"""Beyond the Screen: search any film, then Reflect and Practice on it.

Public:  /api/films/*  and  POST /api/submissions/film-feedback
Admin:   /api/admin/films*, /api/admin/film-prompts*, /api/admin/film-feedback*

Nothing from TMDB is stored: details are fetched live on every call and only
LGN's own settings and writing (external_films, film_prompts, film_feedback)
live in the database. See app/tmdb.py.

Which questions a film shows (resolved separately for Reflect and Practice):
  held            -> no page at all
  universal_only  -> the universal set
  otherwise       -> per kind (Reflect and Practice separately): the film's own
                     LGN set if it has one, and then ONLY that: no universal
                     alternative, no AI set, no way back. Without one, the
                     universal set, with the AI set (once it exists) as the
                     one alternative. Sets are never mixed.
"""

from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import features, film_ai, models, ratelimit, schemas, tmdb
from app.auth import require_admin
from app.database import get_db


def require_beyond_enabled(db: Session = Depends(get_db)) -> None:
    """Off means the feature does not exist for visitors: a plain 404, the same
    as any unknown address. Admin routes are not gated, so LGN can keep editing
    while it is off."""
    if not features.beyond_enabled(db):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")


# Visitor-facing routes (gated by the switch) and admin routes (always on).
public = APIRouter(dependencies=[Depends(require_beyond_enabled)])
router = APIRouter()

# CDN hints (Vercel honours s-maxage). Short, because LGN's own settings
# (held, care note) ride along on the details response.
SEARCH_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400"
DETAILS_CACHE = "public, s-maxage=300, stale-while-revalidate=3600"
# Where to watch changes slowly, and the answer is per region (the CDN keys on the query).
WATCH_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400"
NO_CACHE = "no-store"

KIND_ORDER = ("reflect", "practice")
DIM_ORDER = {"self": 0, "neighbor": 1, "world": 2}


# ------------------------------------------------------------------ helpers


def _norm(text: Optional[str]) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


def _clean(value: Optional[str]) -> Optional[str]:
    value = (value or "").strip()
    return value or None


def _lgn_films(db: Session) -> list:
    """(capsule, film) for every published LGN story."""
    return (
        db.query(models.Capsule, models.Film)
        .join(models.Film, models.Film.capsule_id == models.Capsule.id)
        .filter(models.Capsule.is_published)
        .all()
    )


def _lgn_capsule_for(db: Session, title: str) -> Optional[int]:
    wanted = _norm(title)
    if not wanted:
        return None
    for capsule, film in _lgn_films(db):
        if _norm(film.title) == wanted or _norm(capsule.title) == wanted:
            return capsule.id
    return None


def _from_tmdb(call, *args) -> dict:
    """Run a TMDB lookup, with TMDB's failure modes turned into HTTP ones."""
    if not tmdb.is_available():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Film search is not set up on this server.")
    try:
        return call(*args)
    except tmdb.TmdbError as exc:
        if exc.kind == "not_found":
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Film not found.")
        if exc.kind == "rate_limited":
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Film lookup is busy. Try again in a moment.",
                                headers={"Retry-After": "10"})
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Film lookup is unavailable right now.")


def _tmdb_details(tmdb_id: int) -> dict:
    return _from_tmdb(tmdb.details, tmdb_id)


def _get_ext(db: Session, tmdb_id: int) -> Optional[models.ExternalFilm]:
    return db.query(models.ExternalFilm).filter(models.ExternalFilm.tmdb_id == tmdb_id).first()


def _get_or_create_ext(db: Session, tmdb_id: int) -> models.ExternalFilm:
    ext = _get_ext(db, tmdb_id)
    if ext is None:
        ext = models.ExternalFilm(tmdb_id=tmdb_id)
        db.add(ext)
        try:
            db.commit()
        except Exception:  # two first visits raced on the unique tmdb_id
            db.rollback()
            ext = _get_ext(db, tmdb_id)
            if ext is None:
                raise
            return ext
        db.refresh(ext)
    return ext


def _sorted(rows: List[models.FilmPrompt]) -> List[models.FilmPrompt]:
    return sorted(rows, key=lambda r: (DIM_ORDER.get(r.dimension, 9), r.position, r.id))


