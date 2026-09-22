import json
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List

import anthropic

from app.database import engine, Base, SessionLocal, get_db
from app.config import settings
from app import geme, models, schemas
from app.auth import create_token, require_admin, require_configured, verify_password
from app.video import fetch_vimeo_metadata, parse_video_source

# True on Vercel, at build time and at runtime alike -- Vercel sets VERCEL=1 in
# both. Used only to keep local-development bootstrapping out of a deployment.
IS_SERVERLESS = bool(os.getenv("VERCEL"))


def _should_bootstrap_database() -> bool:
    """Whether this process should create and seed tables on startup.

    Local development only. Two reasons it must not run on a deployment:

    1. Supabase owns the deployed schema, through the migrations in
       `supabase/migrations`. `create_all` would race those -- it creates
       whatever the *models* currently say and silently skips tables that
       already exist, so a half-migrated database would be papered over rather
       than reported.
    2. This ran once per process. A serverless function starts a new process
       per cold start, so it would become a schema check and a `SELECT count(*)`
       against production on every one of them.

    Requires ENV=development explicitly, rather than trusting `!= production`,
    so a deployment that forgets to set ENV at all still fails safe.
    """
    return settings.ENV == "development" and not IS_SERVERLESS


def _bootstrap_database():
    """Create the tables and seed one sample capsule if the database is empty."""
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(models.Capsule).count() == 0:
            sample_capsule = models.Capsule(
                month="2026-07",
                title="Lightpoles",
                description="A community platform that offers one short film each month as common ground for reflection, discussion, and practice.",
                is_active=True,
                pre_watch_prompt="Who comes to mind when you hear the phrase “a light in the darkness”? What did they do that made them a light?",
                pre_watch_supporting_text="You don’t need to write anything down. Simply carry the question with you as you watch."
            )
            db.add(sample_capsule)
            db.commit()
            db.refresh(sample_capsule)

            # Mirrors supabase/seed.sql so local SQLite dev exercises the same
            # Vimeo embed path as a real capsule, rather than a progressive mp4.
            # Poster and runtime come from Vimeo itself rather than a stock
            # image, so local dev shows a real frame of the film. Best-effort:
            # offline, these stay NULL and the player draws its own fallback.
            meta = fetch_vimeo_metadata("1052574030", "53c90178cb")

            sample_film = models.Film(
                capsule_id=sample_capsule.id,
                title="For the Love of God!",
                director="TBD",
                duration="10 min",
                video_provider="vimeo",
                video_id="1052574030",
                video_hash="53c90178cb",
                video_aspect_ratio="16 / 9",
                video_duration_seconds=meta.get("duration_seconds"),
                thumbnail_url=meta.get("thumbnail_url"),
                description="A short film exploring purpose and light in the darkness.",
                theme="Purpose"
            )
            db.add(sample_film)
            db.commit()
    except Exception as e:
        print(f"Database startup/seed error: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if _should_bootstrap_database():
        _bootstrap_database()
    yield

app = FastAPI(
    title="LGN Platform API",
    description="API for the cinema production platform and monthly capsules.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if "*" not in origins else ["*"],
    allow_credentials=True if "*" not in origins else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": f"Internal Server Error: {str(exc)}"},
        headers={"Access-Control-Allow-Origin": "*"}
    )

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _published_filter():
    """SQL condition selecting the capsules the public may see.

        published == is_active OR (publish_at IS NOT NULL AND publish_at <= utcnow())

    The rule itself lives in exactly one place -- `Capsule.is_published` in
    app/models.py, a hybrid property whose Python and SQL forms are written
    together. This helper and `_is_published` below are the two named doors
    onto it, so no endpoint ever spells the comparison out again.

    Evaluated at read time, which is why scheduled publishing needs no cron job
    and no background worker: the moment `publish_at` slips into the past, the
    next request already sees the capsule.
    """
    return models.Capsule.is_published


def _is_published(capsule: models.Capsule) -> bool:
    """The same rule as `_published_filter`, applied to one loaded capsule."""
    return bool(capsule.is_published)


def _capsule_not_found(capsule_id: int) -> HTTPException:
    """404 for a capsule the caller may not see.

    Deliberately identical to the 404 for an id that does not exist at all: a
    public request for an unpublished capsule must not be able to tell a hidden
    draft from a typo. A capsule detail carries the film's video_id and
    video_hash, so confirming that id 7 exists but is embargoed would be enough
    to make an unreleased film findable.
    """
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Capsule with id {capsule_id} not found.",
    )


