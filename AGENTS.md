# Repository guide for coding agents

The implementation is the source of truth. Start with `README.md` and `docs/README.md`, then inspect the relevant code before making claims or changes.

## Navigation

- Public/admin UI: `frontend/src/pages`, `frontend/src/components`, and `frontend/src/api`.
- API composition/config: `backend/app/main.py` and `backend/app/config.py`.
- Models and persistence: `backend/app/models.py`, `backend/app/database.py`, and `backend/migrations/`.
- Public endpoints: `backend/app/routers/rsvp.py` and `content.py`.
- Abuse protection: `backend/app/abuse.py`.
- Admin/auth endpoints: `backend/app/routers/admin.py` and `utils.py`.
- Deployment: root `vercel.json`, `api/index.py`, root `requirements.txt`, Dockerfiles, and `docker-compose.yaml`.
- Authoritative deeper docs: `docs/architecture.md`, `docs/data-and-api.md`, `docs/deployment.md`, and `docs/dev-database.md`.

## Engineering constraints

- Keep the `/api` mounting convention and the `/admin` router prefix in mind when adding routes.
- The public site and `POST /api/rsvps` do not use invitation credentials. Do not add public guest-list or RSVP lookup endpoints.
- `Guest` is a private paper-invitation record. `RSVP` stores the submitter's name/email and may be linked to a guest only through explicit admin reconciliation; never auto-match on name or email.
- Every public submission is a separate record. Email is contact data, not authentication, and must not authorize updates.
- Public party size is capped at six. `Guest.max_guests` is invitation metadata enforced when an admin reconciles an RSVP; it cannot be trusted or enforced before reconciliation.
- Public writes must retain server-side Turnstile verification, the honeypot, strict schema limits, and database-backed HMAC rate limiting. Never expose backend secret keys or log full RSVP payloads.
- The admin secret is a bearer credential. Never expose real secrets, personal data, RSVP text, exports, or populated environment values in code, tests, logs, or documentation.
- Content kinds are restricted to `schedule`, `accommodation`, and `travel`; preserve deterministic `sort_order`, then `id` ordering.
- Database startup performs only explicit compatibility changes. Do not assume `SQLModel.metadata.create_all()` migrates existing schemas; add and test a deliberate versioned migration for model changes.
- Preserve unrelated work in the repository. Do not change product behavior during documentation-only tasks.

## Checks

```bash
cd frontend
npm run lint
npm run test
npm run build

cd ..
backend/venv/bin/python -m unittest discover -s backend/tests
```

There is no configured backend lint/type-check command. Add focused tests for behavioral changes and run the narrowest useful checks during development, followed by the relevant full checks before handoff.

## Documentation and completion

When a change affects architecture, user-visible behavior, API behavior, the data model, environment configuration, deployment, setup, or developer workflow, update only the relevant documentation as part of the same task. Describe the resulting system, not a change diary.

A task is complete when the implementation and focused tests are finished, relevant existing checks pass (or failures are reported), documentation impact has been assessed and addressed, no secrets/personal data were introduced, and the final diff contains no unintended files or behavior changes.
