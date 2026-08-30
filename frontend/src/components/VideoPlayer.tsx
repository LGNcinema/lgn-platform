import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Film } from '../types';
import {
  PRECONNECT_HOSTS,
  PROVIDER_LABEL,
  externalWatchUrl,
  formatRuntime,
  posterCandidates,
  resolveVideoSource,
  vimeoEmbedUrl,
  warmConnections,
  youtubeEmbedUrl,
} from '../videoSource';

const DEFAULT_ASPECT_RATIO = '16 / 9';
/** If the embed document has not fired `load` by now, assume it was blocked. */
const EMBED_LOAD_TIMEOUT_MS = 10000;

type Phase = 'idle' | 'active' | 'error';

interface Props {
  film: Film;
  className?: string;
}

/**
 * Facade-loaded, provider-agnostic player.
 *
 * Nothing from the video provider is fetched on page load: we paint a poster and
 * an accessible play button, warm the provider's connections on hover/focus, and
 * only mount the real player (with autoplay) once the viewer clicks. One click
 * both mounts and starts playback.
 */
export const VideoPlayer: React.FC<Props> = ({ film, className }) => {
  const source = useMemo(() => resolveVideoSource(film), [film]);
  const posters = useMemo(() => posterCandidates(film, source), [film, source]);

  const [phase, setPhase] = useState<Phase>('idle');
  const [embedLoaded, setEmbedLoaded] = useState(false);
  const [posterIndex, setPosterIndex] = useState(0);
  const warmedRef = useRef(false);

  // Reset transient state whenever the film itself changes.
  useEffect(() => {
    setPhase('idle');
    setEmbedLoaded(false);
    setPosterIndex(0);
    warmedRef.current = false;
  }, [film.id]);

  const warm = useCallback(() => {
    if (warmedRef.current || !source) return;
    warmedRef.current = true;
    warmConnections(PRECONNECT_HOSTS[source.provider]);
  }, [source]);

  const activate = useCallback(() => {
    warm();
    setEmbedLoaded(false);
    setPhase('active');
  }, [warm]);

  const retry = useCallback(() => {
    setEmbedLoaded(false);
    setPhase('idle');
  }, []);

  const isEmbed = source?.provider === 'vimeo' || source?.provider === 'youtube';

  // A blocked iframe (extension, CSP, embed disabled) never fires `load`; treat
  // a long silence as failure rather than leaving a dead black box on screen.
  useEffect(() => {
    if (phase !== 'active' || embedLoaded || !isEmbed) return;
    const timer = window.setTimeout(() => setPhase('error'), EMBED_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [phase, embedLoaded, isEmbed]);

  // The facade click is the user gesture, so this play() is allowed to start.
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    if (!el) return;
    const started = el.play();
    if (started && typeof started.catch === 'function') {
      // An autoplay rejection just leaves the native controls waiting for a tap.
      started.catch(() => undefined);
    }
  }, []);

  const aspectRatio = film.video_aspect_ratio?.trim() || DEFAULT_ASPECT_RATIO;
  const frameStyle: React.CSSProperties = { aspectRatio };
  const rootClass = ['video-player', 'video-wrapper', className].filter(Boolean).join(' ');
  const runtime = formatRuntime(film.video_duration_seconds);
  const poster = posters[posterIndex] ?? null;
  const watchUrl = source ? externalWatchUrl(source) : null;

  /* ---- No resolvable source -------------------------------------- */
  if (!source) {
    return (
      <div className={`${rootClass} video-player--empty`} style={frameStyle}>
        <div className="video-status">
          <p className="video-status-title">No film loaded yet</p>
          <p className="video-status-text">
            This capsule&rsquo;s screening hasn&rsquo;t been published. Check back shortly.
          </p>
        </div>
      </div>
    );
  }

  /* ---- Embed blocked / failed ------------------------------------ */
  if (phase === 'error') {
    return (
      <div className={`${rootClass} video-player--empty`} style={frameStyle}>
        <div className="video-status">
          <p className="video-status-title">The player couldn&rsquo;t load</p>
          <p className="video-status-text">
            A browser extension or network policy may be blocking {PROVIDER_LABEL[source.provider]}.
          </p>
          <div className="video-status-actions">
            <button type="button" className="video-status-btn" onClick={retry}>
              Try again
            </button>
            {watchUrl && (
              <a
                className="video-status-link"
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Watch on {PROVIDER_LABEL[source.provider]} &#8599;
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---- Mux: intentionally unimplemented -------------------------- */
  if (source.provider === 'mux') {
    // A real Mux branch needs either `@mux/mux-player-react` or an `hls.js`
    // <video> source pointed at https://stream.mux.com/{playbackId}.m3u8.
    // Both are dependencies this project does not carry, so rather than ship
    // something that silently fails we say so plainly.
    return (
      <div className={`${rootClass} video-player--empty`} style={frameStyle}>
        <div className="video-status">
          <p className="video-status-title">Playback not yet configured</p>
          <p className="video-status-text">
            This film is hosted on Mux, which this player doesn&rsquo;t support yet.
          </p>
        </div>
      </div>
    );
  }

  /* ---- Playing --------------------------------------------------- */
  if (phase === 'active') {
    if (source.provider === 'file') {
      return (
        <div className={rootClass} style={frameStyle}>
          <video
            ref={attachVideo}
            className="screen-video"
            src={source.url}
            poster={poster ?? undefined}
            controls
            playsInline
            preload="none"
            onError={() => setPhase('error')}
          >
            {film.captions_url && (
              <track kind="captions" src={film.captions_url} srcLang="en" label="Captions" default />
            )}
          </video>
        </div>
      );
    }

    const embedUrl =
      source.provider === 'vimeo' ? vimeoEmbedUrl(source, true) : youtubeEmbedUrl(source, true);

    return (
      <div className={rootClass} style={frameStyle}>
        {!embedLoaded && (
          <div className="video-status video-status--loading" aria-hidden="true">
            <span className="video-spinner" />
          </div>
        )}
        <iframe
          className="video-embed-frame"
          src={embedUrl}
          title={film.title}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setEmbedLoaded(true)}
          onError={() => setPhase('error')}
        />
      </div>
    );
  }

  /* ---- Idle facade ----------------------------------------------- */
  return (
    <div className={rootClass} style={frameStyle}>
      <button
        type="button"
        className="video-facade"
        aria-label={`Play ${film.title}`}
        onClick={activate}
        onPointerEnter={warm}
        onFocus={warm}
        onTouchStart={warm}
      >
        <span className="video-facade-media">
          {poster ? (
            <img
              className="video-facade-poster"
              src={poster}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setPosterIndex((i) => i + 1)}
            />
          ) : (
            <span className="video-facade-fallback">
              <span className="video-facade-fallback-title">{film.title}</span>
            </span>
          )}
        </span>
        <span className="play-trigger-btn" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        {runtime && <span className="video-runtime-badge">{runtime}</span>}
      </button>
    </div>
  );
};

export default VideoPlayer;
