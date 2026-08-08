# Local development database

Docker Compose provides PostgreSQL 16 for local development. The volume is owned by Compose, while the FastAPI startup routine creates application tables, applies its limited compatibility updates, and seeds default site content.

## Prerequisites and configuration

- Docker with the Compose plugin (`docker compose`).
- Backend Python dependencies when running setup or seed commands outside the backend container.
- A local `backend/.env`, copied from the checked-in example.

```bash
cp -n backend/.env.example backend/.env
```

The example is already configured for the host-exposed Compose database. Set a non-placeholder `ADMIN_SECRET` if you need to exercise `/admin`. Keep `DEV_MODE=true` and `CORS_ORIGINS=http://localhost:5173` for the standard local frontend/backend pair.

## Start and initialize

Start only PostgreSQL:

```bash
docker compose up -d db
docker compose exec db pg_isready -U postgres -d wedding
```

Initialize from the repository root using the backend virtual environment:

```bash
backend/venv/bin/python -m backend.create_tables
```

Starting the backend also performs initialization:

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

Alternatively, `docker compose up --build` runs PostgreSQL, the backend, and the frontend together. Inside Compose, the backend's `DATABASE_URL` is overridden to use the `db` service hostname.

## Inspect and seed

List tables:

```bash
docker compose exec db psql -U postgres -d wedding -c "\dt"
```

Expected application tables are `guest`, `rsvp`, and `contententry`.

Create a disposable guest and print its personal token:

```bash
cd backend
source venv/bin/activate
python scripts/seed_guests.py
```

Use the token at `http://localhost:5173/?token=<printed-token>`. The seed script creates another guest every time; it has no duplicate check or cleanup.

## Reset disposable data

This destroys the Compose PostgreSQL volume. Do not use it for any database that must be retained.

```bash
docker compose down -v
docker compose up -d db
backend/venv/bin/python -m backend.create_tables
```

The reset is local-only and does not affect a remote `DATABASE_URL` unless you replace the example configuration. Confirm the target URL before running setup or seed commands.

For model and schema-update details, see [Data model and API](data-and-api.md). Production database handling is in [Deployment](deployment.md).
