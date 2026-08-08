# Documentation

The implementation is authoritative. These documents describe the current system and should be updated only when a change affects their subject.

- [Architecture and workflows](architecture.md) — component boundaries, frontend and API structure, external services, and the public RSVP, reconciliation, content, and admin flows.
- [Data model and API](data-and-api.md) — persisted domain entities, validation rules, endpoint behavior, and admin-only operations.
- [Deployment](deployment.md) — Vercel and PostgreSQL/Neon topology, environment variables, schema setup, and production troubleshooting.
- [Local development database](dev-database.md) — starting, inspecting, seeding, and resetting the Docker Compose PostgreSQL database.

For the shortest path to running and checking the project, use the [root README](../README.md). Instructions for future coding agents live in [AGENTS.md](../AGENTS.md).