def _set(rows: List[models.FilmPrompt]) -> schemas.PromptSet:
    rows = _sorted(rows)
    return schemas.PromptSet(
        reflect=[schemas.FilmPromptOut.model_validate(r) for r in rows if r.kind == "reflect"],
        practice=[schemas.FilmPromptOut.model_validate(r) for r in rows if r.kind == "practice"],
    )


def _rows(db: Session, ext_id: Optional[int], source: str) -> List[models.FilmPrompt]:
    q = db.query(models.FilmPrompt).filter(models.FilmPrompt.source == source)
    q = q.filter(models.FilmPrompt.external_film_id.is_(None) if ext_id is None else models.FilmPrompt.external_film_id == ext_id)
    return q.all()


def _by_kind(rows, kind):
    return [r for r in rows if r.kind == kind]


def _detail_out(film: dict, ext: Optional[models.ExternalFilm], lgn_capsule_id: Optional[int],
                reveal: bool = False) -> schemas.FilmDetail:
    """The public view of a film. `reveal` (admin) shows a held film in full."""
    held = bool(film.get("adult")) or (ext is not None and ext.handling == "held")
    if held and not reveal:  # nothing about the film beyond its name
        return schemas.FilmDetail(tmdb_id=film["tmdb_id"], title=film["title"], handling="held")
    return schemas.FilmDetail(
        tmdb_id=film["tmdb_id"],
        title=film["title"],
        year=film.get("year"),
        runtime=film.get("runtime"),
        director=film.get("director"),
        cast=film.get("cast", []),
        genres=film.get("genres", []),
        poster_url=film.get("poster_url"),
        still_url=film.get("still_url"),
        handling=ext.handling if ext else "normal",
        care_note=ext.care_note if ext else None,
        logline=ext.logline if ext else None,
        lgn_capsule_id=lgn_capsule_id,
    )


# ------------------------------------------------------------------ public


@public.get("/api/films/search", response_model=schemas.FilmSearchResponse)
def search_films(request: Request, response: Response, q: str = "", db: Session = Depends(get_db)):
    """LGN's own films first, then TMDB's movies (adult titles excluded)."""
    ratelimit.check(request, "film-search", limit=40, window_seconds=60)
    q = q.strip()[:100]
    if len(q) < 2:
        return schemas.FilmSearchResponse(results=[])

    needle = _norm(q)
    results: List[schemas.FilmSearchResult] = []
    lgn_titles = set()
    for capsule, film in _lgn_films(db):
        if needle and (needle in _norm(film.title) or needle in _norm(capsule.title)):
            lgn_titles.add(_norm(film.title))
            lgn_titles.add(_norm(capsule.title))
            results.append(schemas.FilmSearchResult(
                title=film.title or capsule.title, poster_url=film.thumbnail_url,
                source="lgn", capsule_id=capsule.id,
            ))

    notice = None
    if not tmdb.is_available():
        notice = "Searching other films isn't available right now."
    else:
        try:
            for hit in tmdb.search(q):
                if _norm(hit["title"]) in lgn_titles:
                    continue  # the LGN entry above stands in for it
                results.append(schemas.FilmSearchResult(source="tmdb", **hit))
        except tmdb.TmdbError as exc:
            notice = "Film search is busy. Please try again in a moment." if exc.kind == "rate_limited" \
                else "Film search is unavailable right now. Please try again soon."

    # A degraded answer must not be held by the CDN.
    response.headers["Cache-Control"] = NO_CACHE if notice else SEARCH_CACHE
    return schemas.FilmSearchResponse(results=results, notice=notice)


@public.get("/api/films/universal-prompts", response_model=schemas.PromptSet)
def universal_prompts(response: Response, db: Session = Depends(get_db)):
    """So a film page can show questions at once while its details load."""
    response.headers["Cache-Control"] = NO_CACHE
    return _set(_rows(db, None, "universal"))


@public.get("/api/films/{tmdb_id}", response_model=schemas.FilmDetail)
def film_detail(tmdb_id: int, request: Request, response: Response, db: Session = Depends(get_db)):
    ratelimit.check(request, "film-detail", limit=60, window_seconds=60)
    film = _tmdb_details(tmdb_id)
    # Only a film TMDB confirmed gets a row, so random ids can't fill the table.
    ext = None if film.get("adult") else _get_or_create_ext(db, tmdb_id)
    lgn_id = _lgn_capsule_for(db, film["title"])
    response.headers["Cache-Control"] = DETAILS_CACHE
    return _detail_out(film, ext, lgn_id)


