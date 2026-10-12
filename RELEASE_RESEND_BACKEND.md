# BeautyLink — backend-first Resend release

Status: prepared for review; production merge/deployment requires the owner's explicit approval.

## A. Audit and rollback baseline

Checked on 2026-10-12 using Git fetch, Railway/Vercel read-only connectors and public HTTP requests.

| Classification | Evidence / action |
|---|---|
| Implemented | Resend email-only OTP, six-digit SecureRandom code, HMAC pepper, TTL/attempt limits, single-use registration token, delivery failure rollback; imported once from `codex/resend-first-booking`. |
| Implemented | Authenticated phone update with replacement JWT, DB uniqueness conflict handling and CUSTOMER booking-history existence query (including cancelled bookings). |
| Bug fixed | Old JWT could raise an uncaught missing-account error or authenticate a reassigned phone. Tokens now bind account ID and persisted update timestamp; invalid/stale identities return 401. |
| Bug fixed | Concurrent phone changes could merge a stale detached account. The update reloads/locks the account and rejects stale snapshots; different accounts claiming one phone produce one winner and a safe 409 loser. |
| Compatibility | Supplier registration validation remains as on `main`; stronger unrelated supplier validation from the source branch was excluded. Frontend/API contracts remain compatible with the production frontend. |
| Risk | Account updates invalidate older tokens; legacy tokens issued within the same second as an account update require re-login. Other tabs also need re-login after phone change. |
| Risk | `ddl-auto=update` and the existing legacy payment/slot migration runner are unchanged. Backup and confirmation of the already-live schema are required before approval; this release adds no mapped columns/indexes or migration. |
| Missing / gated | Frontend popup release and interactive workflow tests wait for successful backend deployment and live API verification. The four source-branch frontend tests are rendering/validation tests, not end-to-end acceptance evidence. |
| Follow-up for Phase 2 | The source hook does not cancel its outstanding confirmation/update when the authenticated account changes; add account-change cancellation and delayed-response tests before releasing UI. Other account fields remain local-only until their own backend APIs exist. |
| Unverified | Resend sender/domain/key authorization, actual Inbox delivery, OTP pepper byte length, exact current PayOS URLs/credentials and production MySQL constraints. No real OTP or payment was created during audit. |

Live baseline:

- `main`: `5f424585daec6246c9e711bf76d17566da19673c`.
- Source branches: `codex/resend-first-booking` at `7801edab447d4c183fac228af34dcf17909d3e17`; `codex/resend-railway-otp` at `b325830af83502f01269b24f6af989583ae8d111`.
- Railway backend: `7df31baa-c885-4098-9542-3b07b3e73e39`, SUCCESS, same `main` commit, one healthy replica. MySQL Online; no staged changes. Source is `main`; `checkSuites=false`, so merging may immediately deploy without waiting for CI.
- Vercel production: `dpl_Ae9m9XExgoXF4rp1wZrryhVJgQpq`, READY, same `main` commit, alias `beautylink.cloud`.
- Website and `https://beautylinkexe-production.up.railway.app/api/v1/categories`: HTTP 200. Effective production frontend API base is `https://beautylinkexe-production.up.railway.app/api` (verified in the public bundle).
- CORS preflight from `https://beautylink.cloud` for PATCH plus authorization/content-type: HTTP 200 with the expected allow-origin/method/headers.
- Railway reports `api.beautylink.cloud` verified, valid certificate and propagated CNAME to `lsexf34q.up.railway.app`. The local resolver returns a different A route and HTTPS fails from this workstation; independent custom-domain health verification remains pending. Preserve the working Railway domain.
- Inspected deployment error-log result had no entries; the retrieved HTTP sample contained 31 requests with 200/401 and no 5xx. This bounded sample is not an all-time reliability guarantee.
- Railway confirms variable names `RESEND_API_KEY`, `OTP_MAIL_FROM`, `OTP_PEPPER`, CORS and PayOS variables exist. OAuth redacts all values; presence does not prove validity. No secrets were retrieved or changed.

## B. Code scope and API

The release branch is `release/resend-backend-safe`, based on the audited `origin/main`. Neither source branch is merged wholesale. No frontend changes are included.

Changed files:

