import os
import tempfile

# Must be set before `app` is imported: settings are read once.
_db = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ.update(ENV="development", DATABASE_URL=f"sqlite:///{_db}", ADMIN_PASSWORD="pw",
                  TMDB_API_KEY="", TMDB_READ_ACCESS_TOKEN="", ANTHROPIC_API_KEY="", FILM_AI_ENABLED="false",
                  FILM_AI_ALLOW_WITH_TMDB="false", BEYOND_THE_SCREEN_ENABLED="true")

import pytest
from fastapi.testclient import TestClient

from app import film_defaults, models, ratelimit
from app.config import settings
from app.database import SessionLocal
from app.main import app


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c
    # Film tables only; the sample capsule stays.
    db = SessionLocal()
    for model in (models.FilmFeedback, models.FilmPrompt, models.ExternalFilm):
        db.query(model).filter(*([models.FilmPrompt.source != "universal"] if model is models.FilmPrompt else [])).delete()
    db.query(models.SiteSetting).delete()
    db.commit()
    db.close()
    ratelimit.reset()
    settings.BEYOND_THE_SCREEN_ENABLED = True
    settings.FILM_AI_ENABLED = False
    settings.FILM_AI_ALLOW_WITH_TMDB = False
    settings.FILM_AI_DAILY_CAP = 50


@pytest.fixture()
def db():
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture()
def admin(client):
    token = client.post("/api/admin/login", json={"password": "pw"}).json()["token"]
    return {"Authorization": f"Bearer {token}"}
