from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Default to local SQLite for easy local development without Docker running.
    # In docker-compose, this is overridden to use PostgreSQL.
    DATABASE_URL: str = "sqlite:///./lgn_platform.db"
    ENV: str = "development"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,https://lgn-platform-web.onrender.com,https://lgn-platform.onrender.com"

    # --- Admin portal ------------------------------------------------------
    # A single shared password, held server-side in .env, gates the internal
    # content editor. Deliberately NOT Supabase Auth: the platform may not stay
    # on Supabase, and staff-only editing does not yet warrant per-user
    # accounts.
    #
    # SECURITY: an empty ADMIN_PASSWORD means the admin portal is NOT
    # CONFIGURED, and every admin endpoint answers 503. It must never be read
    # as "no auth required" -- see app/auth.py.
    ADMIN_PASSWORD: str = ""
    # Optional, independent token-signing secret. When empty, the signing
    # secret is derived deterministically from ADMIN_PASSWORD (app/auth.py).
    ADMIN_SECRET: str = ""
    # How long an issued admin token stays valid.
    ADMIN_TOKEN_TTL_HOURS: int = 12

    class Config:
        env_file = ".env"

settings = Settings()
