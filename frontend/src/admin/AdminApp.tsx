import { useCallback, useEffect, useRef, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';

import type { CapsuleDetail } from '../types';
import { AdminApiError, adminFetch, adminLogout, formatMonth, getToken } from './adminClient';
import { AdminLogin } from './AdminLogin';
import { CapsulePicker } from './CapsulePicker';
import { DetailsPanel, DiscussPanel, FilmPanel, PracticePanel, ReflectPanel } from './panels';
import './admin.css';

type TabId = 'film' | 'reflect' | 'discuss' | 'practice' | 'details';

const TABS: { id: TabId; label: string }[] = [
  { id: 'film', label: 'Film & Video' },
  { id: 'reflect', label: 'Reflect' },
  { id: 'discuss', label: 'Discuss' },
  { id: 'practice', label: 'Practice' },
  { id: 'details', label: 'Details' },
];

const isTabId = (value: string | undefined): value is TabId =>
  TABS.some((tab) => tab.id === value);

/* ------------------------------------------------------------------ theme */
/** Mirrors App.tsx exactly: `data-theme` on <html> + the `lgn_theme` localStorage key. */
function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const params = new URLSearchParams(window.location.search);
    const themeParam =
      params.get('theme') ||
      (params.get('dark') === 'true' || params.get('dark') === '1' ? 'dark' : null);
    if (themeParam === 'dark') return 'dark';
    if (themeParam === 'light') return 'light';
    try {
      const saved = localStorage.getItem('lgn_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      /* storage blocked */
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('lgn_theme', theme);
    } catch {
      /* storage blocked */
    }
  }, [theme]);

  return { theme, toggleTheme: () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light')) };
}

