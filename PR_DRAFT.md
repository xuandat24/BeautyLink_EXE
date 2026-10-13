# Require completed bookings before service and supplier reviews

## Current follow-up: safe continuation, Vietnam time and operator zero-money resolution

Continues baseline `4841be0` without rewriting any existing commit. No merge/deploy permission.

- Owned booking GET/additive option-voucher fields, reusable payment-continuation dialog and minimal
  App/Bookings/Checkout identifier restoration. Recheck backend before payment; no replacement booking,
  no browser price/capability/checkout authority, active option/voucher preserved, stale/account/double-submit
  guards and safe HTTPS/default-port PayOS URL. App change is navigation only, not authentication.
- Shared controllable HCM clock/window/30-minute lead and finite overnight interval slots. Strict start
  cutoff across DTO/create/reuse/status; new expiry no later than start, but provider confirmation remains
  necessary for actual closure/release. Existing money receipts/reconciliation still accepted after start.
- ADMIN read-only all-attempt preview and fingerprinted zero-money closure, booking→payment→practitioner
  locks, repeat-safe application-level append-only audit in existing support_reports. Generic support API
  cannot forge/edit this audit namespace. No schema/dependency/refund/financial override.
- Owner option 1 authorizes the narrower secondary closure only with one fully provider-verified nonmanual
  PAID main and all others terminal/zero. Preserve paid primary/booking/deposit state. Late/double/wrong
  money stays blocked; production operation and financial disposition need separate approval.
- New race exposed early webhook ignore for manual attempts; signed valid PAID/exact provider PAID
  evidence now persists under escalation without clearing blockers or reviving cancellation. Existing
  test expecting null paidAt for verified late exact PAID updated, not removed; mismatches still not proof.
- Local Java 21 verify **236 PASS**, independent UTC JVM boundary **6 PASS**; npm ci/test/typecheck/build
  **40 PASS**. Actual Chrome→Spring/JWT/H2 smoke PASS: reuse/expiry retry/reload/back without new booking,
  actual App Account reload, paid/manual guards, completion and both review targets/reload/Explore/details.
  Fixture overlap/early pre-seed login failures were harness issues, corrected without loosening production
  assertions. Existing nonfatal Mockito/Zod/chunk warnings unchanged; fixture artifact scans PASS.
- One CI browser gate (temporary test tooling, no repository runtime dependency), retained isolated MySQL
  concurrency/Docker gates. Final commit's own CI evidence will be linked in the final report/handoff;
  previous 4841be0 CI is not proof of this release.
- Backup metadata/chunks/hash read-only checked; no restore target authorized, restore NOT RUN. Railway
  main auto-deploy config observed; Vercel project read 403 and frontend promotion hold unverified. No
  production mutation/payment/restore/config changes. Runbook includes exact proof/actions/SLA proposals,
  private customer contact, rollback and separate financial/restore/rollout approval gates.

See BOOKING_REVIEW_AUDIT.md for requirement→code→tests mapping and PAYMENT_REVIEW_RUNBOOK.md for
controlled operation. Self-attestation remains MVP; attendance verification/media/Beauty Points absent.
The sections below describe earlier baseline work, not current CI or release permission.

## Latest safety follow-up — supersedes historical release permissions/evidence below

Continue existing branch and commits, no history rewrite. A–F payment/cancel/shop findings were
reproduced before fixes; stale README review rules were statically confirmed. Scope stays booking,
PayOS payment verification/cancellation, review exposure, affected frontend controls and tests/docs.

- Verify pending closure by PayOS identity/status/zero received amount before cancelling/releasing
  a booking. Paid/deposit-paid cancellation returns 409 and support guidance, never fake refund.
- Commit verified PAID/manual evidence even if customer receives a cancellation conflict. Persist
  the order ledger before external create so timeout/finalization failure never loses the known order.
- Keep unconfirmed superseded cancellation PENDING for reconciliation. Withdraw uncertain checkout;
  any manual/unresolved payment blocks completion, review and public aggregates. Customer-cancelled
  bookings never reuse a checkout, resurrect or automatically regain retry permission.
- Booking-first locks and locking rereads; READ_COMMITTED where a scalar/read precedes lock waiting.
  Retry and new creation share the practitioner mutex; full/overnight interval overlap checks, active
  practitioner/service, valid time/schedule. No amount/voucher/deposit/signature changes.
- Supplier shop array now SUPPLIER-only, matching rating/count; scoped SERVICE queries remain separate.
- Frontend additive cancel/pay capabilities, backend-safe controls, support/error states, guarded
  stale/double submits, reread after mutation, retained booking during checkout retry and no browser
  callback-created PAID/CANCELLED state. Old frontend cannot bypass backend checks.

