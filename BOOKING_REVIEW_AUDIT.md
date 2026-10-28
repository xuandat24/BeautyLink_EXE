# BeautyLink booking and verified-review audit

## Current change — 2026-10-28: history synchronization, 12-minute hold, midpoint/photo feedback

This section supersedes the older COMPLETED-only review policy below. Base: `53e292af4cb51fc90f328870b0865cca2cc4845a`.
No production data, mail, payments, DDL, merge or deployment is performed by this change.

| Requirement | Code / invariant | Regression evidence |
| --- | --- | --- |
| Paid history cannot invite a duplicate payment | BookingsPage + bookingHistorySync use GET current attempt then reload the owned booking; max two concurrent requests, no POST. Withhold checkout while checking or inconclusive; account/credential-epoch and load-generation guards. Poll visible history every 30s and on visibility/return; keep cards mounted. | bookingHistorySync.test.ts, bookingActions.test.ts; existing real Spring/JWT/fake-gateway browser smoke |
| 12-minute unpaid hold | One deadline = booking.createdAt + 720s, capped by appointment start. No-attempt expiry locks/rechecks with READ_COMMITTED (including batch snapshot/ledger-creation race); attempts release only after verified terminal zero. Older provider links are safely cancelled by reconciliation after the deadline; unknown/timeout/manual cases retain slot/blocker. A timed-out cancellation receiving later PAID retains manual evidence. | PaymentCancellationSafetyTest exact boundary, timeout, late receipt and normal paid cases |
| No expired checkout/retry | Shared deadline caps legacy QR expiry/freshness lease and gates booking capabilities, QR response, new attempts and ADMIN zero-money retry proposal. Early, provider-verified closure can retain the previously supported retry inside the original hold; customer-cancelled bookings never reopen. | Existing retry/slot/concurrency matrix plus deadline tests |
| Midpoint reviews | CONFIRMED paid/deposit-paid owner can review from scheduled midpoint (Vietnam time), including overnight appointments. COMPLETED eligibility remains compatible. Pending/manual secondary attempts still block write/public aggregates. Completion itself still requires scheduled end. | BookingLifecycleTest, BookingReviewReleaseTest, existing cancellation/manual matrix |
| Public photos + reload/edit | Up to 3 raster JPG/PNG/WEBP images. Existing image preparer, content validator and Cloudinary rollback cleanup. Only own stored review images can be retained; new arbitrary URLs/SVG/invalid content rejected. Two review targets remain unique. | reviewPhotos.test.ts, public list/rating/count + persisted-image integration and browser upload/reload |
| Two feedback reminders maximum | Existing durable outbox, unique per booking/type/customer. Midpoint queued on canonical PAID, completion queued on actual COMPLETED. No old midpoint replay after end, no historical backfill. Any feedback target suppresses both further reminders. | Real payment/completion entrypoint tests, duplicate webhook, scheduled job tests |
| Feedback/send race | Read-committed booking-first lock serializes review commit with pre-send eligibility/feedback check. Suppressed jobs remain auditable SKIPPED. An email already accepted by provider cannot be recalled; stable provider idempotency key handles ambiguous acknowledgement. | Real database row-lock feedback/reminder concurrency test |

Schema necessity: existing booking_reviews has no image list or persisted authorization instant for public
mid-service reviews. Add only nullable `images_json` and `eligible_at`; legacy completed reviews stay visible.
The authorization instant keeps public lists/counts/ratings aligned without MySQL/session-timezone arithmetic. Public predicates bind the application UTC Instant rather than database CURRENT_TIMESTAMP; the MySQL session-timezone regression covers this.
Widen existing outbox type storage to VARCHAR(50) if Hibernate originally generated a native ENUM.
Migration: `backend/src/main/resources/db/migration/mysql/V20261028_01__review_photos_midpoint.sql`.
The existing MySQL migration probe suite tests preservation of legacy rows and new reminder types.

