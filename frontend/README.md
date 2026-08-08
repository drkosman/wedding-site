# Frontend

The React/TypeScript frontend contains the public wedding site and the `/admin` dashboard. It is built with Vite, styled with Tailwind CSS, and talks to the FastAPI backend through `VITE_API_URL`.

Repository-wide setup and commands are in the [root README](../README.md). Frontend structure, data flows, and deployment behavior are documented in [architecture](../docs/architecture.md) and [deployment](../docs/deployment.md).

Useful commands from this directory:

```bash
npm ci
npm run dev
npm run lint
npm run test
npm run build
```

The frontend currently has no client-side router dependency: `src/App.tsx` selects the admin page only when the pathname is exactly `/admin` and otherwise renders the public home page.
