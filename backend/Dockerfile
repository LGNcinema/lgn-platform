FROM python:3.11-slim-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv using the official installer script
ADD https://astral.sh/uv/install.sh /uv-installer.sh
RUN sh /uv-installer.sh && rm /uv-installer.sh
ENV PATH="/root/.local/bin/:${PATH}"

# Set the working directory
WORKDIR /app

# Copy dependency definition files -- the lockfile too, so the image installs
# exactly what the lockfile pins (the same versions the host and Vercel use).
# Copying only pyproject.toml made every build resolve fresh against its open
# `>=` ranges: an image built in September 2026 picked up SQLAlchemy 2.1, whose
# default Postgres driver is psycopg 3 rather than the psycopg2 this project
# installs, and the backend crashed on startup.
COPY pyproject.toml uv.lock /app/

# Install python dependencies using uv. --frozen installs the lockfile as-is and
# fails rather than silently re-resolving if it is out of date with pyproject.
# Sync packages but do not install the current project itself since it's just app files
RUN uv sync --frozen --no-install-project

# Copy the app files into the container
COPY app /app/app/

# Expose FastAPI port
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Command to run backend with uv
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
