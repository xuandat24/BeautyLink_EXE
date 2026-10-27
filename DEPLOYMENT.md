# BeautyLink deployment handoff

This guide deploys the recommended production-shaped setup:

- React frontend on Vercel
- Spring Boot backend on Railway
- MySQL database on Railway

No local `.env` file or real secret should be committed. Railway and Vercel store the production variables.

For the existing BeautyLink production project, follow [RELEASE_RESEND_BACKEND.md](RELEASE_RESEND_BACKEND.md). The setup sections below are for a new installation. Preserve existing secrets, domains, CORS, API base and PayOS URLs; require explicit approval before any production change or deployment.

## 1. Verify the repository

Deploy the `main` branch only after these commands pass locally:

```powershell
cd backend
mvn test
cd ../frontend
npm ci
npm run lint
npm run build
```

## 2. Create Railway services

1. In Railway, create an empty project.
2. Add a MySQL database and keep its service name as `MySQL` (or update the references below to match its name).
3. Add a service from the BeautyLink GitHub repository.
4. Set the backend service **Root Directory** to `/backend`.
5. Set the Railway config file path to `/backend/railway.json` if Railway does not detect it automatically.
6. Generate a public domain for the backend service under **Settings -> Networking**.

The backend Dockerfile builds with Java 21 LTS, activates the `prod` Spring profile, listens on Railway's `PORT`, and uses `/api/v1/categories` as its health check.

## 3. Configure Railway variables

Open the backend service's **Variables** tab and add the following. These are reference variables, not copied database passwords:

```text
MYSQLHOST=${{MySQL.MYSQLHOST}}
MYSQLPORT=${{MySQL.MYSQLPORT}}
MYSQLDATABASE=${{MySQL.MYSQLDATABASE}}
MYSQLUSER=${{MySQL.MYSQLUSER}}
MYSQLPASSWORD=${{MySQL.MYSQLPASSWORD}}
JWT_EXPIRATION_MS=3600000
CORS_ALLOWED_ORIGINS=https://temporary.invalid
DEMO_DATA_ENABLED=false
SUPPLIER_AUTO_VERIFY=false
JWT_SECRET=<a-new-random-secret>
KYC_ENCRYPTION_KEY=<a-different-random-secret>
OTP_PEPPER=<a-third-independent-random-secret>
RATE_LIMIT_BACKEND=memory
RESEND_API_KEY=<resend-api-key>
OTP_MAIL_FROM=no-reply@beautylink.cloud
LOGIN_MAX_PER_IDENTIFIER=8
LOGIN_MAX_PER_IP=20
LOGIN_RATE_WINDOW_SECONDS=900
REGISTRATION_MAX_PER_IP=5
REGISTRATION_RATE_WINDOW_SECONDS=3600
PAYOS_CLIENT_ID=<payos-client-id>
PAYOS_API_KEY=<payos-api-key>
PAYOS_CHECKSUM_KEY=<payos-checksum-key>
PAYOS_RETURN_URL=https://YOUR-VERCEL-DOMAIN/?payment=success
PAYOS_CANCEL_URL=https://YOUR-VERCEL-DOMAIN/?payment=cancelled
PAYOS_WEBHOOK_URL=https://YOUR-RAILWAY-DOMAIN/api/v1/payments/payos/webhook
PAYOS_RECONCILIATION_MS=60000
PAYOS_RECONCILIATION_INITIAL_DELAY_MS=60000
PAYOS_RECONCILIATION_MIN_AGE_SECONDS=60
PAYOS_RECONCILIATION_MIN_INTERVAL_SECONDS=120
```

PayOS is the only production payment gateway. Once any PayOS credential is supplied, the production profile requires all three credentials plus public HTTPS return, cancel, and webhook URLs. Keep credentials absent only for a staged deployment where checkout is intentionally disabled.

For a new installation only, generate independent secret values locally. Preserve all existing production secrets during this release:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

For a new installation, use independent results for `JWT_SECRET`, `KYC_ENCRYPTION_KEY`, and `OTP_PEPPER`. Keep these stable across this release; never print them in logs or paste them into a PR or chat.

### Demo versus real production

For local development using a non-production profile only:

```text
DEMO_DATA_ENABLED=true
SUPPLIER_AUTO_VERIFY=true
```

