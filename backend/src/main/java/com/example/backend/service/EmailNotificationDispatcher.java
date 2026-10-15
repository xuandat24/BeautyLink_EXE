package com.example.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class EmailNotificationDispatcher {
    private static final Logger log = LoggerFactory.getLogger(EmailNotificationDispatcher.class);
    private final BookingConfirmationNotificationService notifications;
    private final TransactionalEmailSender emailSender;
    private final String from;
    private final String replyTo;

    public EmailNotificationDispatcher(BookingConfirmationNotificationService notifications,
            TransactionalEmailSender emailSender,
            @Value("${app.booking-email.from:}") String from,
            @Value("${app.booking-email.reply-to:}") String replyTo) {
        this.notifications = notifications;
        this.emailSender = emailSender;
        this.from = from == null ? "" : from.trim();
        this.replyTo = replyTo == null ? "" : replyTo.trim();
    }

    @Scheduled(fixedDelayString = "${app.booking-email.dispatch-ms:15000}",
            initialDelayString = "${app.booking-email.dispatch-initial-delay-ms:30000}")
    public void dispatch() {
        if (!notifications.isEnabled()) return;
        for (BookingConfirmationNotificationService.ClaimedEmail claim : notifications.claimBatch()) {
            TransactionalEmailSender.DeliveryReceipt receipt;
            try {
                receipt = emailSender.send(
                        new TransactionalEmailSender.EmailMessage(from, replyTo, claim.recipientEmail(),
                                claim.subject(), claim.textBody(), claim.htmlBody(), claim.idempotencyKey()));
            } catch (TransactionalEmailSender.EmailDeliveryException failure) {
                safelyMarkFailed(claim, failure);
                log.warn("Booking email delivery deferred jobId={} code={} kind={}",
                        claim.id(), failure.getSafeCode(), failure.getKind());
                continue;
            } catch (RuntimeException failure) {
                safelyMarkFailed(claim, new TransactionalEmailSender.EmailDeliveryException(
                        TransactionalEmailSender.FailureKind.TRANSIENT, "EMAIL_DISPATCH_UNEXPECTED"));
                log.error("Booking email dispatcher failed jobId={} type={}",
                        claim.id(), failure.getClass().getSimpleName());
                continue;
            }
            try {
                notifications.markSent(claim, receipt.providerMessageId());
            } catch (RuntimeException failure) {
                // The provider accepted the message but the local acknowledgement did not persist.
                // Retrying with the same provider idempotency key is the safest available outcome.
                safelyMarkFailed(claim, new TransactionalEmailSender.EmailDeliveryException(
                        TransactionalEmailSender.FailureKind.AMBIGUOUS, "EMAIL_DELIVERY_ACK_PERSIST_FAILED"));
                log.error("Booking email acknowledgement failed jobId={} type={}",
                        claim.id(), failure.getClass().getSimpleName());
            }
        }
    }

    private void safelyMarkFailed(BookingConfirmationNotificationService.ClaimedEmail claim,
            TransactionalEmailSender.EmailDeliveryException failure) {
        try {
            notifications.markFailed(claim, failure);
        } catch (RuntimeException persistenceFailure) {
            // The lease will expire and make the job claimable after a worker/database interruption.
            log.error("Booking email failure state could not be persisted jobId={} type={}",
                    claim.id(), persistenceFailure.getClass().getSimpleName());
        }
    }
}