@public.get("/api/films/{tmdb_id}/watch", response_model=schemas.FilmWatch)
def film_watch(tmdb_id: int, request: Request, response: Response, region: str = "US",
               db: Session = Depends(get_db)):
    """Where the film can be watched, in the visitor's region (two letters; the
    site's default is the US). TMDB's data, which TMDB sources from JustWatch: the
    page that shows it must credit JustWatch."""
    ratelimit.check(request, "film-watch", limit=60, window_seconds=60)
    region = region.strip().upper()
    if not re.fullmatch(r"[A-Z]{2}", region):
        region = "US"
    ext = _get_ext(db, tmdb_id)
    if ext is not None and ext.handling == "held":  # no page, so nothing to watch
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This film does not have a page.")
    data = _from_tmdb(tmdb.watch, tmdb_id, region)
    response.headers["Cache-Control"] = WATCH_CACHE
    return data


@public.get("/api/films/{tmdb_id}/prompts", response_model=schemas.FilmPromptsResponse)
def film_prompts(tmdb_id: int, response: Response, db: Session = Depends(get_db)):
    # Never cached: an admin edit must show on the next visit.
    response.headers["Cache-Control"] = NO_CACHE
    ext = _get_ext(db, tmdb_id)
    handling = ext.handling if ext else "normal"
    if handling == "held":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This film does not have a page.")

    universal = _rows(db, None, "universal")
    lgn = _rows(db, ext.id, "lgn") if ext and handling == "normal" else []
    chosen, sources = [], {}
    for kind in KIND_ORDER:
        own = _by_kind(lgn, kind)
        sources[kind] = "lgn" if own else "universal"
        chosen += own or _by_kind(universal, kind)

    # Once LGN has written a kind's questions they are the ONLY ones offered for
    # it: no universal alternative, no AI set, no way back for the visitor. Only
    # a kind LGN has not written yet keeps the Universal | AI choice. (Admin can
    # still see and promote a stored AI set; it just isn't shown.)
    open_kinds = [k for k in KIND_ORDER if sources[k] != "lgn"]
    ai = None
    if ext and handling == "normal" and ext.ai_status == "ready" and open_kinds:
        rows = [r for r in _rows(db, ext.id, "ai") if r.kind in open_kinds]
        ai = _set(rows) if rows else None
    return schemas.FilmPromptsResponse(
        handling=handling,
        default_sources=sources,
        default=_set(chosen),
        ai=ai,
        ai_status=ext.ai_status if ext else "none",
    )


@public.post("/api/films/{tmdb_id}/ai")
async def film_ai_start(tmdb_id: int, request: Request, response: Response, db: Session = Depends(get_db)):
    """Called by the page once it has loaded. Idempotent: starts generation only
    if the film is eligible and nobody has already; otherwise just reports."""
    response.headers["Cache-Control"] = NO_CACHE
    ext = _get_ext(db, tmdb_id)
    if ext is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Open the film page first.")
    # Cheap exits before anything that costs a TMDB call or an AI call.
    if ext.handling != "normal" or ext.ai_status == "ready" or not film_ai.can_generate() \
            or film_ai.lgn_covers_every_kind(db, ext.id):
        return {"ai_status": ext.ai_status}
    if ext.ai_status == "pending" and ext.ai_attempted_at and \
            datetime.utcnow() - ext.ai_attempted_at < film_ai.STALE_PENDING:
        return {"ai_status": "pending"}

    ratelimit.check(request, "film-ai", limit=10, window_seconds=60)
    film = await run_in_threadpool(_tmdb_details, tmdb_id)
    if film.get("adult"):
        return {"ai_status": ext.ai_status}
    return {"ai_status": await film_ai.ensure_ai_prompts(db, ext, film)}


