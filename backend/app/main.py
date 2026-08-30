from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List

from app.database import engine, Base, SessionLocal, get_db
from app.config import settings
from app import models, schemas
from app.video import parse_video_source

# Initialize database tables on startup
# and seed a sample monthly capsule if none exists
@asynccontextmanager
async def lifespan(app: FastAPI):
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
            sample_film = models.Film(
                capsule_id=sample_capsule.id,
                title="For the Love of God!",
                director="TBD",
                duration="15 mins",
                video_provider="vimeo",
                video_id="1052574030",
                video_hash="53c90178cb",
                video_aspect_ratio="16 / 9",
                thumbnail_url="https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80",
                description="A short film exploring purpose and light in the darkness.",
                theme="Purpose"
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

    payload = film.model_dump()

    # An admin may paste whatever the studio sent them (a raw <iframe> embed
    # snippet, a player.vimeo.com URL, a vimeo.com/ID/HASH link, or an mp4).
    # If no provider was supplied explicitly, derive the source fields from it.
    # Explicitly-supplied values always win.
    if payload.get("video_url") and not payload.get("video_provider"):
        source = parse_video_source(payload["video_url"])
        if source.provider:
            payload["video_provider"] = source.provider
        if source.video_id and not payload.get("video_id"):
            payload["video_id"] = source.video_id
        if source.video_hash and not payload.get("video_hash"):
            payload["video_hash"] = source.video_hash

    db_film = models.Film(**payload, capsule_id=capsule_id)
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
