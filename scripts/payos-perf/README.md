# Isolated checkout performance measurement

No production payments, database or merchant credentials are used. `BookingReviewSmokeServer` is test-classpath-only, asserts the exact H2 in-memory URL, and enables35 synthetic bookings only with `SMOKE_PERF_MODE=1`. It injects350ms create/250ms GET latency into the existing fake gateway. These are test inputs, **not measured PayOS latencies**. The shell timer starts on the actual payment-button click; QR timing ends at Playwright-visible QR. Browser/API RTT includes Vite/Windows/Docker overhead; it is not internet RTT alone. JDBC duration is execution time, excluding connection acquisition and entity hydration; reserve/persist transaction durations cover those and lock/commit work. Pre-service timing covers JWT/session/current-account handling plus MVC dispatch. Thirty samples use nearest-rank P50/P95/P99; with30, P99 is the observed maximum, not a reliable production tail estimate.

## Run on Windows (PowerShell7, Java21 Docker, Node20+)

From the chosen worktree:

```powershell
npm ci --prefix frontend
npm install --prefix backend/target/qr-browser-runtime --no-save --package-lock=false playwright@1.62.1
node backend/target/qr-browser-runtime/node_modules/playwright/cli.js install chromium
pwsh -NoProfile -File scripts/payos-perf/RunLocal.ps1 -Label after -Samples 30
```

The runner refuses occupied ports/unknown containers, binds to127.0.0.1, passes no production environment variables, waits for the fixture-ready marker, records numeric JSON and cleans up only its own processes/container. Do not run other builds/tests during sampling. A cold-start/readiness failure is not a latency sample. No retrying a half-completed sample with existing attempts: restart the ephemeral test server to get a fresh dataset.

Baseline commit `14260a5b843ff8202541c2fb2ef34933c56f1f42` is the original main60a7399 plus instrumentation/test fixtures only. Use a separate detached worktree of that commit (preserve current dirty work), copy this runner there, install frontend/test runtime there and run `-Label baseline`. Then use the optimized commit with the same OS/browser/Docker settings and30 samples. Do not revert production or reset a worktree to benchmark.

Outputs (ignored): `backend/target/payos-performance-baseline.json`, `payos-performance-after.json`, test server logs, preparation screenshot. Only numeric percentiles are committed in the report. MySQL CI additionally runs `CheckoutPerformanceIntegrationTest` (30 real JWT requests with20ms injected provider latency) and stores `payos-jdbc-performance-MySQL8.4.json`. `PayOSTransportTest` uses the installed SDK and a signed local HTTPS server, self-signed test certificate in a temporary directory trusted only by that test client; it checks pooling, concurrency and rejection of invalid signatures. No TLS verification is disabled in application code.

Optional **read-only** internet reference:

```powershell
node scripts/payos-perf/public-latency.mjs
```

It makes30 gentle unauthenticated GETs only to public categories, stores no bodies, and measures workstation→Railway(SFO). It cannot establish authenticated payment, MySQL production or live PayOS P50/P95/P99. Live merchant latency requires approved production observation after rollout; do not create payments as a benchmark.
