# BeautyLink Community — implementation and controlled rollout

## Baseline and boundaries

Audited 2026-10-30: `origin/main` = `71f6bb3de669c2e53e3ca8d329e092a3ecc0571a`; PRs 36/37 merged. PR 17 remains open (StrictMode session verification); it was inspected and was not merged or rewritten here. The old CommunityModal was an unreferenced local mock; it is removed. Blog/editorial content remains separate.

Reused: Spring JWT/authentication_sessions and current-account checks; existing roles and real practitioner account links; Cloudinary gateway signature validation, image validator/compression and RateLimitBackend; catalog, approved suppliers and existing valid-booking review eligibility; AdminNav and existing booking/checkout entrypoints. Community never creates a booking/payment, changes review eligibility or marks an experience verified.

Railway read-only snapshot: production backend `71f6bb3`, service `47a8d011-cb21-4f0e-94bd-3e4a556038f7`, project `overflowing-recreation`, one SFO replica. Source deploys from main with checkSuites=false; health `/api/v1/categories`. Source uses ddl-auto=update, OSIV=false; SQL files are manual, not Flyway. Vercel project metadata shows READY production deployment `dpl_Hfxyf2FoGLv9dQrDTKEidLUXtAHD`; exact source SHA, root-directory and auto-promotion settings are not exposed by that read model. GET /v7/deployments via Vercel OAuth returns 403 for project-personal2. No settings, production records or secrets were changed.

## Model, policies and contracts

All new backend code is under `com.example.backend.community`, except the strict CommunityImageStorage wrapper. Seven additive tables: posts, post_media, comments, reactions, reports, moderation_actions and restrictions. Existing account/catalog/workforce tables are referenced by 18 foreign keys. Migration: `backend/src/main/resources/db/migration/mysql/V20261030_01__community.sql`.

Public identifiers are UUIDs; account IDs, contacts, birthday, session/token, booking and payment data are absent from public DTOs. Internal numeric IDs are used only in authenticated identity/editor inputs and real public service IDs. ACCOUNT posts have no verified-experience badge. SALON identity requires the actual SUPPLIER owner and approved, non-demo salon with active owner. PRACTITIONER identity requires an explicit active linked account and approved salon. Supplier attachments must belong to their own salon; ordinary customers may recommend public services. Cards fetch current prices and a batch rating aggregation using the existing valid-booking predicate.

- Text: 1–5,000 characters; comments/replies 1–2,000; one reply level; max 3 owned images.
- Images: JPG/PNG/WEBP, source max 10 MB, browser optimizes to <=1,050,000 data-URL characters; backend validates <=800,000 decoded bytes, dimensions <=4096 and <=16M pixels. No arbitrary URL attachment or Base64 persistence. Cloudinary missing/failing is a real error; there is no Base64 fallback.
- Media HTTP happens outside DB locks. DB failure/stale identity after upload triggers best-effort provider deletion; a cleanup failure logs only a generic reconciliation event. Unattached uploads are rate-bounded and can remain after a cancelled composer: operators reconcile unused assets in Cloudinary after checking all references. Never delete assets shared with profiles/services/reviews. Soft hiding/removing app content does not revoke a previously public CDN URL; urgent image takedown also requires the authorized Cloudinary operator.
- Writes serialize on the actor and affected post; revision checks reject stale edits (409). Unique author/request fingerprint ensures one create effect across retries; unique post/author plus post lock makes reactions idempotent. Comments retain hidden/deleted placeholders. Moderation and report resolution/audit commit atomically.
- Rate limits/account: posts 5/min +50/day; comments 15/min +200/day; edits 20/min; reactions 60/min; reports 5/hour; Community uploads 10/min plus shared image limit 20/hour. Public feed/detail/services/comments 300/min per remote address. Uses existing trusted request address handling, not an arbitrary client header. Shared-NAT users share this public budget. Existing memory backend is suitable only for the observed single replica; before horizontal scaling enable the existing Redis RateLimitBackend and verify its failure policy. No new paid resource is provisioned.
- Cursor pages 1–50 (default20), newest internal ID first, public UUID cursor. Search <=100 characters, escaped LIKE and bounded query timeout. Feed batches images/reactions/service rating queries, with fetched author/professional/catalog graphs. No polling or global feed cache.

