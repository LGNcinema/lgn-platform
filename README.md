# LGN Platform

Full-stack platform for a cinema production company hosting monthly short film capsules.

## Architecture
- **Backend:** Python / FastAPI / PostgreSQL
- **Frontend:** React / TypeScript / Vite
- **Database:** PostgreSQL (Docker) / SQLite (Local standalone)

---

## Local Development (with Docker)

The easiest way to run the entire platform (Frontend + Backend + Database) is using Docker Compose. This setup includes hot-reloading for both the frontend and backend, so any code changes you make will immediately be reflected in the running containers.

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### Quick Start
To build and start all services in the background, run:
```bash
docker compose up --build -d
```

**Then give the database a schema.** Which command depends on `DB_BOOTSTRAP` in
`backend/.env`:

| `DB_BOOTSTRAP` | What builds the schema | What you run |
| --- | --- | --- |
| `true` (default) | `create_all()` from `app/models.py`, on startup | nothing — it is already done |
| `false` | the SQL migrations, the same ones that run against Neon | the two commands below |

```bash
cd backend
uv run python migrate.py up      # apply migrations
uv run python migrate.py seed    # sample capsule + film (local only)
```

Run those **from the host, not inside the container.** `backend/Dockerfile`
copies only `pyproject.toml` and `app/`, so `migrate.py`, `migrations/` and
`seed.sql` are not in the image. They reach the database through the port the
`db` service publishes on `localhost:5432`, which is what `DATABASE_URL` in
`backend/.env` points at.

With `DB_BOOTSTRAP=false` the API starts fine against an empty database — it
simply never touches it at startup — so the first request before you migrate
returns a `UndefinedTable` 500 rather than anything that explains itself.

### Switching between the two modes

The `pgdata` volume survives `docker compose down`, so a database built one way
stays that way. Going from `true` to `false` needs a clean volume:

```bash
docker compose down -v          # drops pgdata -- LOCAL data only
docker compose up -d
cd backend && uv run python migrate.py up && uv run python migrate.py seed
```

Skip the reset and `migrate.py up` fails on `20260720165715`, which is not
idempotent (plain `ALTER TABLE ADD COLUMN`) and cannot run against tables the
models already built. If you would rather keep the data, `migrate.py baseline`
records the migrations as applied without running them — it changes no tables.

