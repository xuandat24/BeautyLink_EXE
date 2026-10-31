# BeautyLink frontend

This directory contains the React, TypeScript, Vite, and Tailwind CSS frontend for BeautyLink.

For complete MySQL, backend, frontend, demo-account, testing, architecture, and deployment instructions, read the [project README](../README.md).

Quick start after the backend is running:

```powershell
npm install
npm run dev
```

Open <http://localhost:5173>.

For the isolated, record-backed presentation environment, see
[the reconciliation report and launch instructions](../docs/presentation-revenue-20261031.md).
Run `npm run presentation` with the dedicated local Spring presentation server.
The target and record plan belong to the isolated seed, not dashboard components.
Admin metrics, histories, exports and Supplier summaries now read backend records;
the old frontend-generated Admin dataset is no longer connected to runtime APIs.

`VITE_PRESENTATION_DATA=true` only retains legacy public rating summaries and seeded
email display aliases. It never replaces Admin booking counts or financial totals.
The isolated frontend mode disables it and forces its API to the local proxy.

Useful checks:

```powershell
npm run lint
npm run build
```
