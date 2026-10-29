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
are no reviews, displays 286 fictional user profiles, 14 active partners,
147 completed bookings from 78 customers and 1,906,000 VNĐ in commission revenue, and
replaces `@seed.beautylink.test` emails in admin account views and customer CSV
exports. Actual review contents, booking records, login emails and notification
recipients stay in the backend. Disable the flag and rebuild to show only live
values again. The overview status counts, trend totals and partner/service
rankings reconcile to the report. Sample service reviews use confirmed/completed
booking counts first and share a catalog-wide maximum of 147; once the count is
used, remaining unbooked services show zero reviews. Supplier summaries reuse
the service counts. Commission is a separate field from actual
gross online receipts. Sample rating totals and report summaries do not create matching
public review records. Admin lists, account details, customer CSV and booking
histories use a shared presentation dataset dated October 2026 and respect date,
search, role and booking-status filters. Synthetic accounts are read-only and
never sent to account editing or authentication APIs. Admin access is still
required before presentation data is returned; edit mode uses live accounts.

Useful checks:

```powershell
npm run lint
npm run build
```