Frontend lint/tests/build, backend Java21 verify, isolated MySQL migration/concurrency and browser jobs
must pass at the final PR HEAD. Provider/mail tests are simulated and establish no real transfer/mail delivery.


## Final convergence fix (baseline 87409c11, 13 October 2026)

| Verified defect | Minimal correction | Behavioral evidence |
| --- | --- | --- |
| PAID reconciliation calls markPaid on PENDING/manual while webhook keeps escalation | Single identity/amount-verified receipt decision; never clear manual flags automatically | 2 RED cases before fix; delivery-order/repeated/status/scheduler/webhook tests now PASS |
| REVIEW_REQUIRED is excluded from scheduler/status and may lose later receipt observation | Bounded/throttled candidate query and common entry guard include manual cases | Provider timeout/identity/amount matrix followed by later PAID; query-driven scheduler test |
| Terminal-zero reconciliation can overwrite manual attempt status; invalid webhook reference overwrites verified evidence | Preserve manual status/first verified receipt/reference, ADMIN-only all-attempt closure | Zero/contradictory-zero/operator audit, primary-secondary and concurrent MySQL-selected tests |

Fixed scope: PaymentService, PaymentTransactionRepository, existing payment tests/browser fixture, runbook,
PR and handoff. No API shape/schema/dependency/OTP/auth/money math/unrelated UI change. All paths that can
markPaid or clear manual were traced; only PaymentReviewService clears manual after its locked all-attempt
provider proof/audit. It is unchanged. Established PAID primary stays intact while a secondary is blocked.
Local full suite 269 PASS (+33 integration cases); frontend 40/typecheck/build PASS; expanded real
Chrome/Spring/JWT/H2 fake-gateway smoke PASS. MySQL/Docker/browser CI must match the final pushed HEAD.
Production and operational gates are tracked separately in PAYMENT_REVIEW_RUNBOOK; no merge/deploy yet.

## Fixed scope for continuation/review resolution (baseline 4841be0)

Fetched main 5cdc5d3 and feature 4841be0, clean worktree, merge base main; no AGENTS.md found.
Claims checked against current source before editing:

| Gap | Call paths / invariant | Planned files | Proof |
| --- | --- | --- | --- |
| R1 confirmed: checkout booking ref disappears; bookings has no continue-payment action | Existing owned booking only; reread capabilities; same option/voucher reuses ledger; no browser proof | BookingsPage, CheckoutPage, small continuation dialog/navigation helper, booking DTO/read API/client | React + real browser reload/back-forward/account/stale/double/blocked tests |
| R2 confirmed: pending reuse/status URL before start-time guard | Shared clock/policy, strict now < start, money reconciliation unaffected | CompletionPolicy (shared time helpers), PaymentPolicy, PaymentService, BookingService | Fixed-clock before/exact/after start DTO/create/reuse/status + post-start PAID |
| R3 confirmed: availability host-local time and LocalTime wrap loop | HCM dates, >=30-minute lead, one calendar month, finite interval slots and adjacent-day overlaps | AvailabilityService, booking/payment policies, booking-only frontend date helper/validation | Fixed-clock UTC/HCM, lead/month/midnight/overnight + retained MySQL races |
| R4 confirmed: runbook has no executable zero-money resolution | ADMIN preview, all-attempt provider proof reread under booking/payment locks; no financial automation | Small PaymentReviewService/controller/DTO, SupportReportRepository + targeted SupportService audit protection | Denied roles, dry-run zero writes, safe/idempotent closure, changed preview, mismatch/null/received/other attempts and race tests |
| R5: browser gate currently local-only | Loopback test server/JWT/DB and fake gateway only; fixtures absent from artifacts | Existing smoke fixtures/script + small CI job | Local Chrome and exact-HEAD CI browser/MySQL/Docker gates |

