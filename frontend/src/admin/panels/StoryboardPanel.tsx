/**
 * StoryboardPanel -- review what visitors shared on the storyboard.
 *
 * Two places use it: a story's own Storyboard tab (`capsuleId` set), and the
 * central review page at /admin/storyboard (`capsuleId` null), which lists
 * every story's submissions grouped by story.
 *
 * Nothing a visitor submits is public until it is approved here. Three lists
 * -- Waiting for review, On the storyboard, Declined -- and every card has one
 * obvious next action. Each submission is shown as it will look on the
 * Storyboard, with the reviewer's tools beside it: the Self / Neighbor / World
 * tag (set it before approving), the author's email if they left one, and
 * spam hints worked out by the server.
 *
 * Memory: the lists carry no images. Each photo is fetched on its own, only
 * for cards actually rendered, and released when the card goes away.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CapsuleSummary, Dimension } from '../../types';
import { DIMENSIONS } from '../../components/campfire/campfire';
import { AdminApiError, API_URL, adminFetch, getToken } from '../adminClient';
import { Alert, PanelHead } from './Fields';

type Status = 'pending' | 'approved' | 'declined';

interface Submission {
  id: number;
  capsule_id: number;
  content: string | null;
  author_name: string | null;
  author_location: string | null;
  author_email: string | null;
  status: Status;
  /** Always true for new submissions; older ones could opt out. */
  consent_to_share: boolean;
  has_photo: boolean;
  created_at: string | null;
  reviewed_at: string | null;
  dimension: Dimension | null;
  spam_reasons: string[];
}

const FILTERS: { id: Status; label: string; empty: string }[] = [
  { id: 'pending', label: 'Waiting for review', empty: 'Nothing is waiting for review. New submissions will appear here.' },
  { id: 'approved', label: 'On the storyboard', empty: 'No stories are on the storyboard yet.' },
  { id: 'declined', label: 'Declined', empty: 'Nothing has been declined.' },
];

/** Naive-UTC timestamps from the API, shown in the reviewer's local time. */
function toDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatWhen(value: string | null): string {
  const date = toDate(value);
  return date ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
}

