# BeautyLink release checkpoint

Status: BACKEND_RELEASE_PREPARED — GitHub CI passed; PR creation needs user action; awaiting owner approval. Production unchanged.

- Branch: `release/resend-backend-safe`; base `5f424585daec6246c9e711bf76d17566da19673c`.
- Imported backend-only changes once from `codex/resend-first-booking`; sender/docs from `codex/resend-railway-otp`.
- Added JWT identity/version binding, safe old-token rejection, DB-locked phone updates, compatibility-preserving Supplier validation and targeted tests.
- Baseline: 45 backend tests passed. Final Java 21 Maven verify: 81 tests passed, 0 failures/errors/skips; package built successfully.
- Existing frontend: npm ci, TypeScript (`npm run lint`), production build passed; no frontend source changes.
- Read-only production audit: Railway and Vercel on base commit; healthy backend/MySQL; variable names present but values redacted; old API domain and CORS work. Custom API domain health is not verified from this workstation.
- Code commit `9a4d7dce41e937da5262cf83e34d40be05407ff2` is pushed; GitHub CI passed: https://github.com/xuandat24/BeautyLink_EXE/actions/runs/38236172785 . Later documentation-only commits do not change the tested implementation; inspect actual Git HEAD and its CI before approval.
- GitHub connector returned 403 `Resource not accessible by integration` on PR creation. User can create the backend PR at https://github.com/xuandat24/BeautyLink_EXE/compare/main...release/resend-backend-safe?expand=1 . No PR was created, merged or deployed by this task.
- Next: user creates/reviews backend PR, privately confirms production configuration and MySQL backup, and explicitly approves the exact commit for merge/release. Never merge/deploy before that approval.
- Phase 2 intentionally not started; source UI needs account-change race handling and interactive flow tests before release.
- Details: `RELEASE_RESEND_BACKEND.md`.

No credentials, customer data, OTPs, JWTs or local environment paths are stored here.
