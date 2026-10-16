package com.example.backend.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "external_identities", uniqueConstraints = {
        @UniqueConstraint(name = "uk_external_identity_provider_subject", columnNames = {"provider", "provider_subject"}),
        @UniqueConstraint(name = "uk_external_identity_account_provider", columnNames = {"user_account_id", "provider"})
})
public class ExternalIdentity {
    public enum Provider { GOOGLE }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_account_id", nullable = false, foreignKey = @ForeignKey(name = "fk_external_identity_account"))
    private UserAccount userAccount;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Provider provider;
    @Column(name = "provider_subject", nullable = false, length = 255) private String providerSubject;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public UserAccount getUserAccount() { return userAccount; }
    public void setUserAccount(UserAccount userAccount) { this.userAccount = userAccount; }
    public Provider getProvider() { return provider; }
    public void setProvider(Provider provider) { this.provider = provider; }
    public String getProviderSubject() { return providerSubject; }
    public void setProviderSubject(String providerSubject) { this.providerSubject = providerSubject; }
    public Instant getCreatedAt() { return createdAt; }
}
