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

## Targeted UI refinement (base cdf95fb, 26 October 2026)

This follow-up preserves the merged V2 architecture and all reporting contracts above.

| Requirement | Classification at base | Targeted change |
|---|---|---|
| Nine sidebar destinations, responsive menu, existing hashes | Already implemented | Preserve; add explicit keyboard focus and return focus when closing mobile overlay |
| Six real KPI definitions, demo exclusion, filters/refresh | Already implemented | Preserve data; stronger values/accent icons and comparison explanation |
| KPI destinations | Needs refinement | Explicit detail buttons; completed uses existing status filter, no guessed routes |
| DAY/WEEK/MONTH, two actual reporting series | Needs refinement | Pressed buttons, dashed indigo revenue, keyboard/hover points for both series |
| Chart zero data | Missing explicit chart message | Show empty state without fabricated trend values |
| Status donut and table/drawer colors | Needs refinement | Shared amber pending, blue confirmed, green completed, rose cancelled; violet refunded |
| Recent booking details, CSV and pagination | Already implemented | Preserve; clearer detail button and view-all action |
| Top salons and service-ID ranking | Already implemented | Preserve; visible salon action/focus and long-name titles/truncation |
| Gross receipts, deposits, attempts, payment caveats | Already implemented | Preserve; no fake payment-method categories |
| Backend/security/schema/payment/auth/seed changes | Out of scope | None; no demonstrated backend defect |
| Campaign mutation, editable settings | Out of scope | Preserve explicit unavailable/read-only pages |

Interaction mapping uses the existing onNavigate callbacks: total bookings and recent view-all -> bookings
(clear local status/payment/search filters); completed -> bookings with status=COMPLETED; users -> all-role
user directory; partners -> salon directory; revenue and payment rate -> payment reporting. Booking/payment
drilldowns retain the selected date/demo range while mounted. User/salon directories retain their existing
scope (not a new KPI-specific filter). Top salon passes its actual ID and demo scope to the existing detail.
The existing booked-customer cohort action remains separate. Cards have explicit buttons, not nested links
or whole-card click handlers; opening a metric definition does not navigate.

Focused tests cover KPI mapping, completion/filter reuse, chart requests and keyboard revenue inspection,
zero data and all badge colors. Existing tests retain stale response, authorization, session-expiry, error,
CSV, login/checkout and logout coverage. The existing browser smoke is extended for real grain requests,
KPI completion filter, search, back/forward, mobile Escape/overlay/focus and actual server-side revocation
or logout at the four existing viewports. Browser fixtures remain isolated and production files untouched.
Final run links and screenshots belong in the refinement PR; no production rollout is authorized here.

Deployment/rollback: frontend-only bundle change; existing backend/API/schema remains compatible.
After review and separate deployment approval, roll back only the frontend build if necessary; no database
restore or backend/session/payment-policy rollback is needed.

## Compact responsive follow-up (base 7230249, 26 October 2026)

Inspected existing AdminDashboardPage, AdminOverview, AdminNav, AdminModulesPage, AdminCustomersPage,
ReportsPage, adminStatus, adminApi, beautyApi, App routing, Tailwind/Vite, existing tests and browser gate.
Confirmed actual backend enum definitions and existing customer/demo API defaults; no API/query changes.

Preserved: nine routes and aliases, ADMIN/session guards, KPI formulas, real API reporting, booking/salon
drawers, customer history/CSV, revenue pagination/export, financial review warnings and all payment rules.
Refined only: visible demo inclusion controls removed; every scoped UI request uses includeDemo=false
(legacy initialDemo navigation input cannot enable it). Existing demo fixtures/exclusion tests remain.
Customer export/history retain their existing non-demo backend defaults. No records deleted or changed.

KPI default view is icon/label, tabular value, short comparison and one detail action. Missing comparison
is "Chưa có so sánh", never zero growth. Metric notes/basis/prior-period explanation remain in the closed
keyboard-accessible disclosure; booked-customer drilldown remains next to it. Currency uses vi-VN Intl,
nonwrapping text and container-relative font sizing. Grid: one column mobile, two at sm, three at xl,
six only from 1800px. Main padding 16-24px, card radius/padding 16px, contained table scroll preserved.

