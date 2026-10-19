-- BeautyLink Google Sign-In forward migration (MySQL 8.x).
-- Apply this reviewed migration before deploying the Google-auth application build.
-- Existing phone-bearing accounts are backfilled as contact-confirmed so the
-- release does not interrupt their established booking/payment flow.

ALTER TABLE user_accounts
    MODIFY COLUMN phone VARCHAR(20) NULL,
    MODIFY COLUMN password_hash VARCHAR(255) NULL,
    ADD COLUMN booking_contact_confirmation_required BIT(1) NOT NULL DEFAULT b'0' AFTER password_hash,
    ADD COLUMN booking_contact_confirmed_phone VARCHAR(20) NULL AFTER booking_contact_confirmation_required,
    ADD COLUMN booking_contact_confirmed_at DATETIME(6) NULL AFTER booking_contact_confirmed_phone;

UPDATE user_accounts
SET booking_contact_confirmed_phone = phone,
    booking_contact_confirmed_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP(6))
WHERE phone IS NOT NULL
  AND phone REGEXP '^0(3|5|7|8|9)[0-9]{8}$';

CREATE TABLE external_identities (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_account_id BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_external_identity_provider_subject UNIQUE (provider, provider_subject),
    CONSTRAINT uk_external_identity_account_provider UNIQUE (user_account_id, provider),
    CONSTRAINT fk_external_identity_account FOREIGN KEY (user_account_id) REFERENCES user_accounts(id),
    INDEX idx_external_identity_account (user_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
