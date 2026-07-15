from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

from app.database import engine, Base, get_db
from app.config import settings
from app import models, schemas

# Initialize database tables on startup
# and seed a sample monthly capsule if none exists
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Seed data if empty
    db = next(get_db())
    try:
        if db.query(models.Capsule).count() == 0:
            print("Seeding initial capsule data...")
            # Create active capsule
            capsule = models.Capsule(
                month="2026-07",
                title="Awakening the Undergrowth",
                description="Exploring our deep interconnectedness with the earth through silent observation and ancient ecosystems.",
                is_active=True
            )
            db.add(capsule)
            db.commit()
            db.refresh(capsule)

            # Create Film
            film = models.Film(
                capsule_id=capsule.id,
                title="Whispers of the Canopy",
                director="Sofia Lorenson",
                duration="14 mins",
                # Using a public sample video file
                video_url="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                thumbnail_url="https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1600&q=80",
                description="A cinematic meditation on the subterranean communications network linking old-growth forests. Shot over four seasons in the Pacific Northwest, the film explores how trees support one another through fungal networks, presenting a visual metaphor for human community and mutual support."
            )
            db.add(film)

            # Create Reflection
            reflection = models.Reflection(
                capsule_id=capsule.id,
                title="Hearing the Unheard Conversations",
                author="Marcus Aurel",
                content=(
                    "In Sofia's lens, the forest is not a passive backdrop but an active, breathing conversation. "
                    "When we walk beneath the canopy, we tread on an ancient Internet. The mycelial network transports nutrients and warning signals, "
                    "acting as a collaborative nervous system for the woods.\n\n"
                    "How often do we shut off our own digital networks to plug into this organic, silent, yet screaming flow of life? "
                    "By watching *Whispers of the Canopy*, we are invited to ask: *Who are we connected to, and what signals are we sending?*"
                )
            )
            db.add(reflection)

            # Create Gathering
            gathering = models.Gathering(
                capsule_id=capsule.id,
                title="Community Screening & Shared Silence",
                description="Join us for a hybrid screening of 'Whispers of the Canopy' followed by 15 minutes of collective, quiet reflection and open-mic dialogue.",
                date_str="Friday, July 24, 2026 at 7:00 PM EST",
                location="The Community Hearth (Brooklyn, NY) & Zoom Hybrid",
                rsvp_link="https://example.com/rsvp-canopy"
            )
            db.add(gathering)

            # Create Practice
            practice = models.Practice(
                capsule_id=capsule.id,
                title="A Weekly Exercise in Rooting",
                description="A physical and mental alignment practice designed to ground your awareness into your immediate environment.",
                steps=(
                    "1. Find a quiet green space or stand barefoot on the earth if possible.\n"
                    "2. Position your feet shoulder-width apart, knees slightly bent, and close your eyes.\n"
                    "3. Shift your focus to the soles of your feet. Visualize root fibers growing from your feet down through the soil, connecting with the root networks of nearby plants.\n"
                    "4. Stand in this connected posture for 5-10 minutes, breathing naturally. Observe what arises when you treat yourself as part of the soil system."
                )
            )
            db.add(practice)
            db.commit()
            print("Seeding completed successfully!")
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
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
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    capsule = db.query(models.Capsule).filter(models.Capsule.is_active == True).first()
    if not capsule:
        # If no active, try to return the latest created capsule
        capsule = db.query(models.Capsule).order_by(models.Capsule.created_at.desc()).first()
    
    if not capsule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active monthly capsule found."
        )
    return capsule

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
    capsule = db.query(models.Capsule).filter(models.Capsule.id == capsule_id).first()
    if not capsule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Capsule with id {capsule_id} not found."
        )
    return capsule

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

@app.post("/api/capsules/{capsule_id}/gatherings", response_model=schemas.Gathering, status_code=status.HTTP_201_CREATED)
def add_gathering(capsule_id: int, gathering: schemas.GatheringCreate, db: Session = Depends(get_db)):
    """
    Add a gathering to a specific capsule.
    """
    capsule = db.query(models.Capsule).filter(models.Capsule.id == capsule_id).first()
    if not capsule:
        raise HTTPException(status_code=404, detail="Capsule not found")
        
    db_gathering = models.Gathering(**gathering.model_dump(), capsule_id=capsule_id)
    db.add(db_gathering)
    db.commit()
    db.refresh(db_gathering)
    return db_gathering

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