No new schema/dependency/notification/refund framework. Existing SupportReport is the available
persistent audit mechanism (no AuditLog entity exists); internal payment-review records will be
append-only through application APIs and reserved against customer forgery. Protecting those records
in SupportService directly supports R4; it does not refactor report workflows.
Money-received/conflicting cases remain blocked: operator preview exposes proof; owner decision and
external money handling remain separate approvals, never forced PAID/REFUNDED or cancelled-booking revival.
Older sections below are historical and are not current acceptance evidence.

### Current acceptance mapping

| Requirement | Code / evidence | Result |
| --- | --- | --- |
| Resume without new booking | PaymentContinuationDialog, identity-only navigation; owned booking GET; Bookings/Checkout/App | Component tests and actual App browser reload/back + reuse/expired retry PASS |
| Strict checkout cutoff | Shared BookingCompletionPolicy in DTO/reserve/status; expiry cap in request/ledger | 2 pre-fix RED cases, fixed before/exact/after matrix + late provider-create response + post-start signed money PASS |
| HCM window/finite slots | AvailabilityService + bookingTime helpers; existing practitioner mutex retained | Clock/zone/month/30-minute/midnight/adjacent interval tests PASS; independent UTC JVM 6 PASS |
| Executable internal closure | ADMIN PaymentReviewService/controller, all-attempt identity/terminal/known-zero proof, fingerprint, SupportReport audit | Read-only preview, denied role, stale/change/money/null/other-attempt/idempotent/concurrent webhook tests PASS |
| Preserve paid primary | Separate close-zero-secondary action, owner option 1 approved | FULL_100/DEPOSIT_50 primary unchanged; financial/multi-paid/manual cases refused; completion/review reopen only after blocker removed |
| Money evidence race | Booking-first locking retained, signed PAID on manual attempt no longer ignored; exact late GET PAID observation kept | Concurrent closure/webhook and retained cancel/reconciliation/complete/review tests PASS; no booking revival |
| Real reviews/regression | Existing scoped public queries/eligibility unchanged | Full Java 21 236 tests + frontend 40 + browser SERVICE/SUPPLIER upsert/reload/details PASS |
| Artifact safety | Test-classpath fixture/fake gateway only, no runtime/test dependency changes | Production JAR/bundle fixture scan PASS; source HEAD 4b0450f CI Docker/MySQL/browser PASS |

App.tsx changes are restricted to restoring/clearing continuation navigation; they do not change auth.
SupportService/SupportReportRepository changes directly protect/persist operator audit; no generic support
workflow refactor. No entities/schema, OTP/auth/JWT/KYC, money/voucher/deposit formulas, supplier onboarding,
new notifications or runtime dependencies changed. New scope inventory is fixed; no further feature work.
Existing CI at 4841be0 is baseline only; final HEAD CI must independently pass before CODE READY.
Source/release HEAD `4b0450f` CI https://github.com/xuandat24/BeautyLink_EXE/actions/runs/38357426376
PASS: backend 236, MySQL 107, frontend 40/typecheck/build, Docker and browser. Documentation-only final
checkpoint must also pass its own exact-HEAD CI, reported separately; no runtime changes after this evidence.
Production/PayOS live smoke NOT RUN. Restore metadata inspected, but isolated restore target/approval absent.

## Current safety follow-up (2026-10-13; supersedes historical cancellation policy below)

Baseline main `5cdc5d3`, feature `e207040` was fetched and clean before this follow-up. Existing
commits are preserved; OTP/auth/KYC/voucher/deposit formulas and production configuration are untouched.
Before-fix reproduction: 8 integration cases failed with zero test errors after fixture isolation.
A–F were reproduced (cancelled checkout reuse, paid cancellation, manual-review bypass, false
superseded closure, interval overlap, mixed supplier-shop reviews); G was statically confirmed in README.

