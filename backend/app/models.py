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
    pre_watch_prompt = Column(String, nullable=True)
    pre_watch_supporting_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    film = relationship("Film", back_populates="capsule", uselist=False, cascade="all, delete-orphan")
    reflections = relationship("Reflection", back_populates="capsule", cascade="all, delete-orphan")
    discussion_circles = relationship("DiscussionCircle", back_populates="capsule", cascade="all, delete-orphan")
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
    theme = Column(String, nullable=True)
    bts_text = Column(Text, nullable=True)
    screenplay_text = Column(Text, nullable=True)

    capsule = relationship("Capsule", back_populates="film")

class Reflection(Base):
    __tablename__ = "reflections"

    id = Column(Integer, primary_key=True, index=True)
    capsule_id = Column(Integer, ForeignKey("capsules.id"), nullable=False)
    title = Column(String, nullable=False)
    introduction = Column(Text, nullable=True)
    content = Column(Text, nullable=False) # Supports markdown (e.g. questions)
    author = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    capsule = relationship("Capsule", back_populates="reflections")

class DiscussionCircle(Base):
    __tablename__ = "discussion_circles"

    id = Column(Integer, primary_key=True, index=True)
    capsule_id = Column(Integer, ForeignKey("capsules.id"), nullable=False)
    title = Column(String, nullable=False)
    opening_round = Column(Text, nullable=True)
    discuss_prompts = Column(Text, nullable=True)
    closing_question = Column(Text, nullable=True)

    capsule = relationship("Capsule", back_populates="discussion_circles")

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

class StoryboardSubmission(Base):
    __tablename__ = "storyboard_submissions"

    id = Column(Integer, primary_key=True, index=True)
    capsule_id = Column(Integer, ForeignKey("capsules.id"), nullable=False)
    content = Column(Text, nullable=True) # reflection, story, or link
    media_url = Column(String, nullable=True)
    author_name = Column(String, nullable=True)
    author_location = Column(String, nullable=True)
    author_age = Column(String, nullable=True)
    is_anonymous = Column(Boolean, default=False)
    is_approved = Column(Boolean, default=False) # Requires review before public collage
    created_at = Column(DateTime, default=datetime.utcnow)