@public.post("/api/submissions/film-feedback", status_code=status.HTTP_201_CREATED)
def submit_film_feedback(payload: schemas.FilmFeedbackCreate, request: Request, db: Session = Depends(get_db)):
    """A suggestion, "something's off", or "can't find it". Goes to the admin
    inbox only -- never to the AI, never shown publicly."""
    # A filled honeypot is a bot: look successful, store nothing.
    if payload.website:
        return {"ok": True}
    ratelimit.check(request, "film-feedback", limit=5, window_seconds=60)

    message, suggested = _clean(payload.message), _clean(payload.suggested_text)
    title = _clean(payload.film_title)
    if payload.type == "not_found":
        if not title:
            raise HTTPException(422, "Tell us the film's title.")
    elif not (message or suggested):
        raise HTTPException(422, "Write a few words first.")

    ext = _get_ext(db, payload.tmdb_id) if payload.tmdb_id else None
    db.add(models.FilmFeedback(
        external_film_id=ext.id if ext else None,
        tmdb_id=payload.tmdb_id,
        film_title=title,
        type=payload.type,
        kind=payload.kind,
        dimension=payload.dimension,
        message=message,
        suggested_text=suggested,
        film_year_typed=_clean(payload.film_year_typed),
        email=_clean(payload.email),
    ))
    db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ admin


def _live_title(tmdb_id: int) -> tuple:
    try:
        film = tmdb.details(tmdb_id)
        return film["title"], film.get("year")
    except Exception:  # noqa: BLE001 -- a title is a nicety; the row still lists
        return None, None


@router.get("/api/admin/films", response_model=List[schemas.AdminFilmRow])
def admin_list_films(db: Session = Depends(get_db), _: bool = Depends(require_admin)):
    films = db.query(models.ExternalFilm).order_by(models.ExternalFilm.updated_at.desc()).all()
    counts = dict(
        db.query(models.FilmPrompt.external_film_id, func.count(models.FilmPrompt.id))
        .filter(models.FilmPrompt.source == "lgn")
        .group_by(models.FilmPrompt.external_film_id)
        .all()
    )
    with ThreadPoolExecutor(max_workers=8) as pool:
        titles = list(pool.map(_live_title, [f.tmdb_id for f in films])) if tmdb.is_available() else [(None, None)] * len(films)
    return [
        schemas.AdminFilmRow(
            id=f.id, tmdb_id=f.tmdb_id, title=t[0], year=t[1], handling=f.handling,
            has_care_note=bool(f.care_note), ai_status=f.ai_status, lgn_prompt_count=counts.get(f.id, 0),
        )
        for f, t in zip(films, titles)
    ]


@router.get("/api/admin/films/search", response_model=schemas.FilmSearchResponse)
def admin_search_films(q: str = "", _: bool = Depends(require_admin)):
    """TMDB search for adding a film (no LGN capsules, no CDN)."""
    if not tmdb.is_available():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "TMDB_API_KEY is not set.")
    try:
        hits = tmdb.search(q)
    except tmdb.TmdbError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"TMDB: {exc.kind.replace('_', ' ')}.")
    return schemas.FilmSearchResponse(results=[schemas.FilmSearchResult(source="tmdb", **h) for h in hits])


@router.post("/api/admin/films", response_model=schemas.AdminFilmDetail, status_code=status.HTTP_201_CREATED)
def admin_add_film(body: schemas.AdminFilmCreate, db: Session = Depends(get_db), _: bool = Depends(require_admin)):
    film = _tmdb_details(body.tmdb_id)
    if film.get("adult"):
        raise HTTPException(422, "Adult titles can't be added.")
    ext = _get_or_create_ext(db, body.tmdb_id)
    return _admin_detail(db, ext, film)


def _admin_ext(db: Session, tmdb_id: int) -> models.ExternalFilm:
    ext = _get_ext(db, tmdb_id)
    if ext is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That film hasn't been added yet.")
    return ext


def _admin_prompt(row: models.FilmPrompt) -> schemas.AdminPrompt:
    return schemas.AdminPrompt.model_validate(row)


def _admin_detail(db: Session, ext: models.ExternalFilm, film: Optional[dict]) -> schemas.AdminFilmDetail:
    if film is None and tmdb.is_available():
        try:
            film = tmdb.details(ext.tmdb_id)
        except tmdb.TmdbError:
            film = None
    return schemas.AdminFilmDetail(
        id=ext.id,
        tmdb_id=ext.tmdb_id,
        film=_detail_out(film, ext, None, reveal=True) if film else None,
        handling=ext.handling,
        care_note=ext.care_note,
        logline=ext.logline,
        ai_status=ext.ai_status,
        ai_model=ext.ai_model,
        lgn=[_admin_prompt(r) for r in _sorted(_rows(db, ext.id, "lgn"))],
        ai=[_admin_prompt(r) for r in _sorted(_rows(db, ext.id, "ai"))],
    )


