from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Default to local SQLite for easy local development without Docker running.
    # In docker-compose, this is overridden to use PostgreSQL.
    DATABASE_URL: str = "sqlite:///./lgn_platform.db"
    ENV: str = "development"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,https://lgn-platform-web.onrender.com,https://lgn-platform.onrender.com"

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

