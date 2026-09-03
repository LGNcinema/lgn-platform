import json
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

# Initialize database tables on startup
# and seed a sample monthly capsule if none exists
@asynccontextmanager
async def lifespan(app: FastAPI):
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(models.Capsule).count() == 0:
            sample_capsule = models.Capsule(
                month="2026-08",
                title="SISTERS WITH TRANSISTORS",
                description="A patchwork portrait of several female electronic music pioneers.",
                is_active=True,
                pre_watch_prompt="What was your first encounter with synthesized sound?",
                pre_watch_supporting_text="Before pressing play, take a moment to listen to the room around you."
            )
            db.add(sample_capsule)
            db.commit()
            db.refresh(sample_capsule)

            sample_film = models.Film(
                capsule_id=sample_capsule.id,
                title="SISTERS WITH TRANSISTORS",
                director="Lisa Rovner",
                duration="86 min",
                video_url="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
                thumbnail_url="/images/sisters-thumbnail.jpg",
                description="Narrated by Laurie Anderson. 2020. USA. 86 min."
            )
            db.add(sample_film)
            db.commit()
    except Exception as e:
        print(f"Database startup/seed error: {e}")
    finally:
        db.close()
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

# Endpoints
@app.get("/api/health")
def health_check():
    return {"status": "healthy", "environment": settings.ENV}

@app.get("/api/capsules/active", response_model=schemas.CapsuleDetail)
def get_active_capsule(db: Session = Depends(get_db)):
    """
    Retrieve the currently active monthly capsule.
    Includes the monthly film, reflections, gatherings, and practices.
    """
    try:
        capsule = db.query(models.Capsule).filter(models.Capsule.is_active == True).first()
        if not capsule:
            capsule = db.query(models.Capsule).order_by(models.Capsule.created_at.desc()).first()
        
        if not capsule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active monthly capsule found."
            )
        
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
            pre_watch_prompt=capsule.pre_watch_prompt,
            pre_watch_supporting_text=capsule.pre_watch_supporting_text,
            created_at=capsule.created_at,
            film=film,
            reflections=reflections,
            discussion_circles=discussion_circles,
            practices=practices
        )
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
    List all historical capsules.
    """
    return db.query(models.Capsule).order_by(models.Capsule.month.desc()).all()

@app.get("/api/capsules/{capsule_id}", response_model=schemas.CapsuleDetail)
def get_capsule_detail(capsule_id: int, db: Session = Depends(get_db)):
    """
    Get a specific capsule with all its features.
    """
    try:
        capsule = db.query(models.Capsule).filter(models.Capsule.id == capsule_id).first()
        if not capsule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Capsule with id {capsule_id} not found."
            )
        
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
            pre_watch_prompt=capsule.pre_watch_prompt,
            pre_watch_supporting_text=capsule.pre_watch_supporting_text,
            created_at=capsule.created_at,
            film=film,
            reflections=reflections,
            discussion_circles=discussion_circles,
            practices=practices
        )
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
def create_capsule(capsule: schemas.CapsuleCreate, db: Session = Depends(get_db)):
    """
    Create a new capsule.
    """
    db_capsule = db.query(models.Capsule).filter(models.Capsule.month == capsule.month).first()
    if db_capsule:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Capsule for month {capsule.month} already exists."
        )
    
    # If the new capsule is set to active, deactivate others
    if capsule.is_active:
        db.query(models.Capsule).update({models.Capsule.is_active: False})
        
    db_capsule = models.Capsule(**capsule.model_dump())
    db.add(db_capsule)
    db.commit()
    db.refresh(db_capsule)
    return db_capsule

@app.post("/api/capsules/{capsule_id}/film", response_model=schemas.Film, status_code=status.HTTP_201_CREATED)
def create_film_for_capsule(capsule_id: int, film: schemas.FilmCreate, db: Session = Depends(get_db)):
    """
    Add a film to a specific capsule.
    """
    capsule = db.query(models.Capsule).filter(models.Capsule.id == capsule_id).first()
    if not capsule:
        raise HTTPException(status_code=404, detail="Capsule not found")
    
    if capsule.film:
        raise HTTPException(status_code=400, detail="Capsule already has a film associated with it")
        
    db_film = models.Film(**film.model_dump(), capsule_id=capsule_id)
    db.add(db_film)
    db.commit()
    db.refresh(db_film)
    return db_film

@app.post("/api/capsules/{capsule_id}/reflections", response_model=schemas.Reflection, status_code=status.HTTP_201_CREATED)
def add_reflection(capsule_id: int, reflection: schemas.ReflectionCreate, db: Session = Depends(get_db)):
    """
    Add a reflection to a specific capsule.
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
def add_discussion_circle(capsule_id: int, circle: schemas.DiscussionCircleCreate, db: Session = Depends(get_db)):
    """
    Add a discussion circle to a specific capsule.
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
def add_practice(capsule_id: int, practice: schemas.PracticeCreate, db: Session = Depends(get_db)):
    """
    Add a practice to a specific capsule.
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
