# LGN Cinema platform — notes for Claude

LGN (Life is Greater than Numbers, a nonprofit) offers one short film a month
as a "story", with Reflect and Practice pathways and a public Storyboard.
React + Vite + TypeScript in `frontend/`, FastAPI in `backend/`, Neon Postgres,
hosted on Vercel (`lgn4/lgn-platform`, Hobby plan) at lgn-platform.vercel.app.

**This repository is public.** Never commit secrets, `.env` files, or the
licensed font files (see Fonts).

## How Justin works

- **Commit cadence:** leave edits uncommitted; Justin reviews locally
  (`docker compose up`, site on :5173, API on :8000, Postgres container
  `lgn_db`) and says when to commit, push or merge. Don't commit per tweak:
  every push builds a Vercel preview.
- **Cloud sessions (claude.ai/code)** have no Docker daemon, so run the stack
  bare: `cd backend && uv sync && ENV=development uv run uvicorn app.main:app
  --port 8000 --reload` (SQLite, schema built on startup) and Vite on :5173
  with `/api` proxied to :8000 so Justin's remote preview works. Run
  `npm run fetch-fonts` first (`BLOB_READ_WRITE_TOKEN` is set in the cloud
  environment). Review with 1920px screenshots. The container is ephemeral:
  anything uncommitted is lost when the session ends, so say so before it does.
- **Branches:** `ui-v3` is the iteration branch. Merge `ui-v3` → `main`
  (`--no-ff`) only when asked; `main` deploys to production.
- **No hard-coded leftovers:** when something is retired, delete the data,
  schema and code rather than keeping it with explanatory notes or fallbacks.
- Test at **1920x1080** (what Justin views at), and 1920x950 for a real
  browser window. Mobile layout is Justin's separate work.

## Design (Figma "LGN Web" V3)

- Text and buttons use fixed Figma px at every width; only layout and images
  scale, via `--dp` (100vw/1920, clamped 0.75–1px) across and `--vdp` down.
  Never put `clamp(..vw..)` or `calc(N * var(--dp))` on font sizes.
- Type sizes 12/20/36/48 with the frames' tracking (`--track-*` in index.css).
  Panels `--panel: #ededed` (the frames' grey; don't deepen it).
- Columns are measured from the page centre: header links, the home logo's
  "L", About/Invest body text and search fields start on the 660 line
  (`50% - 300 * var(--dp)`); `#root` is capped at 1920 and centred.
- "Campfire" is called **Go Beyond** in the UI (code still says campfire /
  capsule; the UI says "stories").
- Geme (the AI guide) is hidden for the first version: `SHOW_GEME = false` in
  `frontend/src/components/campfire/StoryShell.tsx`. Its chat and API remain.
- Visual checks: `tools/visual` (Playwright; `node vis.mjs shoot|diff|crop`)
  renders at 1920 CSS px, 2x, to line up with Figma's @2x exports. The Figma
  exports themselves (`design/`) are only on Justin's machine, not in git.

## Fonts

- **Helvetica Now Text** (licensed from MyFonts: Regular + Medium) everywhere,
  plus Courier Prime on "A Witness through Time" and a few mono labels.
  36/48px use Medium (`--weight-display: 500`): Now Text's Regular is ~17%
  lighter than the frames' Helvetica Neue at those sizes.
- The `.woff`/`.woff2` files are **git-ignored** (licensed; public repo). They
  live in the private Vercel Blob store `lgn-fonts`; `frontend/scripts/fetch-fonts.mjs`
  downloads them at the start of `npm run build` and fails a Vercel build that
  can't. `scripts/upload-fonts.mjs` replaces them. `fonts.css` (with the licence
  notice, served unminified) is committed. Without the files locally the site
  falls back to Helvetica/Arial.

## Data and migrations

- Migrations: plain SQL in `backend/migrations/`, applied by `backend/migrate.py`
  (`status` / `up`; `--neon <branch>` targets a Neon branch, e.g.
  `preview/ui-v3`, `main` = PRODUCTION). Local:
  `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lgn_platform uv run python migrate.py up`.
- **Ordering rule:** additive migrations run on production *before* the deploy;
  a migration that drops something the old code still reads runs *after* the
  deploy. `migrate.py up` applies every pending file, so keep a drop out of the
  folder until the code that stops reading it is live.
- Justin runs production migrations himself; ask him.
- Publishing: `capsules.is_active` means published (not exclusive); scheduling
  is derived at read time from `publish_at` (naive UTC). Use the server's
  `is_published`; public GETs serve published stories only.
- Photos (story Behind the Film photos, storyboard photos) are stored as bytea,
  shrunk in the browser before upload, and served with CDN caching (`s-maxage`)
  so views don't draw on Neon's 5 GB/month transfer.

## Features at a glance

- **Story page:** Watch / Reflect / Practice; Reflect and Practice are organised
  as Self / Neighbor / World. Reflect answers stay on the visitor's device;
  "Save my answer" also copies a formatted version to the clipboard.
- **Behind the Film** ("How this film was made", `?section=making`): large
  picture, credits ("Role: Name, Name" lines), a 3x3 gallery and reorderable
  written sections; edited on the admin's Behind the Film tab.
- **Storyboard:** open to read; submissions need admin approval; the admin has
  a Storyboard page (sidebar) for every story, with rule-based spam hints.
- **Admin** (`/admin`, one shared password, `ADMIN_PASSWORD` in `backend/.env`):
  tabs Watch, Reflect, Practice, Behind the Film, Details, Preview, Storyboard.
  Preview renders the real page in a 1920x1080 iframe.

## Open items

- PR #2 "Beyond the Screen" (Cooper, branch `beyond-the-screen`): TMDB film
  search. Preview is configured (token + switch scoped to that branch, preview
  DB migrated). Production: migrate, then merge; ships off. Needs TMDB's
  written approval before turning on publicly. Raised: TMDB search can return
  adult titles despite `include_adult=false`.
- Vercel Hobby is non-commercial-use only; LGN probably needs Pro. Undecided.
- V3 frames relabel the story panel "STORY NO. 1 / [MONTH] / HOW THESE GUIDES
  ARE MADE"; not implemented (awaiting Justin).
- Deferred: film submissions section, desktop/mobile preview toggle, poster
  upload, Spark link placement, Geme's return.
