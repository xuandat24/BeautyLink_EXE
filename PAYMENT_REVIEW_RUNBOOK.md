# Payment review operations — approval required before rollout

## Webhook / reconciliation decision — 13 October 2026 release

This section supersedes any older statement allowing automatic PAID confirmation after an uncertain
customer cancellation. A manual case is never resolved by webhook, customer status GET or scheduler.
All three record an exact, identity-verified receipt through the same decision in PaymentService.
They preserve the first verified receipt observation (`paidAt`), a verified webhook reference when
available, booking/order/link/expected amount and last reconciliation time. An unverified webhook
reference cannot replace verified evidence. These are application observations, not bank settlement proof.
REVIEW_REQUIRED and legacy manual-flagged attempts remain bounded/rate-limited reconciliation candidates
so a later receipt is still discovered. Non-paid manual rows converge to REVIEW_REQUIRED; an established
PAID primary with a manual flag remains PAID/blocked rather than losing its existing receipt.

| Observation for an unresolved/manual attempt | Application result | Authorized next action |
| --- | --- | --- |
| Exact verified PAID | Retain receipt, manual blocker, booking/payment state; no completion/review/checkout | Owner investigates all attempts; no automatic financial resolution |
| Matching terminal, amountPaid=0 | Retain blocker and slot; no automatic closure | ADMIN preview then guarded all-attempt zero closure if every predicate passes |
| Zero response after a recorded receipt | Preserve paidAt/reference and blocker | Zero closure refused; owner investigates contradictory evidence |
| Missing/wrong identity, unknown/nonmatching amount, timeout | No fabricated receipt or closure; blocker retained | Obtain provider/bank evidence and retry read-only preview |
| Normal exact PAID, no manual case | CONFIRMED plus PAID/PARTIALLY_PAID; no auto-completion | Existing completion policy after appointment end |
| Verified primary plus zero terminal secondary | Primary and booking unchanged until operator action | Existing ADMIN close-zero-secondary, freshly verify every attempt and audit |

### Quy trình vận hành tiền đến muộn (chủ dự án: xuandat24)

1. Mở hồ sơ riêng với mã case, booking ID và **tất cả** attempt IDs/orderCodes. Dùng ADMIN GET preview
   bên dưới; đối chiếu đúng kênh PayOS, link ID, số tiền dự kiến/thực nhận, thời điểm, mã tham chiếu,
   giao dịch ngân hàng và tình trạng quyết toán. Lưu bằng chứng vào hồ sơ có giới hạn truy cập, không vào
   Git/chat/log công khai. Nếu PayOS và ngân hàng chưa thống nhất, hồ sơ vẫn đang xử lý.
2. Chủ dự án lấy số điện thoại từ hồ sơ tài khoản/support được phép xem, gọi khách và xác nhận booking
   đang nói đến. Không hỏi OTP/mật khẩu. Thông báo đã ghi nhận giao dịch cần kiểm tra, yêu cầu không trả
   thêm, ghi giờ gọi/kết quả/lần liên hệ tiếp theo. Nếu không liên hệ được, ghi lần thử và hẹn gọi lại;
   không coi im lặng là đồng ý. Ứng dụng chưa tự gửi Gmail hoặc tự gọi điện.
3. Chỉ chủ dự án quyết định việc giữ lịch còn khả dụng hoặc cách xử lý tiền ngoài ứng dụng, sau khi trao
   đổi với khách và spa. Quyết định phải ghi mã case, từng giao dịch/số tiền, ý kiến khách/spa, người duyệt
   và thời điểm. Booking đã hủy không được hồi sinh; không hứa đổi lịch hay hoàn tiền khi chưa có quyết định.
   Yêu cầu chung “triển khai hoàn thành” không phải phê duyệt một khoản chuyển/hoàn tiền cụ thể.
