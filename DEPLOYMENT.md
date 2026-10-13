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
- A PayOS payment opens on the hosted checkout and the booking becomes paid only after its webhook is received.
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
Book/payment DTO changes are additive; deploy backend before frontend after separate approval.
Verify current image/commit and how frontend auto-promotion is held **before** merging main.
No schema/entity mapping, DDL, secrets, webhook URL, CORS or domain changes are required.
