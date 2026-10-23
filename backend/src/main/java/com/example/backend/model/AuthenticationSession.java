package com.example.backend.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "authentication_sessions", indexes = @Index(name = "idx_auth_session_expiry", columnList = "expires_at"))
public class AuthenticationSession {
    @Id @Column(length = 36) private String id;
    @Column(name = "account_id", nullable = false) private Long accountId;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "last_activity_at", nullable = false) private Instant lastActivityAt;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(nullable = false) private boolean revoked;
    protected AuthenticationSession() {}
    public AuthenticationSession(Long accountId, Instant now, Instant expiresAt) {
        this.id = UUID.randomUUID().toString(); this.accountId = accountId;
        this.createdAt = now; this.lastActivityAt = now; this.expiresAt = expiresAt;
    }
    public String getId() { return id; }
    public Long getAccountId() { return accountId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getLastActivityAt() { return lastActivityAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public boolean isRevoked() { return revoked; }
    public void touch(Instant now) { lastActivityAt = now; }
    public void revoke() { revoked = true; }
}
