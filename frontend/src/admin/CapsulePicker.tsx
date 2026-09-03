import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CapsuleSummary } from '../types';
import { AdminApiError, adminFetch, formatMonth, nextUnusedMonth } from './adminClient';
import { currentCapsuleId, publicationState } from './publishing';
import type { PublicationState } from './publishing';
import { StatusPill } from './StatusPill';

interface CapsulePickerProps {
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Bumped by the shell whenever a panel saves, so month/title/status stay in sync. */
  refreshKey?: number;
  onUnauthorized: () => void;
}

/**
 * One bucket per publication state, because all three can now hold several
 * capsules: publishing is no longer exclusive, so "Published" is a real list
 * rather than a bucket that can only ever contain one row. "Scheduled" earns its
 * own bucket because it is the one state that changes without anybody touching
 * the portal.
 */
type Bucket = 'published' | 'scheduled' | 'drafts';

const BUCKET_LABEL: Record<Bucket, string> = {
  published: 'Published',
  scheduled: 'Scheduled',
  drafts: 'Drafts',
};

/** A capsule whose scheduled time has elapsed (`due`) belongs with the published. */
function bucketFor(state: PublicationState): Bucket {
  if (state === 'published' || state === 'due') return 'published';
  if (state === 'scheduled') return 'scheduled';
  return 'drafts';
}

