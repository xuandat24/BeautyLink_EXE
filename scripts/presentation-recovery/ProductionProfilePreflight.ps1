[CmdletBinding()]
param(
    [string]$ConnectionFile = 'C:\Temp\beautylink-customer-seed\scripts\seed-customers\private\railway-production.clixml',
    [string]$JavaHome = 'C:\Program Files\Java\jdk-21.0.11',
    [string]$MavenCommand = 'mvn'
)
$ErrorActionPreference = 'Stop'
$profileRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$profileBackend = Join-Path $profileRoot 'backend'
$profileJava = Join-Path $JavaHome 'bin/java.exe'
$profileJavac = Join-Path $JavaHome 'bin/javac.exe'
if (!(Test-Path -LiteralPath $profileJava) -or !(Test-Path -LiteralPath $profileJavac)) { throw 'Java 21 JDK is required' }
$profileOldJava = $env:JAVA_HOME
$profileOldUrl = [Environment]::GetEnvironmentVariable('MYSQL_PUBLIC_URL', 'Process')
$profileConnection = $null
$profileCredential = $null
Push-Location $profileBackend
try {
    # Compile only; never executes a seeder, starts Spring, or invokes production writes.
    $env:JAVA_HOME = $JavaHome
    & $MavenCommand --batch-mode --no-transfer-progress -DskipTests compile dependency:build-classpath '-Dmdep.outputFile=target/display-classpath.txt' '-Dmdep.includeScope=test'
    if ($LASTEXITCODE) { throw 'Maven preparation failed' }
    $profileJars = (Get-Content target/display-classpath.txt -Raw).Trim() -split ';' | Where-Object { $_ -match 'jackson-|mysql-connector' }
    $profileCp = 'target/classes;target/display-tools;' + ($profileJars -join ';')
    New-Item -ItemType Directory -Force target/display-tools | Out-Null
    $profileSources = @('RecoveryStore', 'DisplayProfileStore', 'DisplayProfileRevisionStore', 'VerifiedBackupEvidence', 'PartnerActivationStore') | ForEach-Object { Join-Path $PSScriptRoot ($_ + '.java') }
    & $profileJavac -cp $profileCp -d target/display-tools @profileSources
    if ($LASTEXITCODE) { throw 'Operator tool compilation failed' }
    $profilePrivate = Join-Path $profileBackend ('target/private-profile-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $profilePrivate | Out-Null
    # Fresh DACL only: do not copy SACL/owner/audit rules or require SeSecurityPrivilege.
    $profileSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $profileAcl = [System.Security.AccessControl.DirectorySecurity]::new()
    $profileAcl.SetAccessRuleProtection($true, $false)
    $profileAcl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($profileSid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
    [System.IO.FileSystemAclExtensions]::SetAccessControl([System.IO.DirectoryInfo]::new($profilePrivate), $profileAcl)
    $profileConnection = Import-Clixml -LiteralPath $ConnectionFile
    if ($profileConnection.Host -ne 'acela.proxy.rlwy.net' -or $profileConnection.Port -ne 10050 -or $profileConnection.Database -ne 'railway') { throw 'Unexpected target; stop and verify project/environment' }
    if ($profileConnection.Credential -isnot [System.Management.Automation.PSCredential]) { throw 'Existing owner DPAPI credential is unavailable' }
    $profileCredential = $profileConnection.Credential.GetNetworkCredential()
    $env:MYSQL_PUBLIC_URL = 'mysql://' + [Uri]::EscapeDataString($profileCredential.UserName) + ':' + [Uri]::EscapeDataString($profileCredential.Password) + '@acela.proxy.rlwy.net:10050/railway'
    $profileSource = Join-Path $profilePrivate 'source.json'
    $profileDisplay = Join-Path $profilePrivate 'display-plan.json'
    $profileActivation = Join-Path $profilePrivate 'activation-plan.json'
    & $profileJava -cp $profileCp DisplayProfileRevisionStore export $profileSource
    if ($LASTEXITCODE) { throw 'Read-only inventory failed' }
    & $profileJava -cp $profileCp DisplayProfileRevisionStore plan $profileSource $profileDisplay
    if ($LASTEXITCODE) { throw 'Display planning failed' }
    & $profileJava -cp $profileCp PartnerActivationStore plan $profileSource $profileActivation
    if ($LASTEXITCODE) { throw 'Activation planning failed' }
    & $profileJava -cp $profileCp DisplayProfileRevisionStore check $profileDisplay
    if ($LASTEXITCODE) { throw 'Display source changed/conflict; review new inventory before approval' }
    & $profileJava -cp $profileCp PartnerActivationStore check $profileActivation
    if ($LASTEXITCODE) { throw 'Activation source changed/conflict; review new inventory before approval' }
    Write-Host ('PRIVATE_REPORT_PATH=' + $profilePrivate)
    Write-Host 'READ ONLY. No apply. Review targets/impact; current verified backup and separate owner approval are required.'
} finally {
    [Environment]::SetEnvironmentVariable('MYSQL_PUBLIC_URL', $profileOldUrl, 'Process')
    $env:JAVA_HOME = $profileOldJava
    $profileCredential = $null
    $profileConnection = $null
    Pop-Location
}
