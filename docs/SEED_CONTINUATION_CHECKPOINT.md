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

REMAINING: current usable backup and isolated restore; fresh production dry-run;
owner approval for exact dry-run before any production writes; final insertion,
hash/sample-login/dashboard verification. No production writes performed.

ACCESS: Railway OAuth exposed variable names, not values; no local DB config.
Owner ran ProductionDryRun.ps1 successfully after the ACL fix.
Only known backup predates current schema; not a passed current-backup gate.

LATEST owner-reported Railway dry-run: managed practitioners existing=0,
missing=24, missing-schedules=168, conflicts=0; customers existing=0, missing=80,
conflicts=0; dashboard before=88, expected-after=168. Backup age=160.3 hours
blocked writes. These counts are from the owner's completed command, not an
independent production query by the agent. Recheck after the new backup.

NEW backup tooling: BackupAndVerify.ps1 + BackupVerify.js reuse installed MySQL
Shell 26.7.1 and mysql:9.7.2 Docker image. Source credentials stay in process
environment only and never enter Docker. Whole application-schema dump with
consistent/checksum=true; new owner-only timestamp/GUID folder; old backup
untouched. Fresh local restore checks checksum/schema/index/FK metadata, counts,
FK orphans and app CLI read-only schema/dataset inspection. Success marker is
RESTORE_VERIFIED.json; no production writes or restore paths exist.

Test evidence: backup tool syntax PASS; synthetic local MySQL 9.7.2 dump/restore
PASS (8 tables, 8 rows, 6 FKs, checksum/schema match, 0 orphans); remote and
nonempty restore target guards PASS. This is NOT a new production backup pass.
Agent source backup was blocked by TCP timeout (MySQL 2003/10060); independent
TCP probe false, Railway MCP still reports exact public endpoint ACTIVE. Stop
retrying it in this environment. Failed new folders contain only failure logs,
no completed backup; none was used to pass the gate. No old seed tests rerun.
Docker Desktop is now running; local test resources were removed.

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

NEXT_ACTION (owner PowerShell; source reachable in their terminal):

```powershell
cd C:\Temp\beautylink-customer-seed
$env:JAVA_HOME='C:\Program Files\Java\jdk-21.0.11'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
$seedBackupOutput=@(& pwsh -NoProfile -File .\scripts\seed-customers\BackupAndVerify.ps1)
$seedBackupExit=$LASTEXITCODE
$seedBackupOutput
if ($seedBackupExit -ne 0) { throw 'Backup/restore failed; stop before dry-run/apply' }
$seedPathLine=$seedBackupOutput | Where-Object { $_ -like 'BACKUP_PATH=*' } | Select-Object -Last 1
if (-not $seedPathLine) { throw 'Verified backup path missing' }
$seedBackupPath=$seedPathLine.Substring('BACKUP_PATH='.Length)
.\scripts\seed-customers\ProductionDryRun.ps1 -DatabaseHost acela.proxy.rlwy.net -DatabasePort 10050 -DatabaseName railway -BackupPath $seedBackupPath
```

Then inspect RESTORE_VERIFIED.json, SHA256SUMS.json and the fresh dry-run reports
(no rows/secrets) and request explicit approval for the exact production writes.
Do not assume final count=168 if the actual source count has changed. Never
ask for passwords in chat. Keep the same 24/80 manifests and private passwords.

DO_NOT_REPEAT: do not regenerate credentials, reseed a second dataset, rerun
old suites by default, change PayOS/auth, merge main or deploy to run the CLI.
Production write approval: NOT GRANTED; merge into seed branch only was approved.
