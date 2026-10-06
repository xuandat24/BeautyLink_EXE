package com.example.backend.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import static com.example.backend.model.DomainEnums.*;

@Entity
@Table(name = "payment_transactions", indexes = {
        @Index(name = "idx_payment_booking_attempts_v2", columnList = "booking_id,created_at"),
        @Index(name = "idx_payment_status", columnList = "status"),
        @Index(name = "idx_payment_provider_reference", columnList = "provider,merchant_reference")
})
public class PaymentTransaction {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "booking_id", nullable = false) private Booking booking;
    @Column(nullable = false, unique = true) private Long orderCode;
    @Enumerated(EnumType.STRING) @Column(length = 20) private PaymentProvider provider = PaymentProvider.PAYOS;
    @Column(name = "merchant_reference", unique = true, length = 64) private String merchantReference;
    @Column(unique = true, length = 80) private String paymentLinkId;
    @Column(length = 120) private String providerTransactionId;
    @Column(length = 30) private String bankCode;
    @Column(length = 30) private String cardType;
    @Column(length = 20) private String providerResponseCode;
    @Column(length = 20) private String providerTransactionStatus;
    @Column(length = 1000) private String checkoutUrl;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal amount;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal remainingAmount = BigDecimal.ZERO;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private PaymentOption paymentOption;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private PaymentTransactionStatus status = PaymentTransactionStatus.PENDING;
    @Column(length = 40) private String voucherCode;
    @Column(length = 120) private String paymentReference;
    private Instant paidAt;
    private Instant expiresAt;
    private Instant providerCreatedAt;
    private Instant lastReconciledAt;
    @Column(nullable = false) private boolean requiresManualReview;
    @Column(nullable = false, updatable = false) private Instant createdAt = Instant.now();
    @Column(nullable = false) private Instant updatedAt = Instant.now();
    @Version private long version;

    @PreUpdate void touch() { updatedAt = Instant.now(); }
    public Long getId() { return id; }
    public Booking getBooking() { return booking; } public void setBooking(Booking booking) { this.booking = booking; }
    public Long getOrderCode() { return orderCode; } public void setOrderCode(Long orderCode) { this.orderCode = orderCode; }
    public PaymentProvider getProvider() { return provider; } public void setProvider(PaymentProvider provider) { this.provider = provider; }
    public String getMerchantReference() { return merchantReference; } public void setMerchantReference(String merchantReference) { this.merchantReference = merchantReference; }
    public String getPaymentLinkId() { return paymentLinkId; } public void setPaymentLinkId(String paymentLinkId) { this.paymentLinkId = paymentLinkId; }
    public String getProviderTransactionId() { return providerTransactionId; } public void setProviderTransactionId(String providerTransactionId) { this.providerTransactionId = providerTransactionId; }
    public String getBankCode() { return bankCode; } public void setBankCode(String bankCode) { this.bankCode = bankCode; }
    public String getCardType() { return cardType; } public void setCardType(String cardType) { this.cardType = cardType; }
    public String getProviderResponseCode() { return providerResponseCode; } public void setProviderResponseCode(String providerResponseCode) { this.providerResponseCode = providerResponseCode; }
    public String getProviderTransactionStatus() { return providerTransactionStatus; } public void setProviderTransactionStatus(String providerTransactionStatus) { this.providerTransactionStatus = providerTransactionStatus; }
    public String getCheckoutUrl() { return checkoutUrl; } public void setCheckoutUrl(String checkoutUrl) { this.checkoutUrl = checkoutUrl; }
    public BigDecimal getAmount() { return amount; } public void setAmount(BigDecimal amount) { this.amount = amount; }
    public BigDecimal getRemainingAmount() { return remainingAmount; } public void setRemainingAmount(BigDecimal remainingAmount) { this.remainingAmount = remainingAmount; }
    public PaymentOption getPaymentOption() { return paymentOption; } public void setPaymentOption(PaymentOption paymentOption) { this.paymentOption = paymentOption; }
    public PaymentTransactionStatus getStatus() { return status; } public void setStatus(PaymentTransactionStatus status) { this.status = status; }
    public String getVoucherCode() { return voucherCode; } public void setVoucherCode(String voucherCode) { this.voucherCode = voucherCode; }
    public String getPaymentReference() { return paymentReference; } public void setPaymentReference(String paymentReference) { this.paymentReference = paymentReference; }
    public Instant getPaidAt() { return paidAt; } public void setPaidAt(Instant paidAt) { this.paidAt = paidAt; }
    public Instant getExpiresAt() { return expiresAt; } public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public Instant getProviderCreatedAt() { return providerCreatedAt; } public void setProviderCreatedAt(Instant providerCreatedAt) { this.providerCreatedAt = providerCreatedAt; }
    public Instant getLastReconciledAt() { return lastReconciledAt; } public void setLastReconciledAt(Instant lastReconciledAt) { this.lastReconciledAt = lastReconciledAt; }
    public boolean isRequiresManualReview() { return requiresManualReview; } public void setRequiresManualReview(boolean requiresManualReview) { this.requiresManualReview = requiresManualReview; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