### Accessing the Services
Once the containers are running, you can access the applications at:
- **Frontend App:** [http://localhost:5173](http://localhost:5173)
- **Backend API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **PostgreSQL Database:** Exposed on port `5432`

### Stopping the Services
To stop the containers without removing your database data:
```bash
docker compose stop
```
To bring everything down and remove containers:
```bash
docker compose down
```

### After adding a frontend dependency

If you add a package to `frontend/package.json`, a plain `docker compose up --build`
is **not** enough. You will get:

```
[plugin:vite:import-analysis] Failed to resolve import "<package>" from "src/main.tsx"
```

The compose file mounts an anonymous volume at `/app/node_modules` (so the container
keeps its own Linux-built modules instead of your host's). Compose *reuses* anonymous
volumes when it recreates a container, so the stale `node_modules` from an earlier run
keeps masking the newly built image layer — the image has the package, the running
container does not. Recreate the anonymous volume as well:

```bash
docker compose up --build -V     # -V = --renew-anon-volumes
```

The `pgdata` volume is **named**, not anonymous, so `-V` leaves your database alone.

### Viewing Logs
If you need to debug or view the logs of the running services:
```bash
# View all logs
docker compose logs -f

# View backend logs only
docker compose logs -f backend

# View frontend logs only
docker compose logs -f frontend
```

---

## Local Development (without Docker)

If you prefer to run the applications locally on your machine without Docker, see the individual READMEs:
- [Backend Instructions](./backend/README.md)
- [Frontend Instructions](./frontend/README.md)

---

## Deployment

The site runs on **Vercel**, as one project holding two
[services](https://vercel.com/docs/services): the Vite frontend and the FastAPI
backend, both built from this repo and served from one domain. `vercel.json` at
the repo root is the whole routing story:

| Request        | Goes to             | The service sees |
| -------------- | ------------------- | ---------------- |
| `/api/...`     | `backend` (FastAPI) | `/api/...`       |
| anything else  | `frontend` (static) | the same path    |

The backend receives the **original** path, prefix included, which is why every
route in `app/main.py` keeps its `/api` prefix and nothing had to be re-rooted.

Because both halves share one origin, the browser's API calls are same-origin:
`VITE_API_URL` is left unset on Vercel and `frontend/src/api.ts` falls back to a
relative `/api/...`. That works unchanged on preview deployments, and it means
**CORS is not involved at all** — `CORS_ORIGINS` only matters locally, where Vite
(5173) and uvicorn (8000) really are different origins.

### Environment variables to set on the Vercel project

Set these for Production *and* Preview, under Project → Settings → Environment
Variables. They are shared by both services; only `VITE_*` names reach the
frontend bundle, so nothing here leaks into the browser.

| Variable            | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`      | **Don't set this by hand** — the Neon integration injects it. See below.      |
| `ENV`               | `production`                                                                 |
| `ADMIN_PASSWORD`    | The shared admin-portal password. Without it the portal answers `503`.        |
| `ANTHROPIC_API_KEY` | Geme's key. Without it the Geme endpoints report unavailable and the UI hides the entry point. |

Leave `GEME_DEBUG` unset — it lets any caller replace Geme's system prompt and
spend tokens against this key, and is for local development only.

### The database connection must be the pooled one

The database is **Neon**, provisioned through the Vercel Marketplace. The
integration injects two connection strings and you should not add your own:

| Variable | Endpoint | Use it for |
| --- | --- | --- |
| `DATABASE_URL` | pooled (`-pooler` host) | the app — this is what the API reads |
| `DATABASE_URL_UNPOOLED` | direct | migrations, the data copy, anything doing DDL |

The API is a serverless function that scales horizontally. If each instance kept
its own SQLAlchemy connection pool, they would multiply into far more Postgres
connections than Neon allows. Neon's PgBouncer does that pooling server-side for
all of them at once, so the app keeps none of its own — `app/database.py` sees
the pooled host and switches to `NullPool` automatically.

**The detection is host-based, not port-based, and that distinction bit us
once.** Supabase marked its pooler with a distinct port (`:6543`); Neon marks
its with a `-pooler` suffix on the hostname and stays on 5432. Code that matched
only the port silently failed to fire on Neon and left local pooling on. Both
markers are matched now — see `POOLED_ENDPOINT_MARKERS` in `app/database.py`.

If `DATABASE_URL` is missing entirely, the config default is SQLite — on a
read-only, per-instance filesystem. The backend refuses to start in that case
rather than serving an empty database that silently loses every write.

### Deep links need the SPA rewrite

The app uses `react-router-dom` with `BrowserRouter`, so routes like `/admin` and
`/admin/capsules/1/film` are real URL paths. A static host asked for `/admin`
looks for a file at that path, finds none, and returns **404 before the React app
ever boots** — so the router never gets to handle the route. Vite's dev server
rewrites unknown paths to `index.html` automatically, which is why this only
bites in production.

The `frontend` service's own `rewrites` block in `vercel.json` handles it:

```json
"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
```

It is a *rewrite*, not a redirect. A redirect changes the address bar and breaks
deep links; a rewrite serves `index.html` while preserving the path so the router
can read it. Static files still win — rewrites are only consulted when nothing on
disk matches.

Symptom if it goes missing: the site works, but every deep link and every hard
refresh away from `/` returns a 404.

### Schema changes must be applied before the code that needs them

Migrations are plain SQL in `backend/migrations/`, applied with
`backend/migrate.py` from a dev machine:

```bash
cd backend
uv run python migrate.py status     # what is applied, what is pending
uv run python migrate.py up         # apply everything pending
uv run python migrate.py seed       # apply seed.sql (upserts; safe to repeat)
```

It tracks applied files in a `schema_migrations` table, runs each in its own
transaction, and stops at the first failure rather than pressing on into
migrations that assumed it landed. It prefers `DATABASE_URL_UNPOOLED` so DDL
goes over the direct connection rather than through PgBouncer.

**`seed.sql` is local-development data. Never run `seed` against the hosted
database.** It upserts a sample capsule and film over whatever is there, keyed on
`month` — against production that overwrites real content. It is a separate,
explicit command for exactly that reason, and nothing applies it automatically.

Deploying code that reads a column before its migration has run produces
`UndefinedColumn` 500s on every affected endpoint, so **migrate first, then
merge**.

Nothing in a deploy touches the schema. The startup path that calls
`create_all()` and seeds a sample capsule is gated to `ENV=development` and off
on Vercel (`app/main.py`), because the SQL migrations own the deployed schema
and a serverless process would otherwise re-run that check on every cold start.

### Local development is unchanged

`docker-compose up` still runs Postgres, uvicorn with `--reload`, and the Vite
dev server exactly as before; `vercel.json` has no effect there. To exercise the
Vercel routing locally instead, `vercel dev` runs both services behind one port.

**Two ways to get a local schema, and you have to pick one** — `DB_BOOTSTRAP`
in `backend/.env`. Setting it to `false` runs the same SQL locally that runs
against Neon, so a broken migration fails on your machine instead of in
production. See [Quick Start](#quick-start) for both paths and how to switch.

---

## Geme (Practice → Keep Exploring → Take It Inward)

The Practice pathway ends in a short chat with Geme, our mascot, who asks a few
questions and helps the visitor name one small next step. It calls the Anthropic
Messages API from the backend — the browser never holds the key.

### Setup

1. Create an API key at [console.anthropic.com](https://console.anthropic.com).
2. Put it in `backend/.env` (gitignored):
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   One location covers both ways of running: `uv run uvicorn` reads it directly,
   and the `backend` service loads the same file via `env_file`. Note that
   `.env` is per-checkout — a git worktree needs its own copy.

Without a key the platform runs normally: `/api/geme/status` reports
`{"enabled": false}` and the Practice page shows the Geme card without an
active button, so nothing 500s for anyone cloning the repo.

### Settings (`backend/app/config.py`, overridable by env var)

| Variable | Default | Notes |
| :--- | :--- | :--- |
| `ANTHROPIC_API_KEY` | *(empty)* | Empty disables Geme. |
| `GEME_MODEL` | `claude-opus-5` | |
| `GEME_MAX_TOKENS` | `1024` | Geme's replies are meant to be three sentences. |
| `GEME_EFFORT` | `low` | How hard the model thinks: `low`–`max`. |
| `GEME_DEBUG` | `false` | Enables the tuning panel below. **Local only.** |

### Tuning Geme's persona (local only)

Iterating on Geme's wording by editing `geme.py` and redeploying is a slow loop, so
there's a live tuning panel: a floating **🧪 Geme Tuning** button, next to the theme
and grid toggles, which opens Geme's persona and parameters for editing and testing
against a real conversation.

It appears only when the server reports `GEME_DEBUG` — set in `docker-compose.yml`
for local development and nowhere else. Edits live in your browser (`localStorage`)
and ride along with your own chat requests; they never touch the server or change
what anyone else sees. **Settling on wording still means editing
`backend/app/geme.py` and committing it.**

`GEME_DEBUG` must stay off in any deployment: with it on, anyone who can reach the
API can replace Geme's system prompt and spend tokens against the server's key.
With it off the override is ignored and `/api/geme/config` 404s.

| Field | What it does |
| :--- | :--- |
| Persona | Geme's whole system prompt. |
| Opening turn | The hidden prompt that makes Geme greet you first. |
| Model / Effort | Which model answers, and how hard it thinks. |
| Max tokens | Reply length cap. Set it too low and a reply can get cut off. |
| Max chars per turn | Truncates over-long visitor messages. |
| History window | How many messages Geme is given — see the note below. |

"What Geme actually receives" shows the assembled prompt — persona plus the current
capsule's film and practice — which is what the model is really sent.

**The history window is not the conversation length.** It counts messages from both
sides and drops the oldest beyond it, so a window of 4 on a six-message conversation
hides Geme's own opener and the first reply. How many exchanges Geme has before it
closes is set in the persona — the line reading *"Three to five exchanges, then you
close"* — so edit that to make conversations longer or shorter.

**Save to file / Load file.** Settings worth keeping can be saved as JSON and loaded
back later, or handed to someone else to try. The file records all seven values in
full (not only what was edited), plus which of them differ from the server's, so the
persona can be lifted straight into `backend/app/geme.py` from `settings.persona`.

### Endpoints

| Endpoint | Purpose |
| :--- | :--- |
| `GET /api/geme/status` | Whether Geme is configured; the frontend checks this before offering the chat. |
| `GET /api/geme/config` | Geme's live persona and parameters, for the tuning panel. 404s unless `GEME_DEBUG`. |
| `POST /api/geme/chat/stream` | Server-sent events (`delta` → `done`/`error`). What the UI uses. |
| `POST /api/geme/chat` | Same turn, returned whole. Useful for testing with `curl`. |

Conversations are **not** stored. The frontend holds the transcript in component
state and replays it on each turn; only the closing step is saved, and only to
the visitor's own `localStorage`. Geme's persona, guardrails, and the capsule
context it is given all live in `backend/app/geme.py`.
