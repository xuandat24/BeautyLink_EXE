# BeautyLink booking/review integration checkpoint

Status: DONE_CODE_AND_TESTS — feature delivered; PR permission and production approval/backup gates remain blocked. Preserve commits and inspect actual Git HEAD/status on resume.

## Latest task — cancellation/payment safety (2026-10-13)

- Authorization supersedes all historical release permissions below: feature-branch code/test/commit/push/draft PR ONLY. No merge, deploy, real payment, production DB write/restore, secret/config changes or force-push.
- Fetched main `5cdc5d3de0bc51bcc2358f6b1f0088ee933448ad` and feature baseline `e207040885f3ab3950281c5429a22c2e4a5570f5`; merge base main, divergence 0/5, clean worktree. Existing commits preserved.
- Reproduced A–F with eight failing isolated integration tests before fixing; README inconsistency G statically confirmed. No unverified finding repaired.
- Backend commit `b770939`: booking-first locking/READ_COMMITTED, cancellation verifies GET/cancel identity/status/received amount; paid/manual evidence commits before HTTP conflict. Unknown cancellation withdraws checkout, keeps PENDING discoverable with manual flag and retains slot. Superseded unknown closures remain PENDING. Checkout order ledger commits before outbound create; timeout retains known order. Retry/new booking serialize on practitioner and check full/adjacent-day intervals. Manual/pending attempts block completion/reviews/public aggregates; supplier-shop array is SUPPLIER only. No entity/schema/dependency/money-formula changes.
- Frontend commit `6d80b27364c0cc0a6d841570df229d80c49aaec1`: additive capabilities fail closed, paid/manual cancel controls/support, stale/double submit guards, refresh real bookings, retain booking across provider retry, server-only return verification and safe redirect. Partner review subtitle describes customer self-confirmation, not independent attendance. No OTP/auth/KYC/UI redesign.
- Latest local backend Java 21 verify: **194 passed**, zero failures/errors/skips, compile/package PASS. Frontend npm ci, **32 passed**, TypeScript and production build PASS. Existing Maven agent/Zod/chunk warnings unchanged. New MySQL CI selection runs both release and cancellation-safety classes (72 tests expected, must verify exact final HEAD result).
- Expanded real Chrome/Spring/JWT/H2 smoke PASS: paid/manual action guards, pending cancellation, completion, both targets create/update/reload, account, appointments, Explore/service/partner details, checkout to fake gateway; zero API/page/console errors. Test harness modal/navigation/UTF8 observation issues were corrected without changing production behavior. Test-only provider never makes outbound payment requests. Production JAR/bundle scans exclude new smoke fixtures/test credentials.
- Railway read-only recheck: active backend deployment `12ca4eb6-d4ca-419c-9c99-2467b712cd03`, SUCCESS, commit main `5cdc5d3`; source remains main, no staged changes, health /api/v1/categories and one replica unchanged. Backend categories and homepage HTTP 200. Vercel deployment metadata read returned 403 for configured team/project; no CLI available, current frontend SHA/promotion settings unverified (historical Vercel ID below is not current evidence).
- Local Docker daemon missing; no local Docker/MySQL test container. Runtime/source HEAD `566939f9a4fc0f1992b840711ac1f4528f23037b` pushed and CI PASS: https://github.com/xuandat24/BeautyLink_EXE/actions/runs/38344332391 . All three jobs succeeded: backend 194 tests + Docker build; frontend npm ci / 32 tests / typecheck / build; isolated MySQL 8.4: release 34 + cancellation-safety 38 = **72 passed**, zero failures/errors/skips. These are actual new-HEAD results, not baseline reuse.
- Owner says they handle PayOS reconciliation/customer contact; late-money policy NOT approved. Gmail/web operator alerts requested but not implemented or authorized as part of this minimal patch; separate approved notification design required. PAYMENT_REVIEW_RUNBOOK.md contains read-only queries, evidence/contact workflow and approval gates, no UPDATE SQL or fake refunds.
- Backup at 20:00 reported historically; restore unverified, no authorized isolated restore target supplied. No production database access used in tests.
- Local Spring/Vite smoke servers stopped after final PASS. Temporary logs remain ignored; no fixture/secret/build output staged.
- Three scoped commits pushed: backend `b770939`, frontend `6d80b27`, docs `566939f`; working tree clean at that milestone. Draft PR creation attempted once for current head and again returned 403 Resource not accessible by integration; no PR exists. Stopped PR action, no alternate credential/bypass. Manual draft: https://github.com/xuandat24/BeautyLink_EXE/compare/main...fix/completed-booking-reviews?expand=1 using PR_DRAFT.md.
- This final checkpoint is documentation-only and does not alter tested runtime. Verify its own final HEAD CI in the final report (Git cannot embed its own commit SHA); do not reuse parent CI as final-HEAD evidence. No code TODO remains in this scope. Production is NOT released. Follow-up requires draft PR/review permission, usable backup/isolated restore authorization, approved money procedure, exact-SHA release approval and controlled backend-first promotion; Gmail/web reminders need a separate approved notification scope. Never merge/deploy under this task.

Everything below is historical baseline, not final-HEAD evidence; older conditional merge/deploy permission is revoked by the latest task.

