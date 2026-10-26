# BeautyLink frontend

This directory contains the React, TypeScript, Vite, and Tailwind CSS frontend for BeautyLink.

For complete MySQL, backend, frontend, demo-account, testing, architecture, and deployment instructions, read the [project README](../README.md).

Quick start after the backend is running:

```powershell
npm install
npm run dev
```

Open <http://localhost:5173>.

For the classroom presentation deployment, set `VITE_PRESENTATION_DATA=true`
before building. This supplies stable sample rating summaries only where there
are no reviews, displays 59 completed appointments on the overview card, and
replaces `@seed.beautylink.test` emails in admin account views and customer CSV
exports. Actual review contents, booking records, login emails and notification
recipients stay in the backend. Disable the flag and rebuild to show only live
values again. Sample rating totals and the overview count do not create matching
review or booking records in the detail lists.

Useful checks:

```powershell
npm run lint
npm run build
```