@router.get("/api/admin/films/{tmdb_id}", response_model=schemas.AdminFilmDetail)
def admin_get_film(tmdb_id: int, db: Session = Depends(get_db), _: bool = Depends(require_admin)):
    return _admin_detail(db, _admin_ext(db, tmdb_id), None)


@router.patch("/api/admin/films/{tmdb_id}", response_model=schemas.AdminFilmDetail)
def admin_update_film(tmdb_id: int, body: schemas.AdminFilmUpdate, db: Session = Depends(get_db),
                      _: bool = Depends(require_admin)):
    ext = _admin_ext(db, tmdb_id)
    data = body.model_dump(exclude_unset=True)
    if "handling" in data and data["handling"] is not None:
        ext.handling = data["handling"]
    if "care_note" in data:
        ext.care_note = _clean(data["care_note"])
    if "logline" in data:
        ext.logline = _clean(data["logline"])
    db.commit()
    return _admin_detail(db, ext, None)


@router.delete("/api/admin/films/{tmdb_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_film(tmdb_id: int, db: Session = Depends(get_db), _: bool = Depends(require_admin)):
    """Forget LGN's settings and writing for a film (it reverts to universal)."""
    ext = _admin_ext(db, tmdb_id)
    db.query(models.FilmPrompt).filter(models.FilmPrompt.external_film_id == ext.id).delete()
    db.delete(ext)
    db.commit()


@router.delete("/api/admin/films/{tmdb_id}/ai", response_model=schemas.AdminFilmDetail)
def admin_delete_ai(tmdb_id: int, db: Session = Depends(get_db), _: bool = Depends(require_admin)):
    """Delete the AI set. Resets the film to "none", so the next visit
    generates a fresh one -- the regenerate path. Also clears "unavailable"."""
    ext = _admin_ext(db, tmdb_id)
    db.query(models.FilmPrompt).filter(
        models.FilmPrompt.external_film_id == ext.id, models.FilmPrompt.source == "ai"
    ).delete()
    ext.ai_status = "none"
    ext.ai_model = None
    ext.ai_prompt_version = None
    db.commit()
    return _admin_detail(db, ext, None)


@router.post("/api/admin/films/{tmdb_id}/promote", response_model=schemas.AdminFilmDetail)
def admin_promote_ai(tmdb_id: int, body: schemas.AdminPromote, db: Session = Depends(get_db),
                     _: bool = Depends(require_admin)):
    """Copy the AI set into the film's LGN set, which then becomes its default.
    The AI rows stay (delete them separately if you want them gone)."""
    ext = _admin_ext(db, tmdb_id)
    ai, lgn = _rows(db, ext.id, "ai"), _rows(db, ext.id, "lgn")
    if not ai:
        raise HTTPException(status.HTTP_409_CONFLICT, "This film has no AI questions to promote.")
    clashes = [k for k in KIND_ORDER if _by_kind(ai, k) and _by_kind(lgn, k)]
    if clashes and not body.replace:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This film already has its own LGN {' and '.join(clashes)}. Promoting would replace it.",
        )
    for row in lgn:
        if row.kind in clashes:
            db.delete(row)
    for row in ai:
        db.add(models.FilmPrompt(
            external_film_id=ext.id, source="lgn", kind=row.kind, dimension=row.dimension,
            position=row.position, title=row.title, content=row.content, steps=row.steps, tips=row.tips,
        ))
    db.commit()
    return _admin_detail(db, ext, None)


# --- prompts (universal when tmdb_id is omitted) ---


def _check_prompt(kind: str, content: Optional[str], steps: Optional[str]) -> None:
    if kind == "reflect" and not (content or "").strip():
        raise HTTPException(422, "A Reflect question needs its question text.")
    if kind == "practice" and not (steps or "").strip():
        raise HTTPException(422, "A Practice action needs at least one step.")


@router.get("/api/admin/film-prompts/universal", response_model=List[schemas.AdminPrompt])
def admin_universal_prompts(db: Session = Depends(get_db), _: bool = Depends(require_admin)):
    return [_admin_prompt(r) for r in _sorted(_rows(db, None, "universal"))]


