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

## Film video sources

A film's video is stored as a **provider-tagged source** rather than a bare URL, so
the platform can move from Vimeo embeds to Mux or self-hosted files without a
frontend rewrite. Columns on `films` (all nullable):

| field | meaning |
| --- | --- |
| `video_provider` | `vimeo` / `mux` / `youtube` / `file`. NULL means "infer from `video_url`". |
| `video_id` | Provider asset id. Vimeo: the numeric id (`1052574030`). Mux: the playback id. |
| `video_hash` | Vimeo private/unlisted hash — the `h=` query param (`53c90178cb`). NULL for other providers. |
| `video_aspect_ratio` | e.g. `16 / 9`. The frontend defaults to `16 / 9` when NULL. |
| `video_duration_seconds` | Runtime badge shown before the player loads. |
| `captions_url` | Future WebVTT track. |

`video_url` is kept for backward compatibility and for the `file` provider, but it
is **nullable**: a Vimeo-hosted film is fully described by
`video_provider` + `video_id` + `video_hash`.

### Pasting a raw embed

`app/video.py` exposes `parse_video_source(raw)`, which normalizes whatever a
studio sends into a `(provider, video_id, video_hash)` triple. It accepts a full
`<iframe>` embed snippet (HTML entities such as `&amp;` are unescaped first), a
`https://player.vimeo.com/video/ID?h=HASH` URL, a `https://vimeo.com/ID/HASH`
URL, YouTube and Mux URLs, and plain file URLs.

`POST /api/capsules/{capsule_id}/film` runs this automatically: if the request
supplies `video_url` but no `video_provider`, the provider fields are populated
from it. Explicitly-supplied values are never overwritten, so an admin can paste
the raw snippet into `video_url` and let the API sort it out.
