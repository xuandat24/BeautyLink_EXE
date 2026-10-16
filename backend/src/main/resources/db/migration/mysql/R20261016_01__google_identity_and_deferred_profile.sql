-- Guarded rollback for V20261016_01.
-- Run only after rolling application traffic back and proving there are no
-- Google-only accounts. This script deliberately aborts rather than deleting
-- customer identities or inventing phone/password data.

DELIMITER $$
CREATE PROCEDURE beautylink_guard_google_auth_rollback()
BEGIN
    IF EXISTS (SELECT 1 FROM user_accounts WHERE phone IS NULL OR password_hash IS NULL) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Rollback blocked: Google-only accounts require an approved account migration; no customer data was changed.';
    END IF;
END$$
DELIMITER ;

CALL beautylink_guard_google_auth_rollback();
DROP PROCEDURE beautylink_guard_google_auth_rollback;

DROP TABLE external_identities;
ALTER TABLE user_accounts
    DROP COLUMN booking_contact_confirmed_at,
    DROP COLUMN booking_contact_confirmed_phone,
    DROP COLUMN booking_contact_confirmation_required,
    MODIFY COLUMN password_hash VARCHAR(255) NOT NULL,
    MODIFY COLUMN phone VARCHAR(20) NOT NULL;
