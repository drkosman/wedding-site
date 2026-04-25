# Wedding SPA

Single-page wedding website with token-based RSVP links, a FastAPI backend, and guest admin endpoints for import/export.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: FastAPI, SQLModel, PostgreSQL
- Map: ArcGIS web components and ArcGIS JS API

## Local Development

`docker-compose.yaml` is for local development only.
Production deployment uses Vercel (frontend + serverless API) and Neon (Postgres).

1. Copy environment examples:

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

2. Start Postgres with Docker:

   ```bash
   docker compose up -d db
   ```

   See [docs/dev-database.md](docs/dev-database.md) for full dev database deployment and reset instructions.

3. Run the backend:

   ```bash
   cd backend
   source venv/bin/activate
   uvicorn app.main:app --reload
   ```

4. Run the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

The frontend defaults to `http://localhost:8000/api`.

## Local Environment Variables

`backend/.env`

```bash
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/wedding
ADMIN_SECRET=replace-me
DEV_MODE=true
CORS_ORIGINS=http://localhost:5173
```

`frontend/.env`

```bash
VITE_API_URL=http://localhost:8000/api
```

## RSVP Links

Seed a test guest and print their token:

```bash
cd backend
source venv/bin/activate
python scripts/seed_guests.py
```

Open the site with `?token=<printed-token>` appended to the frontend URL.

## Admin API

Admin endpoints require the `x-admin-secret` header matching `ADMIN_SECRET`.

- `POST /api/admin/guest`
- `GET /api/admin/guests`
- `POST /api/admin/guests/bulk`
- `GET /api/admin/guests/export`
- `GET /api/admin/summary`
- `PATCH /api/admin/guest/{guest_id}/invite-sent`

Public RSVP endpoints:

- `GET /api/guest/{token}`
- `POST /api/rsvp/{token}`
- `GET /api/health`

## Checks

```bash
cd frontend
npm run lint
npm run test
npm run build

cd ..
backend/venv/bin/python -m unittest discover -s backend/tests
```

## Deployment (Vercel + Neon)

This repository deploys as:

- Frontend static app from `frontend/dist`
- FastAPI serverless function entrypoint at `api/index.py`
- Rewrites configured in root `vercel.json`

### Required Vercel Environment Variables

```bash
DATABASE_URL=postgresql+psycopg://neondb_owner:npg_y3KHV4qpLFNx@ep-morning-sun-a9atitjc-pooler.gwc.azure.neon.tech/wedding?sslmode=require&channel_binding=require
CORS_ORIGINS=https://your-vercel-domain.vercel.app
DEV_MODE=false
VITE_API_URL=/api
ADMIN_SECRET=gripp-streke-ARGUM
```

### Database Table Setup (Neon)

Run this command against your Neon database URL to create/update tables:

```bash
DATABASE_URL="postgresql+psycopg:///neondb_owner:npg_y3KHV4qpLFNx@ep-morning-sun-a9atitjc.gwc.azure.neon.tech/wedding?sslmode=require&channel_binding=require" python -m backend.create_tables
```

This project does not currently include Alembic migrations, so `create_tables` is the deployment setup path.