4. Trong ứng dụng chỉ được: đọc preview; ADMIN đóng toàn bộ attempt terminal/zero hoặc secondary zero
   đúng điều kiện đã mô tả; lưu audit tự động của các thao tác đó. Có tiền, paidAt, sai/thiếu bằng chứng:
   **không gọi closure để ép mở khóa**, không đổi PAID/REFUNDED/CONFIRMED, không UPDATE SQL.
   Kể cả đã xử lý tiền bên ngoài, blocker tài chính vẫn được giữ trong bản này. Hồ sơ không được đánh dấu
   đã giải quyết trong app. Bất kỳ thao tác đổi trạng thái có tiền nào đều cần quyết định riêng, đúng target,
   preview/recheck/audit được kiểm thử; không thuộc bản sửa này và không chặn việc hoàn tất code hiện tại.
5. Khi zero closure được phép: lưu fingerprint/caseReference, gọi đúng endpoint một lần, lưu auditId,
   đọc preview/booking lại. Nếu 409, đọc lại hồ sơ thay vì lặp mù. Xác nhận lịch sử còn nguyên và không mở
   completion/review khi còn attempt khác chưa giải quyết. Không hủy hay tạo link mới để vượt blocker.

Người trực release/đối soát chính: **xuandat24** (đã xác nhận nhận trách nhiệm). Trước public rollout cần
chốt khung giờ trực và người thay thế khi vắng mặt; đề xuất kiểm tra lúc mở ca và mỗi 30 phút, phản hồi
khách trong 2 giờ làm việc, ghi quyết định xử lý trong 1 ngày làm việc. Đây là lịch trực đề xuất, chưa phải
bằng chứng đã được chủ dự án duyệt. Từng giao dịch tiền thật vẫn cần phê duyệt riêng.

## Owner and current gate

The project owner (`xuandat24`) is responsible for PayOS reconciliation and contacting customers.
The owner has **not approved the money-handling procedure** for late/double/mismatched payments.
Public rollout and live-payment testing remain NO-GO until it is reviewed and approved.
This document proposes an operational process, not authorization to move money or modify production.
Automatic Gmail/web operator alerts requested by the owner are **not implemented** in this scoped patch;
they require a separate approved design (authorized recipients/access, deduplication, delivery retry,
no customer/payment secrets in email, and a durable notification record). No SMS/phone OTP or automated calls.
Until alerts exist, the owner must perform authorized read-only checks during monitored operating hours;
approve the monitoring cadence, escalation deadline and backup operator before public rollout.

## Detect, without changing data

Use a read-only MySQL account in the explicitly confirmed environment. Do not paste result sets into
chat, Git, CI, or public logs. These queries return internal IDs, not customer contact information.
Confirm table/column names against the deployed schema before running them. They do not alter schema.

```sql
SELECT p.id AS payment_id, p.booking_id, b.customer_id, b.booking_code,
       p.order_code, p.payment_link_id, p.payment_reference,
       p.status AS attempt_status, p.requires_manual_review,
       p.amount AS expected_amount, p.remaining_amount, p.payment_option,
       p.paid_at, p.created_at, p.expires_at, p.last_reconciled_at,
       b.status AS booking_status, b.payment_status, b.payment_retry_allowed
FROM payment_transactions p JOIN bookings b ON b.id = p.booking_id
WHERE p.requires_manual_review = TRUE OR p.status = 'REVIEW_REQUIRED'
   OR (p.status = 'PENDING' AND
       (p.checkout_url IS NULL OR p.expires_at < UTC_TIMESTAMP()))
ORDER BY p.created_at, p.id LIMIT 100;
```

Read **all** attempts for the selected booking (use a bound parameter, not string concatenation):

```sql
SELECT id, booking_id, order_code, payment_link_id, status, requires_manual_review,
       amount, remaining_amount, payment_option, payment_reference,
       created_at, paid_at, last_reconciled_at, expires_at
FROM payment_transactions WHERE booking_id = ? ORDER BY id;
```

Legacy closure flags may have been written without successful provider cancellation. Audit these
read-only before rollout, especially when another attempt was paid. Do not blindly re-open links:

```sql
SELECT p.id, p.booking_id, p.order_code, p.payment_link_id, p.status,
       p.amount, p.last_reconciled_at, b.status AS booking_status, b.payment_status
FROM payment_transactions p JOIN bookings b ON b.id = p.booking_id
WHERE p.status IN ('CANCELLED', 'EXPIRED', 'FAILED')
  AND EXISTS (SELECT 1 FROM payment_transactions q
              WHERE q.booking_id = p.booking_id AND q.id <> p.id AND q.status = 'PAID')
ORDER BY p.id LIMIT 100;
```

