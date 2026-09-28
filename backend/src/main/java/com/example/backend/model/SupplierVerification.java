package com.example.backend.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "supplier_verifications", indexes = {
        @Index(name = "idx_supplier_verification_cccd_hash", columnList = "cccd_hash", unique = true)
})
public class SupplierVerification {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "supplier_id", nullable = false, unique = true) private Supplier supplier;
    @Column(name = "cccd_hash", nullable = false, unique = true, length = 64) private String cccdHash;
    @Column(nullable = false, length = 512) private String encryptedCccdNumber;
    @Lob @Column(nullable = false, columnDefinition = "LONGTEXT") private String encryptedFrontImage;
    @Lob @Column(nullable = false, columnDefinition = "LONGTEXT") private String encryptedBackImage;
    @Column(nullable = false, updatable = false) private Instant submittedAt = Instant.now();

    public Long getId() { return id; }
    public Supplier getSupplier() { return supplier; } public void setSupplier(Supplier supplier) { this.supplier = supplier; }
    public String getCccdHash() { return cccdHash; } public void setCccdHash(String cccdHash) { this.cccdHash = cccdHash; }
    public String getEncryptedCccdNumber() { return encryptedCccdNumber; } public void setEncryptedCccdNumber(String encryptedCccdNumber) { this.encryptedCccdNumber = encryptedCccdNumber; }
    public String getEncryptedFrontImage() { return encryptedFrontImage; } public void setEncryptedFrontImage(String encryptedFrontImage) { this.encryptedFrontImage = encryptedFrontImage; }
    public String getEncryptedBackImage() { return encryptedBackImage; } public void setEncryptedBackImage(String encryptedBackImage) { this.encryptedBackImage = encryptedBackImage; }
    public Instant getSubmittedAt() { return submittedAt; }
}