```text
+.github/workflows/ci.yml
CODEX_HANDOFF.md
DEPLOYMENT.md
README.md
RELEASE_RESEND_BACKEND.md
backend/.env.properties.example
backend/pom.xml
backend/src/main/java/com/example/backend/auth/AccountDetailsService.java
backend/src/main/java/com/example/backend/auth/JwtAuthenticationFilter.java
backend/src/main/java/com/example/backend/auth/JwtService.java
backend/src/main/java/com/example/backend/controller/AuthController.java
backend/src/main/java/com/example/backend/controller/BookingController.java
backend/src/main/java/com/example/backend/dto/ApiDtos.java
backend/src/main/java/com/example/backend/model/DomainEnums.java
backend/src/main/java/com/example/backend/model/OtpVerificationChallenge.java
backend/src/main/java/com/example/backend/model/UserAccount.java
backend/src/main/java/com/example/backend/repository/BookingRepository.java
backend/src/main/java/com/example/backend/repository/UserAccountRepository.java
backend/src/main/java/com/example/backend/service/AuthService.java
backend/src/main/java/com/example/backend/service/BookingService.java
backend/src/main/java/com/example/backend/service/CurrentAccountService.java
backend/src/main/java/com/example/backend/service/OtpDeliveryService.java
backend/src/main/java/com/example/backend/service/RegistrationVerificationService.java
backend/src/main/resources/application-prod.properties
backend/src/main/resources/application.properties
backend/src/test/java/com/example/backend/AuthServiceTest.java
backend/src/test/java/com/example/backend/JwtIdentityTest.java
backend/src/test/java/com/example/backend/MissingResendConfigurationTest.java
backend/src/test/java/com/example/backend/OtpDeliveryServiceTest.java
backend/src/test/java/com/example/backend/PhoneUpdateConcurrencyTest.java
backend/src/test/java/com/example/backend/PlatformApiIntegrationTest.java
backend/src/test/java/com/example/backend/RegistrationVerificationServiceTest.java
backend/src/test/java/com/example/backend/RegistrationVerificationTransactionTest.java
```

| File group | Reason |
|---|---|
| `OtpDeliveryService`, `pom.xml`, `application.properties` | HTTPS Resend request, bounded connect/read timeouts, safe errors, Vietnamese HTML; remove unused mail starter. |
| `RegistrationVerificationService`, OTP entity/enum comments | Retain email-only verification, legacy `phone_code_hash` NOT NULL compatibility and controlled PHONE rejection. |
| `AuthController`, `AuthService`, `UserAccountRepository`, `ApiDtos` | Self-only phone PATCH, locking, validation, stable conflict code and replacement token. |
| JWT filter/service, account details/current account service, `UserAccount` timestamp callback | Bind token to identity/version and reject reassigned/stale tokens. Timestamp uses monotonic milliseconds compatible with existing DB precision; mappings are unchanged. |
| `BookingController`, `BookingService`, `BookingRepository` | Efficient CUSTOMER history query using `existsByCustomerId`, with no booking/payment mutation. |
| Production logging configuration | Suppress raw Hibernate constraint messages that can contain a conflicting phone; the application still returns the handled error. |
| Backend tests | Mock Resend contract/errors, real verification transactions in H2, JWT/phone/role/history/concurrency regressions. |
| CI and docs | Maven verify/package gate on PRs and this release branch; safe production configuration/runbook. Existing frontend typecheck/build CI stays enabled. |

`PATCH /api/v1/auth/me/phone` takes `{ "phone": "0912345678" }` and returns the existing `AuthResponse` (`accessToken`, `tokenType`, `expiresInMs`, `user`). It derives identity from authentication and ignores any client account ID. Same-phone input does not write the account. Invalid input: 400; occupied phone: 409 `PHONE_ALREADY_IN_USE`; absent/stale identity: 401. All existing account roles remain unchanged.

`GET /api/v1/bookings/mine/history-status` returns `{ "hasPreviousBooking": true|false }`. Anonymous: 401; non-CUSTOMER: 403. Any persisted booking status counts.

