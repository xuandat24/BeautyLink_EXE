package com.example.backend.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "otp_verification_challenges", indexes = {
        @Index(name = "idx_otp_expires", columnList = "expires_at"),
        @Index(name = "idx_otp_registration_token", columnList = "registration_token_hash", unique = true)
})
public class OtpVerificationChallenge {
    @Id @Column(length = 36) private String id;
    @Column(name = "phone_hash", nullable = false, length = 64) private String phoneHash;
    @Column(name = "email_hash", length = 64) private String emailHash;
    @Column(name = "phone_code_hash", nullable = false, length = 64) private String phoneCodeHash;
    @Column(name = "email_code_hash", length = 64) private String emailCodeHash;
    @Enumerated(EnumType.STRING) @Column(name = "verification_channel", length = 16) private DomainEnums.VerificationChannel verificationChannel;
    @Column(nullable = false) private int attempts;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "verified_at") private Instant verifiedAt;
    @Column(name = "registration_token_hash", unique = true, length = 64) private String registrationTokenHash;
    @Column(name = "token_expires_at") private Instant tokenExpiresAt;
    @Column(name = "consumed_at") private Instant consumedAt;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt = Instant.now();
    @Version private long version;

    public String getId() { return id; } public void setId(String id) { this.id = id; }
    public String getPhoneHash() { return phoneHash; } public void setPhoneHash(String phoneHash) { this.phoneHash = phoneHash; }
    public String getEmailHash() { return emailHash; } public void setEmailHash(String emailHash) { this.emailHash = emailHash; }
    public String getPhoneCodeHash() { return phoneCodeHash; } public void setPhoneCodeHash(String phoneCodeHash) { this.phoneCodeHash = phoneCodeHash; }
    public String getEmailCodeHash() { return emailCodeHash; } public void setEmailCodeHash(String emailCodeHash) { this.emailCodeHash = emailCodeHash; }
    public DomainEnums.VerificationChannel getVerificationChannel() { return verificationChannel; } public void setVerificationChannel(DomainEnums.VerificationChannel verificationChannel) { this.verificationChannel = verificationChannel; }
    public int getAttempts() { return attempts; } public void setAttempts(int attempts) { this.attempts = attempts; }
    public Instant getExpiresAt() { return expiresAt; } public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public Instant getVerifiedAt() { return verifiedAt; } public void setVerifiedAt(Instant verifiedAt) { this.verifiedAt = verifiedAt; }
    public String getRegistrationTokenHash() { return registrationTokenHash; } public void setRegistrationTokenHash(String registrationTokenHash) { this.registrationTokenHash = registrationTokenHash; }
    public Instant getTokenExpiresAt() { return tokenExpiresAt; } public void setTokenExpiresAt(Instant tokenExpiresAt) { this.tokenExpiresAt = tokenExpiresAt; }
    public Instant getConsumedAt() { return consumedAt; } public void setConsumedAt(Instant consumedAt) { this.consumedAt = consumedAt; }
    public Instant getCreatedAt() { return createdAt; }
}
