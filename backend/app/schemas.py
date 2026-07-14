from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

# Film schemas
class FilmBase(BaseModel):
    title: str
    director: str
    duration: Optional[str] = None
    video_url: str
    thumbnail_url: Optional[str] = None
    description: Optional[str] = None

class FilmCreate(FilmBase):
    pass

class Film(FilmBase):
    id: int
    capsule_id: int

    model_config = ConfigDict(from_attributes=True)

# Reflection schemas
class ReflectionBase(BaseModel):
    title: str
    content: str
    author: Optional[str] = None

class ReflectionCreate(ReflectionBase):
    pass

class Reflection(ReflectionBase):
    id: int
    capsule_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Gathering schemas
class GatheringBase(BaseModel):
    title: str
    description: Optional[str] = None
    date_str: str
    location: str
    rsvp_link: Optional[str] = None

class GatheringCreate(GatheringBase):
    pass

class Gathering(GatheringBase):
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

class CapsuleCreate(CapsuleBase):
    pass

class Capsule(CapsuleBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Detailed Capsule with all relation models loaded (useful for frontend homepage)
class CapsuleDetail(Capsule):
    film: Optional[Film] = None
    reflections: List[Reflection] = []
    gatherings: List[Gathering] = []
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
    created_at: datetime

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
    created_at: datetime

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
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

