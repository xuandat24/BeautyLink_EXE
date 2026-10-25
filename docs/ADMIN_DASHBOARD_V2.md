# Admin Dashboard V2

Base `821debf7c745e32358236e291cbf44a13d354fad`; branch `feat/admin-dashboard-v2`.
Owner selected the written layout specification; no image/Figma mockup was supplied.
PR #17 (session request sharing) was open at baseline. Auth hooks, JWT policy, checkout, callbacks,
cancellation/completion, review eligibility, production seeds, schema and settings are not changed here.

## Audit and reuse

| Feature | Existing source reused | Addition |
|---|---|---|
| Dashboard | `AdminDashboardController`, `AdminDashboardService.paymentSummary/revenue`, CSV | `AdminInsightsService` and typed `AdminV2Dtos` |
| Bookings | `AdminBookingController`, search/detail, `AdminDashboardPage` drawer | Sidebar, responsive table and accessible detail action |
| Customers | `AdminCustomerService`, `AdminCustomersPage`, history and CSV | Customer tab under Users; paginated all-role directory |
| Salons/workforce | Supplier/ServiceOffering/Practitioner/AvailabilityRule entities | Bounded read-only admin directory/detail |
| Reviews/support | `BookingReviewRepository.VALID_BOOKING`, `ReportsPage` | Paged valid review list; support workflow retained |
| Promotions/settings | No campaign/settings persistence/API exists | Explicit unavailable/read-only pages, no fake statistics/actions |

## Metric contracts

Inclusive ISO dates use Asia/Ho_Chi_Minh, queried as `[from 00:00, to+1 00:00)` instants; max 366 days.
Previous period is the same number of days immediately before from. Change is
`(current-previous)/previous*100`; previous zero or unavailable gives N/A.

| Metric | Definition |
|---|---|
| Bookings | CUSTOMER bookings created in period, including cancellations |
| Users | All-role accounts created in period, all statuses. No user demo marker exists; no inference by name/email. Existing CUSTOMER-only count/export is retained in its tab. |
| Revenue | Gross online amount by paidAt, first PAID transaction (minimum ID) per booking, paidAt non-null and requiresManualReview=false. Duplicate/retry/pending/review attempts add no extra money. Existing payment summaries/CSV now use the same manual guard. |
| Active partners | Current VERIFIED supplier with ACTIVE owner, excluding supplier.demoData unless enabled. Approval history is absent, so previous/trend is N/A. |
| Online payment rate | Bookings in the createdAt cohort with the first verified PAID receipt / all bookings in that cohort, including cancellations. Not a transaction count. |
| Completed | Current COMPLETED bookings in the createdAt cohort |

Revenue is gross receipts, not net revenue/profit. CANCELLED or REFUNDED booking status does not erase a
historical verified receipt. No reliable refund-amount ledger exists to deduct; no refund/cash movement
is inferred. Remaining-at-salon balances are not online revenue. Deposit_05, historical Deposit_50 and
Full_100 remain supported; no cash/card/wallet categories are invented.

- Trend: bookings by createdAt, receipts by paidAt. SQL groups Vietnam dates with dialect-generated
  timestampadd/cast; at most 366 daily projection rows are combined into day/week/month. Weeks start
  Monday; months on day 1. First/last partial buckets contain only the selected range.
- Status distribution: four exclusive statuses, same booking cohort and demo predicate.
- Top salons: booking cohort count descending, supplier ID ascending. Amount belongs to the same
  cohort even if received later. Counts and canonical receipt sums are aggregated separately.
- Popular services: top ten distinct service IDs, count descending/ID ascending; percentage denominator
  is all cohort bookings, not the top ten. Equal service names are not merged.
- Payment performance: all attempts created in period; successful numerator is those attempts now
  PAID with paidAt and no manual flag. Explicitly distinct from booking conversion.
- Demo: existing supplier.demoData exclusion defaults false. Explicit demo scope is carried to salon
  detail. User counts include all accounts because their schema has no demo marker.

