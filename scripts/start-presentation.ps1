$ErrorActionPreference = 'Stop'
if (-not $env:JAVA_HOME -or -not (Test-Path -LiteralPath "$env:JAVA_HOME/bin/java.exe")) {
    throw 'Set JAVA_HOME to a JDK 21 or later before running this script.'
}
$presentationRoot = Split-Path -Parent $PSScriptRoot
Push-Location (Join-Path $presentationRoot 'backend')
try {
    & mvn --batch-mode --no-transfer-progress '-DskipTests' test-compile dependency:build-classpath '-Dmdep.outputFile=target/presentation-classpath.txt' '-Dmdep.includeScope=test'
    if ($LASTEXITCODE -ne 0) { throw 'Presentation compilation failed.' }
    $presentationDependencies = (Get-Content -LiteralPath 'target/presentation-classpath.txt' -Raw).Trim()
    & "$env:JAVA_HOME/bin/java.exe" -Xmx768m -cp "target/test-classes;target/classes;$presentationDependencies" com.example.backend.PresentationServer
    if ($LASTEXITCODE -ne 0) { throw 'Presentation server failed.' }
} finally { Pop-Location }
