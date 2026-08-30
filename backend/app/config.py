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

    class Config:
        env_file = ".env"

settings = Settings()

