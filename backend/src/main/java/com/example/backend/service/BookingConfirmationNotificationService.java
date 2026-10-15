package com.example.backend.service;

import com.example.backend.model.Booking;
import com.example.backend.model.EmailNotificationOutbox;
import com.example.backend.model.PaymentTransaction;
import com.example.backend.repository.EmailNotificationOutboxRepository;
import jakarta.mail.internet.AddressException;
import jakarta.mail.internet.InternetAddress;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static com.example.backend.model.DomainEnums.*;

@Service
public class BookingConfirmationNotificationService {
    private final EmailNotificationOutboxRepository outbox;
    private final BookingConfirmationEmailTemplate templates;
    private final boolean enabled;
    private final int maxAttempts;
    private final int batchSize;
    private final Duration leaseDuration;

    public BookingConfirmationNotificationService(
            EmailNotificationOutboxRepository outbox,
            BookingConfirmationEmailTemplate templates,
            @Value("${app.booking-email.enabled:false}") boolean enabled,
            @Value("${app.booking-email.max-attempts:5}") int maxAttempts,
            @Value("${app.booking-email.dispatch-batch-size:20}") int batchSize,
            @Value("${app.booking-email.lease-seconds:120}") long leaseSeconds) {
        this.outbox = outbox;
        this.templates = templates;
        this.enabled = enabled;
        this.maxAttempts = Math.max(1, maxAttempts);
        this.batchSize = Math.max(1, Math.min(100, batchSize));
        this.leaseDuration = Duration.ofSeconds(Math.max(30, leaseSeconds));
    }

    /** Called only from the transaction that accepts a canonical verified payment. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueueVerifiedPayment(PaymentTransaction payment) {
        if (!enabled) return;
        Booking booking = payment.getBooking();
        if (payment.getStatus() != PaymentTransactionStatus.PAID || payment.isRequiresManualReview()
                || booking.getStatus() != BookingStatus.CONFIRMED
                || (booking.getPaymentStatus() != PaymentStatus.PAID
                    && booking.getPaymentStatus() != PaymentStatus.PARTIALLY_PAID)) {
            throw new IllegalStateException("Booking confirmation email requires a canonical verified payment");
        }
        enqueue(payment, templates.customer(payment));
        enqueue(payment, templates.supplier(payment));
    }

    private void enqueue(PaymentTransaction payment, BookingConfirmationEmailTemplate.RenderedEmail rendered) {
        Booking booking = payment.getBooking();
        if (outbox.existsByBookingIdAndNotificationTypeAndRecipientRole(booking.getId(),
                EmailNotificationType.BOOKING_PAYMENT_CONFIRMED, rendered.recipientRole())) return;

        EmailNotificationOutbox job = new EmailNotificationOutbox();
        job.setBooking(booking);
        job.setPaymentTransaction(payment);
        job.setNotificationType(EmailNotificationType.BOOKING_PAYMENT_CONFIRMED);
        job.setRecipientRole(rendered.recipientRole());
        job.setRecipientEmail(normalizeEmail(rendered.recipientEmail()));
        job.setSubject(rendered.subject());
        job.setTextBody(rendered.textBody());
        job.setHtmlBody(rendered.htmlBody());
        job.setIdempotencyKey("beautylink-booking-payment-confirmed-" + booking.getId() + "-"
                + rendered.recipientRole().name().toLowerCase());
        job.setNextAttemptAt(Instant.now());
        if (job.getRecipientEmail() == null) {
            job.setStatus(EmailNotificationStatus.SKIPPED);
            job.setLastErrorCode("EMAIL_RECIPIENT_MISSING_OR_INVALID");
        } else {
            job.setStatus(EmailNotificationStatus.PENDING);
        }
        outbox.save(job);
    }

    @Transactional
    public List<ClaimedEmail> claimBatch() {
        if (!enabled) return List.of();
        Instant now = Instant.now();
        String claimToken = UUID.randomUUID().toString();
        List<EmailNotificationOutbox> jobs = outbox.findClaimable(EmailNotificationStatus.PENDING,
                EmailNotificationStatus.RETRY, EmailNotificationStatus.PROCESSING, now,
                PageRequest.of(0, batchSize));
        for (EmailNotificationOutbox job : jobs) {
            job.setStatus(EmailNotificationStatus.PROCESSING);
            job.setAttemptCount(job.getAttemptCount() + 1);
            job.setClaimToken(claimToken);
            job.setLeaseUntil(now.plus(leaseDuration));
        }
        return jobs.stream().map(job -> new ClaimedEmail(job.getId(), claimToken, job.getRecipientEmail(),
                job.getSubject(), job.getTextBody(), job.getHtmlBody(), job.getIdempotencyKey())).toList();
    }

    @Transactional
    public void markSent(ClaimedEmail claim, String providerMessageId) {
        EmailNotificationOutbox job = claimed(claim);
        job.setStatus(EmailNotificationStatus.SENT);
        job.setProviderMessageId(providerMessageId);
        job.setSentAt(Instant.now());
        job.setLastErrorCode(null);
        clearLease(job);
    }

    @Transactional
    public void markFailed(ClaimedEmail claim, TransactionalEmailSender.EmailDeliveryException failure) {
        EmailNotificationOutbox job = claimed(claim);
        job.setLastErrorCode(failure.getSafeCode());
        if (failure.getKind() == TransactionalEmailSender.FailureKind.PERMANENT
                || job.getAttemptCount() >= maxAttempts) {
            job.setStatus(EmailNotificationStatus.FAILED_PERMANENT);
            job.setNextAttemptAt(Instant.now());
        } else {
            job.setStatus(EmailNotificationStatus.RETRY);
            long delaySeconds = Math.min(3600, 30L * (1L << Math.min(10, job.getAttemptCount() - 1)));
            job.setNextAttemptAt(Instant.now().plusSeconds(delaySeconds));
        }
        clearLease(job);
    }

    public boolean isEnabled() { return enabled; }

    private EmailNotificationOutbox claimed(ClaimedEmail claim) {
        return outbox.findByIdAndClaimTokenAndStatus(claim.id(), claim.claimToken(), EmailNotificationStatus.PROCESSING)
                .orElseThrow(() -> new IllegalStateException("Email notification lease is no longer owned"));
    }

    private static void clearLease(EmailNotificationOutbox job) {
        job.setClaimToken(null);
        job.setLeaseUntil(null);
    }

    static String normalizeEmail(String value) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.trim().toLowerCase();
        try {
            InternetAddress address = new InternetAddress(normalized, true);
            address.validate();
            return normalized.equals(address.getAddress()) ? normalized : null;
        } catch (AddressException exception) {
            return null;
        }
    }

    public record ClaimedEmail(Long id, String claimToken, String recipientEmail, String subject,
                               String textBody, String htmlBody, String idempotencyKey) {}
}