Paginate by ID for subsequent batches; a limit is not evidence that all cases were inspected.
The historical `last_reconciled_at` value alone is not proof the link was closed correctly.

## Evidence and proposed decision workflow

1. Open an access-controlled support case keyed by booking ID, attempt ID and orderCode.
   Keep checkout disabled and preserve every attempt. Never reclaim a released slot or complete a
   booking merely because a payment arrived. Pending cancellation uncertainty retains its slot.
2. In the correct PayOS merchant channel, inspect each orderCode/link ID: provider state, expected
   amount, amount actually received, bank reference and settlement evidence. Correlate with signed
   webhook/server reconciliation logs, timestamp and all attempts. HTTP 200 alone is insufficient.
3. `requiresManualReview`/`REVIEW_REQUIRED` are **blockers, not money-received evidence**.
   A mismatch may have zero money; `paidAt` can be null. A non-null `paidAt` belongs to that attempt,
   does not prove a second attempt was settled, and must be checked against provider/bank evidence.
4. Contact the customer using authorized account/support records, never public logs or an exported
   customer list. A phone call is a contact action, not proof of SIM ownership. Explain the state,
   ask them not to pay again, record consent and follow-up time in the private case. Existing customer
   **Phản hồi** reports are available; this patch does not promise automatic email/web notifications.
5. Obtain the owner's written decision for the specific case. Proposed options for approval are:
   provider-confirmed no-money closure; handling a late payment with a separately agreed appointment;
   or a legally/operationally approved refund outside this app. **No option is authorized by this
   document, no automatic refund, no fake REFUNDED, no automatic revival of the cancelled booking.**
6. Use the guarded ADMIN preview/zero-money actions described below for cases their predicates permit.
   Financial cases outside these predicates remain blocked. Any further application-state repair requires
   a separately approved, reviewed and tested maintenance action: exact booking/attempt IDs, fresh provider
   proof, preview, booking-first locking, audit and rollback. This release does not provide a financial
   override/refund operation. Never use ad-hoc UPDATE or clear a manual flag to simulate resolution.
7. Close the private case only after provider/bank evidence, customer contact, approved money handling,
   persisted state and read-only verification agree. Retain all attempts, evidence and approvals.

## State policy

| Booking/payment | Customer cancellation | Completion/review | Checkout |
| --- | --- | --- | --- |
| PENDING/UNPAID, no attempt | Allowed, idempotent | No | Future valid booking only |
| PENDING/UNPAID, valid pending link | GET then verified cancel/zero received | No | Same valid attempt only |
| Unknown cancel/get/create result | No claimed success; no guessed slot release | Blocked | Blocked; reconcile/support |
| CONFIRMED/PAID or PARTIALLY_PAID | 409, contact support | Owner CUSTOMER after HCM end; review only after completion | No balance/recharge |
| COMPLETED/PAID or PARTIALLY_PAID | No | Idempotent completion; editable SERVICE + SUPPLIER 1–5 reviews | No |
| CANCELLED by customer | Idempotent confirmed cancellation only | No | Never reuse/retry |
| CANCELLED after provider expiry/failure | May explicitly cancel instead of retry | No | Retry only verified closed attempts + full valid slot |
| REFUNDED | No automatic state change | No review | No |
| Any unresolved PENDING/manual attempt | Unsafe actions withheld | Blocked, including public review aggregates | No new checkout |

Valid pending checkout reuse is the exception in the last row: exactly one live link, unpaid/non-cancelled
booking, no manual blocker, matching option/voucher. Cancellation is still server-verified before success.
An uncertain cancellation may initially retain PENDING/manual for compatibility. Its next verified
observation converges to REVIEW_REQUIRED and retains the blocker, even for exact PAID. Scheduler/status
also inspect REVIEW_REQUIRED/manual rows; terminal/zero never automatically closes the operator case.

## Implementation invariants and residual risks

- Writers lock booking first, then payment attempts in ID order; lookup snapshots are scalar and reread
  after acquiring the booking lock. Payment/status/reconciliation and booking creation use READ_COMMITTED.
