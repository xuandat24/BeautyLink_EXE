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


## Performance follow-up (base60a7399, measured2026-10-28)

Baseline commit14260a5b843ff8202541c2fb2ef34933c56f1f42 preserves prior business code plus numeric timings/test fixtures. Thirty samples before/after used the same350ms create/250ms GET fake provider. See `scripts/payos-perf/README.md` and `docs/PAYOS_CHECKOUT_PERFORMANCE.json` for reproduction and complete P50/P95/P99. No active production payment was read/created. Production read-only metadata: Railway SUCCESS deployment89df9705-11f9-4d6e-8b3f-c13aac51423b at60a7399, SFO; platform tracing off. No region/config changes made.

| Browser boundary (ms) | Before P50/P95/P99 | After P50/P95/P99 |
|---|---:|---:|
| Click→visible shell, new | 822.5/839.8/1362.6 | 5.5/7.2/29.5 |
| Click→visible QR, new | 1028.7/1144.9/1366.1 | 816.8/851.6/908.7 |
| Click→visible shell, existing | 828.1/845.6/848.0 | 5.5/6.3/7.6 |
| Click→visible QR, existing | 831.4/849.1/853.4 | 817.6/833.8/834.0 |
| QR encoding | 13.3/19.9/27.2 | 7.0/9.6/31.2 |
| Recovery GET | 326.7/340.0/341.5 | 322.9/329.7/329.9 |
| Create browser/proxy RTT | 679.4/692.0/837.3 | 673.3/687.5/689.7 |
| JWT/session/account/MVC | 3.1/8.2/85.2 | 3.2/5.8/53.4 |
| JDBC execution | 0.8/1.2/2.7 | 0.7/1.0/1.0 |
| Validation/reserve transaction | 2.7/11.5/23.2 | 2.8/5.2/20.9 |
| Provider create (injected) | 350.7/351.5/365.8 | 350.7/351.0/358.2 |
| Persist transaction | 3.8/9.7/31.6 | 3.7/5.9/19.5 |
| Reuse server total | 6.5/15.3/17.9 | 6.0/17.1/17.7 |

Controlled mock targets pass; this does not prove live PayOS latency. First after QR sample includes a screenshot, making P99 conservative. With30 samples P99 is the maximum, not an established production SLO. SQL counts remain11 fresh/6 reuse; small execution times did not justify changing locks/queries. Blocking status requests dropped60→0 across60 opens; ongoing5s polling/server15s throttling remain. Existing QR visible timing improves little; principal gains are instant shell, fewer fresh-create round trips and HTTP connection reuse.

Public categories30 GETs: TTFB230.7/348.7/732.3ms, total243.9/386.2/879.3ms (P50/P95/P99). This is workstation→SFO reference only. Actual authenticated Railway/MySQL-production/PayOS attribution and provider percentiles remain NOT MEASURED. Do not justify a region move from this probe. MySQL CI runs30 real JWT requests through controllers/transactions with20ms synthetic provider input; its numeric artifact is separate from H2/browser data. SDK HTTPS localhost30 cold/30 pooled calls test signed responses, request identity under concurrency, pool shutdown and invalid signatures; not a PayOS internet benchmark.


### Fast path and safety

- The payment click opens an official branded preparation shell before validation/provider work. Existing quote/booking labels, a non-payable skeleton and real validation/provider/recovery messages are shown; no fake QR/bank instructions. Closing preserves the ledger. Context/account guards discard late results; cart/booking/payment policies are unchanged.
- SDK-signed PENDING creation is identity/amount checked and instructions persisted under existing locks, then stamps existing `lastReconciledAt`. Optional response `instructionsFreshForMs` is bounded by the existing15s window, link expiry and Vietnam appointment start. Unknown/failure cannot renew it. Manual/secondary attempts, paid/refunded/cancelled/completed/time guards remain. Exactly15s requires provider verification (injected-clock test).
- Frontend fast path accepts only a live HTTP-response object in a token+credential-epoch WeakMap, deducting the **whole** HTTP duration. Storage/copied payloads, wrong account, expired lease/incomplete evidence cannot fast-start. Initial evidence expiring while the first check is in-flight locks instructions; after confirmed status, existing polling behavior avoids unnecessary flicker. Errors lock instructions. PAID still requires backend webhook/reconciliation; successful create proves eligible instructions only.
- One Spring-owned HTTP pool is shared; SDK wrappers/ObjectMapper/crypto stay per-operation instead of assuming full SDK thread-safety. Installed2.0.1 `ClientOptions.httpClient` accepts external resources and `close()` shuts them down, so disposal occurs only at gateway shutdown. Timeouts remain15s SDK/30s browser, retries0, with implicit OkHttp connection retries disabled. No receiving-account/signature/credentials change and no dependency added.
- No durable async initiation is justified yet: mock targets pass and real provider latency is unmeasured. No untracked worker or in-memory irreversible queue was added.

