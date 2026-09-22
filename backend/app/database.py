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
# holding its own pool multiplies into far more Postgres connections than
# Supabase allows. The fix is Supabase's transaction-mode pooler (Supavisor, on
# port 6543): it does the pooling server-side for all instances at once, so the
# app should keep none of its own -- hence NullPool.
#
# Detected from the port rather than from a "am I on Vercel?" flag so the rule
# travels with the database URL: point any host at the transaction pooler and
# the pooling is correct, with no second variable to remember.
#
# Note: transaction mode does not support prepared statements. psycopg2 does
# not use server-side prepared statements, so nothing extra is needed here --
# but a future move to psycopg3 or asyncpg would have to disable them.
IS_TRANSACTION_POOLER = ":6543" in settings.DATABASE_URL

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
            "DATABASE_URL is unset (defaulted to SQLite) on Vercel. Set it to the "
            "Supabase transaction pooler URL (port 6543) in the project's "
            "environment variables."
        )
    # SQLite requires different connection arguments for multi-threading in FastAPI
    connect_args = {"check_same_thread": False}
elif IS_TRANSACTION_POOLER:
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
