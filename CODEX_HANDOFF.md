# BeautyLink release checkpoint

Status: BACKEND_CODE_READY — awaiting final CI and owner approval; production unchanged.

- Branch: `release/resend-backend-safe`; base `5f424585daec6246c9e711bf76d17566da19673c`.
- Imported backend-only changes once from `codex/resend-first-booking`; sender/docs from `codex/resend-railway-otp`.
- Added JWT identity/version binding, safe old-token rejection, DB-locked phone updates, compatibility-preserving Supplier validation and targeted tests.
- Baseline: 45 backend tests passed. Final Java 21 Maven verify: 81 tests passed, 0 failures/errors/skips; package built successfully.
- Existing frontend: npm ci, TypeScript (`npm run lint`), production build passed; no frontend source changes.
- Read-only production audit: Railway and Vercel on base commit; healthy backend/MySQL; variable names present but values redacted; old API domain and CORS work. Custom API domain health is not verified from this workstation.
- Next: confirm final verify result, commit/push backend branch, create PR if authorized by connector, wait for CI. Never merge/deploy without explicit owner approval and backup/configuration confirmation.
- Phase 2 intentionally not started; source UI needs account-change race handling and interactive flow tests before release.
- Details: `RELEASE_RESEND_BACKEND.md`.

No credentials, customer data, OTPs, JWTs or local environment paths are stored here.
