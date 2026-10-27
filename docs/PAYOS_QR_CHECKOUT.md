# Custom PayOS QR reliability

Base inspected: `0103290b5e2f4887c9a386c016c09218ca5b6055` (PR30), including the PR29 handoff and PR30 QR commit series. Focused branch: `codex/payos-qr-reliability`. No production payment, DDL, merge, deploy or real transfer is authorized/executed by this patch.

## Verified findings

1. PayOSCheckoutPage required all five instruction fields before showing QR. Optional bank display metadata could therefore suppress a valid provider QR. It also rendered the initial response before its first status request completed. Regression tests cover missing metadata and unresolved/stale first responses.
2. QR rendering accepted any nonempty string; a URL/corrupt payload could become an unpayable QR. Server/client now validate EMV structure, VietQR currency/country, CRC and exact authoritative amount without constructing replacement instructions. All test QR merchants are deliberately `TESTONLY`, unbankable and test-classpath only.
3. Status GET swallowed provider failure and still returned payable instructions. Failure also advanced lastReconciledAt, so another poll could expose instructions without a successful retry. For ordinary PENDING attempts, only successful observations advance that timestamp; uncertain results expose no checkout/QR and set verificationPending. Manual cases retain observation/failure audit timestamps and remain independently blocked. Customer status queries reconcile at most once per15seconds after a successful observation; scheduler age/interval settings remain unchanged. Browser transient failures use bounded exponential retry (five failed requests, max30s; Retry-After clamped5–60s), then explicit retry/online/visibility recovery. Identity mismatch and401/403 stop automatic retry. In-flight requests are aborted on cleanup; session changes lock immediately.
4. Installed `vn.payos:payos-java:2.0.1`: CreatePaymentLinkResponse has qrCode/bin/accountNumber/accountName/description, mapped to existing nullable columns. PaymentLink returned by GET has id/orderCode/amount/amountPaid/status, **no QR/bank-instruction fields**. [Official API](https://payos.vn/docs/api/) and [SDK source](https://github.com/payOSHQ/payos-lib-java) agree. Existing missing QR cannot be recovered through that supported GET. We verify the existing attempt first, never POST another create just for missing instructions, and expose a safe hosted fallback only in QR_UNAVAILABLE. No hosted scraping, guessed VietQR or receiving-account changes.
5. Read-only production snapshot2026-10-28: Railway SUCCESS deployment `4118e863-2374-45e0-95d2-baef5455fb5a` and Vercel production-target READY `dpl_Hsrrogcf59AptTRbjyV2jBUrGn8y` both reference0103290. All five QR columns exist;58 attempts,0 PENDING. This excludes a deployed-version/missing-column mismatch in that snapshot, but provides no live pending payment reproduction. No customer QR/bank instructions were retrieved. READY metadata alone does not prove custom-domain promotion or real checkout success.

## Contract and invariants

Existing `/api/v1/payments/payos/bookings/{bookingId}` POST and `/api/v1/payments/payos/{orderCode}` GET remain. Additive response booleans:

- `checkoutAllowed`: server booking/time/manual/attempt eligibility, independent of a hosted URL. If false, no URL/QR/transfer instructions are exposed.
- `verificationPending`: required provider observation was inconclusive; hide instructions and retry safely. It is not PAID, EXPIRED or CANCELLED.

New frontend requires those verification capabilities and fails closed against an older server even if it returns a hosted URL: a legacy URL alone cannot prove its provider GET succeeded. Backend-first rollout is required. Old frontend ignores the additions but still receives no instructions from the new backend when uncertain. QR is optional; bank display fields are optional. Service/salon/price come from the already owned/revalidated booking, not local storage. Exact quote, payment option, deposit05/full100 and historical50 remain unchanged. Responses must match booking/order/link/amount/remaining/option. Confirmed PAID, manual/terminal states remove all payment actions. Client countdown expiry only hides instructions pending provider reconciliation; it never closes a payment or releases a slot.

POST reuse also requires a recent successful observation or a fresh provider GET before returning existing instructions. A status timeout therefore cannot be bypassed by reissuing create, including from an old frontend. Inconclusive reuse returns a business conflict after the transaction boundary, preserving evidence and the same ledger; it never creates a replacement attempt.

Locks, ledger-before-create, verified webhook identity/signature, cancellation/completion/manual rules and receipt idempotency remain. Contact/auth/seed code, credentials, database schema and PayOS receiving configuration are unchanged.

## Verification matrix

| Requirement | Executable evidence |
|---|---|
| Fresh QR, optional metadata, no hosted URL | PaymentServiceSecurityTest; payosCheckout.test.ts; real Spring browser fake gateway |
| Existing missing QR, same attempt, revisits | PaymentServiceSecurityTest; bookingReviewSmoke.mjs legacy resume + fresh reload |
| Invalid payload/CRC/wrong amount | PayOSQrInstructionsTest; payosCheckout.test.ts |
| Order/link/amount mismatch, signed invalid callback | Existing PaymentServiceSecurityTest/PaymentCancellationSafetyTest + strict frontend identity tests |
| Timeout/unknown amount and retry | New status tests; bounded retry/unit backoff; browser fake provider timeout then same-attempt recovery |
| Delayed/duplicate webhook while viewing QR | Real webhook controller/service/DB in bookingReviewSmoke.mjs with test-only fake verification; persisted PAID and hidden instructions |
| Concurrent create, cancellation races, manual evidence | Existing PaymentCancellationSafetyTest/BookingReviewReleaseTest (H2/MySQL CI) |
| Historical50, new05/full100, quote math | Existing service tests/quote tests, unchanged assertions |
| Session switch, stale response, network reconnect, expiry | Frontend focused tests + auth/booking browser regression |
| Nullable QR migration retains legacy rows | PayOSQrMigrationTest in isolated MySQL job |
| Desktop/mobile branded layout | Existing browser screenshots payos-qr-desktop/mobile with synthetic QR only |

Commands: Java21 `mvn --batch-mode --no-transfer-progress verify`; isolated release MySQL job additionally includes PayOSQrMigrationTest. Frontend `npm ci`, `npm test`, `npm run lint`, `npm run build`; browser uses existing CI bookingReviewSmoke.mjs with real Spring/JWT/H2 and a deterministic test-classpath gateway. Local Windows Spring startup can fail with pre-existing JVM `Unable to establish loopback connection`; Linux container/CI results distinguish that environment failure from code failures. Final counts/HEAD/run URL are recorded in the PR, not inferred from earlier commits. Mock verification is not a real PayOS transfer or production acceptance.

## Controlled rollout (owner approval required)

1. Fresh backup and isolated restore evidence must be within the approved release window. Existing2026-10-27 backup is historical evidence, not automatically fresh on release day.
2. Schema check only (no DDL):

```sql
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_transactions'
AND COLUMN_NAME IN ('qr_code','bank_bin','bank_account_number','bank_account_name','transfer_description')
ORDER BY COLUMN_NAME;
```

All5 correct nullable columns: **skip migration**. Zero: after explicit DDL approval apply existing `backend/src/main/resources/db/migration/mysql/V20261027_01__payos_transfer_details.sql` once with a secure MySQL connection. Partial/incompatible columns: stop and reconcile schema first. No Flyway/Liquibase dependency is installed; an SQL filename does not run automatically. Source default Hibernate ddl-auto=update is not evidence that a particular migration ran; preserve production settings, do not change them to fix code.
3. CI/staging at exact release SHA, then approved backend deployment first. Check deployed SHA/startup/schema/health, unauthorized status access and test-account API contract. Authenticated payment-status GET can reconcile/write evidence; use only the approved test booking, not arbitrary production transactions.
4. Hold frontend promotion until backend is healthy; then deploy/promote matching frontend release. Verify domain/bundle and safe public navigation. No new variables, credentials or receiving-account changes are required.
5. Approved test account/booking, payment option/amount, merchant channel and money disposition must be agreed separately. Owner performs bank transfer. Confirm QR stays on BeautyLink, exact provider instructions, webhook receipt, persisted payment/booking, no duplicate application, no extra attempt; test reload and return. Do not fabricate production webhook, alter appointment time, or create mismatch/races with real money.
6. If frontend fails, return to a compatible approved frontend image. Do not blindly roll backend back to a version that re-exposes uncertain instructions or clears manual review. Retain nullable columns and reconciliation history. Never restore production DB to roll back this code. No production acceptance is claimed until the controlled real test passes.


## Follow-up: first-click deadline and recovery (base 114e074)

The checkout inherited Axios's 10,000ms global deadline, but payos-java2.0.1 defaults to60,000ms and two retries. A client timeout does not cancel server-side creation; the next click could therefore reuse the completed first attempt. The supplied Railway startup log has no request timeout stack/latency; this mismatch is source-confirmed and reproduced by a browser response delayed11seconds, rather than inferred from npm warnings.

Payment create/status requests now have a scoped30second deadline; unrelated endpoints retain10seconds. SDK calls use15seconds and zero implicit retries, including create/cancel. Existing uncertain-provider/manual-review policy is unchanged. Temporary create errors trigger at most three **GET** observations (2s/4s spacing), never another POST. The new CUSTOMER-only `GET /api/v1/payments/payos/bookings/{bookingId}/current` locks the owned booking before its ordered attempts, returns the latest existing ledger, and uses the existing status/reconciliation/identity/amount/manual policy. No attempt returns404; an in-flight create returns verificationPending and no instructions. The endpoint can reconcile existing evidence, like the existing status endpoint; it does not create/cancel attempts. Account/token changes stop recovery; quote and transaction identity remain checked before instructions are exposed. Backend must deploy before frontend because older backends lack this GET; an old backend fails closed rather than repeating creation.

Recovered PAID/manual/terminal states open the same QR status screen with no payable actions. Successful create responses still receive server-status verification before rendering QR. The test-only browser fixture now delays one create response11seconds and asserts one click, one POST, automatic recovery from first status failure, loaded official B artwork, and no page overflow at390px. No real bank transfer or production payment inspection is performed.

Official BeautyLink icon/wordmark/slogan are shared across checkout, continuation and QR; pending feedback explains that another click is unnecessary. Technical Axios timeout text is replaced locally in payment flows. Existing financial instructions and receiving details remain provider-authoritative.

The supplied build warnings were checked separately: targeted same-major patches update Vite6.4.3→6.4.5, Zod4.6.5→4.6.7, follow-redirects1.16.0→1.16.2. The resulting npm audit reports0 vulnerabilities at verification time. No blind `npm audit fix`, framework/Java upgrade or production setting change is part of this fix. Node engine/npm environment/install-script notices are warnings, not evidence of a failed deployed checkout. Pinning Vercel's Node major is an owner configuration choice; it is not silently changed here.

Release: approve PR and exact-SHA CI, retain the existing schema, backend first, verify the new recovery route rejects unauthenticated requests, then frontend. Perform any real PayOS smoke only with separately approved account/booking/amount and money handling. Roll back frontend to a compatible approved build if needed; do not restore DB or roll backend to an unsafe payment-policy version. No new schema, credentials or environment variables are required.