- Create commits a pending order ledger **before** calling PayOS. Finalization reacquires booking/payment
  locks and never overwrites a webhook/cancel winner. Timeout or final DB failure retains the known order
  for reconciliation; it never authorizes a fresh attempt to bypass uncertainty.
- Cancel returns an outcome inside a dedicated transaction, commits verified PAID/manual evidence,
  then throws the HTTP business conflict outside. No broad noRollbackFor or exception swallowing.
- Unconfirmed superseded cancellations stay discoverable PENDING. Principal PAID remains committed.
- Retry and new booking share a practitioner mutex. Interval scans are nonlocking, avoiding inverse
  practitioner→existing-booking lock order. Adjacent-date overlap is checked, including overnight slots.
- Retrying historical closed attempts queries PayOS again. Older fake terminal attempts attached to
  completed/paid bookings are not automatically scanned by the pending scheduler: manual legacy audit
  remains required. Unknown/missing provider orders can remain blocked, requiring an approved resolution.
- Provider GET/cancel happens while locks are held; provider latency can increase wait time. Monitor
  timeout/lock contention. This patch does not introduce an outbox, refund engine or provider framework.
- Availability, new booking lead, retry, checkout cutoff and completion share a Vietnam-time clock policy.
  New booking/retry require at least 30 minutes and at most one calendar month. Existing booking checkout
  may continue strictly before start, not at start. Overnight slot iteration is bounded and adjacent-day
  bookings block the full interval. Configuring new overnight supplier hours is not added in this patch.
- Customer completion is MVP self-attestation, not independent attendance proof. Media/rewards remain absent.

## Single release approval gate — conditional, not yet satisfied

1. Exact final HEAD CI must pass backend, frontend, isolated MySQL and Docker; review the draft PR.
2. Obtain a usable recent backup with completion/checksum metadata. Restore only into an explicitly
   approved isolated target (no paid resource creation without approval); compare schema, aggregate row
   counts and booking/payment/review relations and read with the app. Do not run create-drop tests on a
   restored database containing real customer data. The existing before_resend backup is acknowledged;
   making another backup is not a substitute for an isolated restore check.
3. Obtain separate approval for exact release SHA, environment, money-review process and backend-first
   promotion control. Railway/Vercel Git auto-deploy may race; do not merge until frontend can be held.
4. Backend first, verify deployed SHA/health/startup/MySQL/API; only then frontend from same release SHA.
   Keep secrets, domains, CORS, API base, webhook and schema unchanged. No real payment without the owner
   approving test booking/account/amount/channel and handling the money afterward.
5. Rollback code/image only, not production data. Frontend-only failure: restore frontend and keep the
   healthy compatible backend. Backend failure: hold frontend, use the separately approved image/commit
   rollback. Old main reopens premature review/paid-cancel risks: prefer a tested forward fix or gate unsafe
   actions under an approved incident plan. No blanket DB restore or SQL cleanup to fix a code regression.

Production smoke and live PayOS: **NOT RUN for this release**. HTTP health checks are not feature acceptance.

## Executable internal zero-money resolution

Only authenticated ACTIVE **ADMIN** may use these endpoints. CUSTOMER/SUPPLIER/STAFF cannot operate them.
Do not run write actions on production under the current task. The owner (`xuandat24`) operates and
contacts customers; Gmail/web reminders and automatic phone calls are not introduced.

1. `GET /api/v1/payments/payos/review/bookings/{bookingId}` is a read-only preview. It queries PayOS GET for
   every attempt, returning app/provider identities, expected/received amounts, status, timestamps,
   `fingerprint`, `canCloseZeroMoney`, `canCloseZeroSecondary`, `proposedRetryAllowed` and a blocker.
   There are no customer contacts, bank details, checkout URLs, credentials or payment-authorizing tokens.
2. Review the exact booking and all attempts against the authorized merchant dashboard and private case.
   `paidAt` is an application observation, not independent bank/settlement proof. A mismatch/manual flag
   alone does not set it. Exact signed PAID receipts/server-verified PAID preserve this timestamp even
   when escalation leaves REVIEW_REQUIRED. Preview does not mutate statuses or call provider create/cancel.
