# Require completed bookings before service and supplier reviews

Paid or deposit-paid bookings previously unlocked reviews before service completion, while no API transitioned confirmed bookings to completed. This change adds customer/owner-only completion after the appointment ends in Asia/Ho_Chi_Minh, including overnight appointments. Both review targets require COMPLETED plus PAID/PARTIALLY_PAID.

Cancellation, completion and review writes lock the booking row. Completion is idempotent, preserves the payment status and does not collect a balance or issue rewards. Public review queries and aggregates exclude historical premature/ineligible reviews without deleting them.

Customer account/bookings/appointments use backend booking data and server action flags. The review dialog creates/updates SERVICE and SUPPLIER reviews through the existing PUT API, rereads persisted reviews, and uses stable supplier IDs. Synthetic customer booking history and local-only review success/media/reward promises are removed.

The supplied ZIP patch applied cleanly to latest main `5cdc5d3de0bc51bcc2358f6b1f0088ee933448ad`. Scoped additions clear stale booking choices on dialog reload, expose retry, prevent repeated submission, test identity scope, and cover equal start/end overnight completion, supplier-review updates and public HTTP filtering.

Validation performed during this integration:

- Java 21 `mvn --batch-mode --no-transfer-progress verify`: 114 passed, zero failures/errors/skips; compile/package successful.
- `npm ci`: passed.
- `npm test`: 21 passed.
- `npm run lint`: TypeScript passed (the existing script is `tsc --noEmit`).
- `npm run build`: passed, with existing nonfatal Zod annotation/chunk-size warnings.
- `git diff --check`: passed.

Automated DB checks use H2; PayOS regressions use the existing fake gateway. Chromium checks were recorded by the supplied package and were not rerun here. No live PayOS or production MySQL operation was performed.

No schema migration, automatic completion, PayOS/webhook change or new dependency. Customer self-confirmation is an MVP declaration, not independent attendance proof. Photo/video persistence and Beauty Points remain unimplemented. Do not mark the complete master-plan scope Done. Existing sample marketing/base ratings outside verified booking-review data remain a separate scope.

Keep this PR as draft for review. Backend and frontend contract changes should be released together only after owner approval and production smoke-test planning. Do not merge or deploy as part of this task.
