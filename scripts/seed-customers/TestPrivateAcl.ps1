# Standalone ACL regression: no DB, credentials, Java or network access.
$ErrorActionPreference = 'Stop'
$seedScript = Join-Path $PSScriptRoot 'ProductionDryRun.ps1'
$seedTokens = $null
$seedErrors = $null
$seedAst = [Management.Automation.Language.Parser]::ParseFile($seedScript, [ref]$seedTokens, [ref]$seedErrors)
if ($seedErrors.Count) { throw ($seedErrors | Out-String) }
$seedFunction = $seedAst.Find({ param($node)
    $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Set-SeedPrivateAccess'
}, $false)
if ($null -eq $seedFunction) { throw 'ACL helper missing' }
# Load only the actual helper, never execute the production script.
. ([scriptblock]::Create($seedFunction.Extent.Text))
$seedIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$seedPrincipal = New-Object Security.Principal.WindowsPrincipal($seedIdentity)
if ($seedPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this regression without Administrator elevation'
}
$seedTemp = Join-Path ([IO.Path]::GetTempPath()) ('beautylink-acl-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $seedTemp | Out-Null
try {
    $seedOwnerBefore = (Get-Acl -LiteralPath $seedTemp).Owner
    Set-SeedPrivateAccess -LiteralPath $seedTemp
    Set-SeedPrivateAccess -LiteralPath $seedTemp # Protected DACL reproduces old Set-Acl failure.
    $seedFile = Join-Path $seedTemp 'synthetic.txt'
    [IO.File]::WriteAllText($seedFile, 'ACL regression fixture, not a credential')
    $seedInherited = (Get-Acl -LiteralPath $seedFile).GetAccessRules(
        $true, $true, [Security.Principal.SecurityIdentifier])
    if ($seedInherited.Count -ne 1 -or $seedInherited[0].IdentityReference -ne $seedIdentity.User) {
        throw 'New child did not inherit owner-only access'
    }
    $seedHashBefore = (Get-FileHash -LiteralPath $seedFile -Algorithm SHA256).Hash
    Set-SeedPrivateAccess -LiteralPath $seedFile
    Set-SeedPrivateAccess -LiteralPath $seedFile
    if ((Get-FileHash -LiteralPath $seedFile -Algorithm SHA256).Hash -ne $seedHashBefore -or
        (Get-Acl -LiteralPath $seedTemp).Owner -ne $seedOwnerBefore -or
        (Get-Acl -LiteralPath $seedFile).Owner -ne $seedOwnerBefore) {
        throw 'ACL update changed fixture content or ownership'
    }
    $seedMissing = Join-Path $seedTemp 'absent.txt'
    $seedRejected = $false
    try { Set-SeedPrivateAccess -LiteralPath $seedMissing } catch { $seedRejected = $true }
    if (-not $seedRejected -or (Test-Path -LiteralPath $seedMissing)) { throw 'Missing-path failure was ignored' }
    Write-Output "PASS PowerShell $($PSVersionTable.PSVersion): parser; non-admin directory/file DACL; repeat; child inheritance; owner/content preserved; failure closed. No production access."
} finally {
    # Delete only the GUID-named synthetic fixture created above, never private/.
    if (Test-Path -LiteralPath (Join-Path $seedTemp 'synthetic.txt')) {
        Remove-Item -LiteralPath (Join-Path $seedTemp 'synthetic.txt') -Force
    }
    Remove-Item -LiteralPath $seedTemp -Force
}
