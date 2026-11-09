from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

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

class Film(FilmBase):
    id: int
    capsule_id: int

    model_config = ConfigDict(from_attributes=True)

# Reflection schemas
Dimension = Literal["self", "neighbor", "world"]


class ReflectionBase(BaseModel):
    title: str
    introduction: Optional[str] = None
    content: str
    author: Optional[str] = None
    dimension: Optional[Dimension] = None

class ReflectionCreate(ReflectionBase):
    pass

class ReflectionUpdate(BaseModel):
    title: Optional[str] = None
    introduction: Optional[str] = None
    content: Optional[str] = None
    author: Optional[str] = None
    dimension: Optional[Dimension] = None

class Reflection(ReflectionBase):
    id: int
    capsule_id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# Practice schemas
class PracticeBase(BaseModel):
    title: str
    description: Optional[str] = None
    steps: str
    dimension: Optional[Dimension] = None
    tips: Optional[str] = None

class PracticeCreate(PracticeBase):
    pass

class PracticeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    steps: Optional[str] = None
    dimension: Optional[Dimension] = None
    tips: Optional[str] = None

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
    reflect_intro: Optional[str] = None
    practice_title: Optional[str] = None
    # The story's LGN Spark (YouTube interview). Public placement TBD.
    spark_url: Optional[str] = Field(None, max_length=500)
    bts_copyright: Optional[str] = None
    bts_credits: Optional[str] = None

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
    reflect_intro: Optional[str] = None
    practice_title: Optional[str] = None
    spark_url: Optional[str] = Field(None, max_length=500)
    bts_copyright: Optional[str] = None
    bts_credits: Optional[str] = None

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
class CapsulePhoto(BaseModel):
    """A behind-the-scenes photo, by reference: `url` is API-relative."""
    id: int
    url: str
    caption: Optional[str] = None
    position: int = 0


class CapsulePhotoUpdate(BaseModel):
    caption: Optional[str] = None
    position: Optional[int] = None


PhotoKind = Literal["bts", "hero", "logo"]


class CapsulePhotoCreate(BaseModel):
    # data:image/jpeg;base64,... from the admin's browser (already shrunk).
    image: str = Field(..., max_length=3_000_000)
    caption: Optional[str] = None
    # 'bts' adds to the gallery; 'hero' and 'logo' replace the story's one.
    kind: PhotoKind = "bts"


# A written section of the behind-the-scenes page.
class BtsSectionBase(BaseModel):
    heading: Optional[str] = None
    body: str

class BtsSectionCreate(BtsSectionBase):
    pass

class BtsSectionUpdate(BaseModel):
    heading: Optional[str] = None
    body: Optional[str] = None
    position: Optional[int] = None

class BtsSection(BtsSectionBase):
    id: int
    capsule_id: int
    position: int = 0

    model_config = ConfigDict(from_attributes=True)


class CapsuleDetail(Capsule):
    film: Optional[Film] = None
    reflections: List[Reflection] = []
    practices: List[Practice] = []
    # Filled in by the endpoint (the rows' bytes are never serialised).
    bts_photos: List[CapsulePhoto] = []
    bts_hero: Optional[CapsulePhoto] = None
    bts_logo: Optional[CapsulePhoto] = None
    bts_sections: List[BtsSection] = []

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
# Storyboard
#
# A visitor agrees to the storyboard terms, then submits a story -- optionally
# with a first name, a city, and a small photo of themselves. Every submission
# waits for an admin to approve it before anyone else can see it.

StoryboardStatus = Literal["pending", "approved", "declined"]

# A base64 photo of a 320px JPEG is ~27 KB; this leaves generous headroom while
# keeping a public endpoint from accepting arbitrary payloads.
MAX_PHOTO_BASE64_CHARS = 200_000


class StoryboardSubmissionCreate(BaseModel):
    """What an anonymous visitor may send.

    Moderation fields are server-controlled and simply absent, so every
    submission lands pending. (An earlier version derived this from a schema
    with `is_approved`, which let anyone approve their own story.)

    `consent_to_share` must be true: the page only offers the form after the
    visitor agrees to the storyboard terms, and the API holds the same line.
    Lengths are bounded because this endpoint is public.
    """
    capsule_id: int
    content: str = Field(..., min_length=1, max_length=5000)
    author_name: Optional[str] = Field(None, max_length=60)
    author_location: Optional[str] = Field(None, max_length=80)
    # Optional, only for asking the author about edits; never shown publicly.
    author_email: Optional[str] = Field(None, max_length=254)
    consent_to_share: Literal[True]
    # data:image/jpeg;base64,... (or bare base64). Decoded and checked server-side.
    photo: Optional[str] = Field(None, max_length=MAX_PHOTO_BASE64_CHARS)