3. For unpaid bookings with **every** attempt identity-matching terminal CANCELLED/EXPIRED/FAILED and
   known `amountPaid=0`, use `POST .../{bookingId}/close-zero-money` with
   `{ "fingerprint": "<64 lowercase hex from preview>", "caseReference": "<private case identifier>" }`.
   Case reference accepts 3–80 ASCII letters/digits/`_.-`; do not put customer data in it.
   It refuses paid/refunded/completed bookings, local PAID/paidAt evidence, unknown amount, missing/mismatched
   provider identity, pending or nonzero attempts. An orphan without local link ID may bind the trusted GET
   identity only when orderCode and amount match. No history is deleted.
4. The owner's option **1** approves a narrower alternative: `POST .../{bookingId}/close-zero-secondary`
   with the same payload, only for CONFIRMED/COMPLETED paid/deposit-paid bookings containing exactly one
   non-manual PAID primary whose provider identity and exact positive amountPaid are verified. All other
   attempts must be terminal/zero with no conflicting local PAID/paidAt. Only secondary rows close; primary
   amount, status, paidAt, timestamps and booking/payment state are preserved. This can restore completion/
   review eligibility after blockers clear; it never completes a booking or upgrades PARTIALLY_PAID to PAID.
   No authorization for late, duplicate, mismatched money or production execution follows from this choice.
5. Apply rereads provider evidence under booking → all payments (ID order) → practitioner locks. A changed
   preview returns `409 PAYMENT_REVIEW_STALE`; other unsafe proofs return a 409 blocker. Timeout/unknown
   proof refuses closure. Financial/wrong-identity cases stay blocked. Repeated identical apply checks
   provider proof again and returns the original audit ID with `alreadyApplied=true`, without duplicate audit.
6. Every apply appends per-attempt provider snapshots and a summary in existing `support_reports` with
   reserved `PMT-AUDIT:` reasons, operator, case reference and fingerprint. Generic report creation cannot
   forge the namespace, and generic report updates cannot edit these records. This is application-level
   append-only audit, not a cryptographic guarantee against a privileged database administrator.
7. Zero-money whole-booking closure releases the slot by CANCELLED/UNPAID. Customer-cancelled bookings
   remain nonretryable. Expired/failed bookings become retryable only if all attempts are safe and the
   service/practitioner, schedule, 30-minute lead/month limit and complete interval are still available.
   Reopening later rechecks the slot under the existing practitioner mutex; preview never reserves it.

Money received, unknown amount, wrong order/link/amount or multiple paid attempts require the owner's
case-specific financial decision and customer contact. Proposed SLA for approval: inspect at opening and
every 30 minutes during monitored operating hours, acknowledge within two operating hours, record a plan
within one business day. **Cadence/SLA, backup operator and late-money disposition are not yet approved**.
Keep checkout/completion/review blocked; preserve evidence; arrange contact through private account/support
records and record the call outcome. Do not treat the case as solved by a status change or external refund
alone. A further controlled app-state action, if needed, must be separately specified/tested/approved.

## Backup and rollout evidence (read-only, 13 October 2026)

- Backup identifier: `beautylink_before_resend`; user reports 12 October at 20:42 (+07).
  Metadata/marker were actually inspected: 70 files / 1,064,814 compressed bytes, all 16 listed chunks
  present. Marker modification time is 12 October 20:38:37 (+07), raw begin/end are
  `2026-10-12 13:37:49` / `2026-10-12 13:38:37` (raw strings have no zone).
  Dumper metadata reports format 2.0.1, consistent=true, tzUtc=true, checksum=false.
- SHA-256 of completion marker: `E26EBE30BFFB5B037C5A48500C2F9ABEDD7BA982E6CB49B42ECE0C55DB329239`.
  Sorted relative-file-name + SHA-256 inventory digest (LF separators, UTF-8):
  `6AF3CFB06A12753A6C2D3DF7FA0F1EB6862F783ABE253DE2A014F472E8EC385F`.
  These hashes identify the current snapshot; they are **not** a prior integrity checksum or restore proof.
  No decompression/content integrity verification or customer-row read was performed. Logical TSV byte
  counts cannot be compared directly to compressed zstd file sizes.
