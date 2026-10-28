package com.example.backend.service;

public interface TransactionalEmailSender {
    DeliveryReceipt send(EmailMessage message);
    boolean isConfigured();
    /** Reminder sends hold a booking lock: require bounded, provider-idempotent delivery. */
    default DeliveryReceipt sendReminder(EmailMessage message) {
        throw new EmailDeliveryException(FailureKind.PERMANENT, "EMAIL_REMINDER_TRANSPORT_UNSUPPORTED");
    }

    record EmailMessage(String from, String replyTo, String to, String subject, String textBody,
                        String htmlBody, String idempotencyKey) {}
    record DeliveryReceipt(String providerMessageId) {}

    enum FailureKind { TRANSIENT, PERMANENT, AMBIGUOUS }

    final class EmailDeliveryException extends RuntimeException {
        private final FailureKind kind;
        private final String safeCode;

        public EmailDeliveryException(FailureKind kind, String safeCode) {
            super(safeCode);
            this.kind = kind;
            this.safeCode = safeCode;
        }

        public FailureKind getKind() { return kind; }
        public String getSafeCode() { return safeCode; }
    }
}
