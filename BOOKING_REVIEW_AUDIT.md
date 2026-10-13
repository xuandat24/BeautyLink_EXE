# BeautyLink booking and verified-review audit

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
MySQL/Docker must pass CI for final HEAD; local Docker daemon is unavailable. Final browser/CI results
and current SHA are recorded in CODEX_HANDOFF.md and release report after verification.
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
