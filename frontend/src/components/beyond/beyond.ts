/**
 * Beyond the Screen: search any film, then Reflect and Practice on it.
 * Types and API calls for /api/films/*. The film's details come live from
 * TMDB through our server; nothing about a film is kept in the browser except
 * the visitor's own answers (see ReflectSections: on this device only).
 */
import { API_URL } from '../../api';
import type { Dimension } from '../../types';

export type PromptKind = 'reflect' | 'practice';
export type PromptSource = 'universal' | 'lgn' | 'ai';
export type AiStatus = 'none' | 'pending' | 'ready' | 'unavailable' | 'failed';

export interface FilmSearchResult {
  tmdb_id: number | null;
  title: string;
  year: number | null;
  poster_url: string | null;
  source: 'lgn' | 'tmdb';
  capsule_id: number | null;
}

export interface FilmDetail {
  tmdb_id: number;
  title: string;
  year: number | null;
  runtime: number | null;
  director: string | null;
  cast: string[];
  genres: string[];
  poster_url: string | null;
  /** The Watch tab's picture, a still from TMDB. null: use the poster. */
  still_url: string | null;
  handling: 'normal' | 'universal_only' | 'held';
  care_note: string | null;
  logline: string | null;
  lgn_capsule_id: number | null;
}

export interface FilmPrompt {
  id: number;
  kind: PromptKind;
  dimension: Dimension;
  position: number;
  title: string | null;
  content: string | null;
  steps: string | null;
  tips: string | null;
}

export interface PromptSet {
  reflect: FilmPrompt[];
  practice: FilmPrompt[];
}

export interface FilmPromptsResponse {
  handling: FilmDetail['handling'];
  default_sources: Record<PromptKind, 'universal' | 'lgn'>;
  /** Per kind: LGN's own set if it has one (and then the only one), else the universal set. */
  default: PromptSet;
  /** The one alternative, for kinds LGN has not written yet. Empty for kinds it has. */
  ai: PromptSet | null;
  ai_status: AiStatus;
}

export class FilmApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new FilmApiError('Could not reach the server. Please try again.', 0);
  }
  if (!res.ok) {
    let detail = '';
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? '';
    } catch {
      /* not JSON */
    }
    throw new FilmApiError(
      typeof detail === 'string' && detail ? detail : `Something went wrong (${res.status}).`,
      res.status,
    );
  }
  return res.json() as Promise<T>;
}

export const searchFilms = (q: string, signal?: AbortSignal) =>
  request<{ results: FilmSearchResult[]; notice: string | null }>(
    `/api/films/search?q=${encodeURIComponent(q)}`,
    { signal },
  );

export const fetchFilm = (tmdbId: number, signal?: AbortSignal) =>
  request<FilmDetail>(`/api/films/${tmdbId}`, { signal });

export const fetchFilmPrompts = (tmdbId: number, signal?: AbortSignal) =>
  request<FilmPromptsResponse>(`/api/films/${tmdbId}/prompts`, { signal });

export interface WatchGroup {
  kind: 'stream' | 'free' | 'ads' | 'rent' | 'buy';
  label: string;
  providers: string[];
}

/** Where a film can be watched in one region. TMDB's data, which TMDB sources
 *  from JustWatch: anything that shows it must credit JustWatch. */
export interface FilmWatch {
  region: string;
  available: boolean;
  /** TMDB's own page for the film. One link for every provider. */
  link: string;
  groups: WatchGroup[];
}

export const fetchFilmWatch = (tmdbId: number, region: string, signal?: AbortSignal) =>
  request<FilmWatch>(`/api/films/${tmdbId}/watch?region=${encodeURIComponent(region)}`, { signal });

/** The visitor's country for "where to watch": the region in their browser's
 *  language ("en-GB" -> GB), else the US. Never sent anywhere but our own API. */
export function visitorRegion(): string {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const region = /^[a-z]{2,3}-([A-Za-z]{2})\b/.exec(tag ?? '')?.[1];
    if (region) return region.toUpperCase();
  }
  return 'US';
}

export const fetchUniversalPrompts = (signal?: AbortSignal) =>
  request<PromptSet>('/api/films/universal-prompts', { signal });

/** Asks the server to write this film's AI questions if it should. Resolves
 *  once the server is done (it may take several seconds). */
export const startFilmAi = (tmdbId: number) =>
  request<{ ai_status: AiStatus }>(`/api/films/${tmdbId}/ai`, { method: 'POST' });

export interface FeedbackPayload {
  type: 'suggestion' | 'something_off' | 'not_found';
  tmdb_id?: number;
  film_title?: string;
  kind?: PromptKind;
  dimension?: Dimension;
  message?: string;
  suggested_text?: string;
  film_year_typed?: string;
  email?: string;
  /** Honeypot: stays empty for real visitors. */
  website?: string;
}

export const sendFilmFeedback = (payload: FeedbackPayload) =>
  request<{ ok: boolean }>('/api/submissions/film-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

/** "2001 · Hayao Miyazaki · 2h 5m" -- whatever of it we have. */
export function filmFacts(film: Pick<FilmDetail, 'year' | 'director' | 'runtime'>): string {
  const runtime = film.runtime
    ? film.runtime >= 60
      ? `${Math.floor(film.runtime / 60)}h ${film.runtime % 60}m`
      : `${film.runtime} min`
    : null;
  return [film.year, film.director, runtime].filter(Boolean).join(' · ');
}