Evidence: Java 21 verify **194 passed**, compile/package PASS; npm ci, **32 frontend tests**,
TypeScript and build PASS. New runtime/source HEAD `566939f9a4fc0f1992b840711ac1f4528f23037b`
CI PASS: https://github.com/xuandat24/BeautyLink_EXE/actions/runs/38344332391 — backend/Docker,
frontend, isolated MySQL **72 passed**. Documentation-only handoff commits still require their own
HEAD CI check. Expanded Chrome → real Spring/JWT/H2 smoke PASS for pending cancel, paid/manual
guards, account/appointments, completion, both review upserts/reload, Explore/details and checkout
to a no-network fake gateway; zero API/page/console errors. Test-only gateway/fixtures are excluded
from JAR/bundle. Existing nonfatal warnings unchanged. No live PayOS or production DB mutation.

No schema/migration/dependency/OTP/auth/KYC/price math/attendance/media/points changes. Historical
mocked same-start retry coverage is replaced by stronger real-DB same-start/different-start/overnight
and concurrent create/retry cases; paid-cancel race assertions follow the newly approved MVP policy.
No concurrency tests dropped.

Owner is responsible for manual reconciliation/contact, but late-money procedure is not approved.
Automatic Gmail/web operator reminders are requested follow-up work, not implemented in this PR.
See PAYMENT_REVIEW_RUNBOOK.md for read-only audit, evidence, contact and approval workflow. Unknown
provider orders, legacy false closure, provider latency under locks, backup restore and rollout order
remain explicit risks/gates. Self-confirmation is not independent attendance proof.

**Draft only. Current task forbids merge/deploy/payment/production DB writes or restores.**
Before any separately approved rollout: usable isolated restore evidence, approved money procedure,
exact-SHA CI/review and a controlled backend-first frontend promotion plan. No ad-hoc SQL repair.
Rollback must preserve payment evidence; older main reopens known unsafe review/cancel behavior.
Current final test/CI/SHA evidence is recorded in CODEX_HANDOFF.md and the final task report.

The sections below are historical integration evidence only, not permission to release.

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
- GitHub Actions PASS for code/CI commit **1c08995a539e3934a3aabd6914bf97d64324b477**: https://github.com/xuandat24/BeautyLink_EXE/actions/runs/38303674498 — backend 157 tests and Docker image build; frontend npm ci / 27 tests / TypeScript / build; isolated MySQL 8.4 tests all PASS. The release class runs 34 MySQL tests. Local Docker daemon is unavailable, but the image was successfully built by CI. No local MySQL container was run.
- No production DB, real email or real payment write performed.

### Release gates and rollback

Keep draft until all three CI jobs pass and review is complete. The user now conditionally authorizes merge/release, but only with valid access, verified usable backup and controlled backend-first rollout. Do not use local tests as a substitute for CI.

Rollback baseline verified: main 5cdc5d3; Railway 12ca4eb6-d4ca-419c-9c99-2467b712cd03 SUCCESS; Vercel dpl_9VxMUwE9KkkN8fCT5a1HnvAMxftf READY. Existing API categories and website returned HTTP 200. MySQL is online with a mounted volume; a mounted volume is **not evidence of a usable backup**. User reports a backup at 20:00 today, but selected that restoration has not been tested; usable-backup gate remains unverified.

Draft PR creation was retried and GitHub returned 403 Resource not accessible by integration. No PR/merge/release occurred. Manual draft PR URL: https://github.com/xuandat24/BeautyLink_EXE/compare/main...fix/completed-booking-reviews?expand=1 . Use this description, or grant the existing GitHub connection pull-request write permission and retry. Any subsequent documentation-only commits must still have their current HEAD CI verified before merge.

Existing Git integration may deploy both platforms upon merging main. Verify how frontend promotion is held before merge so the required Railway-first validation sequence is possible; no platform config/secret changes made here. After backup/CI/review gates: release backend, health/startup/MySQL/API smoke, then frontend from the same commit, UI smoke and log monitoring. Backend failure: stop frontend release and restore the recorded backend deployment. Frontend-only failure: restore the recorded frontend deployment; keep a healthy backward-compatible backend. No DDL rollback is needed for this patch; no new schema changes. A code rollback restores the older review behavior and its known restrictions/bugs, so review access should be reevaluated before rollback. Independent attendance, review media and Beauty Points remain out of scope.
