# Promotions rollout

Scope: global, one code per payment attempt; fixed VND or percentage with mandatory cap, minimum order, optional Vietnam-time start/end; no usage-count/budget/salon targeting features are advertised. ADMIN creates/updates; public reads active codes. No DELETE endpoint. Rules and before/after audits commit atomically, with expectedRevision and database locks/unique code.

Existing BEAUTY50 / BEAUTY100 / PINK15 policies remain unchanged defaults until an ADMIN explicitly saves an override. No startup seeding. An override is never deleted, so a paused legacy code cannot accidentally fall back to active. New codes are validated on the backend; Java BigDecimal and existing PayOS minimum/deposit rules remain authoritative. PaymentService keeps the already-reserved amount/remaining amount/option/code; editing or pausing a promotion does not reprice an existing PayOS attempt. An unknown payment is never replaced due to a voucher error.

## Contract
- GET /api/v1/catalog/promotions: public active rules only.
- GET /api/v1/admin/promotions: ADMIN rule list, including existing defaults.
- POST /api/v1/admin/promotions: new immutable code, expectedRevision=-1.
- PUT /api/v1/admin/promotions/{code}: same code, current expectedRevision (defaults use -1 until first override).
- Write fields: code, name, discountType(FIXED/PERCENT), value, minimumOrder, maximumDiscount(percent only), startsAt/endsAt(ISO UTC or offset), status(DRAFT/ENABLED/PAUSED), expectedRevision. View adds derived state DRAFT/SCHEDULED/ACTIVE/PAUSED/EXPIRED and revision.
- End time is exclusive. Admin datetime inputs use Asia/Ho_Chi_Minh. Invalid requests400, stale/duplicate409, missing404, unauthorized401/403. No client-side success/payment inference.

## Controlled deployment (not executed by Codex)
1. Review after exact-head CI. Do not merge yet when main triggers automatic Railway deployment: approve/apply/verify the additive migration first. Obtain a current backup with isolated restore/checksum/schema verification. Inspect actual production schema and ddl-auto setting without exposing secrets; SQL files are not assumed to auto-run.
2. With owner approval, apply backend/src/main/resources/db/migration/mysql/V20261101_01__promotions.sql once using the established secure DB operator. Additive only; no existing-table changes or default inserts. Check SHOW CREATE TABLE promotions; SHOW CREATE TABLE promotion_audits; verify unique code and actor FK. IF NOT EXISTS does not prove compatibility: compare actual columns/types.
3. Only after schema verification, approve merge/backend rollout (main may automatically deploy Railway). Deploy backend first. Read-only smoke: public catalog returns existing3 active defaults if no overrides; authenticated ADMIN list works; CUSTOMER/SUPPLIER/STAFF admin access denied; existing service quote keeps 5%/100% calculations. Do not create production bookings/payments to smoke.
4. Deploy frontend after backend is healthy. Confirm Admin list/form and customer voucher list; explicit approved administrative test code can be saved as DRAFT, audited, and left disabled. Publishing real discounts is an owner business action.
5. Production rules are not written, SQL not applied and deployment not performed by this implementation task.

## Rollback
Retain additive tables/audits and all payment records. Before any rule overrides/custom-code payments exist, prior backend can be restored after checking compatibility. After an override/custom code exists, do not roll backend back to the old static evaluator: it could reactivate a paused default or reject custom continuation previews. Revert frontend if needed while retaining the compatible backend evaluator, or roll forward a focused backend fix. Do not restore over production DB or delete audit/override rows. Never cancel/recreate payment attempts as rollback.

## UI cleanup
Remove the roster explanation banner, demo/catalog cohort disclosure, returning-customer selection explanation, redundant admin refresh button, generic developer-only read-only notice. Keep financial source, verified-vs-report amounts and reconciliation explanations; removing them would mislabel money. No data/role/KPI/seed changes.
