-- Apply once before deployment when ddl-auto is validate/none. Nullable additions only.
-- Retain on code rollback. Existing links keep the hosted checkout fallback.
ALTER TABLE payment_transactions
    ADD COLUMN qr_code TEXT NULL,
    ADD COLUMN bank_bin VARCHAR(100) NULL,
    ADD COLUMN bank_account_number VARCHAR(200) NULL,
    ADD COLUMN bank_account_name VARCHAR(300) NULL,
    ADD COLUMN transfer_description VARCHAR(300) NULL;
