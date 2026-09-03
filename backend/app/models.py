from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, and_, or_
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship

from app.database import Base

class Capsule(Base):
    """A monthly capsule.

    Publication model -- MANY capsules may be published at the same time. The
    public site lists every published capsule as a tab and treats the one with
    the greatest ``month`` (``YYYY-MM``, so lexical order is chronological) as
    the current one. There is no "exactly one live capsule" rule, and
    publishing a capsule never demotes its siblings.

    ``is_active`` therefore means **published**, not "the single live capsule".
    The column keeps its historical name to avoid a rename migration.

    Publication is DERIVED at read time -- no cron job, no background worker.
    See :attr:`is_published`.
    """

    __tablename__ = "capsules"

    id = Column(Integer, primary_key=True, index=True)
    month = Column(String, unique=True, index=True, nullable=False) # e.g. "2026-07"
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    # PUBLISHED flag. True => public right now. Many rows may have it set at
    # once; see the class docstring.
    is_active = Column(Boolean, default=True)
    # Scheduled go-live time, stored as NAIVE UTC to match created_at. NULL
    # means "never scheduled". Once it is in the past the capsule counts as
    # published even though is_active stays False -- nothing ever writes the
    # flag for it.
    publish_at = Column(DateTime, nullable=True)
    pre_watch_prompt = Column(String, nullable=True)
    pre_watch_supporting_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    @hybrid_property
    def is_published(self) -> bool:
        """The single definition of "is this capsule public?".

            published == is_active OR (publish_at IS NOT NULL AND publish_at <= utcnow())

        Evaluated in Python here and compiled to SQL by the ``.expression``
        below, so the row filter and the per-object answer cannot drift apart.
        """
        if self.is_active:
            return True
        return self.publish_at is not None and self.publish_at <= datetime.utcnow()

    @is_published.expression
    def is_published(cls):
        # utcnow() is captured when the query is built, i.e. once per request.
        return or_(
            cls.is_active.is_(True),
            and_(cls.publish_at.isnot(None), cls.publish_at <= datetime.utcnow()),
        )

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
    # Legacy / `file` provider playback URL. Nullable: a Vimeo-hosted film is
    # fully described by video_provider + video_id + video_hash.
    video_url = Column(String, nullable=True)
    # Provider-tagged video source. video_provider is one of
    # "vimeo" | "mux" | "youtube" | "file"; NULL means "infer from video_url".
    video_provider = Column(String, nullable=True)
    video_id = Column(String, nullable=True)
    video_hash = Column(String, nullable=True)  # Vimeo private/unlisted `h=` param
    video_aspect_ratio = Column(String, nullable=True)  # e.g. "16 / 9"
    video_duration_seconds = Column(Integer, nullable=True)
    captions_url = Column(String, nullable=True)  # future WebVTT track
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

