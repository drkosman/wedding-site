# Lucy & Kosta Wedding SPA

Wedding website for Lucy and Kosta with a public RSVP form and an administrative dashboard for paper invitations, response reconciliation, and site-content management.

The implementation is a React/TypeScript single-page application backed by a FastAPI/SQLModel API. The tracked production guidance targets PostgreSQL on Neon, Docker Compose uses PostgreSQL, and the backend has a SQLite fallback for lightweight development and tests. The root Vercel configuration builds the frontend and exposes the Python API under `/api`.

## Repository layout

- `frontend/` — Vite, React 19, TypeScript, Tailwind CSS 4, Vitest, and the ArcGIS-based map.
- `backend/app/` — FastAPI application, SQLModel models, database startup logic, and public/admin routers.
- `backend/tests/` — backend unit tests using temporary or in-memory SQLite databases.
- `api/index.py` — Vercel Python function entrypoint.
- `docs/` — architecture, data/API, deployment, and local database documentation.
- `docker-compose.yaml` — local PostgreSQL, API, and frontend services.
- `vercel.json` — production build and rewrite topology.

## Prerequisites

- Node.js 22 (the version in `frontend/.nvmrc`) and npm.
- Python 3.12 (matching `backend/Dockerfile`) and `venv`.
- Docker with Compose, when using the recommended local PostgreSQL service.

## Local development

From the repository root:

```bash
cp -n backend/.env.example backend/.env
cp -n frontend/.env.example frontend/.env
docker compose up -d db

python3 -m venv backend/venv
backend/venv/bin/pip install -r backend/requirements.txt
backend/venv/bin/python -m backend.create_tables
```

Run the backend:

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

In another terminal, run the frontend:

```bash
cd frontend
npm ci
npm run dev
```

The site and RSVP form are available at `http://localhost:5173`, the admin page at `http://localhost:5173/admin`, and the API at `http://localhost:8000/api`. Configure a Cloudflare Turnstile test widget in the frontend and backend environment files before manually submitting the form. To create an example private invitation-list record for admin reconciliation, run `python scripts/seed_guests.py` from `backend/`.

To run the complete development stack in containers instead, populate the two environment files and run:

```bash
docker compose up --build
```

See [Local development database](docs/dev-database.md) for database lifecycle and reset commands.

## Environment configuration

Copy the checked-in `.env.example` files; never commit populated secrets or connection strings.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Backend | SQLAlchemy/SQLModel database URL. Defaults to a local SQLite file when unset. |
| `ADMIN_SECRET` | Backend | Shared secret required in the `x-admin-secret` header for every admin API request. Admin access is disabled when unset. |
| `DEV_MODE` | Backend | Enables SQL logging when `true`; the current app also disables FastAPI's interactive docs in this mode. |
| `CORS_ORIGINS` | Backend | Comma-separated allowed browser origins. |
| `TURNSTILE_SECRET_KEY` | Backend | Secret used only by the API to verify RSVP challenges. |
| `TURNSTILE_EXPECTED_HOSTNAME` | Backend | Optional hostname required in successful challenge results. |
| `RSVP_RATE_LIMIT_SECRET` | Backend | Secret used to HMAC client addresses before rate-limit events are stored. |
| `RSVP_NOTIFICATION_EMAILS` | Backend | Comma-separated wedding-admin recipients; leave empty to disable RSVP notifications. |
| `RSVP_NOTIFICATION_FROM_EMAIL` | Backend | Verified sender address used for RSVP notifications. |
| `RESEND_API_KEY` | Backend | Resend credential used only by the notification service. |
| `RSVP_ADMIN_URL` | Backend | Optional direct admin-page URL included in notifications. |
| `VITE_API_URL` | Frontend build/runtime | API base URL; use `/api` for the same-origin Vercel deployment. |
| `VITE_TURNSTILE_SITE_KEY` | Frontend build/runtime | Public Turnstile widget site key. |

Deployment-specific handling is documented in [Deployment](docs/deployment.md).

## Checks

```bash
cd frontend
npm run lint
npm run test
npm run build

cd ..
backend/venv/bin/python -m unittest discover -s backend/tests
```

There is no separately configured backend linter or static type checker.

## Documentation

Start with the [documentation index](docs/README.md):

- [Architecture and workflows](docs/architecture.md)
- [Data model and API](docs/data-and-api.md)
- [Deployment](docs/deployment.md)
- [Local development database](docs/dev-database.md)