export function CapsulePicker({ selectedId, onSelect, refreshKey = 0, onUnauthorized }: CapsulePickerProps) {
  const [capsules, setCapsules] = useState<CapsuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState<Bucket>('published');

  const [creating, setCreating] = useState(false);
  const [newMonth, setNewMonth] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const monthHelpId = useId();

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await adminFetch<CapsuleSummary[]>('/api/admin/capsules');
      setCapsules(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        onUnauthorized();
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not load capsules.');
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  /** Publication state per capsule, computed once per list render. */
  const states = useMemo(() => {
    const now = Date.now();
    const map = new Map<number, PublicationState>();
    for (const capsule of capsules) map.set(capsule.id, publicationState(capsule, now));
    return map;
  }, [capsules]);

  /**
   * The capsule the public site opens on: the published one with the newest
   * month. Computed over the whole list, never the filtered one, so searching
   * cannot move the marker onto a different row.
   */
  const currentId = useMemo(() => currentCapsuleId(capsules), [capsules]);

  /**
   * Follow the selection into whichever bucket holds it, so the capsule you are
   * editing never vanishes from the list -- most sharply right after you publish
   * or schedule it, when it would otherwise filter itself out from under you.
   *
   * Keyed on "which capsule, and in what state", so a plain background refresh
   * does not yank the user out of a bucket they deliberately switched to.
   */
  const followed = useRef('');
  useEffect(() => {
    const selected = capsules.find((c) => c.id === selectedId);
    if (!selected) return;
    const state = states.get(selected.id) ?? 'draft';
    const signature = `${selected.id}:${state}`;
    if (followed.current === signature) return;
    followed.current = signature;
    setBucket(bucketFor(state));
  }, [capsules, selectedId, states]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return capsules;
    return capsules.filter((c) => {
      const haystack = `${c.month ?? ''} ${formatMonth(c.month ?? '')} ${c.title ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [capsules, query]);

  const counts = useMemo(() => {
    const tally: Record<Bucket, number> = { published: 0, scheduled: 0, drafts: 0 };
    for (const capsule of searched) tally[bucketFor(states.get(capsule.id) ?? 'draft')] += 1;
    return tally;
  }, [searched, states]);

  const visible = searched.filter(
    (c) => bucketFor(states.get(c.id) ?? 'draft') === bucket,
  );

  const openCreate = () => {
    setNewMonth(nextUnusedMonth(capsules.map((c) => c.month)));
    setNewTitle('');
    setCreateError(null);
    setCreating(true);
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const month = newMonth.trim();
    const title = newTitle.trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      setCreateError('Month is required, in YYYY-MM form (for example 2026-09).');
      return;
    }
    if (!title) {
      setCreateError('Title is required.');
      return;
    }

    setSaving(true);
    setCreateError(null);
    try {
      const created = await adminFetch<{ id: number }>('/api/admin/capsules', {
        method: 'POST',
        body: { month, title, is_active: false, publish_at: null },
      });
      setCreating(false);
      await load();
      if (created && typeof created.id === 'number') {
        // The bucket follows the selection on its own (see the effect above).
        onSelect(created.id);
      }
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        onUnauthorized();
        return;
      }
      setCreateError(err instanceof Error ? err.message : 'Could not create the capsule.');
    } finally {
      setSaving(false);
    }
  };

  const emptyMessage = (() => {
    if (query.trim()) return 'No capsules match that search.';
    if (bucket === 'published') return 'Nothing is published yet. Publish a capsule from its Details tab.';
    if (bucket === 'scheduled') return 'Nothing is scheduled. Set a go-live time on the Details tab of any capsule.';
    return 'No drafts. Every capsule is published or scheduled.';
  })();

  return (
    <section className="admin-picker" aria-label="Capsules">
      <div className="admin-picker-head">
        <h2 className="admin-section-title">Capsules</h2>
        <button type="button" className="admin-btn-primary admin-btn-sm" onClick={openCreate}>
          + New capsule
        </button>
      </div>

      {creating && (
        <form className="admin-create-form" onSubmit={handleCreate}>
          <label className="admin-field">
            <span className="admin-field-label">Month</span>
            <input
              className="admin-input"
              type="month"
              value={newMonth}
              disabled={saving}
              onChange={(e) => setNewMonth(e.target.value)}
              placeholder="2026-09"
              pattern="\d{4}-\d{2}"
              aria-describedby={monthHelpId}
              required
              aria-required="true"
            />
            {/* Firefox and Safari fall back to a plain text box for type=month,
                with no picker at all -- so the expected shape has to be visible
                before anyone types, not only in an error after a failed save. */}
            <span className="admin-field-help" id={monthHelpId}>
              Format YYYY-MM, e.g. 2026-09. One capsule per month.
            </span>
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Title</span>
            <input
              className="admin-input"
              type="text"
              value={newTitle}
              disabled={saving}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Capsule title"
              required
              aria-required="true"
            />
          </label>
          {createError && <p className="admin-inline-error" role="alert">{createError}</p>}
          <div className="admin-create-actions">
            <button type="submit" className="admin-btn-primary admin-btn-sm" disabled={saving}>
              {saving ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              className="admin-btn-ghost admin-btn-sm"
              disabled={saving}
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <input
        className="admin-input admin-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search month or title"
        aria-label="Search capsules"
      />

      <div className="admin-bucket-toggle" role="group" aria-label="Capsule status filter">
        {(['published', 'scheduled', 'drafts'] as Bucket[]).map((id) => (
          <button
            key={id}
            type="button"
            className={`admin-bucket${bucket === id ? ' is-active' : ''}`}
            aria-pressed={bucket === id}
            onClick={() => setBucket(id)}
          >
            {BUCKET_LABEL[id]} ({counts[id]})
          </button>
        ))}
      </div>

      {loading && <p className="admin-muted">Loading capsules...</p>}
      {!loading && error && (
        <div className="admin-inline-error" role="alert">
          {error}
          <button type="button" className="admin-btn-ghost admin-btn-sm" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}
      {!loading && !error && visible.length === 0 && <p className="admin-muted">{emptyMessage}</p>}

      {!loading && !error && bucket === 'published' && visible.length > 1 && (
        <p className="admin-field-help">
          Several capsules are published. The site opens on the newest month -- marked{' '}
          <em>Current</em> -- and the rest stay reachable from the month tabs.
        </p>
      )}

      <ul className="admin-capsule-list">
        {visible.map((capsule) => {
          const state = states.get(capsule.id) ?? 'draft';
          const isCurrent = capsule.id === currentId;
          return (
            <li key={capsule.id}>
              <button
                type="button"
                className={`admin-capsule-row${capsule.id === selectedId ? ' is-selected' : ''}`}
                onClick={() => onSelect(capsule.id)}
                aria-current={capsule.id === selectedId ? 'true' : undefined}
              >
                <span className="admin-capsule-meta">
                  <span className="admin-capsule-month">
                    {formatMonth(capsule.month)}
                    {isCurrent ? (
                      <span
                        className="admin-current-badge"
                        title="The newest published capsule -- the one the public site opens on."
                      >
                        Current
                      </span>
                    ) : null}
                  </span>
                  <span className="admin-capsule-title">{capsule.title || 'Untitled capsule'}</span>
                </span>
                <StatusPill state={state} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default CapsulePicker;
