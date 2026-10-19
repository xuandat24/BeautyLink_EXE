# Booking availability + Google sign-in release

This branch contains the Google sign-in work from `feat/google-signin-deferred-profile` and the booking/workforce changes. Production must receive both migrations before the new backend is deployed:

1. Take and verify a restorable snapshot of the Railway MySQL volume/database. Do not treat Hibernate `ddl-auto=update` as a backup or migration plan.
2. Apply `V20261016_01__google_identity_and_deferred_profile.sql` and verify the account backfill as described in `GOOGLE_SIGNIN_RELEASE.md`.
3. Apply `V20261017_01__practitioner_service_assignments.sql`. Existing practitioner rows default to unrestricted service eligibility; this preserves existing partner catalogs until owners explicitly assign services.
4. Configure the Google OAuth **Web client ID** in Railway (`GOOGLE_CLIENT_IDS` or `GOOGLE_CLIENT_ID`) and Vercel (`VITE_GOOGLE_CLIENT_ID`). Configure `https://beautylink.cloud` as an authorized JavaScript origin in Google Cloud. Never put a client secret in Vite.
5. Deploy backend before frontend. Check `/api/v1/categories`, `/api/v1/services/{id}/capacity?date=YYYY-MM-DD`, and logs; then deploy the matching frontend commit.
6. Smoke-test Google sign-in, deferred contact completion, a qualified service with two practitioners, a fully booked time, specific-practitioner selection, and partner coverage/schedule controls. Use test accounts and do **not** complete a real PayOS transaction.

Capacity policy: active PENDING/CONFIRMED/COMPLETED bookings block the assigned practitioner. CANCELLED bookings do not. A PENDING/UNPAID booking with **no payment attempt** is cancelled after 15 minutes by the hold-expiry scheduler; bookings with any PayOS attempt are left to existing provider reconciliation and manual-review safeguards. Lowest qualified practitioner ID is chosen for any-practitioner booking after locking and rechecking each candidate.

Rollback: restore the previous frontend/backend deployment first. Preserve the new tables/columns and payment history unless a reviewed data-safe rollback is prepared. The Google migration has a guarded rollback script; do not run it with Google-only customer accounts.
