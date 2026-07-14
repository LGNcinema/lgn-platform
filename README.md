# LGN Platform

Full-stack platform for a cinema production company hosting monthly short film capsules.

## Architecture
- **Backend:** Python / FastAPI / PostgreSQL
- **Frontend:** React / TypeScript / Vite
- **Database:** PostgreSQL (Docker) / SQLite (Local standalone)

---

## Local Development (with Docker)

The easiest way to run the entire platform (Frontend + Backend + Database) is using Docker Compose. This setup includes hot-reloading for both the frontend and backend, so any code changes you make will immediately be reflected in the running containers.

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### Quick Start
To build and start all services in the background, run:
```bash
docker compose up --build -d
```

### Accessing the Services
Once the containers are running, you can access the applications at:
- **Frontend App:** [http://localhost:5173](http://localhost:5173)
- **Backend API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **PostgreSQL Database:** Exposed on port `5432`

### Stopping the Services
To stop the containers without removing your database data:
```bash
docker compose stop
```
To bring everything down and remove containers:
```bash
docker compose down
```

### Viewing Logs
If you need to debug or view the logs of the running services:
```bash
# View all logs
docker compose logs -f

# View backend logs only
docker compose logs -f backend

# View frontend logs only
docker compose logs -f frontend
```

---

## Local Development (without Docker)

If you prefer to run the applications locally on your machine without Docker, see the individual READMEs:
- [Backend Instructions](./backend/README.md)
- [Frontend Instructions](./frontend/README.md)