OTP endpoints and request/response fields remain unchanged. PHONE channel is rejected with 400 `OTP_EMAIL_ONLY`. Invalid/expired/reused OTP: 400 `OTP_INVALID`; invalid/expired/consumed token: 400 `VERIFICATION_REQUIRED`; application rate limit: 429 `RATE_LIMITED`; missing pepper: 503 `OTP_NOT_CONFIGURED`; unavailable delivery: 503 `OTP_DELIVERY_UNAVAILABLE`; Resend 429: 503 `OTP_PROVIDER_RATE_LIMITED`. A provider response must contain a nonblank ID. No automatic send retry is performed; repeated user requests remain bounded by the existing target/IP limits. Resend acceptance does not prove Inbox delivery. [Resend send-email contract](https://resend.com/docs/api-reference/emails/send-email).

## C. Verification

- Baseline `main`: Java 21 Maven test, 45 passed, 0 failures/errors/skips.
- Release: Java 21 `mvn --batch-mode --no-transfer-progress verify` passed 81 tests, with 0 failures/errors/skips and successful compile/package. All DB tests use isolated H2 databases; Resend is mocked and PayOS tests use the existing fake gateway.
- Resend tests cover accepted ID, missing sender/key, 400/401/403/422/429/500/502/503/504, malformed/empty responses and a single timeout attempt.
- Real verification service tests cover customer and supplier OTP registration, direct-register rejection, token reuse rejection, persisted wrong-attempt counts, expired codes, rate limits and failed-delivery rollback.
- Identity tests cover phone validation/conflict, same-number idempotency, stored phone and new phone/email login, replacement JWT, old JWT rejection, phone reassignment/return, legacy compatibility, role guards and concurrent updates.
- History tests cover absent, active and cancelled booking history. Existing booking/payment tests remain enabled, including 11 PayOS security tests.
- Production frontend is unchanged. `npm ci`, `npm run lint` (`tsc --noEmit`) and `npm run build` passed. Existing Rollup/Zod annotation and >500 kB chunk warnings remain. There is no ESLint or frontend test script in `main`; UI tests belong to Phase 2.
- `git diff --check` passed. GitHub CI results for the final pushed commit must be successful before approval. No live MySQL, real email delivery, browser session or payment test is claimed here.

## D. Approval and manual actions

1. GitHub: review the backend PR (or create one using its compare link if connector permission is insufficient), wait for both CI jobs to pass, then explicitly approve the exact commit for merge and production release. Because Railway follows `main` without a CI deploy gate, approval to merge must account for that deployment trigger. No main merge is authorized by this runbook.
2. Railway: privately verify the already-set key can send for `beautylink.cloud`, sender is `no-reply@beautylink.cloud`, pepper is the existing independent secret of at least 32 UTF-8 bytes, and DB/PayOS/JWT settings are unchanged. Do not paste values in chat. If a value is incorrect, propose that specific variable change for approval first. Keep one replica/current limiter. Confirm a recent MySQL backup and the existing payment/slot constraints; do not run DDL.
3. Resend: check the existing verified domain, sender/key permission and dashboard delivery events. Do not create a replacement account/key if the current one works. After release approval, use an owned test email for a single customer and supplier OTP smoke test.
4. Vercel: preserve API base/domains/environment. A backend-only commit may rebuild the identical frontend through Git integration; inspect its commit and READY state. Do not release popup code yet.
5. PayOS: preserve current channel, keys, webhook/return/cancel URLs and reconciliation. Confirm the configured webhook is unchanged and existing reconciliation is healthy using read-only logs. A real payment smoke test requires separate explicit permission.
6. Mắt Bão: no DNS/nameserver/SSL changes are needed for Phase 1. Resolve the custom-domain reachability question before a separate cutover approval.

## E. Deployment gates and rollback

**Current decision: GO for backend review/CI; NO-GO for production until explicit approval, backup and configuration verification.**

Phase 1: approve exact tested backend commit, merge only that PR, observe Railway SUCCESS and the served commit, check `/api/v1/categories` on the currently used domain, then validate login/email OTP/customer+supplier registration/phone PATCH/history APIs with owned test accounts. Confirm old JWT gives 401, new token and phone/email login work, conflict gives 409, no extra account fields changed, and cancelled bookings count as history. Keep credentials/tokens/codes out of logs and documents. Observe startup errors and HTTP 5xx/503/latency for at least 15 minutes; OTP provider errors must not make catalog/login unavailable.

Stop if startup/health/CI fails, an endpoint returns unexpected 404/5xx, webhook configuration changes, or payment/booking states regress. Investigate with read-only logs and scoped fixes before continuing.

Rollback only with owner approval: redeploy the recorded pre-release application artifact/commit if the already-existing payment schema is compatible. Never restore an old DB snapshot over new bookings/payments/phone updates. Preserve secrets and all current DB data. Frontend remains compatible with the old backend because Phase 2 has not shipped. Rolling back to SMTP disables Resend registration until a forward fix; catalog/login/payment must remain the priority. If the pre-release legacy migration/schema was not already verified, roll forward rather than assuming an older single-attempt payment schema is safe.

Phase 2 begins only after backend acceptance: branch from the new `main`, bring only UI/session/popup tests from the source branch, fix outstanding account-change races, test all ten UI scenarios from the release task, create a separate PR and wait for CI plus owner approval.

Later cutover (separate approval): frontend `https://beautylink.cloud`; backend/API base `https://api.beautylink.cloud/api`; CORS origin `https://beautylink.cloud`; PayOS return/cancel `https://beautylink.cloud/?payment=success|cancelled`; webhook `https://api.beautylink.cloud/api/v1/payments/payos/webhook`. Current public frontend API base is verified above; current PayOS URL values are unverified/redacted. First verify both domains and current settings, record previous values privately, then test a staged frontend and CORS before individually approving the URL/webhook changes. Retain the old Railway domain as rollback path. Restore only the approved previous non-secret URLs/build if cutover fails; never rotate payment credentials.