Demo seeders are profile-gated and always disabled in production. The two supported cities and five categories are created in either mode because real supplier registration needs them. Do not enable demo flags to fill a production catalog.

For a real public launch, use:

```text
DEMO_DATA_ENABLED=false
SUPPLIER_AUTO_VERIFY=false
```

Preserve the current single-replica rate-limit backend. Shared Redis is required before scaling, which is a separate approved change; the existing implementation falls back to bounded in-memory limits during Redis outages. Registration OTP is email-only and is sent through Resend over HTTPS port 443. Missing or rejected Resend credentials produce a safe `503`; no account or registration token is created. SMTP, Gmail App Password, Twilio and Zalo are not used.

Before the first deployment of this version, take a MySQL backup. Startup performs a narrow idempotent migration that drops the legacy unique payment-per-booking and all-status slot constraints, preserving rows and foreign keys. Verify the startup logs, then confirm multiple payment attempts for one booking in MySQL. Once a second attempt exists, recover by rolling forward rather than reverting to code that assumes one payment row per booking.

Turning demo seeding off does not delete existing demo records. Review `backend/src/main/resources/db/demo-data-cleanup.sql` before removing them.

Do not map Railway's raw `MYSQL_URL` variable to the backend. The application constructs the required JDBC URL from the five referenced MySQL variables above. `MYSQL_JDBC_URL` remains available as an override if a different MySQL host is used.

## 4. Deploy and verify the backend

Deploy the Railway backend, generate its public domain, and open:

```text
https://YOUR-RAILWAY-DOMAIN/api/v1/categories
```

The response should contain the reference categories without enabling demo data. Also check the Railway deployment logs for a successful database connection and health check.

## 5. Deploy the frontend on Vercel

1. Import the same GitHub repository into Vercel.
2. Set **Root Directory** to `frontend`.
3. Keep the framework preset as Vite.
4. Use build command `npm run build` and output directory `dist`.
5. Add this production environment variable:

```text
VITE_API_BASE_URL=https://YOUR-RAILWAY-DOMAIN/api
```

6. Deploy and copy the final Vercel origin, for example `https://beautylink.vercel.app`.

`VITE_API_BASE_URL` is included at frontend build time. Redeploy the frontend whenever this value changes.

## 6. Finish CORS configuration

Return to the Railway backend variables and replace the temporary origin:

```text
CORS_ALLOWED_ORIGINS=https://YOUR-VERCEL-DOMAIN
```

Use only the origin: no `/api`, path, or trailing slash. Multiple allowed origins must be comma-separated. Redeploy the backend after changing the variable.

## 7. Configure PayOS webhook

After the Railway backend has a stable public HTTPS domain, configure this webhook URL in the PayOS merchant dashboard:

```text
https://YOUR-RAILWAY-DOMAIN/api/v1/payments/payos/webhook
```

The endpoint accepts PayOS callbacks without a customer JWT, verifies their signature with `PAYOS_CHECKSUM_KEY`, checks the order code, amount, and payment-link ID, and is idempotent. Browser return/cancel query parameters do not mark a booking paid. Keep all three PayOS credentials exclusively in Railway variables, then redeploy the backend.

## 8. Smoke test the deployed application

Verify all of these from the Vercel website:

- Hà Nội and Hồ Chí Minh can be selected.
- Categories and homepage services load.
- A customer can sign in and create a booking.
- A new customer and supplier receive a real six-digit email OTP through Resend and cannot register with a wrong, expired, or reused verification token.
- The booking appears in **Tổng quan & Lịch hẹn**.
- A PayOS payment normally renders the provider's exact QR inside BeautyLink. A verified legacy link without recoverable QR may use the explicitly labelled hosted fallback. Only signed webhook/server reconciliation confirms payment. See [custom QR verification and rollout](docs/PAYOS_QR_CHECKOUT.md).
- A supplier can sign in, edit its profile, create a service, and update a schedule.
- Staff can view and resolve a submitted report.
- Browser developer tools show no CORS or failed `/api` requests.

## Troubleshooting

### Backend fails to connect to MySQL

- Confirm all five MySQL reference variables point to the correct Railway service name.
- Do not pass the non-JDBC `MYSQL_URL` value as `MYSQL_JDBC_URL`.
- Redeploy the backend after variable changes.

