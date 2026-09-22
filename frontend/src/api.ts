/**
 * Base URL the browser puts in front of every `/api/...` call.
 *
 * Deployed, the site and the API are one Vercel deployment behind one domain --
 * `/api/*` is rewritten to the FastAPI service (see `vercel.json`) -- so the
 * right base is the empty string: requests go to `/api/...` on whatever origin
 * served the page. That covers production and every preview deployment without
 * a per-environment variable, and it keeps the calls same-origin, so CORS never
 * comes into it.
 *
 * Locally, Vite (5173) and uvicorn (8000) really are different origins, so a
 * dev build falls back to uvicorn. A non-empty `VITE_API_URL` still wins over
 * both -- that's how you point a local frontend at a deployed API.
 */
const configured = (import.meta.env.VITE_API_URL ?? '').trim();

export const API_URL: string = configured || (import.meta.env.DEV ? 'http://localhost:8000' : '');
