# Payment review operations — approval required before rollout

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
6. There is no new admin payment mutation API in this MVP. Any application-state repair requires an
   explicitly approved, reviewed and tested maintenance change, backup/restore evidence, exact target
   and a rollback plan. Never resolve a case using an ad-hoc UPDATE or merely changing a status label.
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
Manual flag on an uncertain cancellation keeps the attempt PENDING for scheduler discovery. A verified
PAID result may safely confirm a still-reserved booking; a closed/no-money result with a manual flag
does not automatically resolve the support case or release its slot. REVIEW_REQUIRED is not auto-resolved.

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
- Generic availability uses host-local date/time in existing code; time-zone/window consistency there
  is a separate follow-up. Completion and new interval guards explicitly use Asia/Ho_Chi_Minh.
- Customer completion is MVP self-attestation, not independent attendance proof. Media/rewards remain absent.

## Release and rollback — not authorized in this task

1. Exact final HEAD CI must pass backend, frontend, isolated MySQL and Docker; review the draft PR.
2. Obtain a usable recent backup with completion/checksum metadata. Restore only into an explicitly
   approved isolated target (no paid resource creation without approval); compare schema, aggregate row
   counts and booking/payment/review relations and read with the app. Do not run create-drop tests on a
   restored database containing real customer data. Backup at 20:00 was reported, restoration is unverified.
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