class StoryboardSubmitted(BaseModel):
    """The author's receipt. `token` lets their browser check on this
    submission later (see StoryboardOwnStatus); it is shown only here."""
    id: int
    token: str
    status: StoryboardStatus
    created_at: Optional[datetime] = None


class StoryboardOwnStatus(BaseModel):
    id: int
    status: StoryboardStatus


class StoryboardStory(BaseModel):
    """One story as the public sees it. No moderation state, no token, no age.
    `photo_url` is set only when the author added a photo."""
    id: int
    content: str
    author_name: Optional[str] = None
    author_location: Optional[str] = None
    photo_url: Optional[str] = None
    created_at: Optional[datetime] = None
    dimension: Optional[Dimension] = None


class StoryboardResponse(BaseModel):
    """A campfire's approved, consented stories, oldest first.

    There is no month-end reveal any more: the page shows these to a visitor
    once they have submitted a story of their own (a soft, browser-side gate).
    """
    capsule_id: int
    month: str
    stories: List[StoryboardStory] = []


class StoryboardAdminItem(BaseModel):
    """One submission in the admin review queue. Never carries the photo bytes
    (fetched separately, only when shown) or the owner token."""
    id: int
    capsule_id: int
    content: Optional[str] = None
    author_name: Optional[str] = None
    author_location: Optional[str] = None
    is_anonymous: bool = False
    consent_to_share: bool = False
    status: StoryboardStatus
    has_photo: bool = False
    created_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    dimension: Optional[Dimension] = None
    author_email: Optional[str] = None
    # Plain-language reasons it might be spam (links, repeats, ...). Empty when
    # nothing looks off. A hint for the reviewer, never an automatic decline.
    spam_reasons: List[str] = []


class StoryboardModeration(BaseModel):
    """Approve (true) or decline (false), and/or tag Self / Neighbor / World.
    Either may be sent alone. Consent is the visitor's, so it is not editable
    here."""
    is_approved: Optional[bool] = None
    dimension: Optional[Dimension] = None


# Admin portal auth schemas
class AdminLoginRequest(BaseModel):
    password: str

class AdminLoginResponse(BaseModel):
    token: str
    expires_at: datetime

class AdminSessionResponse(BaseModel):
    valid: bool



# ---------------------------------------------------------------------------
# Beyond the Screen: any film
# ---------------------------------------------------------------------------
FilmHandling = Literal["normal", "universal_only", "held"]
PromptKind = Literal["reflect", "practice"]
PromptSource = Literal["universal", "lgn", "ai"]
AiStatus = Literal["none", "pending", "ready", "unavailable", "failed"]
FeedbackType = Literal["suggestion", "something_off", "not_found"]
FeedbackStatus = Literal["new", "reviewed", "resolved"]


class FilmSearchResult(BaseModel):
    tmdb_id: Optional[int] = None  # None for an LGN film that is not on TMDB
    title: str
    year: Optional[int] = None
    poster_url: Optional[str] = None
    # "lgn": one of our own stories (open capsule_id); "tmdb": any other film.
    source: Literal["lgn", "tmdb"]
    capsule_id: Optional[int] = None


class FilmSearchResponse(BaseModel):
    results: List[FilmSearchResult]
    # Set when TMDB could not be asked (busy, down); LGN's own films still list.
    notice: Optional[str] = None


class FilmDetail(BaseModel):
    tmdb_id: int
    title: str
    year: Optional[int] = None
    runtime: Optional[int] = None
    director: Optional[str] = None
    cast: List[str] = []
    genres: List[str] = []
    poster_url: Optional[str] = None
    # The Watch tab's picture: a still from TMDB. None means use the poster.
    still_url: Optional[str] = None
    handling: FilmHandling = "normal"
    care_note: Optional[str] = None
    logline: Optional[str] = None
    # An LGN story for this film: the page sends the visitor there instead.
    lgn_capsule_id: Optional[int] = None


class WatchGroup(BaseModel):
    kind: Literal["stream", "free", "ads", "rent", "buy"]
    label: str
    providers: List[str]


class FilmWatch(BaseModel):
    """Where a film can be watched in one region. TMDB's data, sourced from
    JustWatch: anything that shows it must credit JustWatch."""
    region: str
    available: bool
    # TMDB's own page for the film in this region. One link for every provider:
    # TMDB does not give a link per service.
    link: str
    groups: List[WatchGroup] = []


