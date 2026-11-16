import { useEffect, useRef, useState, type FormEvent } from 'react';
import './FilmSearch.css';
import { FeedbackDialog } from './FeedbackDialog';
import { searchFilms, type FilmSearchResult } from './beyond';

interface Props {
  onOpenFilm: (tmdbId: number) => void;
  onOpenStory: (capsuleId: number) => void;
  /** On a film's own page: the film on screen, shown in the field. It is not
   *  searched for; the field only starts searching once the visitor edits it. */
  initialQuery?: string;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; query: string; results: FilmSearchResult[]; notice: string | null }
  | { kind: 'error'; message: string };

const DEBOUNCE_MS = 300;

/**
 * "What film did you just watch?" -- the search on the Go Beyond page. Our own
 * stories list first (opening their full page), then any other film from TMDB.
 * Renders into the page's existing `.cf-search` grid, so the field and button
 * keep the frame's positions and the results fall in underneath.
 */
export function FilmSearch({ onOpenFilm, onOpenStory, initialQuery = '' }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const edited = useRef(false);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [notFoundOpen, setNotFoundOpen] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const run = (text: string) => {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setState({ kind: 'loading' });
    searchFilms(text, next.signal)
      .then(({ results, notice }) => setState({ kind: 'done', query: text, results, notice }))
      .catch((err: unknown) => {
        if (next.signal.aborted) return;
        setState({ kind: 'error', message: err instanceof Error ? err.message : 'Search is unavailable right now.' });
      });
  };

  useEffect(() => {
    if (!edited.current) return; // still showing the film on screen, not a search
    window.clearTimeout(timer.current);
    const text = query.trim();
    if (text.length < 2) {
      controller.current?.abort();
      setState({ kind: 'idle' });
      return;
    }
    timer.current = window.setTimeout(() => run(text), DEBOUNCE_MS);
    return () => window.clearTimeout(timer.current);
  }, [query]);

  useEffect(() => () => controller.current?.abort(), []);

  const open = (r: FilmSearchResult) => {
    if (r.source === 'lgn' && r.capsule_id) onOpenStory(r.capsule_id);
    else if (r.tmdb_id) onOpenFilm(r.tmdb_id);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = query.trim();
    if (text.length < 2) return;
    if (state.kind === 'done' && state.query === text && state.results.length === 1) open(state.results[0]);
    else if (!(state.kind === 'done' && state.query === text)) {
      window.clearTimeout(timer.current);
      run(text);
    }
  };

  const results = state.kind === 'done' ? state.results : [];

  return (
    <form className="cf-search" role="search" onSubmit={onSubmit}>
      <input
        className="lgn-field cf-search-field"
        type="search"
        name="film"
        placeholder="What film did you just watch?"
        aria-label="What film did you just watch?"
        autoComplete="off"
        id="film-search-field"
        value={query}
        onChange={(e) => {
          edited.current = true;
          setQuery(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            edited.current = true;
            setQuery('');
          }
        }}
      />
      <button type="submit" className="lgn-btn">Go beyond</button>

      <div className="fs-results" role="status" aria-live="polite">
        {state.kind === 'loading' && <p className="fs-note">Searching…</p>}
        {state.kind === 'error' && <p className="fs-note">{state.message}</p>}
        {state.kind === 'done' && state.notice && <p className="fs-note">{state.notice}</p>}

        {results.length > 0 && (
          <ul className="fs-list">
            {results.map((r) => (
              <li key={`${r.source}-${r.capsule_id ?? r.tmdb_id}`}>
                <button type="button" className="fs-row" onClick={() => open(r)}>
                  {r.poster_url ? (
                    <img className="fs-poster" src={r.poster_url} alt="" loading="lazy" />
                  ) : (
                    <span className="fs-poster fs-poster--none" aria-hidden="true" />
                  )}
                  <span className="fs-title">{r.title}</span>
                  <span className="fs-meta">
                    {r.source === 'lgn' ? 'LGN story' : r.year ?? ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {state.kind === 'done' && results.length === 0 && !state.notice && (
          <p className="fs-note">No film found for “{state.query}”.</p>
        )}
        {state.kind === 'done' && (
          <button type="button" className="cf-how fs-missing" onClick={() => setNotFoundOpen(true)}>
            Can’t find it? Tell us about it.
          </button>
        )}
      </div>

      <FeedbackDialog
        open={notFoundOpen}
        onClose={() => setNotFoundOpen(false)}
        mode="not_found"
        typed={query.trim()}
      />
    </form>
  );
}
