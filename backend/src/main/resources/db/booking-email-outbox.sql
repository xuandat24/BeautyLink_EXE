-- Idempotent MySQL migration for booking confirmation email delivery.
-- Apply before enabling BOOKING_EMAIL_ENABLED. It creates no jobs and therefore
-- cannot email historical bookings.
CREATE TABLE IF NOT EXISTS email_notification_outbox (
    id BIGINT NOT NULL AUTO_INCREMENT,
    booking_id BIGINT NOT NULL,
    payment_transaction_id BIGINT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    recipient_role VARCHAR(20) NOT NULL,
    recipient_email VARCHAR(320) NULL,
    subject VARCHAR(255) NOT NULL,
    text_body LONGTEXT NOT NULL,
    html_body LONGTEXT NOT NULL,
    idempotency_key VARCHAR(180) NOT NULL,
    status VARCHAR(30) NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    next_attempt_at DATETIME(6) NOT NULL,
    lease_until DATETIME(6) NULL,
    claim_token VARCHAR(36) NULL,
    provider_message_id VARCHAR(160) NULL,
    last_error_code VARCHAR(80) NULL,
    sent_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_email_outbox_booking_type_role UNIQUE (booking_id, notification_type, recipient_role),
    CONSTRAINT uk_email_outbox_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT fk_email_outbox_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
    CONSTRAINT fk_email_outbox_payment FOREIGN KEY (payment_transaction_id) REFERENCES payment_transactions(id),
    INDEX idx_email_outbox_dispatch (status, next_attempt_at, lease_until),
    INDEX idx_email_outbox_payment (payment_transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
