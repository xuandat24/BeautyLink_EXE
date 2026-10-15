# Booking confirmation emails

This feature creates customer and partner confirmation emails only when the backend accepts a canonical, verified PayOS payment. It is disabled by default and does not create jobs for historical bookings.

## Trigger and transaction boundary

`PaymentService.handleWebhook()` verifies signed PayOS webhook data, while reconciliation independently verifies the provider payment state. Both trusted paths converge on `acceptVerifiedPaid()` and `markPaid()` after the existing amount, order-code, payment-link, canonical-attempt, and manual-review checks.

`markPaid()` changes the payment and booking state and calls `BookingConfirmationNotificationService.enqueueVerifiedPayment()` in the same database transaction. Two logical outbox rows are created: one for `CUSTOMER` and one for `SUPPLIER`. If that transaction rolls back, neither the verified state change nor the jobs commit. The dispatcher contacts Resend only after a worker claims committed rows in a separate transaction, so a provider outage cannot roll back a confirmed payment.

Frontend redirects, query parameters, checkout clicks, unverified callbacks, cancelled/expired attempts, and `BookingStatus.COMPLETED` do not enqueue these emails.

## Delivery model

- Logical uniqueness is enforced by `(booking_id, notification_type, recipient_role)` and a stable idempotency key.
- Workers claim due rows under a pessimistic database lock, set a lease, then send outside the claim transaction. Expired `PROCESSING` leases are reclaimable after a worker crash.
- Customer and supplier jobs are independent. One failure does not prevent the other from being processed.
- Transient and ambiguous failures use bounded exponential backoff. Permanent provider/recipient failures and exhausted retries become `FAILED_PERMANENT`.
- The Resend request carries the stable `Idempotency-Key` header. The provider message ID is stored when acknowledged.
- Processing is at least once. A lost provider acknowledgement can still produce a duplicate after the provider's idempotency retention expires; strict physical exactly-once delivery is not claimed. SMTP fallback has no provider idempotency guarantee.

No email bodies, API keys, or recipient addresses are written to application logs.

## Database preparation

This repository does not currently use Flyway or Liquibase. Before enabling the worker, apply the idempotent MySQL script:

```text
src/main/resources/db/booking-email-outbox.sql
```

Apply it once to the Railway MySQL database using an authorized SQL client. It creates only the table, indexes, foreign keys, and uniqueness constraints; it does not backfill or email historical bookings. Keep `BOOKING_EMAIL_ENABLED=false` while applying and verifying the schema.

## Railway configuration

Required for activation:

```text
BOOKING_EMAIL_ENABLED=true
BOOKING_EMAIL_FROM=BeautyLink <no-reply@beautylink.cloud>
BOOKING_EMAIL_REPLY_TO=support@beautylink.cloud
FRONTEND_PUBLIC_URL=https://beautylink.cloud
BOOKING_EMAIL_MAX_ATTEMPTS=5
BOOKING_EMAIL_DISPATCH_BATCH_SIZE=20
BOOKING_EMAIL_DISPATCH_MS=15000
BOOKING_EMAIL_DISPATCH_INITIAL_DELAY_MS=30000
BOOKING_EMAIL_LEASE_SECONDS=120
RESEND_API_KEY=<existing server-side Resend key>
```

`BOOKING_EMAIL_REPLY_TO` may be blank. The existing SMTP configuration remains an optional fallback. Do not expose these server variables to Vite/frontend variables.

Before activation in Resend:

1. Verify the `beautylink.cloud` sending domain and its DNS records in the actual Resend account.
2. Ensure `BOOKING_EMAIL_FROM` uses an address permitted by that verified domain.
3. Use Resend's authorized test recipients for pre-production checks; never run automated tests against real customers.
4. Confirm the API key is already stored only in Railway and has the necessary sending access.

These external account steps are not performed by the code change.

## Rollout

1. Keep the currently running backend unchanged and `BOOKING_EMAIL_ENABLED=false`.
2. Apply and verify the outbox table script. This is safe before the application code uses the table.
3. Deploy the code while the feature remains disabled. (`hibernate.ddl-auto=update` is still enabled in this project, but the reviewed SQL script is the explicit production schema step.)
4. Verify Resend domain/sender settings and Railway variables.
5. Test in an isolated environment with an explicitly authorized recipient.
6. Set `BOOKING_EMAIL_ENABLED=true` and restart/redeploy the backend.
7. Monitor outbox status counts and safe error codes. Do not inspect or log stored bodies in routine diagnostics.

There is deliberately no historical backfill command. If a backfill is ever required, design it as a separate, explicit, audited operation with a bounded booking set and recipient approval.

## Rollback

Set `BOOKING_EMAIL_ENABLED=false` first. This stops new job creation and dispatch without changing payment behavior. Then roll back the application version if necessary. Leave the outbox table in place during rollback so pending audit/delivery state is not destroyed. Do not drop it until the rollback is complete and retention requirements have been reviewed.

Re-enabling later resumes eligible pending/retry rows. Review any old pending rows before re-enabling after a long outage, because there is no automatic age-based mass-send policy.
