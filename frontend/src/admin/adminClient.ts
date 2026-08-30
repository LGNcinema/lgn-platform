/**
 * Tiny fetch wrapper for the LGN admin API.
 *
 * The admin session token lives in `sessionStorage` (NOT `localStorage`) so an
 * admin session dies with the browser session. Every storage access is guarded
 * because `sessionStorage` throws outright in some privacy / sandbox modes; an
 * in-memory fallback keeps the portal usable for the life of the page there.
 *
 * Two small registries also live here, because both halves of the portal (the
 * shell and the panels) already import this module and neither imports the
 * other:
 *   - an "unauthorized" broadcast, so a 401 from *any* request can drop the
 *     shell back to the login screen instead of dying as one inline error, and
 *   - a shared dirty registry, so the shell knows whether any panel is holding
 *     unsaved work (and so one `beforeunload` handler can warn on tab close).
 */

export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const TOKEN_KEY = 'lgn_admin_token';

/**
 * Every request gets this long before it is aborted. The film PUT makes a
 * synchronous Vimeo oEmbed call with its own ~5s budget, so this has headroom.
 */
export const ADMIN_TIMEOUT_MS = 20000;

/** Used only when `sessionStorage` is unavailable (privacy mode, sandboxed iframe). */
let memoryToken: string | null = null;

export class AdminApiError extends Error {
  status: number;

  /** True when the request never completed because it was cancelled or timed out. */
  aborted: boolean;

  constructor(message: string, status: number, aborted = false) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.aborted = aborted;
  }
}

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

export function setToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token === null) {
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
    }
  } catch {
    /* storage blocked -- the in-memory copy above is the fallback */
  }
}

/* ---------------------------------------------------------------------------
 * Unauthorized broadcast
 * `adminFetch` clears the token on a 401, but only the shell can decide what to
 * show afterwards. Panels deep in the tree would otherwise sit on a dead token
 * forever, failing every save with a red inline error and never surfacing the
 * login screen again.
 * ------------------------------------------------------------------------- */

type Listener = () => void;

const unauthorizedListeners = new Set<Listener>();

/** Subscribe to "a request came back 401". Returns an unsubscribe function. */
export function onUnauthorized(callback: Listener): () => void {
  unauthorizedListeners.add(callback);
  return () => {
    unauthorizedListeners.delete(callback);
  };
}

function notifyUnauthorized(): void {
  // Copy first: a listener is allowed to unsubscribe itself while we iterate.
  for (const listener of [...unauthorizedListeners]) {
    try {
      listener();
    } catch {
      /* one bad subscriber must not break the request that triggered it */
    }
  }
}

/* ---------------------------------------------------------------------------
 * Dirty registry
 * Every editable form registers itself under a stable key while it holds
 * unsaved changes. The shell reads `hasUnsavedChanges()` before it navigates,
 * and a single `beforeunload` handler is installed for as long as anything is
 * dirty (and removed the moment nothing is).
 * ------------------------------------------------------------------------- */

const dirtyKeys = new Set<string>();
const dirtyListeners = new Set<Listener>();

let beforeUnloadInstalled = false;

function handleBeforeUnload(event: BeforeUnloadEvent): void {
  // Browsers show their own generic wording; the string is only for old ones.
  event.preventDefault();
  event.returnValue = 'You have unsaved changes in the admin portal.';
}

function syncBeforeUnload(): void {
  if (typeof window === 'undefined') return;
  const wanted = dirtyKeys.size > 0;
  if (wanted === beforeUnloadInstalled) return;
  beforeUnloadInstalled = wanted;
  if (wanted) window.addEventListener('beforeunload', handleBeforeUnload);
  else window.removeEventListener('beforeunload', handleBeforeUnload);
}

/**
 * Record whether the form identified by `key` currently holds unsaved changes.
 * Forms must call this with `false` when they unmount.
 */
export function registerDirty(key: string, dirty: boolean): void {
  const had = dirtyKeys.has(key);
  if (dirty === had) return;
  if (dirty) dirtyKeys.add(key);
  else dirtyKeys.delete(key);

  syncBeforeUnload();
  for (const listener of [...dirtyListeners]) {
    try {
      listener();
    } catch {
      /* a bad subscriber must not wedge the registry */
    }
  }
}

/** True when any registered form is holding unsaved changes. */
export function hasUnsavedChanges(): boolean {
  return dirtyKeys.size > 0;
}

/** Subscribe to dirty-state changes. Returns an unsubscribe function. */
export function subscribeDirty(callback: Listener): () => void {
  dirtyListeners.add(callback);
  return () => {
    dirtyListeners.delete(callback);
  };
}

/* ------------------------------------------------------------------- fetch */

