# Repository guide for coding agents

The implementation is the source of truth. Start with `README.md` and `docs/README.md`, then inspect the relevant code before making claims or changes.

## Navigation

- Public/admin UI: `frontend/src/pages`, `frontend/src/components`, `frontend/src/hooks`, and `frontend/src/api`.
- API composition/config: `backend/app/main.py` and `backend/app/config.py`.
- Models and persistence: `backend/app/models.py` and `backend/app/database.py`.
- Public endpoints: `backend/app/routers/rsvp.py` and `content.py`.
- Admin/auth endpoints: `backend/app/routers/admin.py` and `utils.py`.
- Deployment: root `vercel.json`, `api/index.py`, root `requirements.txt`, Dockerfiles, and `docker-compose.yaml`.
- Authoritative deeper docs: `docs/architecture.md`, `docs/data-and-api.md`, `docs/deployment.md`, and `docs/dev-database.md`.

## Engineering constraints

- Keep the `/api` mounting convention and the `/admin` router prefix in mind when adding routes.
- Guest tokens and the admin secret are bearer credentials. Never expose real secrets, live tokens, real guest data, RSVP text, exports, or populated environment values in code, tests, logs, or documentation.
- One guest has at most one mutable RSVP. Server-side party-size authority is `max_guests`; `plus_one_allowed` controls the current UI.
- Content kinds are restricted to `schedule`, `accommodation`, and `travel`; preserve deterministic `sort_order`, then `id` ordering.
- Database startup performs only explicit additive compatibility changes. Do not assume `SQLModel.metadata.create_all()` migrates existing schemas; add and test a deliberate migration path for model changes.
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
