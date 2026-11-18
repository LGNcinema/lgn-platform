/**
 * FilmmakerRequestsPanel -- requests from the For Filmmakers page: makers
 * claiming a film's guide (with a link to their work) and cast or crew sharing
 * how it was made. Nothing is public; each request is followed up by hand and
 * marked replied, then closed.
 */
import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '../adminClient';
import { Alert, DeleteControl, Note, PanelHead } from './Fields';

type Status = 'new' | 'replied' | 'closed';

interface FilmmakerRequest {
  id: number;
  film_title: string;
  film_year: string | null;
  capsule_id: number | null;
  role: 'director' | 'writer' | 'producer' | 'cast-crew';
  name: string;
  email: string;
  work_link: string | null;
  message: string | null;
  status: Status;
  admin_note: string | null;
  created_at: string | null;
}

const ROLE_LABEL: Record<FilmmakerRequest['role'], string> = {
  director: 'Director',
  writer: 'Writer',
  producer: 'Producer',
  'cast-crew': 'Cast or crew',
};

const STATUSES: { id: Status; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'replied', label: 'Replied' },
  { id: 'closed', label: 'Closed' },
];

interface Props {
  /** Called after a change, so the sidebar's waiting count refreshes. */
  onReviewed: () => void;
}

export function FilmmakerRequestsPanel({ onReviewed }: Props) {
  const [items, setItems] = useState<FilmmakerRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | 'all'>('new');

  const load = useCallback(async () => {
    try {
      setItems(await adminFetch<FilmmakerRequest[]>('/api/admin/filmmaker-requests'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Requests could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const changed = async () => {
    await load();
    onReviewed();
  };

  const shown = (items ?? []).filter((r) => filter === 'all' || r.status === filter);

  return (
    <div className="apnl">
      <PanelHead
        title="Filmmaker requests"
        description="From the For Filmmakers page. Confirm who sent each one (usually through a public contact for them or the film) before changing a guide."
      />
      <div className="admin-tabs" role="tablist" aria-label="Show">
        {[...STATUSES, { id: 'all' as const, label: 'All' }].map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={filter === s.id}
            className={`admin-tab${filter === s.id ? ' is-active' : ''}`}
            onClick={() => setFilter(s.id)}
          >
            {s.label}
            {s.id !== 'all' && items ? ` (${items.filter((r) => r.status === s.id).length})` : ''}
          </button>
        ))}
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {!items && !error ? <Note>Loading...</Note> : null}
      {items && shown.length === 0 ? <p className="apnl-empty">Nothing here.</p> : null}
      <div className="apnl-list">
        {shown.map((r) => (
          <RequestCard key={r.id} request={r} onChanged={changed} />
        ))}
      </div>
    </div>
  );
}

function RequestCard({ request, onChanged }: { request: FilmmakerRequest; onChanged: () => Promise<void> }) {
  const [note, setNote] = useState(request.admin_note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/filmmaker-requests/${request.id}`, { method: 'PATCH', body });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That change could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/filmmaker-requests/${request.id}`, { method: 'DELETE' });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The request could not be deleted.');
      setBusy(false);
    }
  };

  const when = request.created_at ? new Date(request.created_at).toLocaleDateString() : '';

  return (
    <article className="apnl-item">
      <div className="apnl-item-head">
        <h3 className="apnl-item-name">
          {request.film_title}
          {request.film_year ? ` (${request.film_year})` : ''} · {ROLE_LABEL[request.role]}
        </h3>
        <span className="apnl-item-id">{when}</span>
      </div>
      <dl className="apnl-dl">
        <dt>From</dt>
        <dd>
          {request.name} · <a href={`mailto:${request.email}`}>{request.email}</a>
        </dd>
        {request.capsule_id && (
          <>
            <dt>LGN story</dt>
            <dd>
              <a href={`/admin/capsules/${request.capsule_id}/film`}>Open story {request.capsule_id}</a>
            </dd>
          </>
        )}
        {request.work_link && (
          <>
            <dt>Their work</dt>
            <dd>
              <a href={request.work_link} target="_blank" rel="noopener noreferrer">
                {request.work_link}
              </a>
            </dd>
          </>
        )}
        {request.message && (
          <>
            <dt>Shared</dt>
            <dd style={{ whiteSpace: 'pre-line' }}>{request.message}</dd>
          </>
        )}
      </dl>
      <label className="apnl-field">
        <span className="apnl-label">Note (only admins see this)</span>
        <textarea className="apnl-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
      </label>
      {error ? <Alert>{error}</Alert> : null}
      <div className="apnl-savebar">
        {STATUSES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`apnl-btn${request.status === s.id ? ' apnl-btn--primary' : ''}`}
            disabled={busy || (request.status === s.id && note === (request.admin_note ?? ''))}
            onClick={() => void patch({ status: s.id, admin_note: note.trim() || null })}
          >
            {request.status === s.id ? (note === (request.admin_note ?? '') ? s.label : 'Save note') : `Mark ${s.label.toLowerCase()}`}
          </button>
        ))}
        <DeleteControl
          label="Delete request"
          question={`Delete the request from ${request.name} permanently?`}
          busy={busy}
          onConfirm={() => void remove()}
        />
      </div>
    </article>
  );
}
