from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, LargeBinary, String, Text, and_, or_
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import deferred, relationship

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
    # V3 (migrations/20261027120000_v3_stories_admin.sql): one introduction for
    # Reflect, the Practice tab's title, and the story's LGN Spark link.
    reflect_intro = Column(Text, nullable=True)
    practice_title = Column(Text, nullable=True)
    spark_url = Column(Text, nullable=True)
    # Behind-the-scenes page (migrations/20261028130000_bts_page.sql). Credits
    # are one "Role: Name, Name" per line; a blank line starts a new group.
    bts_copyright = Column(Text, nullable=True)
    bts_credits = Column(Text, nullable=True)
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
    reflections = relationship("Reflection", back_populates="capsule", cascade="all, delete-orphan", order_by="Reflection.id")
    practices = relationship("Practice", back_populates="capsule", cascade="all, delete-orphan", order_by="Practice.id")
    photos = relationship(
        "CapsulePhoto", back_populates="capsule", cascade="all, delete-orphan",
        order_by="(CapsulePhoto.position, CapsulePhoto.id)",
    )
    bts_sections = relationship("BtsSection", back_populates="capsule", cascade="all, delete-orphan", order_by="(BtsSection.position, BtsSection.id)")

    def _photo_refs(self, kind):
        return [
            {"id": p.id, "url": f"/api/capsule-photos/{p.id}", "caption": p.caption, "position": p.position}
            for p in self.photos
            if p.kind == kind
        ]

    @property
    def bts_photos(self):
        """The behind-the-scenes gallery by reference, for CapsuleDetail. The
        image bytes are deferred on the rows, so this never loads them."""
        return self._photo_refs("bts")

    @property
    def bts_hero(self):
        """The large picture at the top of the behind-the-scenes page."""
        return next(iter(self._photo_refs("hero")), None)

    @property
    def bts_logo(self):
        """The distributor / production company logo on that page."""
        return next(iter(self._photo_refs("logo")), None)

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
    # films.bts_text and films.screenplay_text are retired (the text moved to
    # bts_sections in 20261028130000); the columns remain until dropped.

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
    # self / neighbor / world. Several questions may share one; the first is
    # the featured question.
    dimension = Column(String(16), nullable=True)

    capsule = relationship("Capsule", back_populates="reflections")

class Practice(Base):
    __tablename__ = "practices"

    id = Column(Integer, primary_key=True, index=True)
    capsule_id = Column(Integer, ForeignKey("capsules.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    steps = Column(Text, nullable=False) # Can be list of steps or markdown
    dimension = Column(String(16), nullable=True)  # self / neighbor / world
    tips = Column(Text, nullable=True)

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
    # The visitor's explicit yes to publication. Separate from is_approved on
    # purpose: consent is theirs, approval is LGN's, and the public storyboard
    # needs both. See migrations/20260928120000_storyboard_consent.sql.
    consent_to_share = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    # NULL until an admin approves or declines it -- what tells "pending" from
    # "declined" (both have is_approved False). See `review_status`.
    reviewed_at = Column(DateTime, nullable=True)
    # The author's optional photo: a ~20 KB JPEG the browser already shrank.
    # Deferred, so loading a submission never pulls the image unless asked;
    # it is served only from the photo endpoints.
    photo = deferred(Column(LargeBinary, nullable=True))
    # Secret handed back to the author on submit, for checking on their own
    # submission without an account. Never returned by any list or admin read.
    owner_token = Column(String(64), nullable=True)
    # migrations/20261006120000_storyboard_review_and_photos.sql
    # Set by the reviewer (self / neighbor / world), and the author's optional
    # email for questions about edits -- never public.
    dimension = Column(String(16), nullable=True)
    author_email = Column(String(254), nullable=True)
    # migrations/20261027120000_v3_stories_admin.sql

    @property
    def review_status(self) -> str:
        if self.is_approved:
            return "approved"
        return "pending" if self.reviewed_at is None else "declined"



class BtsSection(Base):
    """A written section of the behind-the-scenes page: an optional heading
    and its paragraphs."""
    __tablename__ = "bts_sections"

    id = Column(Integer, primary_key=True, index=True)
    capsule_id = Column(Integer, ForeignKey("capsules.id", ondelete="CASCADE"), nullable=False)
    heading = Column(Text, nullable=True)
    body = Column(Text, nullable=False)
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    capsule = relationship("Capsule", back_populates="bts_sections")


class CapsulePhoto(Base):
    """A story's behind-the-scenes photo. The admin's browser shrinks it before
    upload, so the image lives in the row (deferred: list reads never load it)
    and is served from its own endpoint."""
    __tablename__ = "capsule_photos"

    id = Column(Integer, primary_key=True, index=True)
    capsule_id = Column(Integer, ForeignKey("capsules.id", ondelete="CASCADE"), nullable=False)
    kind = Column(String(16), nullable=False, default="bts")
    position = Column(Integer, nullable=False, default=0)
    image = deferred(Column(LargeBinary, nullable=False))
    caption = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    capsule = relationship("Capsule", back_populates="photos")