### Frontend opens but API calls fail

- Confirm `VITE_API_BASE_URL` ends in `/api`.
- Open the Railway categories URL directly.
- Confirm `CORS_ALLOWED_ORIGINS` exactly matches the Vercel origin.
- Redeploy Vercel after changing a `VITE_` variable.

### The deployed catalog is empty

- Check real supplier verification status and active service listings.
- Confirm reference categories load and inspect logs using read-only tools.
- Do not enable demo seeders or delete data to repair the production catalog.

### Security reminders

- Never commit `.env.properties`, `.env.local`, database credentials, or JWT secrets.
- Never commit or rotate `KYC_ENCRYPTION_KEY` without a planned data migration; store it only in Railway's secret variables.
- Do not expose the Railway MySQL service publicly unless external database access is specifically required.
- Replace the demonstration password before any public deployment.
- Never expose PayOS credentials in `VITE_` variables or frontend source code.
- Keep Redis private, require TLS/auth where supported, and never expose Resend credentials or `OTP_PEPPER` values to the frontend.

## 9. Resend setup, smoke test and rollback

1. In Resend, keep `beautylink.cloud` verified and create a restricted sending API key.
2. Store the key as Railway `RESEND_API_KEY` and set `OTP_MAIL_FROM=no-reply@beautylink.cloud` on the backend service only. Do not add the key to Vercel or any `VITE_` variable.
3. Redeploy the backend and request one OTP for a dedicated test account. Confirm the email arrives, the six-digit code works once, and wrong, expired and reused codes fail. Provider acceptance is not proof of Inbox delivery, so check Inbox and spam during the smoke test.
4. Verify customer and supplier registration, login, booking creation and PayOS checkout after deployment.

Automated tests use a local HTTP fake and never call Resend or a production database. If the OTP change must be rolled back, redeploy the previous application image/commit; there is no database migration to reverse. Keep `OTP_PEPPER` unchanged so existing unexpired challenges remain consistently hashed. The legacy `phone_code_hash` column remains populated for old MySQL `NOT NULL` compatibility and must not be dropped during rollback.

## 10. Booking/payment/review release gate

See [PAYMENT_REVIEW_RUNBOOK.md](PAYMENT_REVIEW_RUNBOOK.md) for the current cancellation policy,
read-only manual/legacy-attempt audit, responsible owner, unresolved money decisions and rollback.
This task authorizes feature-branch push/draft PR **only**: no merge, production deploy, database
write/restore or real payment. The owner's backup has not been restore-tested; notification and
late-money procedures remain approval gates. Do not treat prior CI or a health HTTP 200 as release evidence.

Require exact final HEAD CI: full Java 21 regression, frontend tests/typecheck/build, MySQL 8.4
`BookingReviewReleaseTest,PaymentCancellationSafetyTest`, and backend Docker build. Local browser
smoke uses real Spring/JWT/H2 with a test-only fake gateway and blocks PayOS network redirects;
neither fixtures nor the fake provider belongs in the production JAR/bundle.
The browser gate covers actual existing-booking continuation after reload/back navigation, reuse and expiry
retry without a new booking; it is not a live PayOS test. Temporary CI-only browser tooling is not a runtime
dependency. Internal ADMIN zero-money/zero-secondary operations require fresh all-attempt provider proof,
preview fingerprint and append-only support-report audit; production use requires separate approval.
Read-only backup metadata now exists, but restore into an approved isolated target remains BLOCKED.
Book/payment DTO changes are additive; deploy backend before frontend after separate approval.
Verify current image/commit and how frontend auto-promotion is held **before** merging main.
No schema/entity mapping, DDL, secrets, webhook URL, CORS or domain changes are required.

## Cloudinary public images

Preparation only: do not change production variables or deploy without the owner's release approval.
In the existing Railway **backend** service, configure these variables privately:

```properties
CLOUDINARY_ENABLED=true
CLOUDINARY_CLOUD_NAME=<Cloudinary cloud name>
CLOUDINARY_API_KEY=<Cloudinary API key>
CLOUDINARY_API_SECRET=<Cloudinary API secret>
CLOUDINARY_CONNECT_TIMEOUT_MS=3000
CLOUDINARY_READ_TIMEOUT_MS=6000
```