AdminStatusBadge/adminStatus are the single status presentation source for users, roles, supplier approval,
booking/payment tables and drawers, customer history and report queue. Actual AccountStatus is ACTIVE,
DISABLED, SUSPENDED; no unsupported INACTIVE/BLOCKED enum is invented. Actual approval statuses are
PENDING, VERIFIED, REJECTED, SUSPENDED. Unknown values have a neutral "Không xác định" fallback.
Filter values remain raw enums. Labels and colored backgrounds have foreground colors designed for AA.

Regression found by the new module-switch test: an old result could render under the next section before
effect cleanup, causing user rows to be formatted as salon counts. Results are now bound atomically to
their section; salon details also require their selected ID. Existing stale-request/token guards remain.

Local npm lint/typecheck, all 112 tests, production build and diff check pass. Three new cases cover
shared enum/fallback styling, normal-scope directories/role filter/pagination, and compact KPI/currency.
The existing browser gate now covers seven viewports (1920, 1440, 1366, 1024, 768, 390, 360 widths),
normal-scope API calls, all routes, CSV downloads, pagination/history, keyboard navigation, logout and
revocation. It checks page overflow, compact KPI height, badge AA contrast, and a deliberately synthetic
large-revenue response for UI containment only; that response is not financial/accounting evidence.
Screenshots use actual isolated API data and include overview/users/salons/detail at every viewport.

Only backend diff: three test-fixture lines designate one in-memory supplier non-demo so the existing
real Spring/JWT/H2 browser gate can exercise normal reporting without a toggle. Other demo suppliers
remain excluded. This test class is absent from production JARs. Production backend, schema, seeds,
dependencies, auth, PayOS and reporting formulas are unchanged. Final CI/screenshots recorded in PR.
Rollback: previous frontend bundle only; no migration, production data write or backend rollout needed.

Visual QA caught mixed-unit Tailwind ordering: min-[1800px] was emitted before xl (rem) and got overridden at 1920px. The 1800px-equivalent breakpoint now uses 112.5rem, matching default units. Browser asserts the expected 6/3/2/1 columns at each width, rather than inferring responsive success solely from overflow.

## Tables, details and SPA follow-up (base 0c2150a)

| Module | Confirmed baseline defect | Narrow change |
|---|---|---|
| Overview | One Promise.all depended on grain and globally replaced content with loading | Separate insights/payment/recent request lifetimes; grain only refetches existing insights, keeps nodes/data and handles local error/retry/races |
| Tables | Salon, booking and revenue cells stacked unrelated attributes | Dedicated columns, scoped admin-table CSS, existing badges/drawers/CSV/paging preserved |
| Salon | ID in component state, oversized drawer, eager capped collections | Hash detail page; headerOnly option on existing API, lazy paginated tab reads and expanded schedule reads |
| Account | No detail or authorized cross-account profile update contract | Explicit ADMIN detail DTO; owner approved only CUSTOMER name/gender/birth edits, manual route, optimistic timestamp under row lock and immutable audit |
| Other modules | Existing read-only reviews, campaign/settings states and reports workflow | Preserve; review columns separated; no speculative campaign data or financial mutations |

Routes: `#admin-salons/{id}` with `/services`, `/practitioners`, `/bookings`, `/payments` tabs;
`#admin-users/{id}` and `/bookings`; manual-only `#admin-users/{id}/edit`. Existing list hashes and aliases
remain. Invalid/unsafe IDs fail closed. Hash changes keep the admin shell and relevant detail header mounted;
only changing the entity/account ID intentionally resets page-local caches. Refresh and browser history
resolve the ID from the URL. No normal UI link/button/search suggestion exposes the edit URL.

Reused: booking list/detail, customer history, canonical receipt policy, status badges, revenue/CSV and
existing session guards. Additive ADMIN APIs:
- GET `/admin/users/{id}`: safe profile projection and up to 100 non-demo linked salons; no secrets or sessions.
- PATCH `/admin/users/{id}/profile`: fullName plus optional gender/dateOfBirth and expectedUpdatedAt.
- Existing GET `/admin/salons/{id}?headerOnly=true`: existing shape with header/counts and empty collections;
  old default still returns the legacy shape/collections unchanged.
