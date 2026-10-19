# Seed continuation checkpoint — 19 October 2026

Branch: `codex/seed-60-customers`.
Original implemented seed: `a0ae4701828fd3d0b1b6b04f25775c0dd9b381d4`.
Main incorporated: `52735beb36139a21a561a1b4ecdc2ab6f062c7ed`.
Merge HEAD before continuation commit: `818bab53dceb12e872f3c6c10d17dc9b85a1c56d`.
Use Git for the current HEAD; do not reset to these historical checkpoints.

DONE: reuse CLI for 80 customers, stable indexes/legacy identity handling;
24 marked DEMO practitioners with service assignments and missing-day schedules;
private credentials-080.psv preserves 60 passwords, generates 20, original intact.
No schema/auth/payment/frontend changes. Documentation and read-only production
dry-run script prepared. Private connection/credential files are ignored.

TESTS: Java 21 focused Maven verify 9/9 PASS, package PASS;
80-customer Spring/MockMvc/H2 evidence includes 160 logins/profile reads and
all 80 histories; legacy partial recovery and idempotency PASS.
All 24 practitioner assignment/schedule/availability checks PASS.
PowerShell parser and node --check PASS. See CUSTOMER_SEED_VERIFICATION.md.
Prior 60-account MySQL/full-suite evidence remains historical, not 80-account
MySQL/production evidence. No frontend files changed; no full-suite rerun needed.

REMAINING: real Railway counts/collisions/schema dry-run; current usable backup;
owner approval for exact dry-run before any production writes; final insertion,
hash/sample-login/dashboard verification. No production writes performed.

ACCESS: Railway OAuth exposed variable names, not values; no local DB config.
Owner was asked to run ProductionDryRun.ps1 once with hidden password entry.
Only known backup predates current schema; not a passed current-backup gate.

ACL follow-up: owner run stopped at Set-Acl before exporting the DB credential
or connecting. Reproduced PrivilegeNotHeldException on a synthetic protected
directory (DACL protected, audit unprotected, no loaded audit rules).
Replaced Set-Acl descriptor copying with fresh DACL-only .NET persistence;
owner/SACL are not written. Single current-owner SID rule, protected DACL,
owner/content verification, inherited owner-only access for new children.
Existing connection files are protected before import, not skipped.
Standalone TestPrivateAcl.ps1 PASS in non-admin Windows PowerShell
5.1.26100.9711 and PowerShell 7.6.5: syntax, directory/file permissions,
repeat, child inheritance, owner/content unchanged, missing-path fail closed.
No production connection, credential read/export, DB write, or old seed tests
were executed for this ACL correction. The 80/24 datasets remain unchanged.

NEXT_ACTION (owner PowerShell, Java 21):

```powershell
cd C:\Temp\beautylink-customer-seed
.\scripts\seed-customers\ProductionDryRun.ps1 -DatabaseHost acela.proxy.rlwy.net -DatabasePort 10050 -DatabaseName railway -BackupPath D:\BeautyLinkBackups\beautylink_before_resend
```

Then inspect only the dry-run reports (no secrets), establish current backup,
and request explicit approval for the exact production writes. If the owner
has already run the command, reuse the ignored DPAPI connection as the same
Windows user; never ask for passwords in chat.

DO_NOT_REPEAT: do not regenerate credentials, reseed a second dataset, rerun
old suites by default, change PayOS/auth, merge main or deploy to run the CLI.
Production write approval: NOT GRANTED; merge into seed branch only was approved.
