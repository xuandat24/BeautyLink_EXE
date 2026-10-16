# CUSTOMER seed verification

Analyzed source: `main` at `a2601072d11a6464c5cd7da0d4d553683ccec9fd`.
Working branch: `codex/seed-60-customers`.

## Model and intended values

| Entity field | Database column | Type | Required | Validation / seed value |
| --- | --- | --- | --- | --- |
| id | id | BIGINT identity | Yes | DB-generated, never supplied |
| fullName | full_name | VARCHAR(120) | Yes | 60 unique Vietnamese names, letters/spaces |
| phone | phone | VARCHAR(20), unique | Yes | `0390000001`–`0390000060`; collision checked |
| email | email | VARCHAR(160), unique | Optional in entity, required by registration | `bl-customer-001@example.com`–`060` |
| gender | gender | ENUM('FEMALE','MALE','OTHER') | Optional in entity, required by registration | MALE/FEMALE/OTHER from manifest |
| dateOfBirth | date_of_birth | DATE | Optional in entity, required by registration | valid adult birth date |
| passwordHash | password_hash | VARCHAR(255) | Yes | BCrypt from generated unique local password |
| authVersion | auth_version | INT | Yes | 0 (entity default) |
| role | role | ENUM('ADMIN','CUSTOMER','STAFF','SUPPLIER') | Yes | CUSTOMER |
| status | status | ENUM('ACTIVE','DISABLED','SUSPENDED') | Yes | ACTIVE |
| loyaltyPoints | loyalty_points | INT | Yes | 0 (entity default) |
| createdAt | created_at | DATETIME(6) | Yes | entity creation time |
| updatedAt | updated_at | DATETIME(6) | Yes | entity creation time, updated by entity listener |

`UserAccount` has no customer city, address, avatar, email verification
timestamp/flag, Google provider ID, or locked flag. City distribution exists
only in the committed synthetic manifest (30 Hanoi, 30 HCM). Normal customer
registration consumes a valid email OTP registration token before saving an
ACTIVE account; this offline administrative seed does not forge OTP events.
Authentication accepts ACTIVE users with a valid BCrypt hash, issues JWT
with phone/account ID/auth version and exposes `/api/v1/auth/me`.

## Execution evidence — 16 October 2026

Environment: new disposable `mysql:8.4` Docker container
`beautylink-customer-seed-20261016`, database `beautylink_seed_test`,
bound only to `127.0.0.1:3308`. The backend ran in a separate Java 21
container on an isolated Docker network without internet egress. No Railway
database, production account, Resend or PayOS credential was used.
Credentials remain in ignored `scripts/seed-customers/private/credentials.psv`.
Local logs are under ignored `backend/target/customer-seed-*.log`.
The `private/` directory and credential file have Windows owner-only ACLs.
ACL probe files were removed after verifying that the generator applies
this restriction.

| Check | Result | Evidence |
| --- | --- | --- |
| Isolated DB target | PASS | MySQL 8.4.11, loopback port 3308; separate internal API network |
| Dry-run / conflicts | PASS | existing 0, missing 60, conflicts 0, no writes |
| Inserted / existing / skipped | PASS | first apply: inserted 60, existing 0; second apply: inserted 0, existing/skipped 60 |
| 60 unique emails and phones | PASS | MySQL aggregate: 60 / 60 / 60 |
| ACTIVE / CUSTOMER / complete profiles | PASS | MySQL aggregate: 60 / 60 / 60 |
| BCrypt hashes and timestamps | PASS | MySQL aggregate: 60 / 60; CLI matched all 60 plaintext credentials to stored hashes |
| Login + fresh session for all 60 | PASS | isolated Docker API: 120 successful logins (email and phone for every account) |
| Profile API for all 60 | PASS | 120 matching profile reads, distinct account IDs; anonymous profile request got 401 |
| Customer booking history | PASS | 60 authenticated empty histories; no bookings created |
| Foreign-key references | PASS in isolated DB | Seeded `user_accounts` has no outbound FK; zero bookings/OTP challenges reference the new identities |
| Second apply adds zero | PASS | existing 60, inserted 0, conflicts 0 |
| Missing write confirmation | PASS | apply without confirmation exited with expected denial |
| Partial dataset recovery | PASS in H2 test | Deleting one synthetic account then reapplying inserted exactly one; other password hash stayed unchanged |
| Local credential security | PASS | Git ignored the file; current and freshly generated probe files had owner-only Windows ACL |
| Existing real accounts unchanged | PASS in isolated DB | Database was empty before seed; conflict test proved an unrelated account is untouched. Not a production-data claim. |
| Email OTP ownership proof | NOT VERIFIED | No email-verification column exists and synthetic `example.com` addresses do not receive OTP. Administrative seed is intentionally ACTIVE. |
| Backend full regression | PASS | Java 21 `mvn --batch-mode --no-transfer-progress verify`: 323 tests, 0 failures/errors/skips, JAR built. After correcting synthetic manifest gender data, the 6 affected seed/safety tests were rerun and passed. |
| Frontend regression | PASS | `npm ci`, 48 tests, `npm run lint`, `npm run build`; existing bundle-size/dependency comment warnings only |
| Production DB | NOT RUN | Separate explicit owner approval required |

After all HTTP checks, an aggregate query again returned 60 for total,
distinct emails, distinct phones, CUSTOMER, ACTIVE, complete profiles, BCrypt
shape and timestamps. Seeded accounts had zero bookings and zero OTP
challenges. The API test container logged no ERROR/Exception. Test profile
city is manifest-only; it cannot be verified as a database or API field.

The current source contains no Google Sign-In/provider identity field or
Google authentication path. A future change adding one should trigger a
fresh compatibility check before using this seed against that version.
