# Managed seed datasets

This is the existing customer seed CLI extended to **80 CUSTOMER accounts**
and **24 managed DEMO practitioners**. Normal backend startup never runs
either dataset. There is no schema migration or public seed endpoint.

## Customers and credentials

`customers.psv` retains indexes 001–060 and their names, gender and birth dates;
061–080 are additions. All phone numbers are synthetic, unique and ten digits,
using 032/056/070/081/090 (16 per prefix). These are valid formats, not proof
that the numbers are unassigned. Never send SMS or call these test numbers.
Name-based emails use the reserved non-deliverable `seed.beautylink.test`
domain. Numeric suffixes are generated once and committed in the manifest.

The first 60 retain their 30 Hanoi / 30 HCM metadata; the final manifest has
40/40. UserAccount has no city/address/avatar/email-verified column. No city
is persisted and no OTP delivery is fabricated. Google external identities
are not created; these accounts use BCrypt passwords.

Keep the original `private/credentials.psv` unchanged. Create a NEW file,
preserving every password by index and generating only missing entries:

```powershell
# From backend/, Java 21
java ../scripts/seed-customers/GenerateCredentials.java ../scripts/seed-customers/customers.psv ../scripts/seed-customers/private/credentials-080.psv ../scripts/seed-customers/private/credentials.psv
```

The generator refuses overwrites and protects the directory/file with
owner-only permissions. Both credential files and any encrypted DB connection
file stay Git-ignored. Do not print or commit them. Existing legacy
`bl-customer-001@example.com` through 060 and their original phones are
recognized by stable index and kept unchanged. If both legacy and new
identities exist for an index, the run fails closed rather than creating a
second batch or renaming accounts.

## Practitioners

`practitioners.psv` maps 24 distinct Vietnamese names to existing supplier
slugs. Each managed person has the exact bio marker
`DEMO BeautyLink [bl-practitioner-001]` … `024`. Unmarked catalog/real
workforce is not adopted, counted as managed, renamed, or rescheduled.
The target is 24 **managed** people; total workforce can be greater.

Suppliers must already be VERIFIED and have active services. New managed
practitioners have explicit restricted service assignments to those services.
Default schedule: Monday–Saturday 09:00–19:00, break 12:00–13:00, 30-minute
steps; Sunday inactive. Existing valid managed schedules are retained and
only absent days are inserted. Invalid/conflicting data blocks apply.
Supplier rows serialize repeated CLI execution. All writes roll back together.

## Local dry-run, apply and verify

Use a disposable isolated database with the current approved schema.
The CLI forces Hibernate `validate` and has no normal application seeders,
schedulers, email or payment services. Supply DB credentials in local process
environment or ignored local configuration, never command-line arguments.

```powershell
mvn --batch-mode --no-transfer-progress "-Dtest=PractitionerSeedTest,CustomerSeedIntegrationTest,CustomerSeedSafetyTest" verify
java -jar target/backend-0.0.1-SNAPSHOT.jar seed-customers --customer.seed.dataset=practitioners --customer.seed.manifest=../scripts/seed-customers/practitioners.psv --customer.seed.mode=dry-run
java -jar target/backend-0.0.1-SNAPSHOT.jar seed-customers --customer.seed.dataset=practitioners --customer.seed.manifest=../scripts/seed-customers/practitioners.psv --customer.seed.mode=apply --customer.seed.confirm-write=CREATE_24_PRACTITIONERS
java -jar target/backend-0.0.1-SNAPSHOT.jar seed-customers --customer.seed.manifest=../scripts/seed-customers/customers.psv --customer.seed.mode=dry-run
java -jar target/backend-0.0.1-SNAPSHOT.jar seed-customers --customer.seed.manifest=../scripts/seed-customers/customers.psv --customer.seed.credentials=../scripts/seed-customers/private/credentials-080.psv --customer.seed.mode=apply --customer.seed.confirm-write=CREATE_80_CUSTOMERS
java -jar target/backend-0.0.1-SNAPSHOT.jar seed-customers --customer.seed.manifest=../scripts/seed-customers/customers.psv --customer.seed.credentials=../scripts/seed-customers/private/credentials-080.psv --customer.seed.mode=verify
```

The customer CLI reports the real CUSTOMER count and expected new count,
not a hardcoded dashboard number. Every existing managed identity is checked;
existing passwords/status/profile are never reset. Unique DB constraints
roll back a racing insert.

## Production read-only checkpoint

`ProductionDryRun.ps1` has **no apply mode**. Run it as the Windows owner.
It prompts for the DB password locally and stores only a DPAPI-encrypted,
owner-only connection file under `private/` (same Windows user/machine).
A saved connection is refused if host/port/schema differ. It runs both
dry-runs using TLS and read-only connections, validates the current schema,
and reports backup metadata. It does not prove restoration from a marker alone.

```powershell
./scripts/seed-customers/ProductionDryRun.ps1 -DatabaseHost <verified-host> -DatabasePort <verified-port> -DatabaseName <verified-schema> -BackupPath <current-completed-backup-folder>
```

Remote CLI runs require exact `customer.seed.expected-host` **and**
`customer.seed.expected-database` plus `allow-remote=true`.
Production apply additionally requires `allow-production=true` and the
dataset-specific write confirmation. Obtain owner approval for the exact
dry-run and a current usable backup before any production apply. No merge
or deployment is required to run this CLI locally.

## Verification and cleanup

`verify-accounts.mjs` tests 80 logins by email and phone, own profiles and
empty booking histories on a loopback or explicitly named internal Docker
test API. Do not run all-account HTTP login checks on production or weaken
its rate limits. Production verification uses all 80 stored hashes and a
separately approved small HTTP sample.

```powershell
node ../scripts/seed-customers/verify-accounts.mjs http://127.0.0.1:18080 ../scripts/seed-customers/customers.psv ../scripts/seed-customers/private/credentials-080.psv
```

Never delete a shared/production dataset with broad LIKE SQL. Cleanup needs
explicit managed IDs, reference checks, backup and approval. A disposable
local test database can be discarded after verification; the manifest and
same credential file can recreate it.

Phone prefix references: [Viettel 032](https://www.vietteltelecom.vn/tin-tuc/tin-dich-vu/bi-quyet-chon-sim-so-dep-viettel-ban-co-biet/19762220),
[Vietnamobile 056](https://www.vietnamobile.com.vn/index.php/tracuutttb),
[MobiFone 070/090](https://noidungsohanoi.mobifone.vn/cach-chon-so-mobifone),
[VinaPhone 081](https://vinaphone.com.vn/english/news/sim-012-doi-thanh-dau-so-nao-mang-vinaphone.html).
