import type { Film, VideoProvider } from './types';

/**
 * Pure, dependency-free source resolution for the video player.
 *
 * Lives outside VideoPlayer.tsx so the component file exports only a component
 * (keeps react-refresh happy) and so these can be unit-tested on their own.
 */

export interface VideoSource {
  provider: VideoProvider;
  /** Provider-native id. Empty string for `file` sources. */
  id: string;
  /** Vimeo private-link hash, when the video is unlisted. */
  hash?: string;
  /** Direct media URL. Only populated for `file` sources. */
  url?: string;
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&quot;': '"',
  '&#34;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&lt;': '<',
  '&gt;': '>',
};

const decodeEntities = (value: string): string =>
  value.replace(/&(?:amp|quot|apos|lt|gt|#34|#39);/g, (m) => HTML_ENTITIES[m] ?? m);

/**
 * Pull a bare URL out of whatever was pasted into `video_url` -- either the URL
 * itself or a full `<iframe ...>` embed snippet (whose `src` is HTML-escaped).
 */
export function extractEmbedUrl(raw: string): string {
  const decoded = decodeEntities(raw.trim());
  const iframeSrc = /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i.exec(decoded);
  return (iframeSrc ? iframeSrc[1] : decoded).trim();
}

/** Parse a raw `video_url` value into a concrete playback source. */
export function parseVideoUrl(raw: string): VideoSource | null {
  const url = extractEmbedUrl(raw);
  if (!url) return null;

  // https://player.vimeo.com/video/1052574030?h=53c90178cb&title=0...
  const vimeoPlayer = /player\.vimeo\.com\/video\/(\d+)/i.exec(url);
  if (vimeoPlayer) {
    return { provider: 'vimeo', id: vimeoPlayer[1], hash: /[?&]h=([A-Za-z0-9]+)/i.exec(url)?.[1] };
  }

  // https://vimeo.com/1052574030/53c90178cb (and channel/group permutations)
  const vimeoCanonical =
    /vimeo\.com\/(?:channels\/[\w-]+\/|groups\/[\w-]+\/videos\/)?(\d+)(?:\/([A-Za-z0-9]+))?/i.exec(
      url,
    );
  if (vimeoCanonical) {
    return {
      provider: 'vimeo',
      id: vimeoCanonical[1],
      hash: vimeoCanonical[2] ?? /[?&]h=([A-Za-z0-9]+)/i.exec(url)?.[1],
    };
  }

  // youtube.com/watch?v=ID, /embed/ID, /shorts/ID, /live/ID, youtu.be/ID
  const youtube =
    /(?:youtube\.com|youtube-nocookie\.com)\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)([A-Za-z0-9_-]{6,})/i.exec(
      url,
    ) ?? /youtu\.be\/([A-Za-z0-9_-]{6,})/i.exec(url);
  if (youtube) return { provider: 'youtube', id: youtube[1] };

  // https://stream.mux.com/PLAYBACK_ID.m3u8
  const mux = /stream\.mux\.com\/([A-Za-z0-9]+)/i.exec(url);
  if (mux) return { provider: 'mux', id: mux[1] };

  // Plain progressive media file.
  if (/\.(?:mp4|webm|ogv|ogg|mov|m4v)(?:[?#]|$)/i.test(url)) {
    return { provider: 'file', id: '', url };
  }

  return null;
}

/**
 * Resolve a `Film` into a playback source. Explicit `video_provider`/`video_id`/
 * `video_hash` columns win; otherwise we fall back to parsing `video_url`.
 */
export function resolveVideoSource(film: Film | null | undefined): VideoSource | null {
  if (!film) return null;

  const provider = film.video_provider;
  const id = film.video_id?.trim() ?? '';
  const hash = film.video_hash?.trim() || undefined;
  const raw = film.video_url?.trim() ?? '';

  if (provider && provider !== 'file' && id) {
    return { provider, id, hash };
  }

  if (provider === 'file') {
    const url = raw ? extractEmbedUrl(raw) : '';
    return url ? { provider: 'file', id: '', url } : null;
  }

  if (!raw) return null;

  const parsed = parseVideoUrl(raw);
  if (!parsed) return null;

  return { ...parsed, hash: hash ?? parsed.hash };
}

/** Poster candidates, best first. The player walks the list on image errors. */
export function posterCandidates(film: Film, source: VideoSource | null): string[] {
  const candidates: string[] = [];
  const thumb = film.thumbnail_url?.trim();
  if (thumb) candidates.push(thumb);
  // No client-side fallback for Vimeo on purpose. A Vimeo poster URL contains an
  // opaque content hash that cannot be derived from the video id, so it has to be
  // fetched from oEmbed -- which the backend does once at write time and stores in
  // thumbnail_url. (Third-party guessers like vumbnail.com only see the id, so for
  // an unlisted film they return a ~3KB placeholder, which is worse than our own
  // fallback card.) If thumbnail_url is empty here, the styled card is correct.
  if (source?.provider === 'youtube') {
    candidates.push(`https://i.ytimg.com/vi/${source.id}/maxresdefault.jpg`);
    candidates.push(`https://i.ytimg.com/vi/${source.id}/hqdefault.jpg`);
  }
  return candidates;
}

/** `5040` -> `1h 24m`, `1080` -> `18 min`. Returns null when unknown. */
export function formatRuntime(seconds: number | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return 'under 1 min';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0) return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
  return `${minutes} min`;
}

export function vimeoEmbedUrl(source: VideoSource, autoplay: boolean): string {
  const params = new URLSearchParams();
  if (source.hash) params.set('h', source.hash);
  params.set('title', '0');
  params.set('byline', '0');
  params.set('portrait', '0');
  params.set('badge', '0');
  params.set('autopause', '0');
  params.set('dnt', '1');
  params.set('autoplay', autoplay ? '1' : '0');
  return `https://player.vimeo.com/video/${source.id}?${params.toString()}`;
}

export function youtubeEmbedUrl(source: VideoSource, autoplay: boolean): string {
  return `https://www.youtube-nocookie.com/embed/${source.id}?autoplay=${autoplay ? '1' : '0'}&rel=0`;
}

/** Public "watch it at the source" URL, used by the blocked-embed fallback. */
export function externalWatchUrl(source: VideoSource): string | null {
  switch (source.provider) {
    case 'vimeo':
      return `https://vimeo.com/${source.id}${source.hash ? `/${source.hash}` : ''}`;
    case 'youtube':
      return `https://www.youtube.com/watch?v=${source.id}`;
    case 'file':
      return source.url ?? null;
    default:
      return null;
  }
}

export const PROVIDER_LABEL: Record<VideoProvider, string> = {
  vimeo: 'Vimeo',
  youtube: 'YouTube',
  mux: 'Mux',
  file: 'the source',
};

/**
 * Hosts worth a connection handshake before the viewer commits to playing.
 * Injected on hover/focus only -- see `warmConnections`.
 */
export const PRECONNECT_HOSTS: Record<VideoProvider, string[]> = {
  vimeo: ['https://player.vimeo.com', 'https://i.vimeocdn.com', 'https://f.vimeocdn.com'],
  youtube: ['https://www.youtube-nocookie.com', 'https://i.ytimg.com'],
  mux: ['https://stream.mux.com'],
  file: [],
};

const warmedHosts = new Set<string>();

/**
 * Inject `<link rel="preconnect">` tags the first time the viewer signals intent
 * (hover / focus / touch). Doing this at mount would spend the very handshake
 * budget the facade exists to protect, so it is deliberately deferred.
 */
export function warmConnections(hosts: string[]): void {
  if (typeof document === 'undefined') return;
  for (const host of hosts) {
    if (warmedHosts.has(host)) continue;
    warmedHosts.add(host);
    const preconnect = document.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = host;
    document.head.appendChild(preconnect);
    const dnsPrefetch = document.createElement('link');
    dnsPrefetch.rel = 'dns-prefetch';
    dnsPrefetch.href = host;
    document.head.appendChild(dnsPrefetch);
  }
}
