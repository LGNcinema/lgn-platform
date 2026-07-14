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
