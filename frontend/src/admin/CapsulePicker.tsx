import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CapsuleSummary } from '../types';
import { AdminApiError, adminFetch, formatMonth, nextUnusedMonth } from './adminClient';

interface CapsulePickerProps {
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Bumped by the shell whenever a panel saves, so month/title/status stay in sync. */
  refreshKey?: number;
  onUnauthorized: () => void;
}

export function CapsulePicker({ selectedId, onSelect, refreshKey = 0, onUnauthorized }: CapsulePickerProps) {
  const [capsules, setCapsules] = useState<CapsuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState<'active' | 'archived'>('active');

  const [creating, setCreating] = useState(false);
  const [newMonth, setNewMonth] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return capsules;
    return capsules.filter((c) => {
      const haystack = `${c.month ?? ''} ${formatMonth(c.month ?? '')} ${c.title ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [capsules, query]);

  const activeCount = searched.filter((c) => c.is_active).length;
  const archivedCount = searched.length - activeCount;
  const visible = searched.filter((c) => (bucket === 'active' ? c.is_active : !c.is_active));

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
      setCreateError('Month is required, in YYYY-MM form.');
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
        setBucket('archived'); // new capsules start as drafts
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
              required
            />
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
          className={`admin-bucket${bucket === 'active' ? ' is-active' : ''}`}
          aria-pressed={bucket === 'active'}
          onClick={() => setBucket('active')}
        >
          Active ({activeCount})
        </button>
        <button
          type="button"
          className={`admin-bucket${bucket === 'archived' ? ' is-active' : ''}`}
          aria-pressed={bucket === 'archived'}
          onClick={() => setBucket('archived')}
        >
          Archived ({archivedCount})
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
          {query.trim() ? 'No capsules match that search.' : `No ${bucket} capsules yet.`}
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
