package com.example.backend.service;

import com.example.backend.model.Booking;
import com.example.backend.repository.BookingRepository;
import com.example.backend.repository.PaymentTransactionRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;
import static com.example.backend.model.DomainEnums.*;

@Service
public class BookingHoldExpiryService {
    private final BookingRepository bookings;
    private final PaymentTransactionRepository payments;
    private final BookingCompletionPolicy time;

    public BookingHoldExpiryService(BookingRepository bookings, PaymentTransactionRepository payments,
                                    BookingCompletionPolicy time) {
        this.bookings = bookings;
        this.payments = payments;
        this.time = time;
    }

    public List<Long> candidates() {
        return bookings.findUnpaidUnstartedHoldIds(BookingStatus.PENDING, PaymentStatus.UNPAID,
                time.now().minusSeconds(15 * 60), PageRequest.of(0, 100));
    }

    @Transactional
    public void expire(Long bookingId) {
        Booking booking = bookings.findByIdForUpdate(bookingId).orElse(null);
        if (booking == null || booking.getStatus() != BookingStatus.PENDING
                || booking.getPaymentStatus() != PaymentStatus.UNPAID
                || !booking.getCreatedAt().isBefore(time.now().minusSeconds(15 * 60))
                || payments.findFirstByBookingIdOrderByCreatedAtDesc(bookingId).isPresent()) return;
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setPaymentRetryAllowed(false);
    }

    @Transactional
    @Scheduled(fixedDelayString = "${app.booking-hold.expiry-check-ms:60000}",
               initialDelayString = "${app.booking-hold.expiry-initial-delay-ms:60000}")
    public void expireCandidates() {
        for (Long id : candidates()) expire(id);
    }
}
