# Deployment

## Production topology

The tracked configuration describes one Vercel project backed by PostgreSQL:

1. Root `vercel.json` builds the frontend and serves `frontend/dist`.
2. `/api/(.*)` is rewritten to `api/index.py`; other paths fall back to the SPA.
3. `api/index.py` imports the FastAPI application from `backend.main`.
4. FastAPI uses SQLModel/SQLAlchemy and Psycopg 3 with `DATABASE_URL`.
5. The public browser loads Cloudflare Turnstile and sends its result with `POST /api/rsvps`.
6. FastAPI validates that result directly with Cloudflare before storing the RSVP.
7. After the database commit, FastAPI makes a short, idempotent Resend API call when RSVP notifications are configured.

The repository does not contain Vercel project metadata, DNS settings, Cloudflare widget provisioning, CI workflows, or database provisioning. Configure those in their respective control planes.

## Environment variables

Configure these names in Vercel project settings. Values are intentionally omitted.

| Name | Scope | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | FastAPI runtime | SQLAlchemy-compatible PostgreSQL URL using the Psycopg dialect and TLS. A pooled Neon endpoint suits serverless request traffic. |
| `ADMIN_SECRET` | FastAPI runtime | Shared secret for every admin request; absence disables admin access. |
| `DEV_MODE` | FastAPI runtime | Controls SQL echo and the current interactive-doc behavior. Use production-safe settings. |
| `CORS_ORIGINS` | FastAPI runtime | Comma-separated exact browser origins. |
| `TURNSTILE_SECRET_KEY` | FastAPI runtime | Backend-only Cloudflare verification secret. |
| `TURNSTILE_EXPECTED_HOSTNAME` | FastAPI runtime | Optional exact hostname accepted from verification results. |
| `RSVP_RATE_LIMIT_SECRET` | FastAPI runtime | Secret used to HMAC client addresses for database-backed limiting. |
| `RSVP_NOTIFICATION_EMAILS` | FastAPI runtime | Comma-separated wedding-admin notification recipients. Empty disables notifications. |
| `RSVP_NOTIFICATION_FROM_EMAIL` | FastAPI runtime | Resend-verified sender/from address. |
| `RESEND_API_KEY` | FastAPI runtime | Backend-only credential with permission to send notification email. |
| `RSVP_ADMIN_URL` | FastAPI runtime | Optional direct URL to the admin page included in notification messages. |
| `VITE_API_URL` | Frontend build | `/api` for the same-origin topology. |
| `VITE_TURNSTILE_SITE_KEY` | Frontend build | Public site key for the Turnstile widget. |

Vite embeds its variables at build time, so redeploy after changing them. Never expose `TURNSTILE_SECRET_KEY`, `RSVP_RATE_LIMIT_SECRET`, or `RESEND_API_KEY` through a `VITE_*` name. Do not use `VITE_API_BASE_URL`; the frontend reads `VITE_API_URL`.

Register every production/preview hostname that should render the widget in Cloudflare. The frontend uses the action name `rsvp`; the backend requires that action in the verification result. If `TURNSTILE_EXPECTED_HOSTNAME` is configured, it must exactly match the verified hostname. Use Cloudflare's documented test keys for local/automated challenge testing, not production keys.

