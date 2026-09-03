from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

# Film schemas
class FilmBase(BaseModel):
    title: str
    director: str
    duration: Optional[str] = None
    video_url: str
    thumbnail_url: Optional[str] = None
    description: Optional[str] = None
    theme: Optional[str] = None
    bts_text: Optional[str] = None
    screenplay_text: Optional[str] = None

class FilmCreate(FilmBase):
    pass

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

class Practice(PracticeBase):
    id: int
    capsule_id: int

    model_config = ConfigDict(from_attributes=True)

# Capsule schemas
class CapsuleBase(BaseModel):
    month: str
    title: str
    description: Optional[str] = None
    is_active: bool = True
    pre_watch_prompt: Optional[str] = None
    pre_watch_supporting_text: Optional[str] = None

class CapsuleCreate(CapsuleBase):
    pass

class Capsule(CapsuleBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# Detailed Capsule with all relation models loaded (useful for frontend homepage)
class CapsuleDetail(Capsule):
    film: Optional[Film] = None
    reflections: List[Reflection] = []
    discussion_circles: List[DiscussionCircle] = []
    practices: List[Practice] = []

    model_config = ConfigDict(from_attributes=True)

# Geme chat schemas (Practice -> Keep Exploring -> Take It Inward)
class GemeTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)

class GemeTuning(BaseModel):
    """Draft settings from the dev tuning panel, for one conversation only.

    Every field is optional and falls back to the server's own value. Honoured
    only when GEME_DEBUG is on -- otherwise the whole object is ignored.
    """
    persona: Optional[str] = Field(default=None, max_length=20000)
    opening_turn: Optional[str] = Field(default=None, max_length=2000)
    model: Optional[str] = Field(default=None, max_length=100)
    effort: Optional[Literal["low", "medium", "high", "xhigh", "max"]] = None
    max_tokens: Optional[int] = Field(default=None, ge=64, le=8192)
    max_turns: Optional[int] = Field(default=None, ge=2, le=60)
    max_chars_per_turn: Optional[int] = Field(default=None, ge=100, le=8000)

class GemeChatRequest(BaseModel):
    capsule_id: Optional[int] = None
    # The full visible transcript. The conversation is not stored server-side,
    # so the frontend replays it on every turn; an empty list opens the chat.
    messages: List[GemeTurn] = Field(default_factory=list, max_length=60)
    tuning: Optional[GemeTuning] = None

class GemeChatResponse(BaseModel):
    reply: str
    # Set only on the closing turn, once Geme has named a step with the visitor.
    next_step: Optional[str] = None

class GemeStatus(BaseModel):
    enabled: bool
    # Whether this server accepts tuning overrides and will serve /api/geme/config.
    debug: bool = False

class GemeConfig(BaseModel):
    """Geme's current settings, for the tuning panel to load and edit."""
    persona: str
    opening_turn: str
    model: str
    effort: str
    max_tokens: int
    max_turns: int
    max_chars_per_turn: int
    # The persona with this capsule's context appended -- what Geme actually receives.
    assembled_system_prompt: str

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

