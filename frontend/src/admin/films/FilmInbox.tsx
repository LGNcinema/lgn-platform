/**
 * Everything visitors send about films: suggested questions, things that look
 * off, films they couldn't find. Never shown publicly, never sent to the AI.
 * A note is either open or done: one click to move it between them.
 */
import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '../adminClient';
import { Alert, DeleteControl } from '../panels/Fields';
import { errorMessage } from '../panels/formState';
import type { FeedbackItem } from './filmsTypes';

type Filter = 'open' | 'done' | 'all';

const TYPE_LABEL: Record<FeedbackItem['type'], string> = {
  suggestion: 'Suggestion',
  something_off: 'Something off',
  not_found: 'Can’t find it',
};

// "reviewed" still exists in the API; here it simply counts as still open.
const isDone = (item: FeedbackItem) => item.status === 'resolved';

export function FilmInbox({ onChanged, onOpenFilm }: { onChanged: () => void; onOpenFilm: (tmdbId: number) => void }) {
  const [filter, setFilter] = useState<Filter>('open');
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await adminFetch<FeedbackItem[]>('/api/admin/film-feedback'));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (run: () => Promise<unknown>) => {
    try {
      await run();
      await load();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const setStatus = (item: FeedbackItem, status: FeedbackItem['status']) =>
    act(() => adminFetch(`/api/admin/film-feedback/${item.id}`, { method: 'PATCH', body: { status } }));

  const open = (items ?? []).filter((i) => !isDone(i));
  const shown = filter === 'all' ? items ?? [] : filter === 'open' ? open : (items ?? []).filter(isDone);
  const filters: { id: Filter; label: string }[] = [
    { id: 'open', label: `Open${items ? ` (${open.length})` : ''}` },
    { id: 'done', label: 'Done' },
    { id: 'all', label: 'All' },
  ];

  return (
    <>
      <p className="admin-muted">What visitors sent about films. Only LGN sees these.</p>
      <div className="fa-filters" role="group" aria-label="Show">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            className={`admin-tab${filter === f.id ? ' is-active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error && <Alert>{error}</Alert>}
      {items === null && !error ? (
        <p className="admin-muted">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="apnl-empty">{filter === 'open' ? 'Nothing waiting.' : 'Nothing here.'}</p>
      ) : (
        <div className="apnl-list">
          {shown.map((item) => (
            <article key={item.id} className="apnl-item">
              <p className="fa-note-head">
                <strong>{TYPE_LABEL[item.type]}</strong>
                {item.film_title && (
                  <>
                    {' · '}
                    {item.tmdb_id ? (
                      <button type="button" className="apnl-btn apnl-btn--link" onClick={() => onOpenFilm(item.tmdb_id as number)}>
                        {item.film_title}
                      </button>
                    ) : (
                      item.film_title
                    )}
                    {item.film_year_typed ? ` (${item.film_year_typed})` : ''}
                  </>
                )}
                <span className="admin-muted fa-note-date">
                  {item.created_at ? new Date(`${item.created_at}Z`).toLocaleDateString() : ''}
                </span>
              </p>
              {(item.kind || item.dimension) && (
                <p className="admin-muted">{[item.kind, item.dimension].filter(Boolean).join(' · ')}</p>
              )}
              {item.suggested_text && <blockquote className="fa-quote">{item.suggested_text}</blockquote>}
              {item.message && <p className="fa-text">{item.message}</p>}
              {item.email && (
                <p className="admin-muted">
                  Reply to <a href={`mailto:${item.email}`}>{item.email}</a>
                </p>
              )}
              <div className="apnl-savebar">
                {isDone(item) ? (
                  <button type="button" className="apnl-btn" onClick={() => void setStatus(item, 'new')}>Reopen</button>
                ) : (
                  <button type="button" className="apnl-btn apnl-btn--primary" onClick={() => void setStatus(item, 'resolved')}>
                    Mark done
                  </button>
                )}
                <span className="apnl-spacer" />
                <DeleteControl
                  label="Delete"
                  question="Delete this permanently?"
                  busy={false}
                  onConfirm={() => void act(() => adminFetch(`/api/admin/film-feedback/${item.id}`, { method: 'DELETE' }))}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