The safety patch verifies provider identity/status/received amount before customer cancellation,
preserves verified payment evidence across HTTP conflicts and uncertain creates, uses booking-first
locks, withholds unsafe checkout/completion/review, and checks retry/new-booking interval competition.
Supplier-shop reviews now contain SUPPLIER only, matching their rating/count; all public review
lists/aggregates hide bookings with pending/manual blockers as well as invalid lifecycle/payment.
Frontend uses additive server cancel/payment capabilities, guards repeated/stale actions, refreshes
real data after mutation, and retains the booking during provider retry instead of creating another.
No schema migration or new dependencies. Customer completion remains self-attestation.

Current local regression: Java 21 verify **194 tests passed**; frontend **32 tests passed**, TypeScript
and production build passed. Baseline results below are historical, not evidence for final HEAD.
Runtime/source HEAD `566939f` CI passed backend/Docker/frontend/MySQL (72 tests) at
https://github.com/xuandat24/BeautyLink_EXE/actions/runs/38344332391; expanded Chrome/Spring/JWT/H2
smoke passed account/appointments/checkout fake gateway/pending cancel and all review scopes with
zero API/page/console errors. Local Docker daemon is unavailable. Documentation-only checkpoint
commits must have their own HEAD CI verified; see CODEX_HANDOFF.md and the final report.
The old paid-cancel expectation is replaced by paid-cancel denial; no concurrency coverage is removed.
The old mocked same-start retry test is superseded by real-DB same-start, different-start, overnight
and concurrent retry/new-create tests (also selected by the MySQL CI job).

Only feature push/draft PR is authorized. No merge/deploy/payment/production DB write or restore.
Owner is responsible for manual review, but money procedure and notification design are not approved.
See PAYMENT_REVIEW_RUNBOOK.md for current invariants, residual risks and explicit release gates.

Reviewed main: `5cdc5d3de0bc51bcc2358f6b1f0088ee933448ad`.
Plan read: 12 October 2026; its last modification was 12 October 2026 at 08:26 UTC.

## Requirements and findings

