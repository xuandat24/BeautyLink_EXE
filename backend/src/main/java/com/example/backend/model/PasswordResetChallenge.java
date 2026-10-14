package com.example.backend.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "password_reset_challenges", indexes = {
        @Index(name = "idx_password_reset_expires", columnList = "expires_at")
})
public class PasswordResetChallenge {
    @Id @Column(length = 36) private String id;
    @Column(name = "user_id") private Long userId;
    @Column(name = "code_hash", nullable = false, length = 64) private String codeHash;
    @Column(nullable = false) private int attempts;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "consumed_at") private Instant consumedAt;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt = Instant.now();
    @Version private long version;

    public String getId() { return id; } public void setId(String id) { this.id = id; }
    public Long getUserId() { return userId; } public void setUserId(Long userId) { this.userId = userId; }
    public String getCodeHash() { return codeHash; } public void setCodeHash(String codeHash) { this.codeHash = codeHash; }
    public int getAttempts() { return attempts; } public void setAttempts(int attempts) { this.attempts = attempts; }
    public Instant getExpiresAt() { return expiresAt; } public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public Instant getConsumedAt() { return consumedAt; } public void setConsumedAt(Instant consumedAt) { this.consumedAt = consumedAt; }
    public Instant getCreatedAt() { return createdAt; }
}
