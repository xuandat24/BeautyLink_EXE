package com.example.backend.service;

import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.web.util.HtmlUtils;
import java.time.Instant;
import static com.example.backend.model.DomainEnums.*;

/** Two durable reminders per booking. No synthetic completion and no mail from client actions. */
@Service
public class FeedbackReminderService {
    private final EmailNotificationOutboxRepository outbox;
    private final BookingRepository bookings;
    private final BookingReviewRepository reviews;
    private final PaymentTransactionRepository payments;
    private final BookingCompletionPolicy time;
    private final boolean enabled;
    private final String frontend;
    public FeedbackReminderService(EmailNotificationOutboxRepository outbox, BookingRepository bookings,
            BookingReviewRepository reviews, PaymentTransactionRepository payments, BookingCompletionPolicy time,
            @Value("${app.booking-email.enabled:false}") boolean emailEnabled,
            @Value("${app.booking-email.feedback-enabled:true}") boolean feedbackEnabled,
            @Value("${app.frontend.public-url:http://localhost:5173}") String frontend) {
        this.outbox = outbox; this.bookings = bookings; this.reviews = reviews;
        this.payments = payments; this.time = time; this.enabled = emailEnabled && feedbackEnabled;
        this.frontend = frontend.replaceAll("/+$", "");
    }
    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueueMidpoint(PaymentTransaction payment) {
        Booking booking = payment.getBooking();
        if (!time.now().isBefore(end(booking))) return; // do not replay an obsolete midpoint reminder
        enqueue(booking, payment, EmailNotificationType.REVIEW_MIDPOINT, BookingCompletionPolicy.reviewOpensAt(booking));
    }
    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueueCompleted(Booking booking) {
        if (!enabled || booking.getStatus() != BookingStatus.COMPLETED) return;
        payments.findCanonicalPaidByBookingId(booking.getId(), PaymentTransactionStatus.PAID)
                .ifPresent(payment -> enqueue(booking, payment, EmailNotificationType.REVIEW_COMPLETED, time.now()));
    }
    private void enqueue(Booking booking, PaymentTransaction payment, EmailNotificationType type, Instant due) {
        if (!enabled || payment.getStatus() != PaymentTransactionStatus.PAID || payment.isRequiresManualReview()
                || !BookingCompletionPolicy.hasVerifiedPayment(booking)
                || reviews.existsByBookingId(booking.getId()) || payments.hasUnresolvedByBookingId(booking.getId())
                || outbox.existsByBookingIdAndNotificationTypeAndRecipientRole(booking.getId(), type, EmailRecipientRole.CUSTOMER)) return;
        String url = frontend + "/#bookings";
        String subject = type == EmailNotificationType.REVIEW_MIDPOINT ? "[BeautyLink] Chia sẻ trải nghiệm dịch vụ" : "[BeautyLink] Cảm ơn bạn đã sử dụng dịch vụ";
        String text = "Bạn có thể đánh giá " + booking.getService().getName() + " tại " + booking.getSupplier().getName()
                + ". Chia sẻ số sao, nhận xét và tối đa 3 ảnh trải nghiệm (không tải giấy tờ/thông tin riêng tư). Mở Lịch hẹn của tôi: " + url
                + ". Nếu bạn đã đánh giá, BeautyLink sẽ không gửi thêm lời nhắc.";
        EmailNotificationOutbox job = new EmailNotificationOutbox();
        job.setBooking(booking); job.setPaymentTransaction(payment); job.setNotificationType(type);
        job.setRecipientRole(EmailRecipientRole.CUSTOMER);
        job.setRecipientEmail(BookingConfirmationNotificationService.normalizeEmail(booking.getCustomer().getEmail()));
        job.setSubject(subject); job.setTextBody(text);
        job.setHtmlBody("<div style='font-family:Arial;color:#243047'><h2 style='color:#db2777'>BeautyLink</h2><p>" + HtmlUtils.htmlEscape(text)
                + "</p><a href='" + HtmlUtils.htmlEscape(url) + "'>Đánh giá trải nghiệm</a></div>");
        job.setIdempotencyKey("beautylink-review-" + booking.getId() + "-" + type.name());
        job.setNextAttemptAt(due.isBefore(time.now()) ? time.now() : due);
        job.setStatus(job.getRecipientEmail() == null ? EmailNotificationStatus.SKIPPED : EmailNotificationStatus.PENDING);
        outbox.save(job);
    }
    private Instant end(Booking b) { return BookingCompletionPolicy.appointmentEnd(b).atZone(BookingCompletionPolicy.ZONE).toInstant(); }

    /** Serialize review commit and reminder send on the same booking lock. A provider-accepted email cannot be recalled. */
    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public boolean deliverIfReminder(BookingConfirmationNotificationService.ClaimedEmail claim,
                                     TransactionalEmailSender sender, String from, String replyTo) {
        Long bookingId = outbox.findBookingId(claim.id()).orElse(null);
        if (bookingId == null) return false;
        Booking booking = bookings.findByIdForUpdate(bookingId).orElseThrow();
        EmailNotificationOutbox job = outbox.findByIdAndClaimTokenAndStatus(claim.id(), claim.claimToken(), EmailNotificationStatus.PROCESSING).orElseThrow();
        if (job.getNotificationType() == EmailNotificationType.BOOKING_PAYMENT_CONFIRMED) return false;
        boolean ready = enabled && ReviewService.isEligible(booking, time.now())
                && !payments.hasUnresolvedByBookingId(bookingId) && !reviews.existsByBookingId(bookingId)
                && (job.getNotificationType() != EmailNotificationType.REVIEW_MIDPOINT || time.now().isBefore(end(booking)))
                && (job.getNotificationType() != EmailNotificationType.REVIEW_COMPLETED || booking.getStatus() == BookingStatus.COMPLETED);
        String recipient = BookingConfirmationNotificationService.normalizeEmail(booking.getCustomer().getEmail());
        if (!ready || recipient == null) {
            job.setStatus(EmailNotificationStatus.SKIPPED); job.setLastErrorCode("REVIEW_REMINDER_SUPPRESSED");
        } else {
            var receipt = sender.send(new TransactionalEmailSender.EmailMessage(from, replyTo, recipient,
                    job.getSubject(), job.getTextBody(), job.getHtmlBody(), job.getIdempotencyKey()));
            job.setStatus(EmailNotificationStatus.SENT); job.setSentAt(time.now()); job.setProviderMessageId(receipt.providerMessageId());
        }
        job.setClaimToken(null); job.setLeaseUntil(null);
        return true;
    }
}