[MASTER PLAN Beauty Link – EXE201](https://docs.google.com/spreadsheets/d/1mn-FTAlpr-AoftJBP1Y_geCHCat1SRXAgHJ0q-6zg3k/edit)
sets the week-6 verified-review work for 12–15 October 2026, assigned to Quân and Đạt,
reviewed by Đạt, and currently marked Not started. Its DoD is to finish booking states
and reviews after service completion. The project overview also describes photo/video
reviews and Beauty Points. A plan status is not evidence that no code exists.

| Requirement | Main before this patch | Proposed behavior / gap |
| --- | --- | --- |
| Reviews after using a service | `ReviewService.isEligible()` accepts PAID/PARTIALLY_PAID unless CANCELLED; even PENDING/PAID passes | Both review targets require COMPLETED plus PAID/PARTIALLY_PAID |
| Reachable completion state | Enum and frontend labels exist, but no runtime writer or completion API | Owner confirms actual use after the scheduled end through a new customer API and UI |
| Backend ownership | Review PUT already checks booking customer; role enforced in controller | Preserved; completion applies the same role and ownership boundaries |
| Customer UI follows server eligibility | Account/appointments offer local-only reviews, with synthetic completed booking history in the account | All customer booking entry points use the shared API-backed bookings page and server eligibility flags |
| Separate service/provider ratings | Backend SERVICE and SUPPLIER targets already exist, one per booking/target | Both available in the form; editing reuses the same backend row |
| Public verified reviews | Supplier API lists persisted reviews regardless of booking state; some frontend screens read local/generated reviews | Public persisted-review queries/aggregates exclude ineligible bookings; category/provider detail reads actual API reviews |
| Media attachments | Modal previews local photos, but DTO/entity has no media field | Still a gap; form does not pretend to persist media |
| Review rewards | Modal promises +20 PinkPoints without a backend reward transaction | Still a gap; removed unsupported success promise |

Primary code evidence: `BookingService.java`, `ReviewService.java`, `PaymentService.java`,
`BookingController.java`, `ReviewController.java`, `DomainEnums.java`, `BookingReview.java`,
`ApiDtos.java`, `CatalogService.java`, and the customer account, appointments, bookings,
category-detail and provider-detail components. `Project Requirement.txt` and README were
also checked; the master plan gives the more specific after-completion criterion.

## Booking lifecycle

| Transition | Actor / trigger | Conditions and effects |
| --- | --- | --- |
| New → PENDING / UNPAID | Customer POST booking | Available practitioner slot; creates booking, not service completion |
| PENDING → CONFIRMED | Verified PayOS webhook or server reconciliation | Deposit gives PARTIALLY_PAID; full payment gives PAID |
| PENDING → CANCELLED | PayOS expired/cancelled/failed reconciliation | Unpaid slot released; paymentRetryAllowed enables existing retry path |
| CANCELLED → PENDING | Customer PayOS retry | Only payment-released cancellations, permitted retry flag, and slot rechecked; explicit customer cancellation disables retry |
| PENDING/CONFIRMED → CANCELLED | Booking owner PATCH cancel | COMPLETED rejected; explicit cancellation disables payment retry |
| CONFIRMED → COMPLETED | Booking owner PATCH complete (new) | Verified payment/deposit and scheduled end reached, then explicit confirmation that service was used |
| COMPLETED → COMPLETED | Same owner retries completion | Idempotent; no payment or reward is invented |
| COMPLETED → review create/edit | Owner PUT SERVICE or SUPPLIER | PAID/PARTIALLY_PAID required; cancellation and unpaid/refunded states rejected |

New route: `PATCH /api/v1/bookings/{id}/complete`. No body or client-supplied timestamp/state.
Response adds `completionEligible`; existing `reviewEligible`, `serviceReview` and
`supplierReview` remain the review contract. Time checks use Asia/Ho_Chi_Minh independent
of the host timezone, including overnight appointments. Cancellation, completion and review
writes acquire the booking row lock; review uniqueness remains enforced in the database.
The PayOS payment process remains responsible for confirmation only and is not changed into
an automatic completion process.

Deposit-only completed bookings remain reviewable because the existing business flow allows
payment of the remainder at the salon. Completion does not change PARTIALLY_PAID into PAID,
collect a balance, or assert that a cash balance was verified by the platform.

## Customer flow

1. Open the bookings page, account bookings tab, or appointments modal. All now read
   `/bookings/mine`, rather than browser-stored/synthetic booking history.
2. A confirmed, paid/deposit booking displays **Đã sử dụng dịch vụ** when the server says
   `completionEligible=true`. Use **Làm mới** if the scheduled end has just passed.
3. The customer explicitly confirms actual service use. The server rechecks ownership,
   status, payment and time, even when the browser holds a stale response.
4. The updated booking displays **Đánh giá dịch vụ / nhà cung cấp**. The review form
   rereads eligible bookings, offers the two targets, saves through the existing PUT API,
   and shows success only after persistence succeeds. Existing reviews can be edited.
5. Public category/provider review forms select real eligible bookings using stable
   service/supplier IDs. A frontend display ID such as `new-supplier-42` is not a database ID;
   provider data now carries its real supplierId explicitly. Missing IDs fail closed.

No booking or legacy local review is automatically promoted into a completed/verified record.
Existing database reviews on uncompleted bookings stay stored but are excluded from public
verified-review lists and aggregates until the booking legitimately satisfies the rule.

## Validation recorded by the supplied package

- Java 21: 113 backend tests passed, zero failures/errors/skips. Includes 12 API matrix cases
  for both review targets, 20 lifecycle unit cases, the updated complete→review integration
  flow, and existing PayOS/auth/profile/catalog/report regressions.
- Matrix covers unpaid, deposit/full payment before completion, completed deposit/full
  payment, cancelled paid/unpaid, and refunded records. Tests check owner-only completion,
  customer-only role, anonymous rejection, exact end time in Vietnam, future and overnight
  appointments, idempotent completion, prohibition on cancelling completed appointments,
  one-row review editing, and suppression of historical premature public reviews.
- Maven packaging completed successfully. In this workspace Mockito requires an explicit
  Byte Buddy javaagent because dynamic attach is unavailable. The packaging step was run
  separately with tests skipped after the full test suite passed; no production JVM or
  dependency configuration was changed for this workspace restriction.
- Frontend: 17 policy tests passed; TypeScript check and production Vite build passed.
  `npm test` is included in CI. Existing Vite chunk-size/Zod annotation warnings are nonfatal.
- Chromium UI smoke with mocked API responses passed: blocked review controls on unpaid,
  upcoming paid/deposit and cancelled bookings; confirm completion; save both targets;
  reload and reopen persisted reviews; authenticated request headers; no page errors.
  This proves UI/API contract behavior, not a live PayOS or production database transaction.

## Remaining scope and acceptance boundaries

Customer self-confirmation after the appointment is an MVP attestation, not independent
proof of attendance or service delivery. A no-show could falsely declare use after the
scheduled end. Stronger verification would require a separately agreed supplier/customer
confirmation or a service-delivery proof flow; none is silently invented here.

Photo/video persistence and Beauty Points remain unimplemented. Existing marketing cards,
provider certificates/service descriptions, and some base/demo rating counts still contain
sample material outside this booking/review correction. Legacy review readers no longer
return fabricated/local reviews; the two main detail review surfaces read the API. Other
legacy explore review overlays currently show no local reviews and can be migrated to the
same API hook separately. Provider lists are capped by the existing supplier endpoint's
100-review limit; the provider detail score reflects the displayed supplier reviews.

Do not mark the complete master-plan feature Done based solely on this patch. Review and
pilot-test the core booking-completion flow, then decide explicitly whether media/rewards
are in the current acceptance scope. The plan itself is not modified by this audit.

Suggested pilot check: create an actual booking, pay a deposit/full amount, confirm that no
review is available before the service ends, confirm service use afterwards, submit/edit both
targets, reload from another session, and verify public visibility. Cancelled and other-owner
bookings must remain blocked. Deploy backend and frontend together so the new server flag
is available; an older backend safely leaves completion unavailable in the new UI.

## Integration verification — 13 October 2026

`origin/main` still matched `5cdc5d3de0bc51bcc2358f6b1f0088ee933448ad` when fetched. No repository AGENTS.md was present. The supplied patch passed `git apply --check`, and the applied source passed reverse-check before the following scoped additions. No unrelated local edits were reset or overwritten.

- Clear old eligible-booking data when the review dialog reloads; add retry after a failed load, reset the review target for the new context and guard repeated submits with a ref. The React quality checklist highlighted stale asynchronous data as the relevant issue; no component-wide redesign was added.
- Reuse a tested booking-scope selector in the dialog so service/supplier database IDs constrain eligible bookings and missing/invalid IDs fail closed.
- Add an equal-start/end next-day completion test, supplier-review update/persisted-ID assertions and actual public supplier HTTP checks excluding historical premature reviews.
- Java 21: `mvn --batch-mode --no-transfer-progress verify` passed **114 tests**, zero failures/errors/skips; compile and executable JAR packaging passed. This Windows environment allowed Mockito attachment; no test-skipping or production JVM changes were necessary.
- Frontend: `npm ci` passed; `npm test` passed **21 tests**; `npm run lint` (`tsc --noEmit`) and `npm run build` passed. Existing Zod annotation and bundle-size warnings remain nonfatal. No dependency was added.
- `git diff --check` passed. PaymentService, auth/Resend code, JPA entities/schema mappings and deployment configuration were unchanged.
- Chromium checks described above are evidence from the supplied package, not checks rerun during this integration. Live MySQL/PayOS testing and production deployment were not performed. All newly executed DB tests used H2 and payment regressions used the existing fake gateway.
- Branch: `fix/completed-booking-reviews`. Deployment and merge remain outside this task's authorization. Review media, Beauty Points and independent attendance proof are still outstanding; the master plan was not marked Done.
