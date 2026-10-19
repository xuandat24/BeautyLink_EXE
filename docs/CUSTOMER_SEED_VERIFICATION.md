# CUSTOMER seed verification

## Continuation: 80 customers and 24 managed DEMO practitioners — 19 October 2026

Original seed commit: `a0ae4701828fd3d0b1b6b04f25775c0dd9b381d4`.
Current main `52735beb36139a21a561a1b4ecdc2ab6f062c7ed` was merged into the
same seed branch as `818bab53dceb12e872f3c6c10d17dc9b85a1c56d` to use the
existing Google identity and practitioner service-assignment model.
Authentication, booking, PayOS and frontend code were not edited by this seed work.

- Target: 80 total managed CUSTOMER identities, not 80 in addition to 60.
- Names, gender, birth dates and indexes 001–060 retained; desired email/phone
  formats improved. Legacy persisted identities are recognized and never renamed.
- 20 profiles added; final city metadata is 40/40, with the original 30/30 intact.
- New private file `credentials-080.psv`: **60 old passwords preserved,
  20 generated**. Original file SHA was compared before/after and unchanged.
- 24 practitioners use explicit DEMO bio markers and supplier/service assignments.
  Unmarked workforce remains outside the managed set.
- Focused Java 21 Maven verify: **9 tests PASS**, 0 failures/errors/skips,
  completed 19 October 2026 at 12:44 +07:00. Log:
  `backend/target/seed-80-practitioner-24.log` (local, not committed).
  H2 isolated integration evidence: 80 ACTIVE CUSTOMER profiles and hashes,
  160 email/phone logins and 160 authenticated profile reads, all 80 empty
  booking histories; repeated apply inserts zero; 60 legacy identities retain
  their hashes and only 20 are added. The legacy test also checks one login.
  Practitioner tests inspect all 24 assignments, seven-day schedules and actual
  availability including break exclusion, idempotency and missing-supplier refusal.
  These are Spring/MockMvc/H2 tests, **not new MySQL or production HTTP evidence**.
  Java packaging, PowerShell syntax and JS syntax checks PASS. Historical
  results below describe the original 60-account implementation only.
- Railway production project/environment/MySQL identified through read-only MCP;
  deployed backend SHA matches main above. OAuth returns variable names only.
  No local DB connection configuration exists, so production counts/collisions/
  schema validation and dashboard count remain **NOT VERIFIED**.
- Only the backup dated 12 October is currently visible locally; it predates
  recent schema changes. A current usable backup gate is **BLOCKED**.
- Production write approval has **not** been requested or granted for a verified
  dry-run. No production insert, merge or deployment was performed.

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
