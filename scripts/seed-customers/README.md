# Synthetic CUSTOMER accounts

This tool prepares exactly 60 password-based CUSTOMER identities in the reserved
`bl-customer-001@example.com` … `bl-customer-060@example.com` namespace.
The addresses are not mailboxes. It never sends OTP or calls PayOS. The
passwords are generated independently and stored only in a local file under
`private/`, which Git ignores.

## Actual account model

`user_accounts` stores name, phone, email, gender, birth date, BCrypt hash,
role, status, loyalty points, auth version and timestamps. It has **no**
customer city/address/avatar or persisted email-verification flag. The
30 Hà Nội / 30 Thành phố Hồ Chí Minh split is manifest metadata only; the UI
will not show it as saved profile data. These synthetic identities are
administratively initialized as ACTIVE; they did not receive a real OTP.

## Isolated environment prerequisite

Use a new, disposable MySQL 8.4 database on loopback. Do not point this at a
restore containing customer data. Create its schema with the current backend
application in that isolated environment first; the seed tool forces Hibernate
`ddl-auto=validate` and never creates/alters tables. Keep database credentials
in ignored `backend/.env.properties` or the local process environment, not
on a command line or in Git. Run the commands below from `backend/`.
Java 21 is required.

## Generate private credentials once

```powershell
java ../scripts/seed-customers/GenerateCredentials.java ../scripts/seed-customers/customers.psv ../scripts/seed-customers/private/credentials.psv
```

The generator refuses to overwrite an existing file. Keep the file private,
back it up in an approved secret store if needed, and never commit or paste it
into an issue, CI log, PR, or chat. Reuse **the same file** when recovering a
partial seed; generating new passwords would not match existing accounts.
The tool requires a non-symlink `private/` parent, restricts that directory
and the new file to its owner (POSIX 0700/0600 or Windows owner-only ACL),
and does not print passwords.

## Build, preview, apply, verify

```powershell
mvn --batch-mode --no-transfer-progress verify
java -jar target/backend-0.0.1-SNAPSHOT.jar seed-customers --customer.seed.manifest=../scripts/seed-customers/customers.psv --customer.seed.mode=dry-run
java -jar target/backend-0.0.1-SNAPSHOT.jar seed-customers --customer.seed.manifest=../scripts/seed-customers/customers.psv --customer.seed.credentials=../scripts/seed-customers/private/credentials.psv --customer.seed.mode=apply --customer.seed.confirm-write=CREATE_60_CUSTOMERS
java -jar target/backend-0.0.1-SNAPSHOT.jar seed-customers --customer.seed.manifest=../scripts/seed-customers/customers.psv --customer.seed.credentials=../scripts/seed-customers/private/credentials.psv --customer.seed.mode=verify
```

The seed entry point is reached only with the explicit `seed-customers`
argument. Normal Railway startup never executes it. The CLI has no web server,
payment/email services, scheduled jobs, demo seeder or catalog seeder. Every
write is in one transaction. A conflict aborts the run without overwriting a
user. A repeat run inserts zero records.

By default, the CLI rejects non-loopback MySQL. A separately approved remote
run requires matching `--customer.seed.allow-remote=true` and
`--customer.seed.expected-host=<verified-host>`. A production profile or
Railway environment also requires
`--customer.seed.allow-production=true`; the apply confirmation is still
required. These flags are technical safeguards, not permission to insert into
production. Obtain explicit owner approval, check a usable backup and review
the dry-run conflicts/counts first. Never place a password or secret in flags.

## Read-only checks

Use the current schema names:

```sql
SELECT COUNT(*) AS seeded_count,
       COUNT(DISTINCT email) AS unique_emails,
       COUNT(DISTINCT phone) AS unique_phones,
       SUM(role = 'CUSTOMER') AS customer_count,
       SUM(status = 'ACTIVE') AS active_count,
       SUM(gender IS NOT NULL AND date_of_birth IS NOT NULL) AS complete_profile_count,
       SUM(HEX(LEFT(password_hash,2)) = '2432' AND CHAR_LENGTH(password_hash) = 60) AS bcrypt_count
FROM user_accounts
WHERE email REGEXP '^bl-customer-(00[1-9]|0[1-5][0-9]|060)@example[.]com$';
```

Expected numbers are 60 in each count **after** apply. The narrower
`001`–`060` identity list is checked by the CLI. Email verification is not
a column and cannot be counted in SQL. Use the isolated HTTP test to verify
normal `/api/v1/auth/login`, `/api/v1/auth/me` and
`/api/v1/bookings/mine` for all 60; an ACTIVE row alone is insufficient.
For the isolated HTTP check, start the backend against the same disposable
MySQL database with an isolated JWT secret and a test-only login rate limit
above 120. Then run:

```powershell
node ../scripts/seed-customers/verify-accounts.mjs http://127.0.0.1:18080 ../scripts/seed-customers/customers.psv ../scripts/seed-customers/private/credentials.psv
```

If the test API is on a Docker `--internal` network without a host port,
run this same script in a disposable Node container joined to that network;
set `CUSTOMER_SEED_TEST_HOST` to the exact test API container name (which
must start with `beautylink-customer-api-`). Mount this directory read-only
as `/work` and use `http://<test-api-container>:8080`. The verifier rejects
other remote hosts, performs only login and GET requests, and prints
aggregate counts, never tokens or passwords. This is a local integration
check, not a live production login claim.

## Safe cleanup

No cleanup runs automatically. In a disposable local test database, stop the
test application, verify that none of the 60 exact reserved IDs has booking,
review, payment or other references, then discard the **entire dedicated
test container/database**. Never use a broad `DELETE ... LIKE` against a
shared or production database. For a shared environment, prepare a separate,
reviewed cleanup that targets explicit IDs only after checking dependencies
and backup; this task does not supply a production deletion command.
