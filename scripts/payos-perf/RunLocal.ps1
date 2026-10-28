[CmdletBinding()]
param(
    [ValidateSet('baseline', 'after')][string]$Label = 'after',
    [ValidateRange(20,35)][int]$Samples = 30,
    [string]$PlaywrightModule = ''
)
$ErrorActionPreference = 'Stop'
$perfRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$perfMaven = Join-Path $env:USERPROFILE '.m2/repository'
if (-not $PlaywrightModule) { $PlaywrightModule = Join-Path $perfRoot 'backend/target/qr-browser-runtime/node_modules/playwright' }
if (-not (Test-Path -LiteralPath $PlaywrightModule)) { throw 'Install the test-only Playwright runtime as documented; production dependencies are unchanged.' }
$perfContainer = 'beautylink-qr-performance-local'
$perfStarted = $false; $perfVite = $null
$oldModule = $env:PLAYWRIGHT_MODULE_PATH; $oldLabel = $env:PERF_LABEL; $oldSamples = $env:PERF_SAMPLES
Push-Location $perfRoot
try {
    docker info --format '{{.ServerVersion}}' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop first.' }
    if (docker ps -a --filter "name=^/$perfContainer$" --format '{{.Names}}') { throw 'The dedicated benchmark container already exists; do not stop an unknown process.' }
    foreach ($port in 8080,5173) { if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Port $port is in use; close the known test process first." } }
    docker run --rm --mount "type=bind,source=$perfRoot,target=/workspace" --mount "type=bind,source=$perfMaven,target=/root/.m2/repository" -w /workspace/backend maven:3.9-eclipse-temurin-21 mvn --batch-mode --no-transfer-progress test-compile dependency:build-classpath -Dmdep.outputFile=target/perf-classpath.txt -Dmdep.includeScope=test
    if ($LASTEXITCODE -ne 0) { throw 'Test server compilation failed.' }
    $perfCommand = 'java -cp "target/test-classes:target/classes:$(cat target/perf-classpath.txt)" com.example.backend.BookingReviewSmokeServer'
    docker run --rm -d --name $perfContainer -p 127.0.0.1:8080:8080 -e SMOKE_BIND_ADDRESS=0.0.0.0 -e SMOKE_PERF_MODE=1 --mount "type=bind,source=$perfRoot,target=/workspace" --mount "type=bind,source=$perfMaven,target=/root/.m2/repository" -w /workspace/backend maven:3.9-eclipse-temurin-21 sh -c $perfCommand
    if ($LASTEXITCODE -ne 0) { throw 'Isolated test server failed to start.' }
    $perfStarted = $true
    $ready = $false
    for ($attempt = 0; $attempt -lt 150; $attempt++) {
        $perfLog = docker logs $perfContainer 2>&1
        if (($perfLog -join "`n").Contains('BOOKING_REVIEW_SMOKE_READY')) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw 'Test fixture did not become ready. No benchmark samples collected.' }
    $perfNode = (Get-Command node).Source
    $perfVite = Start-Process -FilePath $perfNode -ArgumentList 'node_modules/vite/bin/vite.js','--host=127.0.0.1' -WorkingDirectory (Join-Path $perfRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $perfRoot 'backend/target/perf-vite.log') -RedirectStandardError (Join-Path $perfRoot 'backend/target/perf-vite.err.log') -PassThru
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try { $null = Invoke-WebRequest 'http://localhost:5173/tests/payos-performance.html' -UseBasicParsing; break } catch { Start-Sleep -Seconds 1 }
    }
    $env:PLAYWRIGHT_MODULE_PATH = $PlaywrightModule; $env:PERF_LABEL = $Label; $env:PERF_SAMPLES = [string]$Samples
    node frontend/tests/payosPerformance.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Browser performance assertions failed.' }
    docker logs $perfContainer > "backend/target/perf-$Label-server.log"
} finally {
    if ($perfVite -and -not $perfVite.HasExited) { $perfVite.Kill() }
    if ($perfStarted) { docker stop $perfContainer | Out-Null }
    $env:PLAYWRIGHT_MODULE_PATH = $oldModule; $env:PERF_LABEL = $oldLabel; $env:PERF_SAMPLES = $oldSamples
    Pop-Location
}