/** Pull the most useful human-readable message out of an error response body. */
function extractDetail(text: string, status: number): string {
  const fallback = `Request failed (${status}).`;
  if (!text) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Not JSON -- a short plain-text body is still better than nothing.
    return text.length <= 200 ? text : fallback;
  }

  if (!parsed || typeof parsed !== 'object') return fallback;

  const detail = (parsed as { detail?: unknown }).detail;
  if (typeof detail === 'string' && detail) return detail;

  // FastAPI validation errors arrive as `detail: [{ loc, msg, type }, ...]`.
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (item && typeof item === 'object') {
          const msg = (item as { msg?: unknown }).msg;
          if (typeof msg === 'string') return msg;
        }
        return '';
      })
      .filter(Boolean);
    if (messages.length) return messages.join(', ');
  }

  const message = (parsed as { message?: unknown }).message;
  if (typeof message === 'string' && message) return message;

  return fallback;
}

export interface AdminFetchOptions {
  method?: string;
  body?: unknown;
  /** Caller-owned cancellation, e.g. a capsule load superseded by a newer one. */
  signal?: AbortSignal;
  /** Override the default request timeout. */
  timeoutMs?: number;
}

export async function adminFetch<T>(path: string, options: AdminFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, timeoutMs = ADMIN_TIMEOUT_MS } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  // One controller drives both the timeout and the caller's own cancellation, so
  // a hung backend can never leave a panel stuck on "Saving..." forever.
  const controller = new AbortController();
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const abortFromCaller = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', abortFromCaller);
  }

  try {
    let response: Response;
    try {
      response = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      if (timedOut) {
        throw new AdminApiError(
          `The server did not respond within ${Math.round(timeoutMs / 1000)} seconds. Nothing was saved -- check your connection and try again.`,
          0,
          true,
        );
      }
      if (signal?.aborted) {
        throw new AdminApiError('Request cancelled.', 0, true);
      }
      // Status 0 == never reached the server (offline, port closed, CORS preflight).
      throw new AdminApiError(`Could not reach the server at ${API_URL}.`, 0);
    }

    if (response.status === 401) {
      // Token is dead -- drop it, then tell the shell so it can show the login
      // screen instead of leaving the user stuck behind an inline error.
      setToken(null);
      notifyUnauthorized();
    }

    if (!response.ok) {
      let text = '';
      try {
        text = await response.text();
      } catch {
        /* body unreadable */
      }
      throw new AdminApiError(extractDetail(text, response.status), response.status);
    }

    // 204 / 205 and empty bodies must not be run through JSON.parse.
    if (response.status === 204 || response.status === 205) return undefined as T;

    let text = '';
    try {
      text = await response.text();
    } catch {
      return undefined as T;
    }
    if (!text.trim()) return undefined as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new AdminApiError('The server returned a malformed response.', response.status);
    }
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

export async function adminLogin(password: string): Promise<void> {
  const data = await adminFetch<{ token?: string; expires_at?: string }>('/api/admin/login', {
    method: 'POST',
    body: { password },
  });

  if (!data || typeof data.token !== 'string' || !data.token) {
    throw new AdminApiError('The server did not return a session token.', 500);
  }

  setToken(data.token);
}

export function adminLogout(): void {
  setToken(null);
}

/* ---------------------------------------------------------------------------
 * Display helpers
 * These live here (rather than beside a component) so more than one component
 * can share them without tripping React Fast Refresh's component-only rule.
 * ------------------------------------------------------------------------- */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** `2026-08` -> `August 2026`. Anything unparseable is passed straight through. */
export function formatMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(month ?? '');
  if (!match) return month ?? '';
  const index = Number(match[2]) - 1;
  if (index < 0 || index > 11) return month;
  return `${MONTH_NAMES[index]} ${match[1]}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** `monthIndex` is 0-based and may overflow past 11; it is normalised here. */
function toMonthKey(year: number, monthIndex: number): string {
  const y = year + Math.floor(monthIndex / 12);
  const m = ((monthIndex % 12) + 12) % 12;
  return `${y}-${pad2(m + 1)}`;
}

/** Next `YYYY-MM` after the newest existing capsule that nothing has claimed yet. */
export function nextUnusedMonth(months: string[]): string {
  const taken = new Set(months.map((m) => (m ?? '').slice(0, 7)));

  const now = new Date();
  let year = now.getFullYear();
  let monthIndex = now.getMonth();

  const latest = months
    .map((m) => /^(\d{4})-(\d{2})/.exec(m ?? ''))
    .filter((m): m is RegExpExecArray => m !== null)
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))[0];

  if (latest) {
    const latestYear = Number(latest[1]);
    const latestIndex = Number(latest[2]) - 1;
    // Start from whichever is later: the month after the newest capsule, or now.
    if (latestYear * 12 + latestIndex >= year * 12 + monthIndex) {
      year = latestYear;
      monthIndex = latestIndex + 1;
    }
  }

  let candidate = toMonthKey(year, monthIndex);
  let guard = 0;
  while (taken.has(candidate) && guard < 240) {
    monthIndex += 1;
    candidate = toMonthKey(year, monthIndex);
    guard += 1;
  }
  return candidate;
}
