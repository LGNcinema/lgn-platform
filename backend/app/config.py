from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Default to local SQLite for easy local development without Docker running.
    # In docker-compose, this is overridden to use PostgreSQL.
    DATABASE_URL: str = "sqlite:///./lgn_platform.db"
    ENV: str = "development"

    # Whether startup creates tables from the models and seeds a sample capsule.
    #
    # On by default: it is what makes a fresh SQLite file or a just-created
    # docker-compose database usable with no extra step, and it is already
    # confined to ENV=development and off on Vercel (app/main.py).
    #
    # Turn it OFF to drive the local schema from the SQL migrations instead
    # (`migrate.py up`), which is what actually runs against the deployed
    # database. The two cannot both run: create_all() builds the tables from
    # app/models.py, and migration 20260720165715 is not idempotent -- plain
    # ALTER TABLE ADD COLUMN -- so it fails against a database the models have
    # already built.
    DB_BOOTSTRAP: bool = True

    # Browser origins allowed to call this API.
    #
    # On Vercel the site and the API are one deployment behind one domain --
    # `/api/*` is rewritten to this service -- so the browser makes same-origin
    # requests and CORS never comes into it. These defaults exist for local
    # development, where Vite (5173) and uvicorn (8000) are genuinely different
    # origins, and as the escape hatch if the API is ever fronted separately.
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # --- Admin portal ------------------------------------------------------
    # A single shared password, held server-side in .env, gates the internal
    # content editor. Deliberately not tied to a database vendor's auth
    # product -- the platform has already outlived one (Supabase) -- and
    # staff-only editing does not yet warrant per-user accounts.
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
