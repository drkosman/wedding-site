# Dev Database Deployment

This project uses PostgreSQL for the dev SQL database. Docker Compose owns the
database container and volume, and the FastAPI backend creates the application
tables on startup with SQLModel.

## Prerequisites

- Docker with the Compose plugin available as `docker compose`
- A local backend environment file at `backend/.env`

Create the backend environment file if it does not exist:

```bash
cp backend/.env.example backend/.env
```

For local Docker Postgres, `backend/.env` should include:

```bash
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/wedding
ADMIN_SECRET=gripp-streke-ARGUM
DEV_MODE=true
CORS_ORIGINS=http://localhost:5173
```

## Deploy the Dev Database

Start the Postgres service:

```bash
docker compose up -d db
```

Wait until Postgres reports healthy enough to accept connections:

```bash
docker compose exec db pg_isready -U postgres -d wedding
```

Create or update the application tables by running backend startup locally:

```bash
python -m backend.create_tables
```

You can also create the tables by starting the backend normally:

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

## Verify the Database

List the deployed tables:

```bash
docker compose exec db psql -U postgres -d wedding -c "\dt"
```

Expected tables:

- `guest`
- `rsvp`

Seed a test guest and print their RSVP token:

```bash
cd backend
source venv/bin/activate
python -m scripts.seed_guests
```

## Reset Dev Data

To remove all local Postgres data and redeploy from scratch:

```bash
docker compose down -v
docker compose up -d db
python -m backend.create_tables
```

This deletes the `postgres_data` Docker volume, so only use it for disposable
development data.