Use an existing authorized Cloudinary account; inspect its quota/billing before enabling. No account,
resource or paid plan is provisioned by this change. No frontend secret, unsigned preset, webhook,
DNS or database migration is needed. Cloudinary is disabled by default for staged rollout. Missing
credentials do not stop application startup; enabled uploads fail closed with a safe 503 response.

Deploy backend before frontend under the project's approved release procedure. Then smoke-test with
an owner-controlled supplier: select a non-sensitive photo, save storefront, service and practitioner,
reload and verify the persisted URL uses `https://res.cloudinary.com/<cloud>/image/upload/`.
Verify public cards display the photo. Test permission boundaries and errors in a test environment,
not by uploading personal documents. Supplier registration uploads only the public storefront image;
CCCD images continue through existing encrypted storage. Customer account avatars are out of scope.

Limits: browser source 10 MB, prepared data URI 1,100,000 characters; backend validates raster bytes,
dimensions and format before provider upload; 20 new uploads/hour per owner via the configured existing
rate-limit backend. Redis retains the project's existing multi-instance behavior. Incoming Cloudinary
transformation limits output to 2048 px and WebP. Upload requests are signed server-side; responses must
match generated public ID, signature, version, image type and trusted HTTPS delivery URL. No automatic
upload retries (a timeout can be ambiguous). Save APIs retain the existing request/response shape,
authorization and transactions; frontend upload-bearing requests allow 30 seconds.

Failure behavior: 429 becomes a safe rate-limit error; other provider/network errors become 503,
invalid provider identity/signature becomes 502. A failed save is not reported as successful. A confirmed
new asset is deleted best-effort if its DB transaction rolls back; old images are never automatically
deleted. Ambiguous upload timeout, process crash, invalid response or failed rollback cleanup may leave
an unreferenced asset. Inspect the Cloudinary `beautylink/public/` folder against stored image URLs before
manual cleanup; never bulk-delete by age/prefix alone. Do not log provider bodies, signed multipart
payloads or credentials. Existing assets and base64 rows are not bulk-migrated.

Rollback: restore the previous compatible code/image via the approved procedure; no DB restore/DDL.
Existing persisted HTTPS URLs remain compatible. Setting `CLOUDINARY_ENABLED=false` is an explicit
operator choice to restore legacy base64 storage for future uploads, not a fallback on provider error.
Do not rotate/delete Cloudinary credentials/assets as part of a code rollback.

Local verification (no provider account required):

```powershell
cd backend
mvn --batch-mode --no-transfer-progress verify
# Optional contract-derived HTTP simulation, from repository root in another terminal:
postman simulation run postman/simulations/cloudinary.sim.yaml --port 4900 --output ndjson --no-history
# Then from backend (test-only probe, fake credentials):
mvn test-compile dependency:build-classpath -Dmdep.outputFile=target/cloudinary-classpath.txt
$cloudClasspath = (Get-Content target/cloudinary-classpath.txt -Raw).Trim()
java -cp "target/test-classes;target/classes;$cloudClasspath" com.example.backend.service.CloudinarySimulationProbe
```

Windows/MSIX environments that fail Java's local socket initialization may add
`-DargLine=-Djdk.net.unixdomain.tmpdir=C:/Temp` to Maven tests and
`-Djdk.net.unixdomain.tmpdir=C:/Temp` to the probe's Java command. This is a local test-JVM workaround,
not a production setting. No Postman login, workspace publication or paid mock server is required.

Implementation verification (2026-10-20, isolated H2/local HTTP, not production): Maven verify/package
passed 357 executed tests with 2 existing opt-in migration tests skipped (`GoogleSigninMigrationTest`,
`WorkforceMigrationTest`); subsequent focused gateway/API run passed 18 tests, including the added
SHA-256 response, network failure and service-update cases. Frontend 59/59 tests, TypeScript check,
production build and `git diff --check` passed. Postman simulation observed actual Java upload/destroy
requests returning 200. Production JAR inspection found no mock/probe/test contract classes/resources.
Live Cloudinary/account quota and deployed persistence smoke remain NOT RUN pending owner configuration
and release approval. Existing Rollup/zod annotation and chunk-size warnings are non-blocking and unchanged.

## Authentication idle sessions and atomic onboarding (2026-10-24 candidate)

