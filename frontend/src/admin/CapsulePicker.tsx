import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CapsuleSummary } from '../types';
import { AdminApiError, adminFetch, formatMonth, nextUnusedMonth } from './adminClient';

interface CapsulePickerProps {
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Bumped by the shell whenever a panel saves, so month/title/status stay in sync. */
  refreshKey?: number;
  onUnauthorized: () => void;
}

/**
 * Two honest buckets. "Live" holds the single published capsule; everything else
 * -- next month's draft, last month's archive -- is one list, because a future
 * capsule is not "archived" and a bucket that can only ever hold one item is not
 * a filter.
 */
type Bucket = 'live' | 'rest';

const BUCKET_LABEL: Record<Bucket, string> = { live: 'Live', rest: 'Drafts & past' };

export function CapsulePicker({ selectedId, onSelect, refreshKey = 0, onUnauthorized }: CapsulePickerProps) {
  const [capsules, setCapsules] = useState<CapsuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState<Bucket>('live');

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

  /**
   * Follow the selection into whichever bucket holds it, so the capsule you are
   * editing never vanishes from the list -- most sharply right after you publish
   * it, when `is_active` flips and it would otherwise filter itself out.
   *
   * Keyed on "which capsule, and is it live", so a plain background refresh does
   * not yank the user out of a bucket they deliberately switched to.
   */
  const followed = useRef('');
  useEffect(() => {
    const selected = capsules.find((c) => c.id === selectedId);
    if (!selected) return;
    const signature = `${selected.id}:${selected.is_active}`;
    if (followed.current === signature) return;
    followed.current = signature;
    setBucket(selected.is_active ? 'live' : 'rest');
  }, [capsules, selectedId]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return capsules;
    return capsules.filter((c) => {
      const haystack = `${c.month ?? ''} ${formatMonth(c.month ?? '')} ${c.title ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [capsules, query]);

  const liveCount = searched.filter((c) => c.is_active).length;
  const restCount = searched.length - liveCount;
  const visible = searched.filter((c) => (bucket === 'live' ? c.is_active : !c.is_active));

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
        body: { month, title, is_active: false },
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
        <button
          type="button"
          className={`admin-bucket${bucket === 'live' ? ' is-active' : ''}`}
          aria-pressed={bucket === 'live'}
          onClick={() => setBucket('live')}
        >
          {BUCKET_LABEL.live} ({liveCount})
        </button>
        <button
          type="button"
          className={`admin-bucket${bucket === 'rest' ? ' is-active' : ''}`}
          aria-pressed={bucket === 'rest'}
          onClick={() => setBucket('rest')}
        >
          {BUCKET_LABEL.rest} ({restCount})
        </button>
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
      {!loading && !error && visible.length === 0 && (
        <p className="admin-muted">
          {query.trim()
            ? 'No capsules match that search.'
            : bucket === 'live'
              ? 'No capsule is live yet. Publish one from its Details tab.'
              : 'No draft or past capsules yet.'}
        </p>
      )}

      <ul className="admin-capsule-list">
        {visible.map((capsule) => (
          <li key={capsule.id}>
            <button
              type="button"
              className={`admin-capsule-row${capsule.id === selectedId ? ' is-selected' : ''}`}
              onClick={() => onSelect(capsule.id)}
              aria-current={capsule.id === selectedId ? 'true' : undefined}
            >
              <span className="admin-capsule-meta">
                <span className="admin-capsule-month">{formatMonth(capsule.month)}</span>
                <span className="admin-capsule-title">{capsule.title || 'Untitled capsule'}</span>
              </span>
              <span className={`admin-status-pill${capsule.is_active ? ' is-live' : ''}`}>
                <span className="admin-status-dot" aria-hidden="true" />
                {capsule.is_active ? 'Live' : 'Draft'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default CapsulePicker;
