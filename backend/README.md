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

## Configuration

Copy `.env.example` to `.env` and fill it in:

```bash
cp .env.example .env
```

`.env` is git-ignored; `.env.example` is the committed template and must never
contain a real secret.

## Admin API

`/api/admin/*` backs the internal portal LGN staff use to edit the full content
of any capsule — past, current, or upcoming.

### Auth model

Authentication is **one shared password**, stored in the backend `.env` as
`ADMIN_PASSWORD` and compared server-side in constant time. Deliberately *not*
Supabase Auth: the platform may not stay on Supabase, and the gate should not
depend on a vendor we might drop.

Logging in exchanges the password for a stateless bearer token signed with
HMAC-SHA256 (`app/auth.py`, standard library only — no JWT dependency). The
token carries only its own expiry, so there is no session table and a redeploy
does not sign staff out.

> **A shared password gives no per-user audit trail.** Every edit is made by
> "the admin". The API can prove that whoever made a change knew the password;
> it cannot tell you *which* staff member made it, and it cannot revoke one
> person's access without revoking everyone's. If per-editor attribution ever
> matters — for accountability, or to answer "who changed this?" — that
> requires real user accounts, and this scheme should be replaced rather than
> extended.

Rotating the password is the only revocation mechanism. Because the token
signing key is derived from `ADMIN_PASSWORD` by default, **changing the
password immediately invalidates every token already issued**, signing everyone
out. Set `ADMIN_SECRET` explicitly only if you deliberately want rotation *not*
to end live sessions.

| variable | meaning |
| --- | --- |
| `ADMIN_PASSWORD` | The shared password. **Empty/unset ⇒ the portal is unconfigured and every admin endpoint returns 503.** |
| `ADMIN_SECRET` | Optional independent token-signing key. Empty ⇒ derived from `ADMIN_PASSWORD`. |
| `ADMIN_TOKEN_TTL_HOURS` | Token lifetime, default `12`. |

### Fail-closed default

An unset `ADMIN_PASSWORD` **never** means "no authentication required". Every
admin endpoint answers `503 Service Unavailable` with
`{"detail": "Admin portal is not configured"}`, so a deploy that forgets the
variable is locked, not wide open.

### Using it

```bash
# 1. Exchange the password for a token
TOKEN=$(curl -s -X POST http://localhost:8000/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"..."}' | python -c 'import json,sys; print(json.load(sys.stdin)["token"])')

# 2. Send it on every admin request
curl http://localhost:8000/api/admin/capsules -H "Authorization: Bearer $TOKEN"
```

Responses: `401` for a wrong password or a missing/expired/tampered token,
`503` when unconfigured, `404` with a descriptive detail for an unknown id.

### Endpoints

| method | path | notes |
| --- | --- | --- |
| `POST` | `/api/admin/login` | `{"password"}` → `{"token", "expires_at"}`. No token required. |
| `GET` | `/api/admin/session` | `{"valid": true}`. Used to restore a session after a page reload. |
| `GET` | `/api/admin/capsules` | **All** capsules including inactive ones, `month` descending. |
| `GET` | `/api/admin/capsules/{id}` | Full `CapsuleDetail` (film + all collections). |
| `POST` | `/api/admin/capsules` | → 201 |
| `PATCH` | `/api/admin/capsules/{id}` | Partial update. Setting `is_active` demotes the others. |
| `DELETE` | `/api/admin/capsules/{id}` | → 204. Cascades to film, reflections, circles, practices. |
| `PUT` | `/api/admin/capsules/{id}/film` | **Upsert** — a capsule has at most one film. |
| `POST` | `/api/admin/capsules/{id}/{collection}` | → 201 |
| `PATCH` | `/api/admin/{collection}/{item_id}` | Partial update. |
| `DELETE` | `/api/admin/{collection}/{item_id}` | → 204 |

`{collection}` is one of `reflections`, `discussion_circles`, `practices`.

**PATCH semantics.** Bodies are applied with `model_dump(exclude_unset=True)`:
a field you omit is left unchanged, and a field you send explicitly as `null`
clears that (nullable) column. Sending `{"title": "New"}` will not blank out
everything else.

**PUT film.** Because films are 1:1 with capsules, the editor should not have
to know whether it is creating or replacing. This route creates the film when
the capsule has none and updates it otherwise, and runs the same embed parsing
and Vimeo enrichment described under *Film video sources* below — so an admin
can paste a raw `<iframe>` snippet and get `video_provider` / `video_id` /
`video_hash` / `thumbnail_url` / `video_duration_seconds` filled in.

### Which endpoints are protected

Admin-only (bearer token required): everything under `/api/admin/*`, plus the
pre-existing content writes, which used to be open to the internet —
`POST /api/capsules`, `POST /api/capsules/{id}/film`,
`POST /api/capsules/{id}/reflections`,
`POST /api/capsules/{id}/discussion_circles`,
`POST /api/capsules/{id}/practices`.

Intentionally public: **all** `GET` endpoints, and the visitor submission
routes `/api/submissions/contact`, `/api/submissions/film`,
`/api/submissions/reflection`, `/api/submissions/storyboard` — the public
website posts to these anonymously and must keep working.

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
