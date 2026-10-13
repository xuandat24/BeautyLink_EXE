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
- Availability, new booking lead, retry, checkout cutoff and completion share a Vietnam-time clock policy.
  New booking/retry require at least 30 minutes and at most one calendar month. Existing booking checkout
  may continue strictly before start, not at start. Overnight slot iteration is bounded and adjacent-day
  bookings block the full interval. Configuring new overnight supplier hours is not added in this patch.
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
  backend-first frontend-hold control are verified. No merge/deploy authorization in this task. Approve
  rollback image/commit before rollout; old main may reopen known review/cancellation bugs. Roll back code/
  image, never restore production DB to repair a code-only error. Webhook must remain receiving throughout.