For notifications, [verify the sending domain with Resend](https://resend.com/docs/dashboard/domains/introduction), create a sending-only API key, and configure the four RSVP notification variables only in the FastAPI runtime. `RSVP_ADMIN_URL` should point directly to the deployed `/admin` page. Keep `RSVP_NOTIFICATION_EMAILS` empty in environments that should not send mail. The API attempts delivery synchronously after commit because ordinary background work is not durable across a serverless response; a five-second timeout bounds the added request time. Failures are logged without RSVP content or provider response details and never alter the RSVP response. Each request follows Resend's [send-email API](https://resend.com/docs/api-reference/emails/send-email) and uses the persisted RSVP ID as its idempotency key.

## Database initialization and migration

FastAPI calls `create_db_and_tables()` during startup. It creates missing tables, runs the versioned public-RSVP, homepage-section, and RSVP-dietaries migrations, applies older additive RSVP/content compatibility changes, and seeds default content only for empty kinds.

Run initialization explicitly from a trusted environment with a direct administrative database connection:

```bash
DATABASE_URL='postgresql+psycopg://<role>:<password>@<direct-host>/<database>?sslmode=require' \
  python -m backend.create_tables
```

The public-RSVP migration preserves existing guest/response data while cleaning the legacy schema. The homepage-section migration adds the standalone `homepagesection` table and ordering indexes. The RSVP-dietaries migration adds the nullable `rsvp.dietaries` column and removes the obsolete dietary column. Test migrations against a database copy or Neon branch before production. The startup operation is intended to be repeatable, but this repository still does not provide a general migration framework.

Neon pooled endpoints are appropriate for bursty serverless request traffic. Use a direct connection for schema administration/migrations that need session behavior; see [Neon connection pooling](https://neon.com/docs/connect/connection-pooling).

## Deployment process

Before deploying:

1. Run frontend lint, tests, and production build plus backend tests.
2. Review every model change for a deliberate migration path.
3. Configure backend and frontend variables in each Vercel environment.
4. Configure Turnstile hostnames and confirm the frontend/backend keys belong to the same widget.
5. Initialize/migrate the database using a trusted direct connection.
6. Deploy from the repository root.
7. Verify `/api/health`, one public content request, the root RSVP form, challenge failure, one successful test RSVP and its notification, and an authorized admin reconciliation.

The repository contains no scripted rollback. Hosting rollback and Neon restore/branch policies remain operational responsibilities.

## Privacy and security considerations

- The public API is write-only for RSVP data; it exposes no guest-list, contact lookup, or response lookup.
- Turnstile validation is server-side. Challenge results are short-lived/single-use and are not invitation or RSVP credentials.
- Rate-limit rows contain keyed fingerprints rather than raw addresses and are removed after one day during later attempts.
- Public submissions with the same email remain separate; email never authenticates an update.
- Admin responses and CSV exports contain names, emails, and RSVP details. Keep them out of logs, analytics, issue attachments, and public storage.
- RSVP notification email contains only the submitter name and operational response summary. Detailed RSVP text stays in the protected admin interface.
- Resend credentials and recipient configuration are backend-only and must never use the `VITE_*` prefix.
- The admin secret remains in browser `sessionStorage` and is sent on every admin call. The current app has no account roles or admin rate limit.
- SQL echo must be disabled in production so query parameters do not expose personal data through database logs.
- CORS restricts browser origins but does not replace endpoint authorization or bot protection.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| RSVP challenge does not render | Confirm `VITE_TURNSTILE_SITE_KEY`, allowed widget hostname, browser access to Cloudflare, then rebuild. |
| Every RSVP returns verification failure | Confirm `TURNSTILE_SECRET_KEY`, widget pairing, action `rsvp`, and optional expected hostname. |
| RSVP returns `429` | Wait for the 15-minute window; inspect only aggregate rate-limit state, not personal RSVP payloads. |
| RSVP returns `503` or fails closed | Confirm backend abuse-protection variables are present. |
| RSVP succeeds but no notification arrives | Confirm `RSVP_NOTIFICATION_EMAILS`, `RSVP_NOTIFICATION_FROM_EMAIL`, `RESEND_API_KEY`, sender-domain verification, and backend error logs. |
| Admin unlock fails | Confirm `ADMIN_SECRET` and the `x-admin-secret` request header. |
| Browser blocks API calls | Confirm the exact origin in `CORS_ORIGINS`. |
| Tables/columns fail at startup | Run `python -m backend.create_tables` through a direct connection and inspect the versioned migration path. |
| Frontend calls localhost in production | Confirm `VITE_API_URL=/api`, then rebuild/redeploy. |
| A browser path returns 404 | Deploy from the root and confirm the SPA catch-all rewrite. |