- Restore **BLOCKED**: no explicit isolated host/schema/approved restore target. Before any release, confirm
  target is not Railway production; restore with compatible MySQL Shell in an approved isolated environment;
  compare schema/table counts and booking/payment/review foreign-key integrity; inspect app reads with
  ddl-auto=validate, seeders/schedulers/provider integrations disabled and read-only DB credentials.
  Do not run create-drop automated tests on this restored customer dataset. Keep detailed results private.
- Railway read-only inspection: production still follows `main`, root `/backend`, checkSuites=false,
  one replica, health `/api/v1/categories`, latest deployment `12ca4eb6-d4ca-419c-9c99-2467b712cd03` SUCCESS.
  This is not the feature release. Vercel project read returned 403 under connector scope `project-personal2`;
  no CLI is installed, so frontend auto-promotion/current SHA cannot be confirmed. No alternate credentials.
- **NO-GO merge** until exact release SHA CI/review, isolated restore, financial runbook approval and explicit
   backend-first frontend-hold control are verified. Latest task conditionally authorizes release only
   after these gates; the follow-up asks to finish deployment but supplies no restore/rollout evidence. Approve
  rollback image/commit before rollout; old main may reopen known review/cancellation bugs. Roll back code/
  image, never restore production DB to repair a code-only error. Webhook must remain receiving throughout.

## Exact rollout control and remaining account-owner actions

Read-only recheck in this task: Railway source remains main/root /backend, checkSuites=false, no staged
changes, production deployment 12ca4eb6-d4ca-419c-9c99-2467b712cd03 SUCCESS at main 5cdc5d3. A main merge
can start backend deployment immediately; passing feature CI does not change this setting. Vercel GET
project still returns 403 for project-personal2/team_ZSxj6a4Zw9lLokoiuJ3sgoSZ. No alternate credentials.
Current Vercel SHA, branch tracking and promotion switch remain unverified, not assumed safe.

The concrete frontend hold is documented by [Vercel](https://vercel.com/docs/deployments/promoting-a-deployment):
project Settings → Environments → Production → Branch Tracking → turn OFF **Auto-assign Custom Production
Domains** before merging. Record its current value and current deployment ID/SHA first. After merge the
production build should be Staged, not Current; keep the old live frontend until Railway validation.
After backend succeeds, Deployments → exact merge-SHA staged production deployment → (…) → Promote.
Do not substitute promotion of an unrelated preview (it can rebuild with different environment variables).
This is a proposed setting change for the project owner; it has not been made or verified by this session.

One approval record must contain: final feature SHA/green CI, PR/reviewer, merge strategy and resulting
merge SHA, restore target/result, named incident operator and shift, frontend hold evidence, backend-first
sequence and selected rollback image. Verify merge tree/source matches the reviewed branch and merge CI.
Railway first: deployment SHA/image, categories HTTP 200, startup/MySQL/5xx, completion/review ownership
and manual-blocker API checks in isolated staging, and unchanged webhook route/signature configuration.
Keep webhook reachable; never forge a production event or manufacture money to test it. Then staged
frontend same merge SHA, API base/CORS unchanged, smoke login/catalog/bookings/reviews, promote and monitor.
No live payment/refund without separate account/booking/amount/channel/disposition approval.

Backup marker/hash is unchanged on recheck. Docker engine is unavailable locally (service stopped), no
local MySQL server/approved isolated restore target is configured. No restored customer data entered CI.
Owner action: provide an existing isolated host/schema with restore permission, or approve a dedicated
local Docker MySQL target on loopback port 3307 once Docker is running; never reuse the automated-test DB
or Railway production. Restore first, then schema/count/FK/application-read evidence with writes disabled.
Do not create a paid service. Do not send database credentials or customer rows in chat.

Rollback preserves DB/ledger/audit. Frontend-only failure: previous frontend deployment, keep healthy
backend. Backend failure: hold frontend and use a reviewed safe image/forward fix. Neither old main 5cdc5d3
nor feature baseline 87409c1 is a safe *automatic* rollback for these payment/review bugs. If no safe image
exists, owner must approve an incident containment plan that keeps webhook receipt running; no silent
return to unsafe cancellation/review behavior and no production DB restore for a code-only fault.