@router.post("/api/admin/film-prompts", response_model=schemas.AdminPrompt, status_code=status.HTTP_201_CREATED)
def admin_create_prompt(body: schemas.AdminPromptCreate, db: Session = Depends(get_db),
                        _: bool = Depends(require_admin)):
    _check_prompt(body.kind, body.content, body.steps)
    ext_id, source = None, "universal"
    if body.tmdb_id is not None:
        ext_id, source = _admin_ext(db, body.tmdb_id).id, "lgn"
    peers = [r for r in _rows(db, ext_id, source) if r.kind == body.kind and r.dimension == body.dimension]
    row = models.FilmPrompt(
        external_film_id=ext_id, source=source, kind=body.kind, dimension=body.dimension,
        position=max([r.position for r in peers], default=0) + 1,
        title=_clean(body.title) or f"{body.dimension.capitalize()} {'question' if body.kind == 'reflect' else 'practice'}",
        content=_clean(body.content), steps=_clean(body.steps), tips=_clean(body.tips),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _admin_prompt(row)


@router.patch("/api/admin/film-prompts/{prompt_id}", response_model=schemas.AdminPrompt)
def admin_update_prompt(prompt_id: int, body: schemas.AdminPromptUpdate, db: Session = Depends(get_db),
                        _: bool = Depends(require_admin)):
    row = db.query(models.FilmPrompt).filter(models.FilmPrompt.id == prompt_id).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prompt not found.")
    for key, value in body.model_dump(exclude_unset=True).items():
        if key in ("dimension", "position") and value is None:
            continue
        setattr(row, key, value if key in ("dimension", "position") else _clean(value))
    _check_prompt(row.kind, row.content, row.steps)
    db.commit()
    db.refresh(row)
    return _admin_prompt(row)


@router.delete("/api/admin/film-prompts/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_prompt(prompt_id: int, db: Session = Depends(get_db), _: bool = Depends(require_admin)):
    row = db.query(models.FilmPrompt).filter(models.FilmPrompt.id == prompt_id).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prompt not found.")
    db.delete(row)
    db.commit()


# --- inbox ---


@router.get("/api/admin/film-feedback", response_model=List[schemas.FilmFeedbackOut])
def admin_list_feedback(status_filter: Optional[str] = None, db: Session = Depends(get_db),
                        _: bool = Depends(require_admin)):
    q = db.query(models.FilmFeedback)
    if status_filter in ("new", "reviewed", "resolved"):
        q = q.filter(models.FilmFeedback.status == status_filter)
    return q.order_by(models.FilmFeedback.created_at.desc(), models.FilmFeedback.id.desc()).limit(500).all()


@router.patch("/api/admin/film-feedback/{item_id}", response_model=schemas.FilmFeedbackOut)
def admin_update_feedback(item_id: int, body: schemas.FilmFeedbackUpdate, db: Session = Depends(get_db),
                          _: bool = Depends(require_admin)):
    row = db.query(models.FilmFeedback).filter(models.FilmFeedback.id == item_id).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feedback not found.")
    row.status = body.status
    db.commit()
    db.refresh(row)
    return row


@router.delete("/api/admin/film-feedback/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_feedback(item_id: int, db: Session = Depends(get_db), _: bool = Depends(require_admin)):
    row = db.query(models.FilmFeedback).filter(models.FilmFeedback.id == item_id).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feedback not found.")
    db.delete(row)
    db.commit()


# ------------------------------------------------------------------ flag


@router.get("/api/features", response_model=schemas.PublicFeatures)
def public_features(response: Response, db: Session = Depends(get_db)):
    """What the site should show. Never cached: a switch must take effect now."""
    response.headers["Cache-Control"] = NO_CACHE
    return schemas.PublicFeatures(beyond_the_screen=features.beyond_enabled(db))


def _feature_state(db: Session) -> schemas.FeatureState:
    return schemas.FeatureState(
        enabled=features.beyond_enabled(db),
        source=features.beyond_source(db),
        default=features.beyond_default(),
    )


@router.get("/api/admin/features/beyond-the-screen", response_model=schemas.FeatureState)
def admin_get_feature(db: Session = Depends(get_db), _: bool = Depends(require_admin)):
    return _feature_state(db)


@router.put("/api/admin/features/beyond-the-screen", response_model=schemas.FeatureState)
def admin_set_feature(body: schemas.FeatureUpdate, db: Session = Depends(get_db), _: bool = Depends(require_admin)):
    features.set_beyond(db, body.enabled)
    return _feature_state(db)


router.include_router(public)