References inspected alongside installed bytecode: [PayOS Java SDK](https://github.com/payOSHQ/payos-lib-java), [OkHttp reuse guidance](https://github.com/square/okhttp/blob/master/okhttp/src/commonJvmAndroid/kotlin/okhttp3/OkHttpClient.kt). Numeric tracing omits all customer/booking/order IDs, payloads, QR, bank/transfer fields, credentials and URLs. `X-Checkout-Request-ID` is generated server-side (client input ignored), `Server-Timing` and `X-Checkout-SQL-Count` are numeric; context is cleared after each request. Missing browser User Timing support cannot break rendering.

### Rollout and monitoring

No DDL/new variables. Owner-approved exact-SHA CI/staging then backend→frontend; old frontend ignores optional freshness, new frontend falls back to status checking without a live lease. Keep production frontend promotion held until backend/API smoke succeeds. Do not merge/deploy as part of benchmarking.

Group `checkout_timing` by fixed operation(create/status/recovery/quote/webhook), status and correlation; inspect total/pre_service/JDBC/reserve_tx/provider_create-get/persist_tx and provider_connect/tls/ttfb. Connection time includes TLS (do not sum overlapping metrics); zero completed TLS on failed calls does not prove reuse. Separate failures/manual409 from successful percentiles and collect adequate real samples before claiming live P99. Correlate browser response ID with log line; never enable SDK body logging. Watch DB lock waits, provider calls/poll frequency and existing authorized operator audit evidence.

Live smoke needs separately approved account/booking/amount/channel and money disposition. Owner performs transfer; validate only authorized evidence. No fabricated webhook/manual paid. Roll back code/image compatibly, retain nullable schema/history/manual policy; never restore production DB for this fix.


## 2026-10-28: shared checkout and ambiguous-create recovery

Observed owner log (merge afad1fa): provider_create 15022.624ms, SQL 15.067ms, total 15208.913ms/409.
This identifies the slow boundary, not the precise upstream/network exception; create diagnostics now log only exception/cause class names, never provider payloads or credentials.
The HTTP client retains its 15s limit and now bounds the entire call/body (not just each read), with no redirect/implicit retry.

A failed/ambiguous provider create returns the committed attempt with `verificationPending=true`, `checkoutAllowed=false`, no QR. HTTP200 here acknowledges an existing ledger entry, never payment success.
Customer reads wait through the initial 15s create grace, then GET the same order even if its link ID is missing. No replacement POST. Identity/amount/manual-review, late-money and 12-minute hold rules remain authoritative.
Provider GET cannot recreate QR/bank instructions lost with a create response. Such attempts remain visibly verifying/QR-unavailable; never invent QR or receiving information. A previously stored safe PayOS link remains an explicit fallback only when server-authorized.

Product/direct and cart now use the same two-step CheckoutPage: schedule, then payment/voucher/confirmation. Removed the unused BookingModal and duplicate cart discount calculation. A booking covers one service; other cart items/quantities are retained, not bulk-booked or silently charged.
Capacity is refreshed while the schedule is visible, on focus/reconnect and every30s; step changes do not refetch it. Booking creation still validates/locks the actual slot on the backend. Checkout hides the floating chat widget; toast messages do not intercept clicks.

No schema migration or production config change is introduced. Roll out backend then frontend after exact-SHA CI and approval; retain existing PR34 schema prerequisites. Test with isolated data/fake providers first. A controlled real PayOS/booking test needs separate account/amount/disposition authorization. Never use a lost response as permission to retry provider POST or clear manual flags.

Verification artifacts: `backend/target/checkout-sync-mysql.log` (155 PASS), `checkout-sync-transport.log` (SDK HTTPS whole-call deadline/TLS reuse/signature tests), `checkout-sync-browser.log`, `checkout-sync-entry-browser.log`, and `checkout-shared-*.png`. Postman simulation uses synthetic keys only; no real mail/bank/provider writes.
