# Wedding SPA

Single-page wedding website with token-based RSVP links, a FastAPI backend, and guest admin endpoints for import/export.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: FastAPI, SQLModel, PostgreSQL in Docker, SQLite fallback for local development
- Map: ArcGIS web components and ArcGIS JS API

## Local Setup

1. Copy environment examples:

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

2. Start Postgres with Docker:

   ```bash
   docker compose up -d db
   ```

   See [docs/dev-database.md](docs/dev-database.md) for full dev database
   deployment, verification, seeding, and reset instructions.

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

The frontend defaults to `http://localhost:8000/api`. Override it with `VITE_API_BASE_URL`.

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

The admin dashboard at `/admin` asks for this same `ADMIN_SECRET`. Keep it in `backend/.env` for local development or in your backend host's environment variables for deployment. Do not expose it as a `VITE_` frontend variable, because Vite variables are bundled into public browser code.

- `POST /admin/guest`
- `GET /admin/guests`
- `POST /admin/guests/bulk`
- `GET /admin/guests/export`
- `GET /admin/summary`

## Checks

```bash
cd frontend
npm run lint
npm run test
npm run build

cd ..
backend/venv/bin/python -m unittest discover -s backend/tests
```

## Deployment

The app is split into a static frontend and a FastAPI backend.

### Frontend on Vercel

Deploy the `frontend` directory as a Vercel Vite project.

Set this Vercel environment variable:

```bash
VITE_API_BASE_URL=https://your-backend.example.com/api
```

`frontend/vercel.json` rewrites all paths to `index.html` so the SPA can be refreshed on any route.

### Backend

Deploy the FastAPI backend anywhere that can run a Python web service. Required environment variables:

```bash
DATABASE_URL=postgresql+psycopg://...
ADMIN_SECRET=replace-me
DEV_MODE=false
CORS_ORIGINS=https://your-vercel-app.vercel.app,https://your-custom-domain.com
```

For local development, keep `DEV_MODE=true`, run Postgres via Docker, and use `http://localhost:5173` in `CORS_ORIGINS`.

### Database

The code expects a standard Postgres URL in `DATABASE_URL`; there is no provider-specific database code in the app. Neon is a good fit for this project because it is serverless Postgres and has a free tier suitable for small RSVP workloads. For serverless or bursty hosting, use Neon's pooled connection string when available.