/** "02.15.2027", as the Storyboard card shows it. */
function dotDate(value: string | null): string {
  const d = toDate(value);
  return d ? `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}.${d.getFullYear()}` : '';
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

/** The submission as the public Storyboard card will show it (V3), at half
 *  size. The tag line uses the reviewer's current Self / Neighbor / World
 *  choice, so it shows the result of that choice too. */
function CardPreview({ item, filmTitle }: { item: Submission; filmTitle: string }) {
  const dim = DIMENSIONS.find((d) => d.key === item.dimension)?.label;
  const byline = item.author_name ? [item.author_name, item.author_location].filter(Boolean).join(', ') : 'Anonymous';
  return (
    <div className="apnl-sb-preview" aria-label="How it will look on the Storyboard">
      <p className="apnl-sb-preview-text">{item.content}</p>
      <p className="apnl-sb-preview-byline">
        {byline}
        <br />
        {dotDate(item.created_at)}
      </p>
      <p className="apnl-sb-preview-foot">
        <span>Read more &gt;</span>
        <span>{dim ? `${filmTitle}, ${dim}` : filmTitle}</span>
      </p>
    </div>
  );
}

interface Props {
  /** One story's submissions (its own tab), or null for the Storyboard page. */
  capsuleId: number | null;
  /** Waiting-for-review counts by story, for the Storyboard page's story chips. */
  pendingCounts?: Record<number, number>;
  /** Tell the shell a decision was made, so its pending badges refresh. */
  onReviewed: () => void;
}

export function StoryboardPanel({ capsuleId, pendingCounts = {}, onReviewed }: Props) {
  const [filter, setFilter] = useState<Status>('pending');
  // The Storyboard page can narrow to one story; a story's own tab is already one.
  const [storyFilter, setStoryFilter] = useState<number | null>(null);
  const scopeId = capsuleId ?? storyFilter;
  const [items, setItems] = useState<Submission[] | null>(null);
  const [stories, setStories] = useState<CapsuleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Story titles, for the group headings and the card previews' tag line.
  useEffect(() => {
    let cancelled = false;
    adminFetch<CapsuleSummary[]>('/api/admin/capsules')
      .then((all) => {
        if (!cancelled) setStories(Array.isArray(all) ? all : []);
      })
      .catch(() => {
        /* headings fall back to "Story #id" */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setError(null);
      try {
        const scope = scopeId === null ? '' : `capsule_id=${scopeId}&`;
        const data = await adminFetch<Submission[]>(`/api/admin/storyboard?${scope}status_filter=${filter}`, { signal });
        setItems(data);
      } catch (err) {
        if (err instanceof AdminApiError && err.aborted) return;
        setError(err instanceof Error ? err.message : 'Could not load submissions.');
      }
    },
    [scopeId, filter],
  );

  useEffect(() => {
    const controller = new AbortController();
    setItems(null);
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const titleOf = useMemo(() => new Map(stories.map((s) => [s.id, s.title])), [stories]);
  const storyName = (id: number) => titleOf.get(id) || `Story #${id}`;

  const patch = async (item: Submission, body: { is_approved?: boolean; dimension?: Dimension | null }) => {
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await adminFetch<Submission>(`/api/admin/storyboard/${item.id}`, { method: 'PATCH', body });
      if ('is_approved' in body) {
        // It now belongs to another list: drop it from this one.
        setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? null);
        onReviewed();
      } else {
        setItems((prev) => prev?.map((i) => (i.id === item.id ? updated : i)) ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That change could not be saved. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  /** Declined only (the server refuses anything else), and permanent. */
  const remove = async (item: Submission) => {
    if (!window.confirm('Delete this declined submission permanently? This cannot be undone.')) return;
    setBusyId(item.id);
    setError(null);
    try {
      await adminFetch(`/api/admin/storyboard/${item.id}`, { method: 'DELETE' });
      setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That submission could not be deleted. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const [clearing, setClearing] = useState(false);
  const removeAllDeclined = async () => {
    const n = items?.length ?? 0;
    const where = scopeId === null ? 'across every story' : `for ${storyName(scopeId)}`;
    if (!window.confirm(`Delete all ${n} declined submission${n === 1 ? '' : 's'} ${where} permanently? This cannot be undone.`)) return;
    setClearing(true);
    setError(null);
    try {
      const scope = scopeId === null ? '' : `?capsule_id=${scopeId}`;
      await adminFetch(`/api/admin/storyboard/declined${scope}`, { method: 'DELETE' });
      setItems([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The declined submissions could not be deleted. Please try again.');
    } finally {
      setClearing(false);
    }
  };

  // Grouped by story on the central page; one group on a story's own tab.
  const groups = useMemo(() => {
    if (!items) return [];
    const byStory = new Map<number, Submission[]>();
    for (const item of items) {
      const list = byStory.get(item.capsule_id) ?? [];
      list.push(item);
      byStory.set(item.capsule_id, list);
    }
    return [...byStory.entries()];
  }, [items]);

  const active = FILTERS.find((f) => f.id === filter)!;
  const central = capsuleId === null;
  const totalWaiting = Object.values(pendingCounts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="apnl apnl--wide">
      <PanelHead
        title="Storyboard"
        description={
          central
            ? "Every story's storyboard submissions, grouped by story. Nothing appears on the public Storyboard until you approve it."
            : 'What visitors shared about this story. Nothing appears on the public Storyboard until you approve it. Every submitter agreed to the Storyboard terms before posting.'
        }
      />

      {central && (
        <div className="apnl-sb-filters" role="group" aria-label="Show stories">
          <button
            type="button"
            className={`apnl-sb-filter${storyFilter === null ? ' is-active' : ''}`}
            aria-pressed={storyFilter === null}
            onClick={() => setStoryFilter(null)}
          >
            All stories
            {totalWaiting > 0 && <span className="admin-count">{totalWaiting}</span>}
          </button>
          {stories.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`apnl-sb-filter${storyFilter === s.id ? ' is-active' : ''}`}
              aria-pressed={storyFilter === s.id}
              onClick={() => setStoryFilter(s.id)}
            >
              {s.title || `Story #${s.id}`}
              {pendingCounts[s.id] ? <span className="admin-count">{pendingCounts[s.id]}</span> : null}
            </button>
          ))}
        </div>
      )}

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
        {filter === 'declined' && items !== null && items.length > 0 && (
          <button
            type="button"
            className="apnl-btn apnl-btn--ghost apnl-btn--danger apnl-sb-clear"
            disabled={clearing}
            onClick={() => void removeAllDeclined()}
          >
            {clearing ? 'Deleting…' : `Delete all declined (${items.length})`}
          </button>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      {items === null && !error && <p className="admin-muted">Loading&hellip;</p>}

      {items !== null && items.length === 0 && <p className="apnl-empty">{active.empty}</p>}

      {groups.map(([storyId, list]) => (
        <section key={storyId} className="apnl-sb-group" aria-label={storyName(storyId)}>
          {central && (
            <h3 className="apnl-sb-group-title">
              {storyName(storyId)} <span className="admin-muted">· {list.length}</span>
            </h3>
          )}
          <ul className="apnl-sb-list">
            {list.map((item) => {
              const busy = busyId === item.id;
              return (
                <li key={item.id} className="apnl-sb-card apnl-sb-card--v3">
                  <CardPreview item={item} filmTitle={storyName(item.capsule_id)} />

                  <div className="apnl-sb-review">
                    <div className="apnl-sb-who">
                      {item.has_photo ? (
                        <ReviewPhoto id={item.id} name={item.author_name} />
                      ) : (
                        <span className="apnl-sb-photo apnl-sb-photo--none" aria-hidden="true">
                          {item.author_name?.charAt(0).toUpperCase() ?? ''}
                        </span>
                      )}
                      <div>
                        <p className="apnl-sb-name">
                          {item.author_name ?? 'Anonymous'}
                          {item.author_location ? <span className="apnl-sb-city"> &middot; {item.author_location}</span> : null}
                        </p>
                        <p className="apnl-sb-when">
                          Submitted {formatWhen(item.created_at)}
                          {item.status !== 'pending' && item.reviewed_at ? <> &middot; reviewed {formatWhen(item.reviewed_at)}</> : null}
                        </p>
                        {item.author_email && (
                          <p className="apnl-sb-when">
                            <a href={`mailto:${item.author_email}`}>{item.author_email}</a> (private, for edits)
                          </p>
                        )}
                      </div>
                    </div>

                    {item.spam_reasons.length > 0 && (
                      <p className="apnl-sb-spam">
                        <strong>Possible spam:</strong> {item.spam_reasons.join(' · ')}
                      </p>
                    )}

                    {!item.consent_to_share && (
                      <p className="apnl-sb-flag">
                        Submitted before sharing required consent, so it never appears publicly, even if approved.
                      </p>
                    )}

                    <div className="apnl-sb-dims" role="group" aria-label="Self, Neighbor or World">
                      <span className="apnl-sb-dims-label">Tag</span>
                      {DIMENSIONS.map((d) => (
                        <button
                          key={d.key}
                          type="button"
                          className={`apnl-sb-filter${item.dimension === d.key ? ' is-active' : ''}`}
                          aria-pressed={item.dimension === d.key}
                          disabled={busy}
                          onClick={() => void patch(item, { dimension: item.dimension === d.key ? null : d.key })}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>

                    <div className="apnl-sb-actions">
                      {item.status === 'pending' && (
                        <>
                          <button type="button" className="apnl-btn apnl-btn--primary" disabled={busy} onClick={() => void patch(item, { is_approved: true })}>
                            Approve
                          </button>
                          <button type="button" className="apnl-btn apnl-btn--ghost" disabled={busy} onClick={() => void patch(item, { is_approved: false })}>
                            Decline
                          </button>
                        </>
                      )}
                      {item.status === 'approved' && (
                        <button type="button" className="apnl-btn apnl-btn--ghost" disabled={busy} onClick={() => void patch(item, { is_approved: false })}>
                          Hide from storyboard
                        </button>
                      )}
                      {item.status === 'declined' && (
                        <>
                          <button type="button" className="apnl-btn apnl-btn--ghost" disabled={busy} onClick={() => void patch(item, { is_approved: true })}>
                            Approve after all
                          </button>
                          <button type="button" className="apnl-btn apnl-btn--ghost apnl-btn--danger" disabled={busy} onClick={() => void remove(item)}>
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
