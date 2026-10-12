# Require completed bookings before service and supplier reviews

Paid or deposit-paid bookings previously unlocked reviews before service completion, while no API transitioned confirmed bookings to completed. This change adds customer/owner-only completion after the appointment ends in Asia/Ho_Chi_Minh, including overnight appointments. Both review targets require COMPLETED plus PAID/PARTIALLY_PAID.

Cancellation, completion and review writes lock the booking row. Completion is idempotent, preserves the payment status and does not collect a balance or issue rewards. Public review queries and aggregates exclude historical premature/ineligible reviews without deleting them.

Customer account/bookings/appointments use backend booking data and server action flags. The review dialog creates/updates SERVICE and SUPPLIER reviews through the existing PUT API, rereads persisted reviews, and uses stable supplier IDs. Synthetic customer booking history and local-only review success/media/reward promises are removed.

The supplied ZIP patch applied cleanly to latest main `5cdc5d3de0bc51bcc2358f6b1f0088ee933448ad`. Scoped additions clear stale booking choices on dialog reload, expose retry, prevent repeated submission, test identity scope, and cover equal start/end overnight completion, supplier-review updates and public HTTP filtering.

Validation performed during this integration:

- Java 21 `mvn --batch-mode --no-transfer-progress verify`: 114 passed, zero failures/errors/skips; compile/package successful.
- `npm ci`: passed.
- `npm test`: 21 passed.
- `npm run lint`: TypeScript passed (the existing script is `tsc --noEmit`).
- `npm run build`: passed, with existing nonfatal Zod annotation/chunk-size warnings.
- `git diff --check`: passed.

The historical results above describe the initial ZIP integration only. See the release follow-up below for the current test evidence.

No schema/entity migration or automatic completion. Customer self-confirmation is an MVP declaration, not independent attendance proof. Photo/video persistence and Beauty Points remain unimplemented. Do not mark the complete master-plan scope Done.

## Release follow-up — 2026-10-13

- Preserved commits 8c6f731 and 5b9cf8d; continued on the existing feature branch without reset or rewrite.
- PayOS status/webhook/reconciliation previously locked payment rows before booking, relying on fetch joins for implicit locks. Now use a scalar booking identity lookup, explicit booking lock, payment locking reread and identity recheck. Superseded attempts use locking reads (not stale repeatable-read snapshots). Cancellation/completion/review all serialize on the same booking. Duplicate PAID/manual-review callbacks are idempotent; late PAID on cancellation stays manual-review without reclaiming a slot. Amount, signing, refund and gateway behavior unchanged.
- Added scoped public reviews: GET /api/v1/services/{id}/reviews and /suppliers/{id}/reviews with page/size (default 20, max 100), DB pagination and createdAt DESC,id DESC ordering. Response: content,totalElements,totalPages,page,size,rating; names remain masked. The old supplier shop reviews array is retained and DB-limited for compatibility.
- Public lists/counts/averages now share the completed + paid/deposit-paid + valid rating predicate. No legacy supplier base aggregates or supplier-to-service rating fallback. Historical invalid reviews are hidden, not deleted.
- Frontend separates service/supplier rating/count and retains stable database IDs. Filter Explore uses real scoped endpoints, no name/display-ID matching or localStorage reviews. Shared hook supports loading/error/retry/empty/pagination, stale-scope cleanup and missing-ID fail-closed. Partner service cards now load real supplier services. Demo homepage reviews are development-only and labeled demo; production shows no fake review counts.
- Invalid target/pagination conversion previously returned HTTP 500; now controlled 400. Added a regression for stale frontend flags that cannot override backend eligibility.
- Added jsdom as a dev-only dependency for React hook/state tests; retained the existing Node test framework. Test-only Spring/H2 loopback fixture and browser harness are excluded from production artifacts. Browser testing caught and fixed a React reserved-key spread warning.

### Current evidence

- Java 21: mvn --batch-mode --no-transfer-progress verify — **157 passed**, no failures/errors/skips; compile/package PASS.
- Frontend npm ci PASS; npm test **27 passed**; npm run lint (tsc --noEmit) PASS; production build PASS (existing Zod/chunk warnings).
- Concurrency tests use real H2 transactions/row locks: cancel vs webhook/reconciliation in both orders, duplicate paid callbacks, reconciliation vs webhook, complete vs cancel in both orders, duplicate completion, same/different target reviews.
- Full 16-state matrix for service/API/public legacy filtering; time boundaries including Vietnam/UTC and overnight; 105 reviews per target with identical timestamps, stable pages and aggregate agreement; roles/ownership/anonymous/not-found/rating/comment boundaries/refunded/stale flags.
- Real Chrome → localhost Spring/H2/JWT smoke PASS: completion, both review create/update, reload persistence and scoped Explore/service/partner detail; zero console/page errors and zero API 4xx/5xx in the final run.
- GitHub Actions adds a separate disposable MySQL 8.4 job using the same release transaction/scope tests. The first pushed code commit 86054cd passed backend and frontend; MySQL's Maven verification step passed, with job cleanup initially still pending. Local Docker build could not run because Docker daemon is unavailable, so backend CI now also builds the real Docker image. Verify the latest commit's full Actions run before merge.
- No production DB, real email or real payment write performed.

### Release gates and rollback

Keep draft until all three CI jobs pass and review is complete. The user now conditionally authorizes merge/release, but only with valid access, verified usable backup and controlled backend-first rollout. Do not use local tests as a substitute for CI.

Rollback baseline verified: main 5cdc5d3; Railway 12ca4eb6-d4ca-419c-9c99-2467b712cd03 SUCCESS; Vercel dpl_9VxMUwE9KkkN8fCT5a1HnvAMxftf READY. Existing API categories and website returned HTTP 200. MySQL is online with a mounted volume; a mounted volume is **not evidence of a usable backup**. Backup status remains unverified.

Existing Git integration may deploy both platforms upon merging main. Verify how frontend promotion is held before merge so the required Railway-first validation sequence is possible; no platform config/secret changes made here. After backup/CI/review gates: release backend, health/startup/MySQL/API smoke, then frontend from the same commit, UI smoke and log monitoring. Backend failure: stop frontend release and restore the recorded backend deployment. Frontend-only failure: restore the recorded frontend deployment; keep a healthy backward-compatible backend. No DDL rollback is needed for this patch; no new schema changes. A code rollback restores the older review behavior and its known restrictions/bugs, so review access should be reevaluated before rollback. Independent attendance, review media and Beauty Points remain out of scope.
