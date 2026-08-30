# LGN Platform Backend

FastAPI Python backend for hosting monthly short film capsules.

## Setup & Running Locally

This backend is managed by `uv` and run inside Docker Compose.

### Local Development (inside Docker)
The simplest way to run both the frontend and backend is using Docker Compose. The backend service will automatically mount `./app` into the container and reload on changes.

Please see the [Root README](../README.md) for full Docker Compose instructions and commands.

### Local Python Virtual Environment (without Docker)
If you want to run or test locally outside Docker, make sure you have `uv` installed:
```bash
# Initialize venv and install dependencies
uv sync

# Run the API server
uv run uvicorn app.main:app --reload
```

## Environment

Settings live in `app/config.py` and are read from `backend/.env` (gitignored) or
the environment. `DATABASE_URL` defaults to local SQLite; `ANTHROPIC_API_KEY`
enables the Geme chat (`/api/geme/*`) and leaves it disabled when unset. See the
[Geme section of the root README](../README.md#geme-practice--keep-exploring--take-it-inward).

Try a turn without the UI:
```bash
curl -s -X POST http://localhost:8000/api/geme/chat \
  -H "Content-Type: application/json" \
  -d '{"capsule_id": 1, "messages": []}'
```
