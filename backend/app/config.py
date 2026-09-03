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

    # --- Geme ---------------------------------------------------------------
    # Geme, the Practice "Take It Inward" chat companion. Without an API key the
    # /api/geme endpoints report themselves as unavailable and the frontend
    # hides the entry point -- the rest of the platform runs unaffected.
    ANTHROPIC_API_KEY: str = ""
    GEME_MODEL: str = "claude-opus-5"
    GEME_MAX_TOKENS: int = 1024
    GEME_EFFORT: str = "low"

    # Live prompt tuning (Practice -> Geme -> the "Geme Tuning" dev panel). Lets a
    # client read the persona and send its own persona/parameters for a single
    # conversation, so the wording can be iterated on without a redeploy.
    #
    # Defaults OFF and must be switched on deliberately -- with it on, whoever can
    # reach the API can replace Geme's system prompt and spend tokens against this
    # server's key. docker-compose enables it for local development only.
    GEME_DEBUG: bool = False

    class Config:
        env_file = ".env"

settings = Settings()
