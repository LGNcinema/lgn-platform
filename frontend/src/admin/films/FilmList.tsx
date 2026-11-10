/** The films LGN has touched, with one box to find any other film on TMDB and add it. */
import { useEffect, useState, type FormEvent } from 'react';
import type { FilmSearchResult } from '../../components/beyond/beyond';
import { adminFetch } from '../adminClient';
import { Alert } from '../panels/Fields';
import { errorMessage } from '../panels/formState';
import { HANDLING_LABEL, type AdminFilmRow } from './filmsTypes';

export function FilmList({ onOpen }: { onOpen: (tmdbId: number) => void }) {
  const [rows, setRows] = useState<AdminFilmRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<FilmSearchResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);

  useEffect(() => {
    adminFetch<AdminFilmRow[]>('/api/admin/films')
      .then(setRows)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearchError(null);
    try {
      const res = await adminFetch<{ results: FilmSearchResult[] }>(
        `/api/admin/films/search?q=${encodeURIComponent(query.trim())}`,
      );
      setHits(res.results);
    } catch (err) {
      setHits(null);
      setSearchError(errorMessage(err));
    }
  };

  const open = async (tmdbId: number) => {
    setAdding(tmdbId);
    try {
      // Adding a film that is already here just opens it.
      await adminFetch('/api/admin/films', { method: 'POST', body: { tmdb_id: tmdbId } });
      onOpen(tmdbId);
    } catch (err) {
      setSearchError(errorMessage(err));
      setAdding(null);
    }
  };

  const known = new Set((rows ?? []).map((r) => r.tmdb_id));

  return (
    <>
      <form className="fa-search" role="search" onSubmit={(e) => void search(e)}>
        <input
          className="apnl-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search TMDB to add a film"
          aria-label="Search TMDB to add a film"
        />
        <button type="submit" className="apnl-btn apnl-btn--primary">Search</button>
      </form>
      {searchError && <Alert>{searchError}</Alert>}
      {hits && hits.length === 0 && <p className="apnl-empty">No films found.</p>}
      {hits && hits.length > 0 && (
        <ul className="fa-hits">
          {hits.map((h) => (
            <li key={h.tmdb_id}>
              <span>
                {h.title} {h.year ? <span className="admin-muted">({h.year})</span> : null}
              </span>
              <button type="button" className="apnl-btn" disabled={adding !== null} onClick={() => void open(h.tmdb_id as number)}>
                {adding === h.tmdb_id ? 'Opening…' : known.has(h.tmdb_id as number) ? 'Open' : 'Add'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <Alert>{error}</Alert>}
      {rows === null && !error && <p className="admin-muted">Loading…</p>}
      {rows && (
        <p className="fa-count">
          {rows.length === 0
            ? 'No films yet. A film appears here once a visitor opens its page, or when you add it above.'
            : `${rows.length} ${rows.length === 1 ? 'film' : 'films'}. One appears here once a visitor opens its page, or when you add it.`}
        </p>
      )}
      {rows && rows.length > 0 && (
        <ul className="fa-rows">
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" className="fa-row" onClick={() => onOpen(r.tmdb_id)}>
                <span className="fa-row-title">
                  {r.title ?? `Film ${r.tmdb_id}`} {r.year ? <span className="admin-muted">({r.year})</span> : null}
                </span>
                <span className="fa-row-pills">
                  {r.lgn_prompt_count > 0 && <span className="fa-pill fa-pill--on">LGN</span>}
                  {r.handling !== 'normal' && <span className="fa-pill fa-pill--warn">{HANDLING_LABEL[r.handling]}</span>}
                  {r.has_care_note && <span className="fa-pill">Care note</span>}
                  {r.ai_status === 'ready' && <span className="fa-pill">AI draft</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
