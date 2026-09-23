import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import settings

# How this engine is pooled depends on what is on the other end of the URL.
#
# On a long-lived server (Docker, bare uvicorn) SQLAlchemy's own pool is the
# right thing: one process, one pool, connections reused across requests.
#
# On Vercel the API is a function that scales horizontally, and each instance
# holding its own pool multiplies into far more Postgres connections than the
# database allows. The fix is the provider's transaction-mode pooler, which does
# that pooling server-side for every instance at once -- so the app should keep
# none of its own, hence NullPool.
#
# Detected from the URL rather than from an "am I on Vercel?" flag, so the rule
# travels with the database: point any host at a pooled endpoint and the pooling
# is correct, with no second variable to keep in sync.
#
# Providers mark that endpoint differently, which is the trap here:
#   Neon      a `-pooler` suffix on the HOST, still on port 5432
#             ep-cool-name-123456-pooler.us-east-2.aws.neon.tech
#   Supabase  a distinct PORT, 6543 (Supavisor)
# Matching only on the port -- which is what this did when the database was
# Supabase -- silently fails to fire on Neon and leaves local pooling on.
#
# Note: both are PgBouncer-style transaction mode, which does not support
# SQL-level prepared statements. psycopg2 does not use them, so nothing extra is
# needed here -- but a move to psycopg3 or asyncpg would have to disable them.
POOLED_ENDPOINT_MARKERS = ("-pooler.", ":6543")

IS_POOLED_ENDPOINT = any(
    marker in settings.DATABASE_URL for marker in POOLED_ENDPOINT_MARKERS
)

connect_args = {}
engine_kwargs = {}

if settings.DATABASE_URL.startswith("sqlite"):
    # The SQLite default is a local-development convenience. On Vercel the
    # filesystem is read-only apart from /tmp, and /tmp is per-instance and
    # discarded, so a SQLite URL there means DATABASE_URL was never set. Say so
    # once, loudly, instead of serving an empty database that silently loses
    # every write.
    if os.getenv("VERCEL"):
        raise RuntimeError(
            "DATABASE_URL is unset (defaulted to SQLite) on Vercel. The Neon "
            "integration normally injects it -- check that the database is "
            "connected to this project in the Vercel dashboard."
        )
    # SQLite requires different connection arguments for multi-threading in FastAPI
    connect_args = {"check_same_thread": False}
elif IS_POOLED_ENDPOINT:
    engine_kwargs["poolclass"] = NullPool
    # Fail fast instead of hanging a whole function invocation on a dead pooler.
    connect_args = {"connect_timeout": 10}
else:
    # A connection idle in the pool can be killed by the database or by anything
    # in between; pre_ping spends one cheap round trip to find that out before a
    # request does. recycle keeps connections under typical proxy idle timeouts.
    engine_kwargs.update(pool_pre_ping=True, pool_recycle=1800)

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, **engine_kwargs)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base class for models
Base = declarative_base()

# Dependency to get db session in endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
