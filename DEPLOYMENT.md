# BeautyLink deployment handoff

This guide deploys the recommended production-shaped setup:

- React frontend on Vercel
- Spring Boot backend on Railway
- MySQL database on Railway

No local `.env` file or real secret should be committed. Railway and Vercel store the production variables.

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
DEMO_DATA_ENABLED=true
DEMO_ACCOUNT_PASSWORD=<a-new-private-demo-password>
SUPPLIER_AUTO_VERIFY=true
JWT_SECRET=<a-new-random-secret>
KYC_ENCRYPTION_KEY=<a-different-random-secret>
OTP_PEPPER=<a-third-independent-random-secret>
RATE_LIMIT_BACKEND=redis
REDIS_URL=${{Redis.REDIS_URL}}
REDIS_TIMEOUT=2s
SPRING_MAIL_HOST=<smtp-host>
SPRING_MAIL_PORT=587
SPRING_MAIL_USERNAME=<smtp-username>
SPRING_MAIL_PASSWORD=<smtp-password>
SPRING_MAIL_PROPERTIES_MAIL_SMTP_AUTH=true
SPRING_MAIL_PROPERTIES_MAIL_SMTP_STARTTLS_ENABLE=true
OTP_MAIL_FROM=<verified-sender-address>
TWILIO_ACCOUNT_SID=<twilio-account-sid>
TWILIO_AUTH_TOKEN=<twilio-auth-token>
TWILIO_FROM_NUMBER=<twilio-sender-number>
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
```

Generate the secret values locally; do not reuse any development or database password:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Run the command four times: use independent results for `JWT_SECRET`, `KYC_ENCRYPTION_KEY`, `OTP_PEPPER`, and `DEMO_ACCOUNT_PASSWORD`. Keep `KYC_ENCRYPTION_KEY` and `OTP_PEPPER` stable across redeployments.

### Demo versus real production

For the classroom demonstration, keep:

```text
DEMO_DATA_ENABLED=true
SUPPLIER_AUTO_VERIFY=true
```

This creates fake suppliers, services, schedules, and demo accounts in a new database. The two supported cities and five categories are created in either mode because real supplier registration needs them. The seeding is safe to run repeatedly. Share `DEMO_ACCOUNT_PASSWORD` privately with the demonstrators.

For a real public launch, use:

```text
DEMO_DATA_ENABLED=false
SUPPLIER_AUTO_VERIFY=false
```

Add a private Redis service to Railway and keep `RATE_LIMIT_BACKEND=redis`; production fails closed if Redis cannot enforce a limit. Registration sends real SMS through Twilio and email through SMTP. Missing or rejected provider credentials produce a safe `503`, and no account/token is created.

Before the first deployment of this version, take a MySQL backup. Startup performs a narrow idempotent migration that drops the legacy unique payment-per-booking and all-status slot constraints, preserving rows and foreign keys. Verify the startup logs, then confirm multiple payment attempts for one booking in MySQL. Once a second attempt exists, recover by rolling forward rather than reverting to code that assumes one payment row per booking.

Turning demo seeding off does not delete existing demo records. Review `backend/src/main/resources/db/demo-data-cleanup.sql` before removing them.

Do not map Railway's raw `MYSQL_URL` variable to the backend. The application constructs the required JDBC URL from the five referenced MySQL variables above. `MYSQL_JDBC_URL` remains available as an override if a different MySQL host is used.

## 4. Deploy and verify the backend

Deploy the Railway backend, generate its public domain, and open:

```text
https://YOUR-RAILWAY-DOMAIN/api/v1/categories
```

With demo data enabled, the response should contain five categories. Also check the Railway deployment logs for a successful database connection and health check.

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
- A new customer receives real phone/email OTP messages and cannot register with a wrong, expired, or reused verification token.
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

- Confirm `DEMO_DATA_ENABLED=true` on the backend service.
- Confirm `DEMO_ACCOUNT_PASSWORD` has at least eight characters.
- Redeploy and inspect the backend startup logs.

### Security reminders

- Never commit `.env.properties`, `.env.local`, database credentials, or JWT secrets.
- Never commit or rotate `KYC_ENCRYPTION_KEY` without a planned data migration; store it only in Railway's secret variables.
- Do not expose the Railway MySQL service publicly unless external database access is specifically required.
- Replace the demonstration password before any public deployment.
- Never expose PayOS credentials in `VITE_` variables or frontend source code.
- Keep Redis private, require TLS/auth where supported, and never expose Twilio, SMTP, or `OTP_PEPPER` values to the frontend.
