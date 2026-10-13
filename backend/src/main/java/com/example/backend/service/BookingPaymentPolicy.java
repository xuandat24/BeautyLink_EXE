package com.example.backend.service;

import com.example.backend.model.Booking;
import com.example.backend.model.PaymentTransaction;
import java.util.List;
import static com.example.backend.model.DomainEnums.*;

/** Shared capabilities; provider verification and locking remain in PaymentService. */
public final class BookingPaymentPolicy {
    private BookingPaymentPolicy() {}
    public static boolean manual(List<PaymentTransaction> attempts) {
        return attempts.stream().anyMatch(p -> p.isRequiresManualReview() || p.getStatus() == PaymentTransactionStatus.REVIEW_REQUIRED);
    }
    public static boolean unresolved(List<PaymentTransaction> attempts) {
        return manual(attempts) || attempts.stream().anyMatch(p -> p.getStatus() == PaymentTransactionStatus.PENDING);
    }
    public static boolean paid(Booking booking) { return BookingCompletionPolicy.hasVerifiedPayment(booking); }
    public static boolean canCancel(Booking b, List<PaymentTransaction> attempts) {
        return b.getStatus() != BookingStatus.CANCELLED && b.getStatus() != BookingStatus.COMPLETED
                && b.getPaymentStatus() == PaymentStatus.UNPAID && !manual(attempts)
                && attempts.stream().noneMatch(p -> p.getStatus() == PaymentTransactionStatus.PAID);
    }
    public static String reason(Booking b, List<PaymentTransaction> attempts) {
        if (manual(attempts)) return "PAYMENT_REVIEW_REQUIRED";
        if (unresolved(attempts) && (paid(b) || b.getStatus() == BookingStatus.CANCELLED
                || attempts.stream().filter(p -> p.getStatus() == PaymentTransactionStatus.PENDING).count() > 1
                || attempts.stream().anyMatch(p -> p.getStatus() == PaymentTransactionStatus.PENDING && (p.getCheckoutUrl() == null
                    || (p.getExpiresAt() != null && !p.getExpiresAt().isAfter(java.time.Instant.now())))))) return "PAYMENT_RECONCILING";
        if (b.getPaymentStatus() == PaymentStatus.REFUNDED) return "BOOKING_REFUNDED";
        if (paid(b)) return "PAYMENT_ALREADY_PAID";
        if (attempts.stream().anyMatch(p -> p.getStatus() == PaymentTransactionStatus.PAID)) return "PAYMENT_STATE_CONFLICT";
        if (b.getStatus() == BookingStatus.COMPLETED) return "BOOKING_COMPLETED";
        if (b.getStatus() == BookingStatus.CANCELLED && !b.isPaymentRetryAllowed()) return "BOOKING_CANCELLED";
        if (!b.getAppointmentDate().atTime(b.getStartTime()).atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toInstant().isAfter(java.time.Instant.now())) return "SLOT_UNAVAILABLE";
        return null;
    }
}
