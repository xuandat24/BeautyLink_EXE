param(
    [Parameter(Mandatory)] [string]$DatabaseHost,
    [Parameter(Mandatory)] [int]$DatabasePort,
    [Parameter(Mandatory)] [string]$DatabaseName,
    [string]$BackupPath,
    [string]$DatabaseUser = 'root'
)
$ErrorActionPreference = 'Stop'
$seedRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$seedJar = Join-Path $seedRoot 'backend/target/backend-0.0.1-SNAPSHOT.jar'
if (-not (Test-Path -LiteralPath $seedJar)) { throw 'Build the reviewed seed JAR before running this command' }
# NO apply mode. Password is DPAPI-encrypted locally for this Windows user/machine.
$seedPrivate = Join-Path $PSScriptRoot 'private'
$seedConnectionFile = Join-Path $seedPrivate 'railway-production.clixml'
if (Test-Path -LiteralPath $seedConnectionFile) {
    $seedSaved = Import-Clixml -LiteralPath $seedConnectionFile
    if ($seedSaved.Host -ne $DatabaseHost -or $seedSaved.Port -ne $DatabasePort -or $seedSaved.Database -ne $DatabaseName) {
        throw 'Saved connection targets a different database; no connection attempted'
    }
    $seedCredential = $seedSaved.Credential
} else {
    $seedPasswordInput = Read-Host 'Railway MySQL password (hidden; never paste into chat)' -AsSecureString
    $seedCredential = New-Object System.Management.Automation.PSCredential($DatabaseUser, $seedPasswordInput)
    New-Item -ItemType Directory -Path $seedPrivate -Force | Out-Null
    $seedAcl = Get-Acl -LiteralPath $seedPrivate
    $seedOwner = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $seedAcl.SetAccessRuleProtection($true, $false)
    $seedAcl.SetAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($seedOwner,'FullControl','Allow')))
    Set-Acl -LiteralPath $seedPrivate -AclObject $seedAcl
    [pscustomobject]@{Host=$DatabaseHost; Port=$DatabasePort; Database=$DatabaseName; Credential=$seedCredential} |
        Export-Clixml -LiteralPath $seedConnectionFile -NoClobber
    $seedFileAcl = Get-Acl -LiteralPath $seedConnectionFile
    $seedFileAcl.SetAccessRuleProtection($true, $false)
    $seedFileAcl.SetAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($seedOwner,'FullControl','Allow')))
    Set-Acl -LiteralPath $seedConnectionFile -AclObject $seedFileAcl
    Write-Output 'Connection credential saved encrypted in ignored private/ directory'
}
$seedPassword = $seedCredential.Password
$seedKeys = @('MYSQL_JDBC_URL','MYSQL_USERNAME','MYSQL_PASSWORD','SPRING_PROFILES_ACTIVE')
$seedPrevious = @{}
foreach ($seedKey in $seedKeys) { $seedPrevious[$seedKey] = [Environment]::GetEnvironmentVariable($seedKey, 'Process') }
$seedPointer = [IntPtr]::Zero
try {
    $seedPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seedPassword)
    $env:MYSQL_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($seedPointer)
    $env:MYSQL_USERNAME = $seedCredential.UserName
    $env:MYSQL_JDBC_URL = "jdbc:mysql://${DatabaseHost}:${DatabasePort}/${DatabaseName}?sslMode=REQUIRED&allowPublicKeyRetrieval=false&serverTimezone=Asia/Bangkok&characterEncoding=UTF-8&connectTimeout=10000&socketTimeout=20000"
    $env:SPRING_PROFILES_ACTIVE = 'prod'
    $seedMarker = if ($BackupPath) { Join-Path $BackupPath '@.done.json' } else { $null }
    if ($seedMarker -and (Test-Path -LiteralPath $seedMarker)) {
        $seedBackup = Get-Item -LiteralPath $seedMarker
        $seedAgeHours = ((Get-Date).ToUniversalTime() - $seedBackup.LastWriteTimeUtc).TotalHours
        Write-Output ("Backup completion marker: age-hours={0:N1} sha256={1}" -f $seedAgeHours, (Get-FileHash -LiteralPath $seedMarker -Algorithm SHA256).Hash)
        if ($seedAgeHours -gt 24) { Write-Output 'WRITE_GATE_BLOCKED: backup older than 24 hours' }
        else { Write-Output 'BACKUP_METADATA_PRESENT: restore usability still needs verification before write approval' }
    } else { Write-Output 'WRITE_GATE_BLOCKED: backup completion marker missing' }
    Push-Location (Join-Path $seedRoot 'backend')
    try {
        foreach ($seedDataset in @('practitioners','customers')) {
            $seedManifest = Join-Path $PSScriptRoot "$seedDataset.psv"
            & java -jar $seedJar seed-customers "--customer.seed.dataset=$seedDataset" "--customer.seed.manifest=$seedManifest" '--customer.seed.mode=dry-run' '--customer.seed.allow-remote=true' "--customer.seed.expected-host=$DatabaseHost" "--customer.seed.expected-database=$DatabaseName" '--spring.datasource.hikari.read-only=true'
            if ($LASTEXITCODE -ne 0) { throw "Dry-run failed for $seedDataset; no apply attempted" }
        }
    } finally { Pop-Location }
} finally {
    foreach ($seedKey in $seedKeys) { [Environment]::SetEnvironmentVariable($seedKey, $seedPrevious[$seedKey], 'Process') }
    if ($seedPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($seedPointer) }
    $seedPassword.Dispose()
}