def _capsule_detail(capsule: models.Capsule) -> schemas.CapsuleDetail:
    """Assemble a CapsuleDetail, tolerating a broken/absent relation.

    Each relation is loaded defensively so a single bad row (e.g. a column that
    a not-yet-applied migration has not added) degrades that one section rather
    than 500-ing the whole capsule page.
    """
    film = None
    reflections = []
    discussion_circles = []
    practices = []

    try:
        film = capsule.film
    except Exception as e:
        print(f"Error fetching film relation: {e}")

    try:
        reflections = capsule.reflections or []
    except Exception as e:
        print(f"Error fetching reflections relation: {e}")

    try:
        discussion_circles = capsule.discussion_circles or []
    except Exception as e:
        print(f"Error fetching discussion_circles relation: {e}")

    try:
        practices = capsule.practices or []
    except Exception as e:
        print(f"Error fetching practices relation: {e}")

    return schemas.CapsuleDetail(
        id=capsule.id,
        month=capsule.month,
        title=capsule.title,
        description=capsule.description,
        is_active=capsule.is_active,
        publish_at=capsule.publish_at,
        is_published=_is_published(capsule),
        pre_watch_prompt=capsule.pre_watch_prompt,
        pre_watch_supporting_text=capsule.pre_watch_supporting_text,
        created_at=capsule.created_at,
        film=film,
        reflections=reflections,
        discussion_circles=discussion_circles,
        practices=practices,
    )


def _enrich_film_payload(payload: dict) -> dict:
    """Normalize and enrich a film payload in place, returning it.

    An admin may paste whatever the studio sent them (a raw <iframe> embed
    snippet, a player.vimeo.com URL, a vimeo.com/ID/HASH link, or an mp4). If
    no provider was supplied explicitly, derive the source fields from it.
    Explicitly-supplied values always win.

    Then pull the real poster frame and runtime from Vimeo once, at write time,
    so the player never has to look them up at render time. Best-effort: any
    failure just leaves the fields NULL and the player falls back gracefully.
    """
    if payload.get("video_url") and not payload.get("video_provider"):
        source = parse_video_source(payload["video_url"])
        if source.provider:
            payload["video_provider"] = source.provider
        if source.video_id and not payload.get("video_id"):
            payload["video_id"] = source.video_id
        if source.video_hash and not payload.get("video_hash"):
            payload["video_hash"] = source.video_hash

    if payload.get("video_provider") == "vimeo" and payload.get("video_id"):
        if not payload.get("thumbnail_url") or not payload.get("video_duration_seconds"):
            meta = fetch_vimeo_metadata(payload["video_id"], payload.get("video_hash"))
            if meta.get("thumbnail_url") and not payload.get("thumbnail_url"):
                payload["thumbnail_url"] = meta["thumbnail_url"]
            if meta.get("duration_seconds") and not payload.get("video_duration_seconds"):
                payload["video_duration_seconds"] = meta["duration_seconds"]

    return payload


def _get_or_404(db: Session, model, item_id: int, label: str):
    """Fetch a row by primary key or raise a 404 naming what was missing."""
    instance = db.query(model).filter(model.id == item_id).first()
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{label} with id {item_id} not found.",
        )
    return instance


# Endpoints
@app.get("/api/health")
def health_check():
    return {"status": "healthy", "environment": settings.ENV}

