# Local development database

Docker Compose provides PostgreSQL 16 for local development. FastAPI startup creates application tables, runs the explicit public-RSVP and homepage-section migrations plus older compatibility changes, and seeds default site content.

## Prerequisites and configuration

- Docker with the Compose plugin.
- Backend Python dependencies when running setup outside the container.
- Local backend/frontend environment files copied from the checked-in examples.
- Cloudflare Turnstile test widget keys for manual RSVP submission.

```bash
cp -n backend/.env.example backend/.env
cp -n frontend/.env.example frontend/.env
```

Keep local secrets and connection strings untracked. The backend example targets the host-exposed Compose database. The public endpoint fails closed until its Turnstile and rate-limit configuration is present.

## Start and initialize

```bash
docker compose up -d db
docker compose exec db pg_isready -U postgres -d wedding
backend/venv/bin/python -m backend.create_tables
```

Starting the backend also initializes the schema:

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

Alternatively, `docker compose up --build` runs PostgreSQL, the backend, and the frontend together. The backend container uses the `db` service hostname.

## Inspect and seed

List tables:

```bash
docker compose exec db psql -U postgres -d wedding -c "\dt"
```

Expected tables include `guest`, `rsvp`, `rsvpratelimitevent`, `contententry`, `homepagesection`, and `schema_migration`.

Create an example private paper-invitation record for the admin reconciliation list:

```bash
cd backend
source venv/bin/activate
python scripts/seed_guests.py
```

The public RSVP form is always available at `http://localhost:5173`; it does not use the seeded record to identify a visitor. After a test submission, use `/admin` to match the RSVP manually.

## Reset disposable data

This destroys the Compose PostgreSQL volume. Do not use it for data that must be retained.

```bash
docker compose down -v
docker compose up -d db
backend/venv/bin/python -m backend.create_tables
```

The reset is local-only unless the environment file is changed to a remote URL. Confirm the target before running setup or reset commands. Model/migration details are in [Data model and API](data-and-api.md); production handling is in [Deployment](deployment.md).
