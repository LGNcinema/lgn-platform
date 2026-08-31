from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

# Film schemas
class FilmBase(BaseModel):
    title: str
    director: str
    duration: Optional[str] = None
    # Legacy / `file` provider URL. May also be a raw Vimeo link or a pasted
    # <iframe> embed snippet on create — the API parses it into the fields below.
    video_url: Optional[str] = None
    # Provider-tagged video source.
    video_provider: Optional[str] = None  # "vimeo" | "mux" | "youtube" | "file"
    video_id: Optional[str] = None
    video_hash: Optional[str] = None
    video_aspect_ratio: Optional[str] = None  # e.g. "16 / 9"
    video_duration_seconds: Optional[int] = None
    captions_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    description: Optional[str] = None
    theme: Optional[str] = None
    bts_text: Optional[str] = None
    screenplay_text: Optional[str] = None

class FilmCreate(FilmBase):
    pass

# Admin PATCH body. Every field optional; the API applies it with
# `model_dump(exclude_unset=True)`, so an omitted field is left untouched while
# an explicit `null` clears a nullable column.
class FilmUpdate(BaseModel):
    title: Optional[str] = None
    director: Optional[str] = None
    duration: Optional[str] = None
    video_url: Optional[str] = None
    video_provider: Optional[str] = None
    video_id: Optional[str] = None
    video_hash: Optional[str] = None
    video_aspect_ratio: Optional[str] = None
    video_duration_seconds: Optional[int] = None
    captions_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    description: Optional[str] = None
    theme: Optional[str] = None
    bts_text: Optional[str] = None
    screenplay_text: Optional[str] = None

class Film(FilmBase):
    id: int
    capsule_id: int

    model_config = ConfigDict(from_attributes=True)

# Reflection schemas
class ReflectionBase(BaseModel):
    title: str
    introduction: Optional[str] = None
    content: str
    author: Optional[str] = None

class ReflectionCreate(ReflectionBase):
    pass

class ReflectionUpdate(BaseModel):
    title: Optional[str] = None
    introduction: Optional[str] = None
    content: Optional[str] = None
    author: Optional[str] = None

class Reflection(ReflectionBase):
    id: int
    capsule_id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# Discussion Circle schemas
class DiscussionCircleBase(BaseModel):
    title: str
    opening_round: Optional[str] = None
    discuss_prompts: Optional[str] = None
    closing_question: Optional[str] = None

class DiscussionCircleCreate(DiscussionCircleBase):
    pass

class DiscussionCircleUpdate(BaseModel):
    title: Optional[str] = None
    opening_round: Optional[str] = None
    discuss_prompts: Optional[str] = None
    closing_question: Optional[str] = None

class DiscussionCircle(DiscussionCircleBase):
    id: int
    capsule_id: int

    model_config = ConfigDict(from_attributes=True)

# Practice schemas
class PracticeBase(BaseModel):
    title: str
    description: Optional[str] = None
    steps: str

class PracticeCreate(PracticeBase):
    pass

class PracticeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    steps: Optional[str] = None

class Practice(PracticeBase):
    id: int
    capsule_id: int

    model_config = ConfigDict(from_attributes=True)

# Capsule schemas
#
# PUBLICATION MODEL. Many capsules may be published at once; the "current" one
# is simply the published capsule with the greatest `month`. Two writable
# fields drive it, and one read-only field reports the result:
#
#   is_active   -- means PUBLISHED (historical column name, kept to avoid a
#                  rename migration). Setting it on one capsule does NOT
#                  unpublish any other.
#   publish_at  -- optional scheduled go-live time, NAIVE UTC. Nullable; send
#                  an explicit null to clear a schedule.
#   is_published -- derived, read-only, server-computed:
#                     is_active OR (publish_at IS NOT NULL AND publish_at <= utcnow())
#                  Clients must not re-implement this comparison: the server's
#                  clock is the only one that decides, so a browser with skewed
#                  time cannot disagree with what the public API actually
#                  serves. The three admin states are:
#                     draft     -> is_published false, publish_at null
#                     scheduled -> is_published false, publish_at in the future
#                     published -> is_published true
class CapsuleBase(BaseModel):
    month: str
    title: str
    description: Optional[str] = None
    # Published-now flag. See the note above: this is not exclusive.
    is_active: bool = True
    # Scheduled go-live, naive UTC (ISO-8601 in JSON). Null = not scheduled.
    publish_at: Optional[datetime] = None
    pre_watch_prompt: Optional[str] = None
    pre_watch_supporting_text: Optional[str] = None

class CapsuleCreate(CapsuleBase):
    pass

class CapsuleUpdate(BaseModel):
    month: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    # Explicit null clears the schedule and returns the capsule to draft
    # (assuming is_active is false); an omitted field is left untouched.
    publish_at: Optional[datetime] = None
    pre_watch_prompt: Optional[str] = None
    pre_watch_supporting_text: Optional[str] = None

class Capsule(CapsuleBase):
    id: int
    created_at: Optional[datetime] = None
    # Derived and read-only -- computed server-side from is_active/publish_at
    # by Capsule.is_published in app/models.py. Present on responses only
    # (CapsuleCreate/CapsuleUpdate do not accept it), so it can never be set
    # by a client.
    is_published: bool

    model_config = ConfigDict(from_attributes=True)

# Detailed Capsule with all relation models loaded (useful for frontend homepage)
class CapsuleDetail(Capsule):
    film: Optional[Film] = None
    reflections: List[Reflection] = []
    discussion_circles: List[DiscussionCircle] = []
    practices: List[Practice] = []

    model_config = ConfigDict(from_attributes=True)

# Contact Submission schemas
class ContactSubmissionBase(BaseModel):
    name: str
    email: str
    message: str

class ContactSubmissionCreate(ContactSubmissionBase):
    pass

class ContactSubmission(ContactSubmissionBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# Film Submission schemas
class FilmSubmissionBase(BaseModel):
    title: str
    director: str
    duration: Optional[str] = None
    link: str
    synopsis: Optional[str] = None
    email: str

class FilmSubmissionCreate(FilmSubmissionBase):
    pass

class FilmSubmission(FilmSubmissionBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# User Reflection schemas
class UserReflectionBase(BaseModel):
    capsule_id: int
    email: Optional[str] = None
    answers: str
    submitted_to_lgn: bool = False

class UserReflectionCreate(UserReflectionBase):
    pass

class UserReflection(UserReflectionBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# Storyboard Submission schemas
class StoryboardSubmissionBase(BaseModel):
    capsule_id: int
    content: Optional[str] = None
    media_url: Optional[str] = None
    author_name: Optional[str] = None
    author_location: Optional[str] = None
    author_age: Optional[str] = None
    is_anonymous: bool = False
    is_approved: bool = False

class StoryboardSubmissionCreate(StoryboardSubmissionBase):
    pass

class StoryboardSubmission(StoryboardSubmissionBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# Admin portal auth schemas
class AdminLoginRequest(BaseModel):
    password: str

class AdminLoginResponse(BaseModel):
    token: str
    expires_at: datetime

class AdminSessionResponse(BaseModel):
    valid: bool