@app.get("/api/capsules/active", response_model=schemas.CapsuleDetail)
def get_active_capsule(db: Session = Depends(get_db)):
    """
    Retrieve the current monthly capsule: the PUBLISHED capsule with the
    greatest `month`.

    `month` is `YYYY-MM`, so lexical ordering is chronological. Many capsules
    may be published at once (together they are the public tab bar); this is
    simply the newest of them, so publishing an older month never steals the
    current slot from a newer one.

    Includes the monthly film, reflections, gatherings, and practices.

    404s when nothing is published. It deliberately does NOT fall back to the
    most recently created capsule as it once did -- that fallback would serve a
    draft or an embargoed capsule, film video ids and all, to anyone.
    """
    try:
        capsule = (
            db.query(models.Capsule)
            .filter(_published_filter())
            .order_by(models.Capsule.month.desc())
            .first()
        )

        if not capsule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active monthly capsule found."
            )

        return _capsule_detail(capsule)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_active_capsule: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching active capsule: {str(e)}"
        )

@app.get("/api/capsules", response_model=List[schemas.Capsule])
def list_capsules(db: Session = Depends(get_db)):
    """
    List every PUBLISHED capsule, newest month first.

    This feeds the public site's capsule tab bar. Drafts and capsules whose
    `publish_at` has not arrived yet are omitted entirely -- use
    GET /api/admin/capsules to see those.
    """
    return (
        db.query(models.Capsule)
        .filter(_published_filter())
        .order_by(models.Capsule.month.desc())
        .all()
    )

@app.get("/api/capsules/{capsule_id}", response_model=schemas.CapsuleDetail)
def get_capsule_detail(capsule_id: int, db: Session = Depends(get_db)):
    """
    Get a specific PUBLISHED capsule with all its features.

    An unpublished capsule 404s with the same detail as a nonexistent id, so
    this endpoint cannot be used to confirm that a hidden draft exists.
    """
    try:
        capsule = (
            db.query(models.Capsule)
            .filter(models.Capsule.id == capsule_id, _published_filter())
            .first()
        )
        if not capsule:
            raise _capsule_not_found(capsule_id)

        return _capsule_detail(capsule)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_capsule_detail: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching capsule detail: {str(e)}"
        )


@app.post("/api/capsules", response_model=schemas.Capsule, status_code=status.HTTP_201_CREATED)
def create_capsule(
    capsule: schemas.CapsuleCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    """
    Create a new capsule. Admin only.

    Accepts `is_active` (published now) and `publish_at` (scheduled go-live,
    naive UTC). Publishing this capsule does NOT unpublish any other -- many
    capsules are published at once by design.
    """
    db_capsule = db.query(models.Capsule).filter(models.Capsule.month == capsule.month).first()
    if db_capsule:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Capsule for month {capsule.month} already exists."
        )

    db_capsule = models.Capsule(**capsule.model_dump())
    db.add(db_capsule)
    db.commit()
    db.refresh(db_capsule)
    return db_capsule