Paths below are relative to `/api/v1/community`:

| API | Contract / permission |
|---|---|
| GET /config | Public; enabled/maxImages/maxContentLength, no Community table reads |
| GET /posts, /posts/{uuid}, /posts/{uuid}/comments | Public published content; category/q/before/size, comments parent/before/size; no-store, Vary Authorization |
| GET /services | Public authoritative non-demo catalog references, q/size |
| GET /identities | Authenticated authoritative representation options |
| GET /posts/{uuid}/edit | Private owner PostEdit = public Post + raw editable identity fields |
| POST /posts | Active eligible actor; PostWrite; stable requestKey; 201 after DB commit |
| PUT /posts/{uuid}, DELETE /posts/{uuid}?revision= | Owner only; stale409; soft delete |
| POST /media | Authenticated; image; owned media UUID and verified HTTPS URL |
| PUT /posts/{uuid}/reaction | Authenticated; liked boolean; server-confirmed Post counters |
| POST /posts/{uuid}/comments | requestKey/content/parent; one-level, same-post validation |
| PUT/DELETE /posts/{uuid}/comments/{cid} | Owner and revision; count/context preserved |
| POST /posts/{uuid}/reports | Authenticated reason/optional comment; dedup per target revision |
| GET /moderation/posts, /reports | STAFF/ADMIN only; cursor, visibility/q or resolved filters |
| GET /moderation/posts/{uuid}, /comments, /history | STAFF/ADMIN; history latest50 |
| PUT /moderation/posts/{uuid} | STAFF/ADMIN; action/reason/revision/optional comment; audited hide/restore/remove/dismiss |
| Same PUT: RESTRICT_AUTHOR / ALLOW_AUTHOR | ADMIN only; CUSTOMER/SUPPLIER Community interactions only; no global status/role/session changes |

Public post/comment DTOs are typed in `frontend/src/types/community.ts`. Error responses reuse ApiException and existing status conventions: 400 validation, 401 session, 403 permission, 404 unavailable, 409 stale/idempotency conflict, 413 body bound, 429 rate, 503 image dependency.

## Frontend and sharing

`/community` and `/community/posts/{uuid}` use existing App + history/popstate and lazy modules. Existing hashes, Admin routes and PayOS return priority are preserved. `#admin-community` integrates ADMIN moderation; `#community-moderation` is the narrow STAFF view. Public reads work during silent session checking; private actions remain locked. All asynchronous results are bound to credential epoch; account switching clears pending reaction state and rejects stale results. Composer freezes an ambiguous submission and retries the exact request key/payload, retaining successful image IDs.

Service View performs a fresh catalog GET then opens the real salon screen. Book performs the same GET and invokes existing shared CheckoutPage; slots, quotations, payment and ownership remain authoritative. Public `/?serviceId={real-id}` links open that service's real salon page; no private route/query is shared.

Native share, Facebook sharer and Telegram links are supported. Messenger/Zalo/Instagram/TikTok use honest copy/manual fallback; no automatic cross-posting or external OAuth. BookingShareFeature keeps owner-only preview/code copy/calendar actions but public tones/social/native/copy messages contain only allowlisted service/salon information, never code, amount, appointment, practitioner, notes or private current URL.

`frontend/api/community-share.ts` is the Vercel Node handler: fetches guest-only public content from fixed/trusted backend origin, validates the UUID/visibility, escapes metadata and injects it into built dist/index.html. No JS is needed by crawlers. Hidden/deleted=>404/noindex; unavailable=>503/noindex; no-store. Existing favicon/assets/SEO remain intact. Optional **server-only** COMMUNITY_API_ORIGIN can point an approved HTTPS staging backend; default is https://api.beautylink.cloud. Never set it from user input. No token is forwarded. Ensure Vercel project root is frontend. Do not broaden SPA rewrites to interfere with other routes.

