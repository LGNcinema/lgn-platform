/**
 * StoryboardPanel -- review what visitors shared on this story's storyboard.
 *
 * Nothing a visitor submits is public until it is approved here. The queue is
 * three lists -- Waiting for review, On the storyboard, Declined -- and every
 * card has one obvious next action, so reviewing is: read, look at the photo,
 * press Approve or Decline. A decision can be reversed from the other lists
 * ("Hide from storyboard", "Approve after all").
 *
 * Memory: the lists carry no images. Each photo is fetched on its own, only for
 * cards actually rendered, and released when the card goes away.
 */
import { useCallback, useEffect, useState } from 'react';
import { AdminApiError, API_URL, adminFetch, getToken } from '../adminClient';
import { Alert, PanelHead } from './Fields';
import type { PanelProps } from './Fields';

type Status = 'pending' | 'approved' | 'declined';

interface Submission {
  id: number;
  capsule_id: number;
  content: string | null;
  author_name: string | null;
  author_location: string | null;
  status: Status;
  /** Always true for new submissions; older ones could opt out. */
  consent_to_share: boolean;
  has_photo: boolean;
  created_at: string | null;
  reviewed_at: string | null;
}

const FILTERS: { id: Status; label: string; empty: string }[] = [
  { id: 'pending', label: 'Waiting for review', empty: 'Nothing is waiting for review. New submissions will appear here.' },
  { id: 'approved', label: 'On the storyboard', empty: 'No stories are on this storyboard yet.' },
  { id: 'declined', label: 'Declined', empty: 'Nothing has been declined.' },
];

/** Naive-UTC timestamps from the API, shown in the reviewer's local time. */
function formatWhen(value: string | null): string {
  if (!value) return '';
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** A submission's photo, fetched with the admin token (an <img src> can't send
 *  one). The object URL is revoked when the card unmounts. */
function ReviewPhoto({ id, name }: { id: number; name: string | null }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    const token = getToken();
    fetch(`${API_URL}/api/admin/storyboard/${id}/photo`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob || cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => {
        /* the card still reads fine without its photo */
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return (
    <span className="apnl-sb-photo">
      {src ? <img src={src} alt={name ? `Photo of ${name}` : 'Submitted photo'} /> : null}
    </span>
  );
}

interface Props extends PanelProps {
  /** Tell the shell a decision was made, so its pending badges refresh. */
  onReviewed: () => void;
}

export function StoryboardPanel({ capsule, onReviewed }: Props) {
  const [filter, setFilter] = useState<Status>('pending');
  const [items, setItems] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setError(null);
      try {
        const data = await adminFetch<Submission[]>(
          `/api/admin/storyboard?capsule_id=${capsule.id}&status_filter=${filter}`,
          { signal },
        );
        setItems(data);
      } catch (err) {
        if (err instanceof AdminApiError && err.aborted) return;
        setError(err instanceof Error ? err.message : 'Could not load submissions.');
      }
    },
    [capsule.id, filter],
  );

  useEffect(() => {
    const controller = new AbortController();
    setItems(null);
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const decide = async (item: Submission, approve: boolean) => {
    setBusyId(item.id);
    setError(null);
    try {
      await adminFetch(`/api/admin/storyboard/${item.id}`, { method: 'PATCH', body: { is_approved: approve } });
      // It now belongs to another list: drop it from this one.
      setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? null);
      onReviewed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That decision could not be saved. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const active = FILTERS.find((f) => f.id === filter)!;

  return (
    <div className="apnl apnl--wide">
      <PanelHead
        title="Storyboard"
        description="What visitors shared about this story. Nothing appears on the public storyboard until you approve it. Every submitter agreed to the storyboard terms before posting."
      />

      <div className="apnl-sb-filters" role="group" aria-label="Show submissions">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`apnl-sb-filter${filter === f.id ? ' is-active' : ''}`}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}

      {items === null && !error && <p className="admin-muted">Loading&hellip;</p>}

      {items !== null && items.length === 0 && <p className="apnl-empty">{active.empty}</p>}

      {items !== null && items.length > 0 && (
        <ul className="apnl-sb-list">
          {items.map((item) => {
            const busy = busyId === item.id;
            return (
              <li key={item.id} className="apnl-sb-card">
                <div className="apnl-sb-who">
                  {item.has_photo ? <ReviewPhoto id={item.id} name={item.author_name} /> : <span className="apnl-sb-photo apnl-sb-photo--none" aria-hidden="true">{item.author_name?.charAt(0).toUpperCase() ?? ''}</span>}
                  <div>
                    <p className="apnl-sb-name">
                      {item.author_name ?? 'Anonymous'}
                      {item.author_location ? <span className="apnl-sb-city"> &middot; {item.author_location}</span> : null}
                    </p>
                    <p className="apnl-sb-when">
                      Submitted {formatWhen(item.created_at)}
                      {item.status !== 'pending' && item.reviewed_at ? <> &middot; reviewed {formatWhen(item.reviewed_at)}</> : null}
                    </p>
                  </div>
                </div>

                <p className="apnl-sb-text">{item.content}</p>

                {!item.consent_to_share && (
                  <p className="apnl-sb-flag">
                    Submitted before sharing required consent, so it never appears publicly, even if approved.
                  </p>
                )}

                <div className="apnl-sb-actions">
                  {item.status === 'pending' && (
                    <>
                      <button type="button" className="apnl-btn apnl-btn--primary" disabled={busy} onClick={() => void decide(item, true)}>
                        Approve
                      </button>
                      <button type="button" className="apnl-btn apnl-btn--ghost" disabled={busy} onClick={() => void decide(item, false)}>
                        Decline
                      </button>
                    </>
                  )}
                  {item.status === 'approved' && (
                    <button type="button" className="apnl-btn apnl-btn--ghost" disabled={busy} onClick={() => void decide(item, false)}>
                      Hide from storyboard
                    </button>
                  )}
                  {item.status === 'declined' && (
                    <button type="button" className="apnl-btn apnl-btn--ghost" disabled={busy} onClick={() => void decide(item, true)}>
                      Approve after all
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
