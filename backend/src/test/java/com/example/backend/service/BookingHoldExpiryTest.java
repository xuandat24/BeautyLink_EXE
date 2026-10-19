package com.example.backend.service;

import com.example.backend.model.Booking;
import com.example.backend.model.PaymentTransaction;
import com.example.backend.repository.BookingRepository;
import com.example.backend.repository.PaymentTransactionRepository;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.Optional;
import static com.example.backend.model.DomainEnums.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class BookingHoldExpiryTest {
    final BookingRepository bookings = mock(BookingRepository.class);
    final PaymentTransactionRepository payments = mock(PaymentTransactionRepository.class);
    final BookingHoldExpiryService expiry = new BookingHoldExpiryService(bookings, payments,
            new BookingCompletionPolicy(Clock.fixed(Instant.parse("2030-01-01T00:00:00Z"), ZoneOffset.UTC)));

    @Test void abandonedBookingWithoutAttemptReleasesCapacity() {
        Booking booking = stalePending();
        when(bookings.findByIdForUpdate(1L)).thenReturn(Optional.of(booking));
        expiry.expire(1L);
        assertEquals(BookingStatus.CANCELLED, booking.getStatus());
        assertFalse(booking.isPaymentRetryAllowed());
    }

    @Test void anyAttemptOrVerifiedPaymentPreventsRelease() {
        Booking booking = stalePending();
        when(bookings.findByIdForUpdate(1L)).thenReturn(Optional.of(booking));
        when(payments.findFirstByBookingIdOrderByCreatedAtDesc(1L)).thenReturn(Optional.of(new PaymentTransaction()));
        expiry.expire(1L);
        assertEquals(BookingStatus.PENDING, booking.getStatus());
        booking.setPaymentStatus(PaymentStatus.PARTIALLY_PAID);
        expiry.expire(1L);
        assertEquals(BookingStatus.PENDING, booking.getStatus());
    }

    private Booking stalePending() {
        Booking booking = new Booking(); booking.setId(1L);
        booking.setStatus(BookingStatus.PENDING); booking.setPaymentStatus(PaymentStatus.UNPAID);
        return booking;
    }
}