class FilmPromptOut(BaseModel):
    id: int
    kind: PromptKind
    dimension: Dimension
    position: int = 0
    title: Optional[str] = None
    content: Optional[str] = None
    steps: Optional[str] = None
    tips: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PromptSet(BaseModel):
    reflect: List[FilmPromptOut] = []
    practice: List[FilmPromptOut] = []


class FilmPromptsResponse(BaseModel):
    handling: FilmHandling = "normal"
    # Per kind, which set is the default: Reflect can be LGN's own while
    # Practice is still the universal one. A kind that is LGN's own is the ONLY
    # set offered for it: no universal alternative and no AI set.
    default_sources: dict
    default: PromptSet
    # Only when ai_status is "ready" (and the film allows it), and only for the
    # kinds LGN has not written yet (the others come back empty). None when
    # there is nothing to offer.
    ai: Optional[PromptSet] = None
    ai_status: AiStatus = "none"


class FilmFeedbackCreate(BaseModel):
    type: FeedbackType
    tmdb_id: Optional[int] = None
    film_title: Optional[str] = Field(None, max_length=300)
    kind: Optional[PromptKind] = None
    dimension: Optional[Dimension] = None
    message: Optional[str] = Field(None, max_length=2000)
    suggested_text: Optional[str] = Field(None, max_length=2000)
    film_year_typed: Optional[str] = Field(None, max_length=16)
    email: Optional[str] = Field(None, max_length=254)
    # Honeypot: real visitors never see this field, so a value means a bot.
    website: Optional[str] = Field(None, max_length=200)


class FilmFeedbackOut(BaseModel):
    id: int
    tmdb_id: Optional[int] = None
    film_title: Optional[str] = None
    type: FeedbackType
    kind: Optional[PromptKind] = None
    dimension: Optional[Dimension] = None
    message: Optional[str] = None
    suggested_text: Optional[str] = None
    film_year_typed: Optional[str] = None
    email: Optional[str] = None
    status: FeedbackStatus
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class FilmFeedbackUpdate(BaseModel):
    status: FeedbackStatus


# --- admin ---
class AdminFilmRow(BaseModel):
    id: int
    tmdb_id: int
    title: Optional[str] = None  # fetched live; None if TMDB could not be asked
    year: Optional[int] = None
    handling: FilmHandling
    has_care_note: bool = False
    ai_status: AiStatus
    lgn_prompt_count: int = 0


class AdminFilmCreate(BaseModel):
    tmdb_id: int = Field(..., gt=0)


class AdminFilmUpdate(BaseModel):
    handling: Optional[FilmHandling] = None
    care_note: Optional[str] = Field(None, max_length=1000)
    logline: Optional[str] = Field(None, max_length=1000)


class AdminPrompt(FilmPromptOut):
    source: PromptSource
    external_film_id: Optional[int] = None


class AdminFilmDetail(BaseModel):
    id: int
    film: Optional[FilmDetail] = None  # live TMDB details; None if unavailable
    tmdb_id: int
    handling: FilmHandling
    care_note: Optional[str] = None
    logline: Optional[str] = None
    ai_status: AiStatus
    ai_model: Optional[str] = None
    lgn: List[AdminPrompt] = []
    ai: List[AdminPrompt] = []


class AdminPromptCreate(BaseModel):
    # None = a universal prompt.
    tmdb_id: Optional[int] = None
    kind: PromptKind
    dimension: Dimension
    title: Optional[str] = Field(None, max_length=300)
    content: Optional[str] = Field(None, max_length=2000)
    steps: Optional[str] = Field(None, max_length=4000)
    tips: Optional[str] = Field(None, max_length=1000)


class AdminPromptUpdate(BaseModel):
    dimension: Optional[Dimension] = None
    position: Optional[int] = None
    title: Optional[str] = Field(None, max_length=300)
    content: Optional[str] = Field(None, max_length=2000)
    steps: Optional[str] = Field(None, max_length=4000)
    tips: Optional[str] = Field(None, max_length=1000)


class AdminPromote(BaseModel):
    # Replace an existing LGN set for the same kind (otherwise that is a 409).
    replace: bool = False


class PublicFeatures(BaseModel):
    beyond_the_screen: bool


class FeatureState(BaseModel):
    enabled: bool
    # "admin": the portal's switch has been used. "default": nothing saved, so
    # the server's BEYOND_THE_SCREEN_ENABLED applies.
    source: Literal["admin", "default"]
    default: bool


class FeatureUpdate(BaseModel):
    # null clears the portal's switch and goes back to the server default.
    enabled: Optional[bool] = None