Base inspected: `ef13ac9e0f6ff64669289ffcb02e66773c620d98` (main/PR #10).
Branch: `codex/session-onboarding-expiry`. This is a code candidate, NOT a production deployment.

Verified former behavior: default-true remember-me persisted bearer/profile in localStorage;
the store trusted that profile before `/me` and App preserved it on any `/me` failure.
JWT verification had no server idle/revocation row; profile edits issued fresh full-lifetime JWTs.
Five independent onboarding cache values had indefinite TTL and no common completion timestamp.

### New contract and compatibility

- Every new login, EMAIL-verified registration, supplier registration and explicit Google login
  issues a signed JWT with a random `sid` bound to `authentication_sessions.account_id`.
  Every authenticated request checks account identity/status/version AND the persisted session.
  Idle deadline is `last_activity_at + 10 minutes`; equality is expired. Absolute expiry is
  the smaller of configured JWT lifetime and **one hour**. No refresh token or automatic renewal.
- `POST /api/v1/auth/session/activity`, authenticated, no body: returns 200 with
  `idleExpiresAt` and `absoluteExpiresAt` (UTC ISO instants). Locks/rereads the session before
  updating activity; cannot revive expired/revoked sessions. Only trusted pointer/keyboard/wheel/touch
  interaction calls it, at most once per 15 seconds per tab. GET/polling/focus/visibility do not renew.
- `POST /api/v1/auth/session/logout`, authenticated: revokes this sid and returns 204.
  Already revoked/expired credentials receive 401; revocation is state-idempotent.
  Local logout is immediate; offline revocation cannot be guaranteed until a server request succeeds.
  Idle/absolute enforcement still applies. Independent explicit logins have independent sessions;
  copied tabs sharing a sid share activity/logout hints, never share bearer tokens via localStorage.
- Profile/phone replacement preserves sid, last activity and absolute deadline. Late `/me`, login,
  Google/register and profile responses cannot restore credentials after logout/account switch.
  Request interception also checks elapsed wall time before protected actions, including after sleep.
- MVP remember-me is removed. Bearer/meta are sessionStorage-only. Legacy localStorage tokens and
  cached auth profiles are discarded rather than migrated. A restored browser session starts locked
  (`checking`) BEFORE child effects, and requires `/me` before exposing protected UI.
  Matching authenticated 401 clears auth. 403 does not imply revocation; `/me` 403 locks verification.
  Network/5xx locks UI and retains recoverable credentials, with explicit retry/logout and no retry loop.
  Public catalog reads omit bearer credentials and remain public.
- **Browser-close limitation:** browsers may restore sessionStorage, duplicate tabs or preserve a
  process across window closure. Exact close detection is not claimed. Restored credentials must pass
  `/me` and both server deadlines; reopening within the valid idle window can still verify successfully.
  A hostile authenticated client can emulate activity calls; the independent one-hour absolute limit
  bounds that behavior. sessionStorage remains exposed to same-origin XSS (not an HttpOnly cookie).
  No cookies were introduced; existing bearer-only CORS/CSRF model is unchanged.
- Only account auth keys are cleared. Account-scoped v4 carts remain saved under their owner.
  Protected checkout is stopped on expiry; reauthentication retains selection/booking-id hints and
  re-fetches server ownership/capabilities before continuation. Different accounts cannot reuse private
  booking data. PayOS return parameters remain untrusted hints until a backend status read succeeds.
  No booking/payment cancellation, amount calculation, gateway mutation or reconciliation logic changed.
- Onboarding uses ONE versioned `beautylink_onboarding_v1` record with `completedAt`, location id,
  canonical city name and category. Reads/category changes do not renew the 24-hour deadline.
  Exact deadline timer plus focus/visibility/storage reconciliation resets all five memory fields together.
  Legacy/corrupt/future/expired selections are cleared deterministically, then options are validated
  against current location/category APIs. Global cache defaults and unrelated preferences are unchanged.
  Automatic modal is home-only, includes logged-in users, excludes active booking/checkout/payment return.
  Expiring onboarding does not revoke auth. Failed option loading offers retry, never fabricated IDs.

### Files and purpose

- Backend enforcement: `auth/{AuthenticationSessions,JwtService,JwtAuthenticationFilter}.java`,
  `model/AuthenticationSession.java`, `repository/AuthenticationSessionRepository.java`,
  `controller/SessionController.java`, `service/AuthService.java`.
- Additive DDL: `backend/src/main/resources/db/migration/mysql/V20261024_01__authentication_sessions.sql`.
- Frontend: `App.tsx`, `components/{AuthPage,BookingsPage,PaymentContinuationDialog,LocationSelectModal}.tsx`,
  `hooks/useSessionLifecycle.ts`, `lib/{authSession,onboarding}.ts`, `services/beautyApi.ts`, `store/beautyStore.ts`.
- Backend tests: `Authentication{SessionsTest,SessionIntegrationTest,SessionMigrationTest}.java`,
  `TestJwtFactory.java`, `AuthServiceTest.java`, `JwtIdentityTest.java`,
  `RegistrationVerificationTransactionTest.java` (mock unrelated external image gateway, retain OTP assertions).
- Frontend tests: `authSession.test.ts`, `sessionLifecycle.test.ts`, `onboardingExpiry.test.ts`,
  `sessionFixtures.ts`, `cartState.test.ts`, `paymentContinuation.test.ts`, `publicImageUpload.test.ts`.
  The latter existing tests now establish valid session fixtures; business assertions are retained.
- `.github/workflows/ci.yml`: add only the isolated authentication-session DDL test to existing MySQL job.
  This validates table/FK creation and preservation of pre-existing users on loopback test DB only.
  `DEPLOYMENT.md` and `CODEX_HANDOFF.md`: candidate evidence and release gates, no runtime settings.

### Verification evidence and outstanding gates

Java 21.0.11, Maven 3.9.12; no production DB/services used. Commands from `backend`:

```powershell
# Standard required regression command (Linux CI must pass before merge):
mvn --batch-mode --no-transfer-progress verify
# Windows Mockito agent is test-JVM-only; do not add it to Railway/POM:
mvn --batch-mode --no-transfer-progress `
  '-Dtest=AuthenticationSessionsTest,AuthenticationSessionIntegrationTest,AuthenticationSessionMigrationTest,AuthServiceTest,JwtIdentityTest,GoogleAuthIntegrationTest,RegistrationVerificationServiceTest,RegistrationVerificationTransactionTest,PasswordResetServiceTest' `
  '-Dspring.main.lazy-initialization=true' `
  '-DargLine=-javaagent:C:/Users/NHATAN~1/.m2/repository/org/mockito/mockito-core/5.17.0/mockito-core-5.17.0.jar' test
```

Focused result: **45 passed, 0 failures/errors, 1 skipped** (MySQL migration: no isolated target).
Real JWT/filter/MockMvc/H2 tests cover four roles, exact 10-minute boundary, non-renewing GET,
activity, revocation, missing/unknown/wrong-owner sid, anonymous/expired JWT and profile deadline retention.
Google integration, real EMAIL verification/registration transaction/supplier registration and password
reset tests retain their checks. External OTP delivery/image/Google verifier mocks do not test live providers.
Lazy initialization avoids constructing unused Windows HTTP clients; auth/OTP paths themselves execute.

Frontend: `npm test` **93 passed**, `npm run lint` (TypeScript) and `npm run build` PASS.
Tests cover 401/403/500/offline, restored-tab first render, sleep, cross-tab hints, late responses,
account switch/cart isolation, checkout double submit/ownership, exact 24h timer/visibility/tabs,
legacy/corrupt selections, validated options, logged-in user and critical-flow modal exclusion.
Known Zod/Rollup annotation warnings remain; no new dependency was added.

Full local `mvn verify` was attempted and is **NOT PASS**: 374 cases, 160 passed,
211 setup errors, 3 opt-in MySQL cases skipped, zero assertion failures. Windows Java loopback
`SocketException: Invalid argument: connect` / `Unable to establish loopback connection`
prevents unrelated JDK HTTP/Cloudinary test contexts from starting. See ignored
`backend/target/session-full-verify-final.log`, focused `session-final-focused.log`, and surefire reports.
Do not treat focused success as full regression success. Docker daemon unavailable; real browser,
isolated MySQL DDL/locking, full Linux CI, live OAuth/Resend and production smoke remain NOT VERIFIED.
No application source was changed to conceal this machine restriction and no test was disabled.

### Approval-required deployment and rollback checklist

1. Review exact feature diff and obtain a successful full Java/frontend CI and isolated MySQL migration
   run on that exact SHA. Run staging browser session/checkout/payment-return smoke without real money.
2. Confirm a usable recent backup/restore. Apply the additive SQL once on staging; check table,
   expiry index, account FK and existing account/booking/payment counts. Production DDL needs approval.
   SQL files are not auto-run by Flyway (not installed); do not rely on Hibernate `update` as release evidence.
3. Keep JWT secret, Google/OTP/PayOS/CORS values unchanged. **No new Railway/Vercel variable is required**;
   JWT_EXPIRATION_MS remains supported but is capped at one hour. Do not rotate secrets to revoke sessions.
4. Hold frontend promotion. Approve/apply production DDL, deploy backend first and verify health,
   login for all roles, expired/revoked token 401, non-renewing polling, activity and existing webhook
   availability. Old JWTs lacking sid intentionally require reauthentication; communicate this interruption.
   Old frontend has no activity heartbeat: keep mixed-version window short and then promote frontend.
5. Verify frontend SHA, forced legacy reauth, network lock/retry, idle/sleep/multiple tabs,
   owner carts, checkout reauth/ownership, nonfinancial payment return and 24h onboarding in staging.
   Do not create production bookings/payments or alter production data as a smoke shortcut.
6. Rollback code/images only to a reviewed **session-enforcing** compatible build; retain the new table
   and existing rows. Do not restore production DB or revert to stateless JWT enforcement just to restore
   login convenience. Stop rollout on session/ownership regression; preserve server booking/payment records.
   Expired session-row retention/cleanup is an operator maintenance decision, not a deletion in this patch.

No merge, deployment, production configuration mutation or production migration was performed for this task.

### Profile/session stability and customer avatar — 2026-10-25

This patch keeps previously verified pages mounted during background `/auth/me` checks.
Focus/visibility events share one request and recheck at most once per minute after successful
verification. Idle/absolute deadlines are checked on every resume/request; the backend remains
the authority. A definitive authenticated 401 clears the session. Auth verification failures lock
private UI; ordinary upload/other resource 5xx or network failures stay local to that operation.

Customer avatar persistence adds nullable `user_accounts.avatar_url` and authenticated,
customer-only `PATCH /api/v1/auth/me/avatar`. No account ID is accepted from the client. A successful
update returns a replacement JWT with the same session ID and absolute deadline, since saving the
account changes its identity timestamp. Public-image validation/storage/rate limits are reused;
old assets are retained, and failed transactions use the existing new-asset rollback cleanup.
Cloudinary's existing enabled/configured mode is unchanged. When disabled, its existing legacy
mode stores the validated data image; do not label that mode a Cloudinary upload.

Release order (approval required; not executed here):

1. Require all four CI jobs on the exact proposed HEAD, including the additive MySQL avatar
   migration test and the expanded desktop/mobile browser smoke. Browser fixtures use isolated
   H2 and synthetic accounts; image storage runs in legacy mode with no external upload.
2. Confirm backup/restore and apply `backend/src/main/resources/db/migration/mysql/V20261025_01__customer_avatar.sql`
   once in staging, then in production only with separate approval. Verify the nullable LONGTEXT
   column and unchanged account/booking/payment counts. Flyway is not installed. Hibernate's current
   `ddl-auto=update` is not a substitute for an approved, reviewed migration step.
3. Deploy approved backend first. Old frontend consumers remain compatible with the extra nullable
   `avatarUrl` response field. Confirm existing Google/password sign-in, `/me`, idle expiry and logout
   on an authorized test account without logging credentials. The new frontend needs the avatar endpoint.
4. Deploy/promote frontend after backend checks. Check Profile navigation, native file picker,
   validation, one upload per save, visible operation errors, persistence after reload, and unchanged
   account/cart/booking ownership. Do not test using another customer's profile or real money.
5. On regression, stop promotion. Roll frontend/code images back to a reviewed session-enforcing
   version. **Keep the nullable avatar column and data**; old code ignores it. Do not roll back to a
   pre-session JWT policy, drop the column, restore DB, or remove manual payment blockers.

No new environment variables, OAuth settings or production secrets are required by this patch.
