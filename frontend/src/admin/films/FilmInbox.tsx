/** Everything visitors send about films. Never shown publicly, never sent to the AI. */
import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '../adminClient';
import { Alert, DeleteControl, PanelHead } from '../panels/Fields';
import { errorMessage } from '../panels/formState';
import type { FeedbackItem } from './filmsTypes';

type Filter = 'new' | 'reviewed' | 'resolved' | 'all';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'all', label: 'All' },
];
const TYPE_LABEL: Record<FeedbackItem['type'], string> = {
  suggestion: 'Suggestion',
  something_off: 'Something off',
  not_found: 'Can’t find it',
};

export function FilmInbox({ onChanged, onOpenFilm }: { onChanged: () => void; onOpenFilm: (tmdbId: number) => void }) {
  const [filter, setFilter] = useState<Filter>('new');
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const query = filter === 'all' ? '' : `?status_filter=${filter}`;
      setItems(await adminFetch<FeedbackItem[]>(`/api/admin/film-feedback${query}`));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [filter]);

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

  return (
    <div className="apnl">
      <PanelHead
        title="Inbox"
        description="What visitors sent about films: suggested questions, things that look off, and films they couldn’t find. Only LGN sees these."
      />
      <div className="fa-filters" role="tablist" aria-label="Filter">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={`admin-tab${filter === f.id ? ' is-active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error && <Alert>{error}</Alert>}
      {items === null ? (
        <p className="admin-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="apnl-empty">Nothing here.</p>
      ) : (
        <div className="apnl-list">
          {items.map((item) => (
            <article key={item.id} className="apnl-item">
              <div className="apnl-item-head">
                <h3 className="apnl-item-name">
                  {TYPE_LABEL[item.type]}
                  {item.film_title ? `: ${item.film_title}` : ''}
                  {item.film_year_typed ? ` (${item.film_year_typed})` : ''}
                </h3>
                <span className="apnl-item-id">
                  {item.created_at ? new Date(`${item.created_at}Z`).toLocaleString() : ''}
                </span>
              </div>
              <p className="fa-meta">
                {item.status !== 'new' && <span className="fa-pill">{item.status}</span>}
                {item.kind && <span className="fa-pill">{item.kind}</span>}
                {item.dimension && <span className="fa-pill">{item.dimension}</span>}
                {item.tmdb_id && (
                  <button type="button" className="apnl-btn apnl-btn--link" onClick={() => onOpenFilm(item.tmdb_id as number)}>
                    Open film
                  </button>
                )}
              </p>
              {item.suggested_text && <blockquote className="fa-quote">{item.suggested_text}</blockquote>}
              {item.message && <p className="fa-text">{item.message}</p>}
              {item.email && (
                <p className="admin-muted">
                  Reply to: <a href={`mailto:${item.email}`}>{item.email}</a>
                </p>
              )}
              <div className="apnl-savebar">
                {item.status !== 'reviewed' && (
                  <button type="button" className="apnl-btn" onClick={() => void setStatus(item, 'reviewed')}>
                    Mark reviewed
                  </button>
                )}
                {item.status !== 'resolved' ? (
                  <button type="button" className="apnl-btn apnl-btn--primary" onClick={() => void setStatus(item, 'resolved')}>
                    Mark resolved
                  </button>
                ) : (
                  <button type="button" className="apnl-btn" onClick={() => void setStatus(item, 'new')}>
                    Reopen
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
    </div>
  );
}