## Current release follow-up (2026-10-13)

- Booking-first lock ordering added to PayOS status/webhook/reconciliation; payment locks no longer fetch-join booking. Other attempts use explicit locking reads to avoid stale MySQL repeatable-read snapshots.
- Scoped, DB-paginated public SERVICE/SUPPLIER reviews and aggregates excluding legacy seed counts implemented. Old supplier shop reviews field retained, DB-limited.
- Frontend scope IDs/mappings, zero counts, real Filter Explore reviews and paginated loading/error/retry states implemented. Partner service cards now load real API services. Static homepage demo review component excluded from production.
- New H2 transactional concurrency tests pass. Invalid review target revealed HTTP 500; fixed typed parameter handling to HTTP 400.
- Latest completed backend run: 157 passed, no failures/errors/skips; compile/package PASS. Includes 16 legacy-public matrix cases, Vietnam/UTC boundary, timestamp-tie pagination, legacy rating 0 and stale flags.
- Frontend: npm ci, 27 tests, TypeScript/lint and production build PASS; jsdom added only as a dev dependency, lockfile synchronized.
- Added isolated MySQL CI job for release transaction tests and push trigger for feature branch. MySQL URL guard restricts tests to loopback beautylink_review_test; never production.
- Docker CLI available but daemon unavailable. No Docker build/MySQL container verification locally.
- Final real Chrome/localhost Spring/H2 smoke PASS: completion, both target create/update, reload, Explore/service/partner detail; zero console/page errors and API 4xx/5xx. React key warning discovered by browser and fixed/tested; only test-JVM workaround for Windows AF_UNIX, no production runtime changes.
- Code commit 86054cd7afb4d4fa9e2b833947973b6cc8b68236 pushed. Draft PR creation retried and blocked by GitHub connector 403; no PR exists. Use compare URL and PR_DRAFT.md if integration permissions remain unavailable.
- CI/quality commit 1c08995a539e3934a3aabd6914bf97d64324b477 pushed; https://github.com/xuandat24/BeautyLink_EXE/actions/runs/38303674498 PASS for all jobs: backend 157 tests + Docker image build, frontend 27 tests + lint/build, isolated MySQL 34 tests. Earlier 86054cd run also PASS. Local Docker daemon missing, covered by CI image build.
- User reports backup at 20:00 today and selected that restoration has not been tested. Usable backup remains unverified. Do not merge/deploy until this gate, draft PR creation/review and current-HEAD CI are satisfied.
- Next external steps: create draft PR via compare link or fix GitHub connection write permissions; validate backup on a separate database; coordinate backend-first release/promotion. No code implementation TODO remains for this scoped patch. Later documentation-only commits preserve tested runtime code, but verify their own CI before merge.
- Production rollback baseline verified: main 5cdc5d3; Railway 12ca4eb6-d4ca-419c-9c99-2467b712cd03 SUCCESS; Vercel dpl_9VxMUwE9KkkN8fCT5a1HnvAMxftf READY. Railway categories and frontend GET returned HTTP 200. Backup unverified (mounted MySQL volume is not backup proof).
- Merge/deployment conditionally authorized by latest user task, ONLY after all gates, valid access and usable recent DB backup are verified. No production action. Local Spring/H2/Vite test servers stopped after smoke tests; test fixtures are excluded from production JAR/bundle.
- Previous handoff entries below are historical; its old blanket no-merge condition is superseded by the latest user's conditional authorization.

- Branch: `fix/completed-booking-reviews`; base: `5cdc5d3de0bc51bcc2358f6b1f0088ee933448ad`.
- Integrated the supplied ZIP after a clean patch check. Preserved merged backend Resend/phone changes from main.
- Added owner-only customer completion after appointment end in Vietnam, server eligibility, locked completion/cancellation/review writes and public review filtering.
- Account/bookings/appointments load real bookings; both review targets use backend persistence and stable supplier IDs.
- Scoped additions: stale review-load cleanup/retry, repeated-submit guard and tested booking ID scope; extra overnight/supplier-edit/public-HTTP checks.
- Verified: Java 21 Maven verify 114 tests with no failures/errors/skips; frontend npm ci, 21 tests, TypeScript and production build pass; git diff --check pass.
- No entity/schema migration, dependency, payment behavior or production configuration changes. No live payment/OTP/database mutation.
- Code commit: `8c6f731199242ac8e9775cdfe91fca161df60ff8`, pushed to `origin/fix/completed-booking-reviews`. Later checkpoint-only commits do not change the tested code; inspect actual HEAD.
- GitHub returned 403 `Resource not accessible by integration` for draft PR creation. No PR was created. Create a draft using https://github.com/xuandat24/BeautyLink_EXE/compare/main...fix/completed-booking-reviews?expand=1 and PR_DRAFT.md.
- Implementation and local verification are finished. The remaining external action is PR creation/review. Never merge/deploy for this task; GitHub PR CI runs when a PR is created.
- Limits: independent attendance verification, photo/video persistence and review points remain unimplemented. See BOOKING_REVIEW_AUDIT.md.

Inspect actual Git status/HEAD before continuing. This file contains no secrets, tokens or customer data.
