param(
    [string]$BackupRoot = 'D:\BeautyLinkBackups',
    [string]$MySqlShell = 'D:\MySQL\resources\app\shell\bin\mysqlsh.exe',
    [string]$ExpectedHost = 'acela.proxy.rlwy.net',
    [int]$ExpectedPort = 10050,
    [string]$ExpectedDatabase = 'railway'
)
$ErrorActionPreference = 'Stop'
# Reuse the reviewed DACL helper only; do not execute ProductionDryRun.ps1.
$seedTokens=$null; $seedErrors=$null
$seedAst=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'ProductionDryRun.ps1'),[ref]$seedTokens,[ref]$seedErrors)
if ($seedErrors.Count) { throw 'ACL helper script syntax error' }
$seedFunction=$seedAst.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Set-SeedPrivateAccess'},$false)
. ([scriptblock]::Create($seedFunction.Extent.Text))
$seedConnection=Join-Path $PSScriptRoot 'private/railway-production.clixml'
Set-SeedPrivateAccess -LiteralPath $seedConnection
$seedSaved=Import-Clixml -LiteralPath $seedConnection
if ($seedSaved.Host -ne $ExpectedHost -or $seedSaved.Port -ne $ExpectedPort -or $seedSaved.Database -ne $ExpectedDatabase) { throw 'Saved database identity differs; no backup attempted' }
if (-not (Test-Path -LiteralPath $MySqlShell)) { throw 'Installed MySQL Shell missing' }
& docker version --format '{{.Server.Version}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop to enable isolated restore verification' }
& docker image inspect mysql:9.7.2 --format '{{.Id}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Matching local mysql:9.7.2 image required; no cloud resource will be created' }
$seedId=(Get-Date -Format 'yyyyMMdd_HHmmss')+'_'+[guid]::NewGuid().ToString('N').Substring(0,8)
$seedFolder=Join-Path $BackupRoot ('beautylink_before_seed_'+$seedId)
if (Test-Path -LiteralPath $seedFolder) { throw 'Backup path already exists; never overwrite' }
New-Item -ItemType Directory -Path $seedFolder | Out-Null
Set-SeedPrivateAccess -LiteralPath $seedFolder
$seedDump=Join-Path $seedFolder 'dump'
$seedSourceReport=Join-Path $seedFolder 'source-schema.json'
$seedScript=Join-Path $PSScriptRoot 'BackupVerify.js'
$seedContainer='bl-restore-'+$seedId.Replace('_','-')
$seedNetwork=$seedContainer+'-net'
$seedContainerMade=$false; $seedNetworkMade=$false
$seedPointer=[IntPtr]::Zero
$seedKeys=@('BL_BACKUP_MODE','BL_BACKUP_SCHEMA','BL_BACKUP_HOST','BL_BACKUP_PORT','BL_BACKUP_USER','BL_BACKUP_PASSWORD','BL_BACKUP_DUMP','BL_BACKUP_SOURCE_REPORT','MYSQL_ROOT_PASSWORD','MYSQL_ROOT_HOST','MYSQL_JDBC_URL','MYSQL_USERNAME','MYSQL_PASSWORD','SPRING_PROFILES_ACTIVE')
$seedPrevious=@{}
foreach ($seedKey in $seedKeys) { $seedPrevious[$seedKey]=[Environment]::GetEnvironmentVariable($seedKey,'Process') }
function Invoke-BackupShell([string]$Phase,[string]$Prefix) {
    $seedLog=Join-Path $seedFolder ($Phase+'.log')
    & $MySqlShell --js --quiet-start=2 --file=$seedScript *> $seedLog
    if ($LASTEXITCODE -ne 0) { throw "Backup $Phase failed; private log: $seedLog. No production writes attempted." }
    $seedMatch=Select-String -LiteralPath $seedLog -Pattern ('^'+$Prefix+'=(.+)$')
    if ($seedMatch.Count -ne 1) { throw "Missing $Phase verification result" }
    return ($seedMatch.Matches[0].Groups[1].Value | ConvertFrom-Json)
}
try {
    $seedPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($seedSaved.Credential.Password)
    $env:BL_BACKUP_PASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($seedPointer)
    $env:BL_BACKUP_MODE='dump'; $env:BL_BACKUP_SCHEMA=$ExpectedDatabase
    $env:BL_BACKUP_HOST=$ExpectedHost; $env:BL_BACKUP_PORT=[string]$ExpectedPort
    $env:BL_BACKUP_USER=$seedSaved.Credential.UserName; $env:BL_BACKUP_DUMP=$seedDump
    Write-Output 'Creating a new consistent schema/data backup with checksums; production is read only.'
    $seedSource=Invoke-BackupShell 'dump' 'BL_BACKUP_RESULT'
    $seedSource | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $seedSourceReport -Encoding UTF8
    if (-not (Test-Path -LiteralPath (Join-Path $seedDump '@.done.json')) -or -not (Test-Path -LiteralPath (Join-Path $seedDump '@.checksums.json'))) { throw 'Backup completion/checksum metadata missing' }
    $seedFiles=Get-ChildItem -LiteralPath $seedDump -File -Recurse | ForEach-Object {
        [pscustomobject]@{File=$_.FullName.Substring($seedDump.Length+1); Length=$_.Length; SHA256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
    }
    $seedFiles | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $seedFolder 'SHA256SUMS.json') -Encoding UTF8
    # No source credentials enter Docker. This fresh local root password is ephemeral.
    $env:BL_BACKUP_PASSWORD=$null
    $env:MYSQL_ROOT_PASSWORD=[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N')
    $env:MYSQL_ROOT_HOST='%'
    # Dedicated local bridge: Docker 29 internal networks do not publish ports.
    # Only 127.0.0.1 is published; no production connection/secret enters it.
    & docker network create $seedNetwork | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create isolated local network' }; $seedNetworkMade=$true
    & docker run -d --pull=never --name $seedContainer --network $seedNetwork --publish '127.0.0.1::3306' --env MYSQL_ROOT_PASSWORD --env MYSQL_ROOT_HOST --tmpfs '/var/lib/mysql:rw,noexec,nosuid,size=512m' mysql:9.7.2 --local-infile=ON --event-scheduler=OFF --skip-log-bin | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create isolated local restore container' }; $seedContainerMade=$true
    $seedReady=$false
    for ($seedTry=0; $seedTry -lt 45; $seedTry++) {
        & docker exec $seedContainer sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -Nse "SELECT 1"' 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $seedReady=$true; break }
        Start-Sleep -Seconds 2
    }
    if (-not $seedReady) { throw 'Local restore MySQL did not become ready' }
    $seedPortLine=(& docker port $seedContainer 3306/tcp).Trim()
    if ($seedPortLine -notmatch '^127\.0\.0\.1:(\d+)$') { throw 'Restore port is not loopback-only' }
    $seedPort=[int]$Matches[1]
    Write-Output "Restoring only to isolated 127.0.0.1:$seedPort (MySQL 9.7.2); never to Railway."
    $env:BL_BACKUP_MODE='restore'; $env:BL_BACKUP_HOST='127.0.0.1'; $env:BL_BACKUP_PORT=[string]$seedPort
    $env:BL_BACKUP_USER='root'; $env:BL_BACKUP_PASSWORD=$env:MYSQL_ROOT_PASSWORD
    $env:BL_BACKUP_SOURCE_REPORT=$seedSourceReport
    $seedResult=Invoke-BackupShell 'restore' 'BL_RESTORE_RESULT'
    foreach ($seedFile in $seedFiles) {
        if ((Get-FileHash -LiteralPath (Join-Path $seedDump $seedFile.File) -Algorithm SHA256).Hash -ne $seedFile.SHA256) { throw 'Backup file hash changed during verification' }
    }
    # Application schema validation and read-only manifest inspections on restored data.
    $env:MYSQL_JDBC_URL="jdbc:mysql://127.0.0.1:$seedPort/${ExpectedDatabase}?sslMode=REQUIRED&allowPublicKeyRetrieval=false&serverTimezone=Asia/Bangkok"
    $env:MYSQL_USERNAME='root'; $env:MYSQL_PASSWORD=$env:MYSQL_ROOT_PASSWORD; $env:SPRING_PROFILES_ACTIVE='prod'
    $seedJar=Join-Path $PSScriptRoot '../../backend/target/backend-0.0.1-SNAPSHOT.jar'
    foreach ($seedDataset in @('practitioners','customers')) {
        $seedManifest=Join-Path $PSScriptRoot "$seedDataset.psv"
        & java -jar $seedJar seed-customers "--customer.seed.dataset=$seedDataset" "--customer.seed.manifest=$seedManifest" '--customer.seed.mode=dry-run' '--spring.datasource.hikari.read-only=true' *> (Join-Path $seedFolder "app-read-$seedDataset.log")
        if ($LASTEXITCODE -ne 0) { throw "Application read/schema validation failed for $seedDataset; see private backup log" }
    }
    $seedResult | Add-Member -NotePropertyName ApplicationRead -NotePropertyValue 'PASS'
    $seedResult | Add-Member -NotePropertyName CompletedUtc -NotePropertyValue ([DateTime]::UtcNow.ToString('o'))
    $seedResult | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $seedFolder 'RESTORE_VERIFIED.json') -Encoding UTF8
    Write-Output ("PASS backup/restore: tables={0} foreign-keys={1} orphans=0 customers={2}; checksum/schema/app-read PASS" -f $seedResult.tableCount,$seedResult.foreignKeysChecked,$seedResult.customers)
    Write-Output "BACKUP_PATH=$seedDump"
} finally {
    # Exact freshly created local resources only. No volumes/shared databases deleted.
    if ($seedContainerMade) { & docker rm -f $seedContainer | Out-Null }
    if ($seedNetworkMade) { & docker network rm $seedNetwork | Out-Null }
    foreach ($seedKey in $seedKeys) { [Environment]::SetEnvironmentVariable($seedKey,$seedPrevious[$seedKey],'Process') }
    if ($seedPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($seedPointer) }
    $seedSaved.Credential.Password.Dispose()
}
