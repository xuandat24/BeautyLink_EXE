# Guard booking completion/reviews and preserve manual PayOS cases

A paid booking previously unlocked reviews before service completion. This branch makes completion an explicit owner-CUSTOMER action after the appointment ends in Asia/Ho_Chi_Minh; reviews require COMPLETED + PAID/PARTIALLY_PAID with no unresolved attempts. Payment cannot complete a booking, revive customer cancellation or upgrade a deposit.

## Payment correctness

- Unpaid customer cancellation verifies provider closure/zero money; verified receipts commit even when cancellation returns 409. Paid/deposit-paid cancellation is refused with support guidance.
- Ledger commits before provider create. Booking → payment locking, locking rereads and practitioner mutex protect cancellation, webhook, reconciliation, completion, review and slot retry.
- Existing booking continuation uses backend ownership/capabilities and preserves active option/voucher; it never replaces an unresolved booking. Shared controllable Vietnam time handles strict checkout cutoff, 30-minute lead, calendar-month limits and overnight intervals.
- Latest fix, relative to 87409c11: scheduler/status could clear a PENDING manual flag via markPaid, while webhook kept the blocker. All verified PAID sources now share one decision. Manual/conflicting receipts persist evidence and REVIEW_REQUIRED without changing booking/payment state.
- REVIEW_REQUIRED/manual rows remain bounded/throttled reconciliation candidates, including after terminal-zero observations. Only ADMIN all-attempt zero-money closure may remove their blockers. Later zero or invalid identity/amount cannot erase a verified receipt/reference.
- Approved secondary zero closure preserves exactly one fully provider-verified PAID primary. Financial conflicts/late/duplicate money have no automatic refund or application override.

## Reviews and compatibility

Scoped, DB-paginated SERVICE/SUPPLIER lists, matching counts/ratings and masked names exclude invalid legacy reviews without deleting them. Frontend account/bookings/appointments/Explore/detail use backend persistence and stable IDs. Missing/stale eligibility fails closed. Additive APIs preserve backend-first compatibility.

ADMIN preview and fingerprinted zero closure use existing support_reports audit; generic support actions cannot forge/edit the reserved namespace. No schema migration or runtime dependency change; no OTP/auth/JWT/KYC, amount/voucher/deposit math, production configuration or data change. Customer completion remains self-attestation. Independent attendance, review media, Beauty Points and notifications are not implemented.

## Verification

- New convergence tests first reproduced two failing PAID-before-webhook cases on baseline 87409c11.
- Java 21 `mvn --batch-mode --no-transfer-progress verify`: **269 passed**, zero failures/errors/skips; package successful.
- **33 added integration cases** cover order/repeats, real cancellation timeout, missing/mismatched provider proof, contradictory zero after receipt, manual PENDING, cancelled booking, primary/secondary, operator audit and concurrent webhook/reconciliation.
- Strict mock adjusted so mismatched webhook references are never consumed or persisted; no assertions/tests removed.
- Frontend `npm ci`, **40 tests**, `npm run lint` (TypeScript), production build PASS. Existing dependency/chunk warnings remain.
- Real Chrome → Spring/JWT → isolated H2 browser smoke PASS, including PAID evidence remaining blocked in UI, continuation/reload/back/retry, cancellation, completion and both review targets. Fake gateway only; **not live PayOS**. No API/page/console errors.
- Existing CI runs full backend/frontend, isolated MySQL transaction/concurrency (140 tests expected), Docker image build and the browser smoke. Review the **current PR HEAD** run before merge; historical runs do not satisfy this gate.
- Local Docker engine unavailable; MySQL and image-build evidence must come from the current-HEAD CI jobs. Production JAR/bundle fixture scan and git diff --check PASS.

## Release gate

Draft until exact-HEAD CI/review and operational gates pass. Railway read-only evidence remains main 5cdc5d3, deployment 12ca4eb6-d4ca-419c-9c99-2467b712cd03 SUCCESS, source main with checkSuites=false. Vercel project read still 403; serving SHA/auto-promotion unverified. No merge/deploy in this session.

Existing backup before_resend has a completion marker and unchanged checksum; restore has **not** been proven. Owner xuandat24 handles reconciliation/contact; on-call coverage and money disposition require explicit confirmation. See PAYMENT_REVIEW_RUNBOOK.md for the concrete decision tree and single approval gate.

Before merge, the owner must verify/disable Vercel Settings → Environments → Production → Branch Tracking → Auto-assign Custom Production Domains so the frontend stays Staged. Then backend deployment/health/MySQL/API/webhook checks, followed by same-merge-SHA frontend promotion and smoke. No real payment without separate approval.

Rollback code/image, preserve ledger/audit; do not restore production DB for a code issue. Neither old main nor 87409c11 is a safe automatic rollback for the bugs addressed here. Frontend-only rollback keeps the healthy backend; backend incident requires a reviewed safe image/forward fix and frontend hold.

PR creation previously returned integration 403. If unchanged, use the compare URL and this body; it is a permission gate, not further feature scope:
https://github.com/xuandat24/BeautyLink_EXE/compare/main...fix/completed-booking-reviews?expand=1
