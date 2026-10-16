# Google Sign-In release runbook

This change uses the Google Identity Services popup callback. The browser sends only Google's signed ID-token credential to `POST /api/v1/auth/google`; the Spring backend verifies it against the configured web client ID and then issues the normal BeautyLink JWT. There is no OAuth client secret in the frontend and no redirect URI is required for this popup flow.

## Google Cloud

1. Create or select the Google Cloud project owned by BeautyLink.
2. In Google Auth Platform, configure Branding and Audience. Add explicit test users while the app is in testing mode.
3. Create an OAuth 2.0 Client ID of type **Web application**.
4. Add development origins actually used by the team, for example `http://localhost:5173` and `http://127.0.0.1:5173`.
5. Add the production JavaScript origin `https://beautylink.cloud`.
6. Do not add a redirect URI for this implementation: it uses GIS popup mode with a JavaScript credential callback.
7. Copy the web client ID. Do not create or expose a client secret for the browser.

## Configuration

- Vercel frontend: set `VITE_GOOGLE_CLIENT_ID` to the web client ID for Preview first. Add it to Production only after approval.
- Railway backend: set `GOOGLE_CLIENT_ID` to the same web client ID. `GOOGLE_CLIENT_IDS` may instead contain a comma-separated allow-list during a controlled client-ID rotation.
- Redeploy Preview/backend staging after the variables are set, then test an authorized Google account. This repository change does not set or invent credentials.

## Database rollout

1. Take a verified MySQL backup and record counts for `user_accounts` and existing bookings/payments.
2. Apply `src/main/resources/db/migration/mysql/V20261016_01__google_identity_and_deferred_profile.sql` to a staging clone and run the MySQL release tests.
3. Apply the same script to production before the application build. Do not rely on Hibernate `ddl-auto=update` to relax the existing `NOT NULL` columns.
4. Verify nullable `phone`/`password_hash`, both new contact-confirmation columns, both identity uniqueness constraints, and the foreign key.
5. Deploy backend before frontend so `/api/v1/auth/google` exists before the GIS button is exposed.

## Rollback

The safe first rollback is application-only: roll back the frontend and backend while leaving the additive/nullable schema in place. Existing local authentication remains valid and Google-created records are retained.

The provided `R20261016_01__google_identity_and_deferred_profile.sql` is destructive to the identity table and therefore is a last-stage schema rollback. It aborts if any account has a null phone or password hash; it never deletes customers, fabricates credentials, or resets passwords. Before running it, migrate every Google-only account through an owner-approved process, confirm there is no live Google traffic, back up `external_identities`, and validate record counts. If the guard fails, stop and keep the forward-compatible schema.

## Account-linking policy

This initial release never links by matching email. A Google credential whose verified email already belongs to any local customer, supplier, staff, or admin account receives `GOOGLE_ACCOUNT_LINK_REQUIRED` and must use its existing login method. Authenticated proof-of-control linking remains future work.