/* -------------------------------------------------------------------- app */
export function AdminApp() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [authState, setAuthState] = useState<'checking' | 'out' | 'in'>(() =>
    getToken() ? 'checking' : 'out'
  );
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const [capsule, setCapsule] = useState<CapsuleDetail | null>(null);
  const [capsuleLoading, setCapsuleLoading] = useState(false);
  const [capsuleError, setCapsuleError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /* ---- routing ---- */
  const tabMatch = useMatch('/admin/capsules/:capsuleId/:tab');
  const capsuleOnlyMatch = useMatch('/admin/capsules/:capsuleId');

  const routeCapsuleId = tabMatch?.params.capsuleId ?? capsuleOnlyMatch?.params.capsuleId;
  const parsedId = routeCapsuleId ? Number(routeCapsuleId) : NaN;
  const capsuleId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;

  const rawTab = tabMatch?.params.tab;
  const activeTab: TabId = isTabId(rawTab) ? rawTab : 'film';

  // Normalise partial / unknown URLs so a refresh always lands somewhere real.
  useEffect(() => {
    if (authState !== 'in' || capsuleId === null) return;
    if (!isTabId(rawTab)) {
      navigate(`/admin/capsules/${capsuleId}/film`, { replace: true });
    }
  }, [authState, capsuleId, rawTab, navigate]);

  /* ---- auth ---- */
  const handleUnauthorized = useCallback(() => {
    adminLogout();
    setCapsule(null);
    setAuthState('out');
    setSessionNotice('Your session expired. Please sign in again.');
  }, []);

  useEffect(() => {
    if (authState !== 'checking') return;
    let cancelled = false;

    (async () => {
      try {
        await adminFetch<{ valid: boolean }>('/api/admin/session');
        if (!cancelled) setAuthState('in');
      } catch (err) {
        if (cancelled) return;
        adminLogout();
        setAuthState('out');
        if (err instanceof AdminApiError && err.status !== 401) {
          setSessionNotice(err.message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authState]);

  const handleSignOut = () => {
    adminLogout();
    setCapsule(null);
    setSessionNotice(null);
    setAuthState('out');
    navigate('/admin/capsules', { replace: true });
  };

  /* ---- capsule detail ---- */
  const loadCapsule = useCallback(
    async (id: number) => {
      setCapsuleLoading(true);
      setCapsuleError(null);
      try {
        const data = await adminFetch<CapsuleDetail>(`/api/admin/capsules/${id}`);
        setCapsule(data);
      } catch (err) {
        setCapsule(null);
        if (err instanceof AdminApiError) {
          if (err.status === 401) {
            handleUnauthorized();
            return;
          }
          if (err.status === 404) {
            navigate('/admin/capsules', { replace: true });
            return;
          }
        }
        setCapsuleError(err instanceof Error ? err.message : 'Could not load that capsule.');
      } finally {
        setCapsuleLoading(false);
      }
    },
    [handleUnauthorized, navigate]
  );

  useEffect(() => {
    if (authState !== 'in') return;
    if (capsuleId === null) {
      setCapsule(null);
      setCapsuleError(null);
      return;
    }
    void loadCapsule(capsuleId);
  }, [authState, capsuleId, loadCapsule]);

  /** Panels call this after a successful write: re-read the capsule and the sidebar list. */
  const handleSaved = useCallback(async () => {
    setRefreshKey((key) => key + 1);
    if (capsuleId !== null) await loadCapsule(capsuleId);
  }, [capsuleId, loadCapsule]);

  const handleSelectCapsule = useCallback(
    (id: number) => {
      navigate(`/admin/capsules/${id}/film`);
    },
    [navigate]
  );

  /* ---- tabs ---- */
  const goToTab = (tab: TabId) => {
    if (capsuleId === null) return;
    navigate(`/admin/capsules/${capsuleId}/${tab}`);
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;

    event.preventDefault();
    tabRefs.current[next]?.focus();
    goToTab(TABS[next].id);
  };

  const renderPanel = () => {
    if (!capsule) return null;
    const props = { capsule, onSaved: handleSaved };
    switch (activeTab) {
      case 'reflect':
        return <ReflectPanel {...props} />;
      case 'discuss':
        return <DiscussPanel {...props} />;
      case 'practice':
        return <PracticePanel {...props} />;
      case 'details':
        return <DetailsPanel {...props} />;
      case 'film':
      default:
        return <FilmPanel {...props} />;
    }
  };

  /* ---- render ---- */
  if (authState === 'checking') {
    return (
      <div className="admin-portal">
        <div className="admin-boot">
          <span className="admin-spinner" aria-hidden="true" />
          <p className="admin-muted">Restoring your session...</p>
        </div>
      </div>
    );
  }

  if (authState === 'out') {
    return (
      <div className="admin-portal">
        {sessionNotice && (
          <p className="admin-session-notice" role="status">
            {sessionNotice}
          </p>
        )}
        <AdminLogin
          onAuthenticated={() => {
            setSessionNotice(null);
            setAuthState('in');
          }}
        />
      </div>
    );
  }

  return (
    <div className="admin-portal">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div className="admin-brand">
            <h1 className="admin-brand-title">Admin Portal</h1>
            <span className="admin-brand-sub">Life is Greater than Numbers</span>
          </div>
          <div className="admin-header-actions">
            <button
              type="button"
              className="admin-btn-ghost"
              onClick={toggleTheme}
              title="Toggle light / dark theme"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
              <span aria-hidden="true">{theme === 'light' ? '☀️' : '🌙'}</span>
              <span>{theme === 'light' ? 'Light' : 'Dark'}</span>
            </button>
            <button type="button" className="admin-btn-ghost" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="admin-body">
        <aside className="admin-sidebar">
          <CapsulePicker
            selectedId={capsuleId}
            onSelect={handleSelectCapsule}
            refreshKey={refreshKey}
            onUnauthorized={handleUnauthorized}
          />
        </aside>

        <main className="admin-main">
          {capsuleId === null ? (
            <div className="admin-card admin-empty">
              <h2 className="admin-section-title">No capsule selected</h2>
              <p className="admin-muted">
                Pick a capsule from the list, or create a new one, to start editing its film,
                reflection, discussion circle, practice and details.
              </p>
            </div>
          ) : (
            <>
              <div className="admin-capsule-head">
                <p className="admin-eyebrow">{capsule ? formatMonth(capsule.month) : ' '}</p>
                <h2 className="admin-capsule-heading">
                  {capsule ? capsule.title || 'Untitled capsule' : 'Loading...'}
                </h2>
                {capsule && (
                  <span className={`admin-status-pill${capsule.is_active ? ' is-live' : ''}`}>
                    <span className="admin-status-dot" aria-hidden="true" />
                    {capsule.is_active ? 'Live' : 'Draft'}
                  </span>
                )}
              </div>

              <div className="admin-tabs" role="tablist" aria-label="Capsule sections">
                {TABS.map((tab, index) => (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabRefs.current[index] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`admin-tab-${tab.id}`}
                    aria-selected={activeTab === tab.id}
                    aria-controls="admin-tabpanel"
                    tabIndex={activeTab === tab.id ? 0 : -1}
                    className={`admin-tab${activeTab === tab.id ? ' is-active' : ''}`}
                    onClick={() => goToTab(tab.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div
                className="admin-panel"
                id="admin-tabpanel"
                role="tabpanel"
                aria-labelledby={`admin-tab-${activeTab}`}
                tabIndex={0}
              >
                {capsuleLoading && !capsule && (
                  <div className="admin-card admin-empty">
                    <span className="admin-spinner" aria-hidden="true" />
                    <p className="admin-muted">Loading capsule...</p>
                  </div>
                )}
                {capsuleError && (
                  <div className="admin-card admin-inline-error" role="alert">
                    {capsuleError}
                    <button
                      type="button"
                      className="admin-btn-ghost admin-btn-sm"
                      onClick={() => void loadCapsule(capsuleId)}
                    >
                      Retry
                    </button>
                  </div>
                )}
                {renderPanel()}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default AdminApp;
