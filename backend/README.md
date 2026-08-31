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
| `GET` | `/api/admin/capsules` | **All** capsules including drafts and scheduled ones, `month` descending. |
| `GET` | `/api/admin/capsules/{id}` | Full `CapsuleDetail` (film + all collections). |
| `POST` | `/api/admin/capsules` | → 201 |
| `PATCH` | `/api/admin/capsules/{id}` | Partial update. Accepts `is_active` and `publish_at`; publishing one capsule does **not** unpublish the others. |
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

Public and open are not the same thing, though: the public capsule `GET`s serve
**only published capsules**. See *Capsule publication* below.

## Capsule publication

**Many capsules are published at once.** They are the tab bar on the public
site. The **current** capsule is simply the published capsule with the greatest
`month` — `month` is `YYYY-MM`, so lexical ordering is chronological. There is
no "exactly one live capsule" rule any more, and publishing a capsule never
demotes its siblings.

Two writable columns drive it, and one derived field reports the result:

| field | kind | meaning |
| --- | --- | --- |
| `is_active` | writable `bool` | **Means "published".** The column keeps its historical name to avoid a rename migration. It is *not* exclusive — many rows may have it set. |
| `publish_at` | writable, nullable `datetime` | Scheduled go-live, **naive UTC** (matching `created_at`). NULL = not scheduled. Send an explicit `null` to clear a schedule. |
| `is_published` | read-only `bool` | Derived server-side. Present on every capsule response; rejected as input. |

### The rule

```
published  ==  is_active = TRUE
               OR (publish_at IS NOT NULL AND publish_at <= utcnow())
```

It is **derived at read time — there is no cron job and no background worker**,
and nothing ever flips `is_active` on a schedule. The moment `publish_at` slips
into the past, the next request already sees the capsule; `is_active` stays
`false` in the database forever.

The rule is written **once**, as the `Capsule.is_published` hybrid property in
`app/models.py`, whose Python form (one loaded row) and SQL form (the row
filter) are defined together so they cannot drift. `app/main.py` exposes it as
`_published_filter()` (a SQLAlchemy condition) and `_is_published(capsule)`; no
endpoint spells the comparison out again.

`is_published` is returned to clients so the admin portal can label the three
states without doing its own clock arithmetic — a browser with skewed time
would otherwise disagree with what the API actually serves:

| state | `is_active` | `publish_at` | `is_published` |
| --- | --- | --- | --- |
| draft | `false` | `null` | `false` |
| scheduled | `false` | future | `false` |
| published | `true` *or* `false` | anything *or* past | `true` |

### What the public sees

| endpoint | behaviour |
| --- | --- |
| `GET /api/capsules` | **Published only**, `month` descending. Feeds the public tab bar. |
| `GET /api/capsules/{id}` | **404 if not published** — with the *same* detail string as a genuinely missing id. |
| `GET /api/capsules/active` | The published capsule with the greatest `month`. `404` when nothing is published. |

The matching 404 detail is deliberate: an unpublished capsule must be
indistinguishable from a typo. A `CapsuleDetail` carries the film's `video_id`
and `video_hash`, so merely confirming that id 7 exists but is embargoed would
be enough to make an unreleased film findable by anyone guessing ids.

`GET /api/capsules/active` no longer falls back to the most recently created
capsule when nothing is published — that fallback served drafts to the public.
It answers `404 No active monthly capsule found.` instead.

### What the admin sees

`GET /api/admin/capsules` and `GET /api/admin/capsules/{id}` are **never**
filtered by publication state. Previewing a draft or a scheduled capsule before
it goes live is the whole point of the editor.

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

> **Caution for API clients — changing a film's video.** Explicit provider fields
> always win over `video_url`. So if you send a *new* `video_url` while echoing
> back the `video_provider` / `video_id` / `video_hash` from a previous response,
> the new URL is stored but the old provider fields are kept — and since the
> player prefers the explicit columns, **the site keeps playing the old film**.
> When you change the video, send `video_url` with `video_provider`, `video_id`,
> `video_hash`, `thumbnail_url` and `video_duration_seconds` all omitted or null,
> so the server re-derives them. The admin portal's Film panel does this for you;
> anything else calling this API directly must do it deliberately.
