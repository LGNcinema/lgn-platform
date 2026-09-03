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
