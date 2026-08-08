# Deployment

## Production topology

The tracked configuration describes a single Vercel project backed by PostgreSQL:

1. Root `vercel.json` runs `cd frontend && npm install && npm run build`.
2. Vite writes the static application to `frontend/dist`, Vercel's configured output directory.
3. `/api/(.*)` is rewritten to the Python function at `api/index.py`.
4. All other paths are rewritten to `/index.html` for SPA fallback.
5. `api/index.py` imports `backend.main:app`, which re-exports the FastAPI app.
6. FastAPI connects through SQLModel/SQLAlchemy and the Psycopg 3 driver using `DATABASE_URL`.

The root `requirements.txt` supplies Python dependencies to the Vercel build; `backend/requirements.txt` supplies the same dependency set for local/backend-container use. `frontend/vercel.json` is a frontend-only SPA fallback configuration, but root deployment uses the root file.

The repository does not contain Vercel project metadata, DNS/custom-domain configuration, CI workflows, or evidence of automatic database provisioning. Confirm those settings in the hosting control planes.

## Environment variables

Configure values in Vercel project settings. This table intentionally lists names and formats only.

| Name | Scope | Production guidance |
| --- | --- | --- |
| `DATABASE_URL` | FastAPI runtime | SQLAlchemy-compatible PostgreSQL URL. Use the Psycopg dialect form (`postgresql+psycopg://...`) expected by this code and require TLS. A Neon pooled endpoint is appropriate for the serverless API. |
| `ADMIN_SECRET` | FastAPI runtime | Strong shared secret. If absent, all admin API calls are denied. Rotate it if exposed. |
| `DEV_MODE` | FastAPI runtime | Set to `false` for production to disable SQL echo. In the current implementation this also enables FastAPI `/docs` and `/redoc`. |
| `CORS_ORIGINS` | FastAPI runtime | Comma-separated exact browser origins. Include every intended production/preview origin, with no path. |
| `VITE_API_URL` | Frontend build | `/api` for the same-origin topology. Vite embeds this value at build time, so redeploy after changing it. |

Do not use `VITE_API_BASE_URL`; the frontend reads only `VITE_API_URL`. Do not commit populated `.env` files, database URLs, passwords, admin secrets, personal RSVP tokens, or guest exports.

Neon provides pooled hostnames for bursty/serverless application traffic. Its official guidance recommends a direct connection for schema migrations and similar session-dependent tooling. This repository currently initializes schemas through the application rather than a separate migration connection, so validate schema changes against the chosen endpoint before production rollout. See [Neon connection pooling](https://neon.com/docs/connect/connection-pooling).

## Database initialization

FastAPI calls `create_db_and_tables()` during startup. It creates missing SQLModel tables, applies the limited compatibility alterations listed in [Data model and API](data-and-api.md#schema-setup-and-compatibility-updates), and seeds default schedule/accommodation/travel content for empty kinds.

To initialize explicitly from a trusted environment with a direct administrative database connection:

```bash
DATABASE_URL='postgresql+psycopg://<role>:<password>@<direct-host>/<database>?sslmode=require' \
  python -m backend.create_tables
```

Run that command from the repository root with the root/backend Python dependencies installed. The operation is intended to be repeatable, but it is not a replacement for general schema migrations and it does not validate that every deployed schema detail matches the models.

## Deployment process

Before deploying:

1. Run the frontend lint, unit test, and production build plus the backend unit tests from the root README.
2. Review model changes for an explicit schema-upgrade path; `create_all()` alone does not alter existing tables.
3. Configure all environment variables for the intended Vercel environment (production and previews are separate settings).
4. Deploy from the repository root so root `vercel.json`, `requirements.txt`, and `api/index.py` are included.
5. Verify `/api/health`, a public content request, one authorized admin read, and an RSVP flow using a non-production test guest.

The repository contains no CI/CD workflow or scripted rollback. Hosting deployment/rollback and Neon restore/branch policies are operational concerns outside the tracked code.

## Production considerations

- RSVP query tokens are bearer credentials and are persisted in the guest's browser `localStorage`. Avoid analytics/logging setups that capture full query strings.
- The admin secret is held in `sessionStorage` and sent on every admin call. `/admin` has no account login, rate limiting, or role separation.
- Admin guest responses, tokens, CSV downloads, and generated invitation templates contain sensitive information.
- CORS is permissive for methods and headers but restricts origins to `CORS_ORIGINS`; an incorrect origin presents as a browser CORS failure.
- Public schedule, accommodation, and travel sections require the API/database. Static wedding details and imagery still render if those content requests fail.
- The ArcGIS map requires browser access to ArcGIS-hosted basemap, elevation, and feature-layer services.

## Troubleshooting

| Symptom | Repository-supported check |
| --- | --- |
| Frontend calls `localhost:8000` in production | Confirm `VITE_API_URL=/api` was present during the frontend build, then rebuild/redeploy. |
| Admin unlock fails | Confirm `ADMIN_SECRET` exists at runtime and the browser request includes the exact `x-admin-secret` value. |
| Browser blocks API calls | Confirm the page's exact origin is present in comma-separated `CORS_ORIGINS`. |
| API starts but tables/columns fail | Run `python -m backend.create_tables` with a direct connection and compare the required change with the limited compatibility list; add a deliberate migration for unsupported changes. |
| Database connections fail or time out | Check the URL dialect, TLS parameters, Neon endpoint state, credentials, and whether the connection is pooled/direct as appropriate. |
| Dynamic content is missing | Check `GET /api/content/{kind}` and database connectivity. Empty kinds are seeded only during database initialization. |
| `/admin` or another browser path returns 404 | Deploy from the root and confirm the SPA catch-all rewrite in root `vercel.json` is active. |

