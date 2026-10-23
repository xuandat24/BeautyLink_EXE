-- Back up first; apply once before deploying session-enforcing backend. No user/booking/payment data changes.
CREATE TABLE authentication_sessions (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    account_id BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    last_activity_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    revoked BIT(1) NOT NULL DEFAULT b'0',
    INDEX idx_auth_session_expiry (expires_at),
    CONSTRAINT fk_auth_session_account FOREIGN KEY (account_id) REFERENCES user_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Code rollback must retain the table; reverting enforcement re-enables old JWT policy and is not a safe security rollback.
