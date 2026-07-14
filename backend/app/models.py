from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base

class Capsule(Base):
    __tablename__ = "capsules"

    id = Column(Integer, primary_key=True, index=True)
    month = Column(String, unique=True, index=True, nullable=False) # e.g. "2026-07"
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    film = relationship("Film", back_populates="capsule", uselist=False, cascade="all, delete-orphan")
    reflections = relationship("Reflection", back_populates="capsule", cascade="all, delete-orphan")
    gatherings = relationship("Gathering", back_populates="capsule", cascade="all, delete-orphan")
    practices = relationship("Practice", back_populates="capsule", cascade="all, delete-orphan")

class Film(Base):
    __tablename__ = "films"

    id = Column(Integer, primary_key=True, index=True)
    capsule_id = Column(Integer, ForeignKey("capsules.id"), unique=True, nullable=False)
    title = Column(String, nullable=False)
    director = Column(String, nullable=False)
    duration = Column(String, nullable=True)
    video_url = Column(String, nullable=False)
    thumbnail_url = Column(String, nullable=True)
    description = Column(Text, nullable=True)

    capsule = relationship("Capsule", back_populates="film")

class Reflection(Base):
    __tablename__ = "reflections"

    id = Column(Integer, primary_key=True, index=True)
    capsule_id = Column(Integer, ForeignKey("capsules.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False) # Supports markdown
    author = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    capsule = relationship("Capsule", back_populates="reflections")

class Gathering(Base):
    __tablename__ = "gatherings"

    id = Column(Integer, primary_key=True, index=True)
    capsule_id = Column(Integer, ForeignKey("capsules.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    date_str = Column(String, nullable=False) # e.g. "July 24, 2026, 7:00 PM EST"
    location = Column(String, nullable=False)  # Zoom or address
    rsvp_link = Column(String, nullable=True)

    capsule = relationship("Capsule", back_populates="gatherings")

class Practice(Base):
    __tablename__ = "practices"

    id = Column(Integer, primary_key=True, index=True)
    capsule_id = Column(Integer, ForeignKey("capsules.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    steps = Column(Text, nullable=False) # Can be list of steps or markdown

    capsule = relationship("Capsule", back_populates="practices")

class ContactSubmission(Base):
    __tablename__ = "contact_submissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class FilmSubmission(Base):
    __tablename__ = "film_submissions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    director = Column(String, nullable=False)
    duration = Column(String, nullable=True)
    link = Column(String, nullable=False)
    synopsis = Column(Text, nullable=True)
    email = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class UserReflection(Base):
    __tablename__ = "user_reflections"

    id = Column(Integer, primary_key=True, index=True)
    capsule_id = Column(Integer, ForeignKey("capsules.id"), nullable=False)
    email = Column(String, nullable=True)
    answers = Column(Text, nullable=False) # JSON-stringified or block text of answers
    submitted_to_lgn = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

