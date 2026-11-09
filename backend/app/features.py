"""Feature flags the admin portal can flip at runtime.

Resolution: a saved admin switch wins; otherwise the server's environment
default (config.py). The saved value lives in `site_settings`, so staging and
production -- which have separate databases -- can differ with no redeploy.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app import models
from app.config import settings

BEYOND = "beyond_the_screen_enabled"


def _row(db: Session, key: str) -> Optional[models.SiteSetting]:
    return db.query(models.SiteSetting).filter(models.SiteSetting.key == key).first()


def beyond_default() -> bool:
    return bool(settings.BEYOND_THE_SCREEN_ENABLED)


def beyond_enabled(db: Session) -> bool:
    row = _row(db, BEYOND)
    return row.value == "true" if row else beyond_default()


def beyond_source(db: Session) -> str:
    return "admin" if _row(db, BEYOND) else "default"


def set_beyond(db: Session, enabled: Optional[bool]) -> None:
    """True/False saves the admin's choice; None clears it (back to default)."""
    row = _row(db, BEYOND)
    if enabled is None:
        if row:
            db.delete(row)
    elif row:
        row.value = "true" if enabled else "false"
    else:
        db.add(models.SiteSetting(key=BEYOND, value="true" if enabled else "false"))
    db.commit()
