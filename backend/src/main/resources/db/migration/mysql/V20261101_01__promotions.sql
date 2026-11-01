-- Additive tables only. Apply under the approved backup/migration procedure before backend rollout.
CREATE TABLE IF NOT EXISTS promotions (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, code VARCHAR(40) NOT NULL, name VARCHAR(120) NOT NULL,
 discount_type VARCHAR(10) NOT NULL, discount_value DECIMAL(19,2) NOT NULL, minimum_order DECIMAL(19,0) NOT NULL,
 maximum_discount DECIMAL(19,0) NULL, starts_at DATETIME(6) NULL, ends_at DATETIME(6) NULL,
 status VARCHAR(12) NOT NULL, version BIGINT NOT NULL DEFAULT 0, updated_at DATETIME(6) NOT NULL,
 CONSTRAINT uk_promotion_code UNIQUE(code)
);
CREATE TABLE IF NOT EXISTS promotion_audits (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, actor_id BIGINT NOT NULL, code VARCHAR(40) NOT NULL,
 action VARCHAR(12) NOT NULL, before_json LONGTEXT NULL, after_json LONGTEXT NOT NULL, created_at DATETIME(6) NOT NULL,
 CONSTRAINT fk_promotion_audit_actor FOREIGN KEY(actor_id) REFERENCES user_accounts(id)
);
-- Existing BEAUTY50/BEAUTY100/PINK15 remain default rules until explicitly overridden via ADMIN API.
-- No startup inserts, no alterations to existing bookings/payments, no dropping tables on rollback.
