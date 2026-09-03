import { useCallback, useEffect, useRef, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';

import type { CapsuleDetail } from '../types';
import {
  AdminApiError,
  adminFetch,
  adminLogout,
  formatMonth,
  getToken,
  hasUnsavedChanges,
  onUnauthorized,
} from './adminClient';
import { AdminLogin } from './AdminLogin';
import { CapsulePicker } from './CapsulePicker';
import {
  DetailsPanel,
  DiscussPanel,
  FilmPanel,
  PracticePanel,
  PreviewPanel,
  ReflectPanel,
} from './panels';
import { publicationState } from './publishing';
import { StatusPill } from './StatusPill';
import './admin.css';

type TabId = 'film' | 'reflect' | 'discuss' | 'practice' | 'details' | 'preview';

/**
 * `checking`     -- restoring a stored token
 * `unreachable`  -- the restore request never reached the server; the token is
 *                   still held, because a wifi blip is not a sign-out
 * `out`          -- no session
 * `in`           -- signed in
 */
type AuthState = 'checking' | 'unreachable' | 'out' | 'in';

/** A navigation held back because something on screen has unsaved changes. */
interface PendingNav {
  message: string;
  run: () => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'film', label: 'Film & Video' },
  { id: 'reflect', label: 'Reflect' },
  { id: 'discuss', label: 'Discuss' },
  { id: 'practice', label: 'Practice' },
  { id: 'details', label: 'Details' },
  { id: 'preview', label: 'Preview' },
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

  const [authState, setAuthState] = useState<AuthState>(() => (getToken() ? 'checking' : 'out'));
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  /** A 401 arrived while the portal was in use -- as opposed to never signed in. */
  const [sessionExpired, setSessionExpired] = useState(false);

  const [capsule, setCapsule] = useState<CapsuleDetail | null>(null);
  const [capsuleLoading, setCapsuleLoading] = useState(false);
  const [capsuleError, setCapsuleError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [pendingNav, setPendingNav] = useState<PendingNav | null>(null);

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const stayRef = useRef<HTMLButtonElement | null>(null);

  // A sequence number plus an AbortController: clicking capsule A then B on a
  // slow link must never leave A's content rendered under B's heading.
  const loadSeq = useRef(0);
  const inFlight = useRef<AbortController | null>(null);
  const loadedIdRef = useRef<number | null>(null);

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
  /**
   * Fired for *any* 401, from any request anywhere in the tree. The capsule is
   * deliberately left in state: the panels below keep their drafts, so signing
   * back in returns the user to exactly what they had typed.
   */
  const handleUnauthorized = useCallback(() => {
    adminLogout();
    setSessionExpired(true);
    setSessionNotice('Your session expired. Please sign in again.');
    setAuthState((current) => (current === 'in' ? 'out' : current));
  }, []);

  useEffect(() => onUnauthorized(handleUnauthorized), [handleUnauthorized]);

  useEffect(() => {
    if (authState !== 'checking') return;
    let cancelled = false;

    (async () => {
      try {
        await adminFetch<{ valid: boolean }>('/api/admin/session');
        if (!cancelled) setAuthState('in');
      } catch (err) {
        if (cancelled) return;
        const rejected = err instanceof AdminApiError && err.status === 401;
        if (!rejected) {
          // The request never got an answer (backend restarting, wifi hiccup).
          // The token may still have hours left on it, so keep it and offer a
          // retry rather than quietly throwing a valid session away.
          setSessionNotice(err instanceof Error ? err.message : 'Could not reach the server.');
          setAuthState('unreachable');
          return;
        }
        adminLogout();
        setAuthState('out');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authState]);

  /* ---- unsaved-work guard ---- */
  /**
   * Any in-app navigation that would unmount a panel goes through here. The
   * confirmation is inline (the portal avoids native dialogs); `beforeunload`,
   * installed by the dirty registry itself, covers reloads and tab closes.
   */
  const runGuarded = useCallback((message: string, run: () => void) => {
    if (hasUnsavedChanges()) {
      setPendingNav({ message, run });
      return;
    }
    run();
  }, []);

  useEffect(() => {
    if (pendingNav) stayRef.current?.focus();
  }, [pendingNav]);

  const handleSignOut = () => {
    runGuarded('Signing out will discard them.', () => {
      adminLogout();
      setCapsule(null);
      loadedIdRef.current = null;
      setSessionNotice(null);
      setSessionExpired(false);
      setAuthState('out');
      navigate('/admin/capsules', { replace: true });
    });
  };

  /* ---- capsule detail ---- */
  const loadCapsule = useCallback(
    async (id: number) => {
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      const seq = loadSeq.current + 1;
      loadSeq.current = seq;

      setCapsuleLoading(true);
      setCapsuleError(null);
      try {
        const data = await adminFetch<CapsuleDetail>(`/api/admin/capsules/${id}`, {
          signal: controller.signal,
        });
        if (loadSeq.current !== seq) return;
        setCapsule(data);
      } catch (err) {
        // A superseded load (including the abort we just caused) is not an error.
        if (loadSeq.current !== seq) return;
        if (err instanceof AdminApiError) {
          if (err.status === 401) {
            // Leave `capsule` alone: the panel below is holding unsaved text.
            handleUnauthorized();
            return;
          }
          if (err.status === 404) {
            setCapsule(null);
            navigate('/admin/capsules', { replace: true });
            return;
          }
        }
        setCapsuleError(err instanceof Error ? err.message : 'Could not load that capsule.');
      } finally {
        if (loadSeq.current === seq) setCapsuleLoading(false);
      }
    },
    [handleUnauthorized, navigate],
  );

  useEffect(() => {
    if (authState !== 'in') return;
    if (capsuleId === null) {
      loadedIdRef.current = null;
      setCapsule(null);
      setCapsuleError(null);
      return;
    }
    // Signing back in after an expiry re-runs this effect. Reloading the capsule
    // we already have would remount the panel and destroy the draft we just went
    // to the trouble of preserving, so only a genuinely different id reloads.
    if (loadedIdRef.current === capsuleId) return;
    loadedIdRef.current = capsuleId;
    setCapsule(null);
    setCapsuleError(null);
    void loadCapsule(capsuleId);
  }, [authState, capsuleId, loadCapsule]);

  /** Panels call this after a successful write: re-read the capsule and the sidebar list. */
  const handleSaved = useCallback(async () => {
    setRefreshKey((key) => key + 1);
    if (capsuleId !== null) await loadCapsule(capsuleId);
  }, [capsuleId, loadCapsule]);

  const handleSelectCapsule = useCallback(
    (id: number) => {
      if (id === capsuleId) return;
      runGuarded('Opening another capsule will discard them.', () => {
        navigate(`/admin/capsules/${id}/film`);
      });
    },
    [capsuleId, navigate, runGuarded],
  );

  /* ---- tabs ---- */
  const goToTab = (tab: TabId) => {
    if (capsuleId === null || tab === activeTab) return;
    runGuarded('Switching tabs will discard them.', () => {
      navigate(`/admin/capsules/${capsuleId}/${tab}`);
    });
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

  /**
   * `key={capsule.id}` is not cosmetic. `useEditState` refuses incoming values
   * while a draft is dirty (right for a background refetch), so without a key
   * React would reuse one panel instance across two different capsules and the
   * next save would write capsule A's text onto capsule B.
   */
  const renderPanel = () => {
    if (!capsule) return null;
    const props = { capsule, onSaved: handleSaved };
    switch (activeTab) {
      case 'reflect':
        return <ReflectPanel key={capsule.id} {...props} />;
      case 'discuss':
        return <DiscussPanel key={capsule.id} {...props} />;
      case 'practice':
        return <PracticePanel key={capsule.id} {...props} />;
      case 'details':
        return <DetailsPanel key={capsule.id} {...props} />;
      case 'preview':
        return <PreviewPanel key={capsule.id} {...props} />;
      case 'film':
      default:
        return <FilmPanel key={capsule.id} {...props} />;
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

  if (authState === 'unreachable') {
    return (
      <div className="admin-portal">
        <div className="admin-boot">
          <div className="admin-card admin-empty" role="alert">
            <h2 className="admin-section-title">Could not reach the server</h2>
            <p className="admin-muted">
              {sessionNotice ?? 'The server did not answer.'} Your sign-in has been kept -- this is
              almost always the backend restarting.
            </p>
            <div className="admin-header-actions">
              <button
                type="button"
                className="admin-btn-ghost admin-btn-sm"
                onClick={() => {
                  setSessionNotice(null);
                  setAuthState('checking');
                }}
              >
                Try again
              </button>
              <button
                type="button"
                className="admin-btn-ghost admin-btn-sm"
                onClick={() => {
                  adminLogout();
                  setSessionNotice(null);
                  setAuthState('out');
                }}
              >
                Sign out instead
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // A session that expired mid-edit keeps the whole shell mounted behind the
  // login card, so every unsaved draft survives the round trip.
  const reAuthenticating = authState === 'out' && sessionExpired && capsule !== null;

  if (authState === 'out' && !reAuthenticating) {
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
            setSessionExpired(false);
            setAuthState('in');
          }}
        />
      </div>
    );
  }

  return (
    <div className="admin-portal">
      {/* Always rendered, inert or not: swapping this wrapper in and out would
          remount the panels and lose the drafts it exists to protect. */}
      <div className="admin-shell" inert={reAuthenticating || undefined}>
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

        {pendingNav && (
          <div className="admin-guard" role="alertdialog" aria-label="Unsaved changes">
            <p className="admin-guard-text">
              <strong>You have unsaved changes.</strong> {pendingNav.message}
            </p>
            <div className="admin-guard-actions">
              <button
                type="button"
                ref={stayRef}
                className="admin-btn-ghost admin-btn-sm"
                onClick={() => setPendingNav(null)}
              >
                Stay and keep editing
              </button>
              <button
                type="button"
                className="admin-btn-ghost admin-btn-sm admin-btn-danger"
                onClick={() => {
                  const { run } = pendingNav;
                  setPendingNav(null);
                  run();
                }}
              >
                Discard changes and leave
              </button>
            </div>
          </div>
        )}

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
                  <p className="admin-eyebrow">{capsule ? formatMonth(capsule.month) : ' '}</p>
                  <h2 className="admin-capsule-heading">
                    {capsule ? capsule.title || 'Untitled capsule' : 'Loading...'}
                  </h2>
                  {capsule && (
                    <>
                      <StatusPill state={publicationState(capsule)} />
                      <a
                        className="admin-btn-ghost admin-btn-sm"
                        href="/?view=capsule"
                        target="_blank"
                        rel="noreferrer"
                        title={
                          publicationState(capsule) === 'published'
                            ? 'Open the public site in a new tab. It opens on the newest published capsule; every published capsule is reachable from the month tabs.'
                            : 'This capsule is not published, so the public site will not show it. Use the Preview tab to see it, or publish it from Details.'
                        }
                      >
                        {publicationState(capsule) === 'published' ? 'View on site' : 'View live site'}
                        <span aria-hidden="true"> ↗</span>
                      </a>
                    </>
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

      {reAuthenticating && (
        <div className="admin-relogin" role="dialog" aria-modal="true" aria-label="Session expired">
          <div className="admin-relogin-inner">
            <p className="admin-session-notice" role="status">
              Your session expired. <strong>Nothing you typed has been lost</strong> -- it is still on
              the form behind this card. Sign in again and save it.
            </p>
            <AdminLogin
              onAuthenticated={() => {
                setSessionNotice(null);
                setSessionExpired(false);
                setAuthState('in');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminApp;
