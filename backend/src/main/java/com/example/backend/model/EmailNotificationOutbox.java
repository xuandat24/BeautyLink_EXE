package com.example.backend.model;

import jakarta.persistence.*;
import java.time.Instant;

import static com.example.backend.model.DomainEnums.*;

@Entity
@Table(name = "email_notification_outbox", uniqueConstraints = {
        @UniqueConstraint(name = "uk_email_outbox_booking_type_role",
                columnNames = {"booking_id", "notification_type", "recipient_role"}),
        @UniqueConstraint(name = "uk_email_outbox_idempotency_key", columnNames = "idempotency_key")
}, indexes = {
        @Index(name = "idx_email_outbox_dispatch", columnList = "status,next_attempt_at,lease_until"),
        @Index(name = "idx_email_outbox_payment", columnList = "payment_transaction_id")
})
public class EmailNotificationOutbox {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "booking_id", nullable = false) private Booking booking;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "payment_transaction_id", nullable = false) private PaymentTransaction paymentTransaction;
    @Enumerated(EnumType.STRING) @Column(name = "notification_type", nullable = false, length = 50) private EmailNotificationType notificationType;
    @Enumerated(EnumType.STRING) @Column(name = "recipient_role", nullable = false, length = 20) private EmailRecipientRole recipientRole;
    @Column(name = "recipient_email", length = 320) private String recipientEmail;
    @Column(nullable = false, length = 255) private String subject;
    @Lob @Column(name = "text_body", nullable = false, columnDefinition = "LONGTEXT") private String textBody;
    @Lob @Column(name = "html_body", nullable = false, columnDefinition = "LONGTEXT") private String htmlBody;
    @Column(name = "idempotency_key", nullable = false, length = 180) private String idempotencyKey;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30) private EmailNotificationStatus status = EmailNotificationStatus.PENDING;
    @Column(name = "attempt_count", nullable = false) private int attemptCount;
    @Column(name = "next_attempt_at", nullable = false) private Instant nextAttemptAt = Instant.now();
    @Column(name = "lease_until") private Instant leaseUntil;
    @Column(name = "claim_token", length = 36) private String claimToken;
    @Column(name = "provider_message_id", length = 160) private String providerMessageId;
    @Column(name = "last_error_code", length = 80) private String lastErrorCode;
    @Column(name = "sent_at") private Instant sentAt;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt = Instant.now();
    @Column(name = "updated_at", nullable = false) private Instant updatedAt = Instant.now();
    @Version private long version;

    @PreUpdate void touch() { updatedAt = Instant.now(); }

    public Long getId() { return id; }
    public Booking getBooking() { return booking; } public void setBooking(Booking booking) { this.booking = booking; }
    public PaymentTransaction getPaymentTransaction() { return paymentTransaction; } public void setPaymentTransaction(PaymentTransaction paymentTransaction) { this.paymentTransaction = paymentTransaction; }
    public EmailNotificationType getNotificationType() { return notificationType; } public void setNotificationType(EmailNotificationType notificationType) { this.notificationType = notificationType; }
    public EmailRecipientRole getRecipientRole() { return recipientRole; } public void setRecipientRole(EmailRecipientRole recipientRole) { this.recipientRole = recipientRole; }
    public String getRecipientEmail() { return recipientEmail; } public void setRecipientEmail(String recipientEmail) { this.recipientEmail = recipientEmail; }
    public String getSubject() { return subject; } public void setSubject(String subject) { this.subject = subject; }
    public String getTextBody() { return textBody; } public void setTextBody(String textBody) { this.textBody = textBody; }
    public String getHtmlBody() { return htmlBody; } public void setHtmlBody(String htmlBody) { this.htmlBody = htmlBody; }
    public String getIdempotencyKey() { return idempotencyKey; } public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public EmailNotificationStatus getStatus() { return status; } public void setStatus(EmailNotificationStatus status) { this.status = status; }
    public int getAttemptCount() { return attemptCount; } public void setAttemptCount(int attemptCount) { this.attemptCount = attemptCount; }
    public Instant getNextAttemptAt() { return nextAttemptAt; } public void setNextAttemptAt(Instant nextAttemptAt) { this.nextAttemptAt = nextAttemptAt; }
    public Instant getLeaseUntil() { return leaseUntil; } public void setLeaseUntil(Instant leaseUntil) { this.leaseUntil = leaseUntil; }
    public String getClaimToken() { return claimToken; } public void setClaimToken(String claimToken) { this.claimToken = claimToken; }
    public String getProviderMessageId() { return providerMessageId; } public void setProviderMessageId(String providerMessageId) { this.providerMessageId = providerMessageId; }
    public String getLastErrorCode() { return lastErrorCode; } public void setLastErrorCode(String lastErrorCode) { this.lastErrorCode = lastErrorCode; }
    public Instant getSentAt() { return sentAt; } public void setSentAt(Instant sentAt) { this.sentAt = sentAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