References: [Vercel Vite](https://vercel.com/docs/frameworks/frontend/vite), [function includeFiles](https://vercel.com/docs/project-configuration/vercel-json), [Telegram sharing](https://core.telegram.org/widgets/share).

## Reproducible verification

```powershell
# From frontend
npm run lint
npm test
npm run build
# From backend, Java21
mvn --batch-mode --no-transfer-progress verify
# Isolated MySQL ONLY: exact guard URL, credentials for disposable CI instance
$env:REVIEW_TEST_JDBC_URL='jdbc:mysql://127.0.0.1:3306/beautylink_review_test'
$env:REVIEW_TEST_USERNAME='root'
# Set REVIEW_TEST_PASSWORD privately for the disposable instance; never production.
mvn --batch-mode --no-transfer-progress '-Dtest=CommunityIntegrationTest,CommunityMigrationTest' test
```

MySQL migration test clones non-Community tables from the previous-release entity schema into its own guarded disposable database, copies synthetic rows, applies SQL twice, checks old table counts, 7 new tables/18 FKs, duplicate/FK rejection, then boots Hibernate validate. It refuses an unexpected target or pre-existing clone; it never connects to production. Current application entities outside Community match the audited baseline. This is not evidence of restoring a current production backup.

Browser commands are fully wired into `.github/workflows/ci.yml`. Java CommunitySmokeServer is test-classpath only (H2 + actual BCrypt/JWT/session/image validation, fake Cloudinary/PayOS transport). Start it on loopback8080, Vite5173, then from frontend:

```powershell
$env:COMMUNITY_SMOKE='1'
node --import tsx tests/communityShareServer.ts
# Separate shell from repo root; PLAYWRIGHT_MODULE_PATH may point to installed runtime
node frontend/tests/communitySmoke.mjs
postman collection run postman/community.postman_collection.json
```

The metadata harness calls the actual Vercel handler over HTTP and only redirects its fixed public API request to isolated Spring. No production API call, real upload, email or payment. Screenshots and results under backend/target/community-*. Browser covers guest boundaries, actual login, upload+service post, own edit/reload, like/comment/reply, history, service/catalog/shared-checkout entrypoints (zero booking/payment POSTs), admin reports/hide/restore/audit, hidden OG404 and logout/revocation. Desktop1366/mobile390/360 have contained overflow assertions. Unit tests cover UGC escaping, SSR metadata, ambiguous retry, optional public auth and stale response/account switch.

Evidence at implementation: frontend187 tests/lint/build passed before final added account-switch regression; focused final Community unit9 passed. Backend Linux Java21 verify465/0 failure/0 error/8 conditional MySQL skips passed before final comment-moderation test; final focused MySQL13/13 and migration1/1 passed. Exact final full counts/checks must be read from the PR's final CI, which includes all later tests. Native Windows Maven failed loopback socket tests; identical full suite passed Linux/Docker, no security/test bypass. Local Postman4 requests/4 assertions passed; cloud publishing was not used (no CLI credentials).

## Release: approval, backup, migration, backend first

**Do not merge until the owner has held automatic deploys and reviewed the schema gate.** Feature-off alone does not stop Hibernate update from adding tables at startup. No production backup/restore, staging deployment or live social/CDN validation was performed in this task.

1. Owner: Railway backend service -> Settings -> source/automatic deployments: temporarily disconnect/hold automatic main deployments through the existing supported control; record previous state. Do not change source secrets/domain. Vercel Production settings: verify automatic custom-domain assignment is held so frontend remains on the current deployment. Confirm current source SHAs and project root/frontend; GET deployments currently403 requires owner Dashboard verification (no new token needed).
2. Owner: create a **new** consistent backup using existing approved backup tooling or MySQL Shell util.dumpSchemas; keep previous backups untouched. Restore into a fresh isolated MySQL matching production's major version. Record completion marker/checksum, schema, per-table counts/FKs/orphans and successful read-only application read. Verify current production schema compatibility read-only. Stop for unknown differences; CI schema validation is not a production backup gate.
3. Staging DBA: after restore verification, apply the additive SQL to the isolated restored schema and launch candidate backend with ddl-auto=validate to detect unexpected differences without DDL. Do not change production global DDL policy as part of this feature. Confirm ordinary authentication/catalog/booking/payment read APIs and disabled Community config. Explicit owner approval required before production DDL.
4. For approved production DDL, use a preconfigured MySQL login-path (no password in shell/history):

```powershell
# Owner substitutes actual host/port/user only; password is prompted locally.
mysql_config_editor set --login-path=beautylink-release --host=APPROVED_HOST --port=APPROVED_PORT --user=APPROVED_USER --password
mysql --login-path=beautylink-release railway -e "SELECT DATABASE(), VERSION();"
# Review result and verified backup before continuing. This is a manual WRITE gate.
Get-Content backend/src/main/resources/db/migration/mysql/V20261030_01__community.sql -Raw | mysql --login-path=beautylink-release railway
if ($LASTEXITCODE -ne 0) { throw 'Stop: migration did not finish; inspect before any retry' }
mysql --login-path=beautylink-release railway -e "SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name LIKE 'community_%'; SELECT COUNT(*) AS community_foreign_keys FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE() AND table_name LIKE 'community_%';"
```

5. With final required CI green, owner approves merge of the exact PR HEAD, then explicitly deploys that merge SHA backend first, keeping COMMUNITY_ENABLED=false (default). Check build/startup/health plus /api/v1/community/config enabled=false and existing authenticated /me, catalog, booking/payment read behavior. Feature flag is the only new backend setting. Reuse existing Cloudinary keys/config; no new frontend secrets, no provider changes.
6. Release frontend candidate only after backend/schema checks. Use Vercel deployment source SHA/Functions list to verify api/community-share packaged with dist/index.html. Enable COMMUNITY_ENABLED=true in approved staging first; test real signed Cloudinary upload with authorized synthetic content, direct HTTP social metadata without JS, guest boundaries, explicit logout/expiry and actual service availability navigation. Never create real payments for this check.
7. Owner approves production enablement and frontend promotion; controlled authorized Community test account/content only. Check public read and normal write/moderation, mobile overlay, native copy/share and social crawler preview. An actual network's cached preview may need its official refresh/debugger. Confirm no API5xx/permission drift or booking/payment regression. Record frontend/backend SHA and flag setting. Restore the recorded deployment automation only after confirming controlled order is no longer required. No action in steps1–7 is executed automatically by this PR.

## Rollback / operation

Disable COMMUNITY_ENABLED first; hold frontend promotion, return frontend to a confirmed compatible image/code if necessary. Roll back backend to a known compatible image from this release line; leave additive tables and Community/audit data intact. Never restore production DB to fix code; never roll back payment/session protections to an old unsafe release. A disabled Community endpoint returns404 while config returns enabled=false. Investigate rate-limit503/429 and upload failures using correlation-safe application logs, not content/contacts/tokens. Active CDN takedown and retention cleanup are separate authorized operator actions; never bulk-delete shared assets or audit rows.

Remaining live gates: owner approval; current backup+restore/schema evidence; Railway deployment hold; Vercel source/hold/root/function verification (OAuth403); approved staging real-CDN/social preview check; controlled backend-first release smoke. These are operational gates, not instructions to rewrite booking/payment or provision infrastructure.

CI follow-up: the existing Admin schedule smoke waited on a SaveForm toast that its immediate schedule.reload() unmounts. It now asserts the real PUT200, seven returned rules and equal GET readback before inspecting the UI; no Admin business logic was changed. Community navigation was moved out of the crowded primary header row after a reproducible new 768px overflow (822px, disappearing when the new button was removed). Regression smoke checks bounded header controls and real desktop/tablet/mobile navigation.

Preview runtime verification exposed ERR_MODULE_NOT_FOUND in Vercel Node24 for an extensionless ESM import. The handler now imports communityShare.js explicitly (TypeScript resolves its .ts source) and reads the packaged HTML relative to import.meta.url, independent of working directory. A regression test compiles the handler with existing TypeScript in NodeNext mode and runs the emitted JavaScript in native Node, checking real escaped200 HTML/asset references and invalid-ID404; no tsx loader hides resolution errors.

The follow-up exposed the actual dated fixture issue: on Friday2026-10-30 the old today+2 synthetic future bookings landed on a closed Sunday. ScheduleService correctly rejects replacing schedules that strand future bookings. Only BookingReviewSmokeServer now chooses a future working Monday; BrowserFixtureDateTest covers all seven weekdays/month boundary. Production booking/schedule rules are unchanged. The smoke asserts PUT status before an explicit authenticated readback, avoiding an unhandled pending GET promise masking a genuine409.