- GET `/admin/salons/{id}/services`, `/practitioners`: database paging (size 1..100).
- GET `/admin/salons/{id}/practitioners/{personId}/schedule`: verifies both IDs, at most seven weekly rules.
- GET `/admin/salons/{id}/bookings`: CUSTOMER cohort, createdAt date/status filters, database paging.
- GET `/admin/payments?salonId&from&to&page&size`: bounded attempt ledger and canonical receipt summary.
All above retain `/api/v1` server and relative `/v1` client prefixes. Demo exclusion and 366-day Vietnam
date policy stay unchanged. Read-only queries bind values and use repeatable-read snapshots.

Money: attempts are listed by createdAt, ordered createdAt DESC/id DESC; canonical verified receipts use
paidAt and the same first-PAID/manual guard as existing reporting. Duplicate/manual attempts do not inflate
receipts. Deposits 5%/historical 50%, full payment, requested amount and remaining-at-salon snapshot are
separate. A PAID label is not a claim that every attempt is canonical. No cash/refund/commission/payout
calculation is invented. Header booking/service/practitioner counts retain their existing all-time definitions;
booking tab date filters and CUSTOMER cohort can have a different count.

Owner explicitly approved the narrow update contract in this session. Only ACTIVE ADMIN actors may edit
CUSTOMER name/gender/birth. Unknown JSON fields, role/status/email/phone/password/authVersion edits are
rejected. Optional null fields preserve existing values, including null Google-account profiles; no invented
birth dates/genders. Target row is re-read under a pessimistic lock and expectedUpdatedAt must match.
Only one concurrent update wins; stale submissions return 409. Changes and SupportReport audit commit
atomically. Reserved `ADMIN-PROFILE-AUDIT:` records contain actor/target IDs, changed field names and
timestamps, no profile values/secrets; public creation and report mutation of that audit are forbidden.
Existing JWT accountUpdatedAt policy is preserved: an edited customer's old JWT returns 401 and the
customer signs in again. No token is issued to the admin for that customer and no session policy is relaxed.

Verification: real Spring/JWT/Hibernate tests cover salon/payment isolation, canonical amounts, paging,
role denial, strict payload validation, stale writes, audit persistence/immutability and concurrent HTTP
updates. Frontend tests cover local chart races/error/retry without unmount/refetching unrelated widgets,
tab caching, route parsing, hidden edit discovery and duplicate-submit prevention. Browser uses the existing
isolated Spring/H2/fake gateway gate at seven viewports, never production. Full local Java verify was
executed: 400 cases, 0 failures/211 context/HTTP errors/4 skips due to Windows JVM loopback failure in
RestClient initialization; the focused Admin tests with mocked outbound image gateway pass. Require full
Linux CI at final HEAD; final counts/run/screenshots recorded in PR instead of documentary CI reruns.

Release: backend first (additive APIs and immutable audit reservation), then frontend; no schema/env/secret
changes. Roll back frontend to the previous compatible bundle if necessary, retain backend audit guards
for records already written. Do not restore DB or roll back session/payment safety. No merge/deploy or
production writes authorized/performed by this task.


### Manual profile-edit directory (follow-up to PR21)

The manually entered URL is `https://beautylink.cloud/#admin-users/edit` (after this frontend change is released).
It reuses the normal all-role user directory, search, role filter, paging and customer history/CSV.
Only this opt-in directory shows a `Sửa hồ sơ` action for CUSTOMER rows; it opens the existing
`#admin-users/123/edit` form with the real numeric ID, and its back action returns to the edit directory.
`{id}` in documentation is a placeholder, never a literal ID to type into the browser.
No normal sidebar/list/detail advertises this mode. All routes remain behind App's verified ADMIN gate;
URL secrecy is not authorization. Existing server validation/ACTIVE ADMIN/CUSTOMER-only fields,
concurrency checks, immutable audit and JWT policy are unchanged. No new backend/API/schema changes.
Browser regression adds direct entry, refresh, real all-role data, customer-only edit buttons,
form/save/reload/back to the directory and responsive screenshots at all seven existing viewports.
