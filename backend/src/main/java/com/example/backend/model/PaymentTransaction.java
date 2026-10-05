package com.example.backend.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import static com.example.backend.model.DomainEnums.*;

@Entity
@Table(name = "payment_transactions", indexes = {
        @Index(name = "idx_payment_booking", columnList = "booking_id"),
        @Index(name = "idx_payment_status", columnList = "status")
})
public class PaymentTransaction {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @OneToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "booking_id", nullable = false, unique = true) private Booking booking;
    @Column(nullable = false, unique = true) private Long orderCode;
    @Column(unique = true, length = 80) private String paymentLinkId;
    @Column(length = 1000) private String checkoutUrl;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal amount;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal remainingAmount = BigDecimal.ZERO;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private PaymentOption paymentOption;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private PaymentTransactionStatus status = PaymentTransactionStatus.PENDING;
    @Column(length = 40) private String voucherCode;
    @Column(length = 120) private String paymentReference;
    private Instant paidAt;
    @Column(nullable = false, updatable = false) private Instant createdAt = Instant.now();
    @Column(nullable = false) private Instant updatedAt = Instant.now();
    @Version private long version;

    @PreUpdate void touch() { updatedAt = Instant.now(); }
    public Long getId() { return id; }
    public Booking getBooking() { return booking; } public void setBooking(Booking booking) { this.booking = booking; }
    public Long getOrderCode() { return orderCode; } public void setOrderCode(Long orderCode) { this.orderCode = orderCode; }
    public String getPaymentLinkId() { return paymentLinkId; } public void setPaymentLinkId(String paymentLinkId) { this.paymentLinkId = paymentLinkId; }
    public String getCheckoutUrl() { return checkoutUrl; } public void setCheckoutUrl(String checkoutUrl) { this.checkoutUrl = checkoutUrl; }
    public BigDecimal getAmount() { return amount; } public void setAmount(BigDecimal amount) { this.amount = amount; }
    public BigDecimal getRemainingAmount() { return remainingAmount; } public void setRemainingAmount(BigDecimal remainingAmount) { this.remainingAmount = remainingAmount; }
    public PaymentOption getPaymentOption() { return paymentOption; } public void setPaymentOption(PaymentOption paymentOption) { this.paymentOption = paymentOption; }
    public PaymentTransactionStatus getStatus() { return status; } public void setStatus(PaymentTransactionStatus status) { this.status = status; }
    public String getVoucherCode() { return voucherCode; } public void setVoucherCode(String voucherCode) { this.voucherCode = voucherCode; }
    public String getPaymentReference() { return paymentReference; } public void setPaymentReference(String paymentReference) { this.paymentReference = paymentReference; }
    public Instant getPaidAt() { return paidAt; } public void setPaidAt(Instant paidAt) { this.paidAt = paidAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
