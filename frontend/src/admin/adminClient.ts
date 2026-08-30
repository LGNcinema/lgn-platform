/**
 * Tiny fetch wrapper for the LGN admin API.
 *
 * The admin session token lives in `sessionStorage` (NOT `localStorage`) so an
 * admin session dies with the browser session. Every storage access is guarded
 * because `sessionStorage` throws outright in some privacy / sandbox modes; an
 * in-memory fallback keeps the portal usable for the life of the page there.
 */

export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const TOKEN_KEY = 'lgn_admin_token';

/** Used only when `sessionStorage` is unavailable (privacy mode, sandboxed iframe). */
let memoryToken: string | null = null;

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
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

export async function adminFetch<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const { method = 'GET', body } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // Status 0 == never reached the server (offline, port closed, CORS preflight).
    throw new AdminApiError(`Could not reach the server at ${API_URL}.`, 0);
  }

  if (response.status === 401) {
    // Token is dead -- drop it so the shell falls back to the login screen.
    setToken(null);
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