## API and routes

Existing `/api/v1/admin/dashboard/{summary,payments,revenue,revenue.csv}`, `/bookings`, `/bookings/{id}`,
`/customers`, `/customers/{id}/bookings` remain available. Frontend keeps `/v1/*` relative API paths.
New GET-only endpoints all use `hasRole('ADMIN')`:

- `/api/v1/admin/dashboard/insights?from&to&includeDemo&granularity=DAY|WEEK|MONTH`: six Metric records
  (value/previous/changePercent/basis), trends, status counts, ranking, services and attempt counts.
- `/api/v1/admin/users?query&role&page&size`: ID/name/email/role/status/createdAt, no passwords/phone/KYC.
- `/api/v1/admin/salons?query&includeDemo&page&size`: owner, approval/activity and related counts.
- `/api/v1/admin/salons/{id}?includeDemo`: salon, first 100 services, first 100 practitioners, their weekly
  rules (max 700), ten recent bookings. Limits are displayed; no approval/status mutation.
- `/api/v1/admin/reviews?includeDemo&page&size`: valid reviews without private customer identifiers.

Directory page >=0 (max 100000), size 1..100, search <=120. Values are bound parameters.
Repeatable-read read-only transactions keep aggregate snapshots consistent. No whole booking collections
are loaded for counts, no payment/practitioner join multiplication, no entity graph serialized. Existing
indexes are reused. Large production ranges may benefit from a separately measured date-index review.

Old bookmarks `#admin`, `#admin-dashboard`, `#admin-bookings`, `#admin-payments`, `#admin-customers`
remain valid. New: `#admin-salons`, `#admin-reviews`, `#admin-promotions`, `#admin-settings`.
`#reports` retains ADMIN/STAFF policy. Global search advertises booking resources only. Customer history,
revenue pagination and CSV are retained. Responses are ignored after unmount/token changes; customer
history uses a selection sequence and CSV download stops if the account token changes.

## Verification and release

Integration coverage: real Spring/JWT/Hibernate ADMIN guards, denied roles, canonical/duplicate/manual/demo
receipts, cancelled/refunded gross-receipt semantics, equal service names/IDs, Vietnam midnight, previous
period, deterministic ranking/pagination, salon schedules and invalid/empty ranges. The same new suite
runs on isolated MySQL CI in addition to H2.

Browser gate uses a synthetic ADMIN, real BCrypt/JWT and isolated Spring/H2/fake PayOS at 1366x768,
1440x900, 1920x1080 and 390x844. It verifies actual API KPI data, date changes, sidebar, salon/booking
details, users/customer view, payments/reviews, page overflow and logout. Screenshots are uploaded in
`admin-v2-browser`. This is not production Google, Cloudinary or payment verification.

Require final-HEAD CI and reviewer approval before merge/deploy. No migration/environment/secret changes
are needed. Approved backend first, frontend second. Old API consumers remain compatible. Roll back
frontend to the prior compatible build; retain additive read endpoints or roll backend to a reviewed
session-enforcing version. Do not restore production DB or revert session/payment safety.
No production records, deployments or configuration were changed by this task.

Local evidence before PR: `npm ci`, `npm test` (104/104), `npm run lint` (TypeScript),
`npm run build`, `node --check frontend/tests/adminDashboardSmoke.mjs` and `git diff --check` PASS.
Java 21 full verify was executed: 396 cases; new Admin V2 7/7 and existing aggregate 1/1 PASS.
The full local run is NOT PASS: 36 failures/16 errors are confined to the same three pre-existing
Windows HTTP suites (MissingResendConfigurationTest, PlatformApiIntegrationTest, CloudinaryImageGatewayTest)
with JVM `Unable to establish loopback connection`; 4 opt-in MySQL cases skipped. No tests disabled.
Require Linux CI at the final HEAD, including Docker, isolated MySQL and the browser screenshots.