@app.post("/api/capsules/{capsule_id}/film", response_model=schemas.Film, status_code=status.HTTP_201_CREATED)
def create_film_for_capsule(
    capsule_id: int,
    film: schemas.FilmCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    """
    Add a film to a specific capsule. Admin only.

    Use PUT /api/admin/capsules/{capsule_id}/film to upsert instead of erroring
    when the capsule already has a film.
    """
    capsule = db.query(models.Capsule).filter(models.Capsule.id == capsule_id).first()
    if not capsule:
        raise HTTPException(status_code=404, detail="Capsule not found")

    if capsule.film:
        raise HTTPException(status_code=400, detail="Capsule already has a film associated with it")

    payload = _enrich_film_payload(film.model_dump())

    db_film = models.Film(**payload, capsule_id=capsule_id)
    db.add(db_film)
    db.commit()
    db.refresh(db_film)
    return db_film

@app.post("/api/capsules/{capsule_id}/reflections", response_model=schemas.Reflection, status_code=status.HTTP_201_CREATED)
def add_reflection(
    capsule_id: int,
    reflection: schemas.ReflectionCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    """
    Add a reflection to a specific capsule. Admin only.
    """
    capsule = db.query(models.Capsule).filter(models.Capsule.id == capsule_id).first()
    if not capsule:
        raise HTTPException(status_code=404, detail="Capsule not found")
        
    db_reflection = models.Reflection(**reflection.model_dump(), capsule_id=capsule_id)
    db.add(db_reflection)
    db.commit()
    db.refresh(db_reflection)
    return db_reflection

@app.post("/api/capsules/{capsule_id}/discussion_circles", response_model=schemas.DiscussionCircle, status_code=status.HTTP_201_CREATED)
def add_discussion_circle(
    capsule_id: int,
    circle: schemas.DiscussionCircleCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    """
    Add a discussion circle to a specific capsule. Admin only.
    """
    capsule = db.query(models.Capsule).filter(models.Capsule.id == capsule_id).first()
    if not capsule:
        raise HTTPException(status_code=404, detail="Capsule not found")
        
    db_circle = models.DiscussionCircle(**circle.model_dump(), capsule_id=capsule_id)
    db.add(db_circle)
    db.commit()
    db.refresh(db_circle)
    return db_circle

@app.post("/api/capsules/{capsule_id}/practices", response_model=schemas.Practice, status_code=status.HTTP_201_CREATED)
def add_practice(
    capsule_id: int,
    practice: schemas.PracticeCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    """
    Add a practice to a specific capsule. Admin only.
    """
    capsule = db.query(models.Capsule).filter(models.Capsule.id == capsule_id).first()
    if not capsule:
        raise HTTPException(status_code=404, detail="Capsule not found")
        
    db_practice = models.Practice(**practice.model_dump(), capsule_id=capsule_id)
    db.add(db_practice)
    db.commit()
    db.refresh(db_practice)
    return db_practice

@app.post("/api/submissions/contact", response_model=schemas.ContactSubmission, status_code=status.HTTP_201_CREATED)
def submit_contact(submission: schemas.ContactSubmissionCreate, db: Session = Depends(get_db)):
    """
    Submit a contact message/inquiry.
    """
    db_submission = models.ContactSubmission(**submission.model_dump())
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)
    return db_submission

@app.post("/api/submissions/film", response_model=schemas.FilmSubmission, status_code=status.HTTP_201_CREATED)
def submit_film(submission: schemas.FilmSubmissionCreate, db: Session = Depends(get_db)):
    """
    Submit a short film for consideration.
    """
    db_submission = models.FilmSubmission(**submission.model_dump())
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)
    return db_submission

@app.post("/api/submissions/reflection", response_model=schemas.UserReflection, status_code=status.HTTP_201_CREATED)
def submit_reflection(submission: schemas.UserReflectionCreate, db: Session = Depends(get_db)):
    """
    Submit a user's private/public capsule reflection answers.
    """
    capsule = db.query(models.Capsule).filter(models.Capsule.id == submission.capsule_id).first()
    if not capsule:
        raise HTTPException(status_code=404, detail="Capsule not found")
        
    db_reflection = models.UserReflection(**submission.model_dump())
    db.add(db_reflection)
    db.commit()
    db.refresh(db_reflection)
    return db_reflection

@app.post("/api/submissions/storyboard", response_model=schemas.StoryboardSubmission, status_code=status.HTTP_201_CREATED)
def submit_storyboard(submission: schemas.StoryboardSubmissionCreate, db: Session = Depends(get_db)):
    """
    Submit a contribution to the Storyboard (reflection, link, image info).
    """
    capsule = db.query(models.Capsule).filter(models.Capsule.id == submission.capsule_id).first()
    if not capsule:
        raise HTTPException(status_code=404, detail="Capsule not found")
        
    db_submission = models.StoryboardSubmission(**submission.model_dump())
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)
    return db_submission


# ===========================================================================
# Admin portal
#
# Everything below requires the shared admin password (see app/auth.py).
# `require_admin` answers 503 when no ADMIN_PASSWORD is configured and 401 for
# a missing, expired, or tampered token -- an unconfigured deploy fails closed.
#
# PATCH bodies are applied with `model_dump(exclude_unset=True)`: an omitted
# field is left untouched, while an explicit `null` clears a nullable column.
# ===========================================================================

# --- Auth ------------------------------------------------------------------

@app.post("/api/admin/login", response_model=schemas.AdminLoginResponse)
def admin_login(payload: schemas.AdminLoginRequest):
    """
    Exchange the shared admin password for a signed, expiring bearer token.

    The password is never logged or echoed back, and is compared in constant
    time.
    """
    require_configured()

    if not verify_password(payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password",
        )

    token, expires_at = create_token()
    return schemas.AdminLoginResponse(token=token, expires_at=expires_at)


@app.get("/api/admin/session", response_model=schemas.AdminSessionResponse)
def admin_session(_: bool = Depends(require_admin)):
    """
    Validate a stored token so the portal can restore a session after a reload.
    """
    return schemas.AdminSessionResponse(valid=True)


# --- Capsules --------------------------------------------------------------

@app.get("/api/admin/capsules", response_model=List[schemas.Capsule])
def admin_list_capsules(
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    """
    Every capsule -- past, current, and upcoming -- newest month first.

    Unlike the public GET /api/capsules this deliberately includes drafts and
    capsules whose `publish_at` has not arrived yet: previewing unpublished
    content is the whole point of the editor. Each row still carries the
    derived `is_published`, so the portal can label a capsule
    draft / scheduled / published without doing its own clock arithmetic.
    """
    return db.query(models.Capsule).order_by(models.Capsule.month.desc()).all()


@app.get("/api/admin/capsules/{capsule_id}", response_model=schemas.CapsuleDetail)
def admin_get_capsule(
    capsule_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    """
    A single capsule with its film, reflections, circles, and practices.

    Unfiltered by publication state -- this is how the editor previews a draft
    or a scheduled capsule before it goes live.
    """
    capsule = _get_or_404(db, models.Capsule, capsule_id, "Capsule")
    return _capsule_detail(capsule)


@app.post("/api/admin/capsules", response_model=schemas.Capsule, status_code=status.HTTP_201_CREATED)
def admin_create_capsule(
    capsule: schemas.CapsuleCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    """
    Create a capsule. Same rules as POST /api/capsules.
    """
    return create_capsule(capsule=capsule, db=db, _=True)


@app.patch("/api/admin/capsules/{capsule_id}", response_model=schemas.Capsule)
def admin_update_capsule(
    capsule_id: int,
    updates: schemas.CapsuleUpdate,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    """
    Partially update a capsule. Omitted fields are left untouched.

    Accepts `is_active` (published now) and `publish_at` (scheduled go-live,
    naive UTC; send an explicit null to clear the schedule and return the
    capsule to draft). Publishing this capsule does NOT unpublish any other.
    """
    capsule = _get_or_404(db, models.Capsule, capsule_id, "Capsule")
    changes = updates.model_dump(exclude_unset=True)

    # `month` is unique -- reject a collision rather than letting the DB raise.
    new_month = changes.get("month")
    if new_month and new_month != capsule.month:
        clash = db.query(models.Capsule).filter(
            models.Capsule.month == new_month,
            models.Capsule.id != capsule_id,
        ).first()
        if clash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Capsule for month {new_month} already exists.",
            )

    for field, value in changes.items():
        setattr(capsule, field, value)

    db.commit()
    db.refresh(capsule)
    return capsule


@app.delete("/api/admin/capsules/{capsule_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_capsule(
    capsule_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    """
    Delete a capsule and everything hanging off it (cascade delete-orphan).
    """
    capsule = _get_or_404(db, models.Capsule, capsule_id, "Capsule")
    db.delete(capsule)
    db.commit()
    return None


# --- Film (1:1 with a capsule, so PUT upserts) ------------------------------

@app.put("/api/admin/capsules/{capsule_id}/film", response_model=schemas.Film)
def admin_upsert_film(
    capsule_id: int,
    film: schemas.FilmCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    """
    Create or replace the capsule's film.

    A capsule has at most one film, so the editor should never have to know
    whether it is creating or updating -- hence PUT rather than POST/PATCH.
    Runs the same embed parsing and Vimeo enrichment as POST
    /api/capsules/{id}/film.
    """
    capsule = _get_or_404(db, models.Capsule, capsule_id, "Capsule")
    payload = _enrich_film_payload(film.model_dump())

    db_film = capsule.film
    if db_film is None:
        db_film = models.Film(**payload, capsule_id=capsule_id)
        db.add(db_film)
    else:
        for field, value in payload.items():
            setattr(db_film, field, value)

    db.commit()
    db.refresh(db_film)
    return db_film


# --- Reflections -----------------------------------------------------------

@app.post(
    "/api/admin/capsules/{capsule_id}/reflections",
    response_model=schemas.Reflection,
    status_code=status.HTTP_201_CREATED,
)
def admin_create_reflection(
    capsule_id: int,
    reflection: schemas.ReflectionCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    return add_reflection(capsule_id=capsule_id, reflection=reflection, db=db, _=True)


@app.patch("/api/admin/reflections/{item_id}", response_model=schemas.Reflection)
def admin_update_reflection(
    item_id: int,
    updates: schemas.ReflectionUpdate,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    item = _get_or_404(db, models.Reflection, item_id, "Reflection")
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@app.delete("/api/admin/reflections/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_reflection(
    item_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    db.delete(_get_or_404(db, models.Reflection, item_id, "Reflection"))
    db.commit()
    return None


# --- Discussion circles ----------------------------------------------------

@app.post(
    "/api/admin/capsules/{capsule_id}/discussion_circles",
    response_model=schemas.DiscussionCircle,
    status_code=status.HTTP_201_CREATED,
)
def admin_create_discussion_circle(
    capsule_id: int,
    circle: schemas.DiscussionCircleCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    return add_discussion_circle(capsule_id=capsule_id, circle=circle, db=db, _=True)


@app.patch("/api/admin/discussion_circles/{item_id}", response_model=schemas.DiscussionCircle)
def admin_update_discussion_circle(
    item_id: int,
    updates: schemas.DiscussionCircleUpdate,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    item = _get_or_404(db, models.DiscussionCircle, item_id, "Discussion circle")
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@app.delete("/api/admin/discussion_circles/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_discussion_circle(
    item_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    db.delete(_get_or_404(db, models.DiscussionCircle, item_id, "Discussion circle"))
    db.commit()
    return None


# --- Practices -------------------------------------------------------------

@app.post(
    "/api/admin/capsules/{capsule_id}/practices",
    response_model=schemas.Practice,
    status_code=status.HTTP_201_CREATED,
)
def admin_create_practice(
    capsule_id: int,
    practice: schemas.PracticeCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    return add_practice(capsule_id=capsule_id, practice=practice, db=db, _=True)


@app.patch("/api/admin/practices/{item_id}", response_model=schemas.Practice)
def admin_update_practice(
    item_id: int,
    updates: schemas.PracticeUpdate,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    item = _get_or_404(db, models.Practice, item_id, "Practice")
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@app.delete("/api/admin/practices/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_practice(
    item_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(require_admin),
):
    db.delete(_get_or_404(db, models.Practice, item_id, "Practice"))
    db.commit()
    return None

# Geme -- Practice > Keep Exploring > Take It Inward
#
# Geme's chat is stateless on the server: the frontend replays the transcript on
# every turn and nothing a visitor types is written to the database.

def _geme_system_prompt(capsule_id: int | None, db: Session, persona: str | None = None) -> str:
    """System prompt for a capsule, so Geme knows what was just watched."""
    if capsule_id is None:
        return geme.build_system_prompt(persona=persona)

    capsule = db.query(models.Capsule).filter(models.Capsule.id == capsule_id).first()
    if not capsule:
        raise HTTPException(status_code=404, detail="Capsule not found")

    practice = None
    try:
        practices = capsule.practices or []
        practice = practices[0] if practices else None
    except Exception as e:
        print(f"Error fetching practices relation for Geme: {e}")

    return geme.build_system_prompt(capsule=capsule, practice=practice, persona=persona)


def _geme_tuning(payload: schemas.GemeChatRequest) -> schemas.GemeTuning:
    """The caller's draft settings, or an empty set when tuning is switched off.

    Overrides let a client supply Geme's whole system prompt, so they are honoured
    only where GEME_DEBUG says it is safe. Elsewhere they are ignored rather than
    rejected, so a stale panel can't break an ordinary conversation.
    """
    if payload.tuning and geme.debug_enabled():
        return payload.tuning
    return schemas.GemeTuning()


def _geme_client():
    client = geme.get_client()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Geme is not configured on this server (no ANTHROPIC_API_KEY set)."
        )
    return client


def _geme_error_detail(exc: Exception) -> str:
    """Map an SDK failure onto something safe to show a visitor."""
    if isinstance(exc, anthropic.RateLimitError):
        return "Geme is talking with a lot of people right now. Try again in a moment."
    if isinstance(exc, (anthropic.AuthenticationError, anthropic.PermissionDeniedError)):
        return "Geme isn't set up correctly on this server."
    if isinstance(exc, anthropic.APIConnectionError):
        return "Geme couldn't be reached. Check your connection and try again."
    return "Geme couldn't finish that thought. Try again."


@app.get("/api/geme/status", response_model=schemas.GemeStatus)
def geme_status():
    """Whether the Geme chat is available, so the frontend can hide it if not."""
    return schemas.GemeStatus(enabled=geme.is_enabled(), debug=geme.debug_enabled())


@app.get("/api/geme/config", response_model=schemas.GemeConfig)
def geme_config(capsule_id: int | None = None, db: Session = Depends(get_db)):
    """Geme's current persona and parameters, for the dev tuning panel to edit."""
    if not geme.debug_enabled():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Geme tuning is not enabled on this server."
        )

    config = geme.defaults()
    return schemas.GemeConfig(
        **config,
        assembled_system_prompt=_geme_system_prompt(capsule_id, db),
    )


@app.post("/api/geme/chat", response_model=schemas.GemeChatResponse)
async def geme_chat(payload: schemas.GemeChatRequest, db: Session = Depends(get_db)):
    """One Geme turn, returned whole. The streaming route is what the UI uses."""
    client = _geme_client()
    tuning = _geme_tuning(payload)
    system = _geme_system_prompt(payload.capsule_id, db, persona=tuning.persona)
    messages = geme.build_messages(
        payload.messages,
        opening_turn=tuning.opening_turn,
        max_turns=tuning.max_turns,
        max_chars=tuning.max_chars_per_turn,
    )

    try:
        response = await client.messages.create(**geme.request_kwargs(
            system, messages,
            model=tuning.model, max_tokens=tuning.max_tokens, effort=tuning.effort,
        ))
    except anthropic.APIError as e:
        print(f"Geme chat error: {e}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=_geme_error_detail(e))

    text = "".join(block.text for block in response.content if block.type == "text")
    reply, next_step = geme.split_next_step(text)
    return schemas.GemeChatResponse(reply=reply, next_step=next_step)


@app.post("/api/geme/chat/stream")
async def geme_chat_stream(payload: schemas.GemeChatRequest, db: Session = Depends(get_db)):
    """Server-sent events: `delta` as Geme types, then one `done` (or `error`)."""
    client = _geme_client()
    tuning = _geme_tuning(payload)
    system = _geme_system_prompt(payload.capsule_id, db, persona=tuning.persona)
    messages = geme.build_messages(
        payload.messages,
        opening_turn=tuning.opening_turn,
        max_turns=tuning.max_turns,
        max_chars=tuning.max_chars_per_turn,
    )
    kwargs = geme.request_kwargs(
        system, messages,
        model=tuning.model, max_tokens=tuning.max_tokens, effort=tuning.effort,
    )

    async def events():
        step_filter = geme.NextStepFilter()
        try:
            async with client.messages.stream(**kwargs) as stream:
                async for chunk in stream.text_stream:
                    visible = step_filter.feed(chunk)
                    if visible:
                        yield f"data: {json.dumps({'type': 'delta', 'text': visible})}\n\n"

            tail = step_filter.flush()
            if tail:
                yield f"data: {json.dumps({'type': 'delta', 'text': tail})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'next_step': step_filter.next_step})}\n\n"
        except anthropic.APIError as e:
            print(f"Geme stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': _geme_error_detail(e)})}\n\n"
        except Exception as e:
            print(f"Geme stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': _geme_error_detail(e)})}\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Tell nginx-style proxies not to buffer, or the stream arrives at once.
            "X-Accel-Buffering": "no",
        },
    )
