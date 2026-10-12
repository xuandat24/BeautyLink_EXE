package com.example.backend.service;

import com.example.backend.dto.ApiDtos.UpsertBookingReviewRequest;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.time.*;
import java.util.Optional;
import static com.example.backend.model.DomainEnums.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class BookingLifecycleTest {
    private final Instant now = Instant.parse("2026-10-12T10:00:00Z"); // 17:00 Vietnam
    private final BookingCompletionPolicy policy = new BookingCompletionPolicy(Clock.fixed(now, ZoneOffset.UTC));
    private final BookingRepository bookings = mock(BookingRepository.class);
    private final BookingReviewRepository reviews = mock(BookingReviewRepository.class);
    private final BookingService service = new BookingService(bookings, mock(ServiceOfferingRepository.class),
            mock(PractitionerRepository.class), mock(SupplierRepository.class), mock(AvailabilityService.class), reviews, policy);

    @ParameterizedTest
    @CsvSource({
        "PENDING,UNPAID,false,false", "PENDING,PAID,false,false",
        "CONFIRMED,UNPAID,false,false", "CONFIRMED,PARTIALLY_PAID,true,false",
        "CONFIRMED,PAID,true,false", "COMPLETED,UNPAID,false,false",
        "COMPLETED,PARTIALLY_PAID,false,true", "COMPLETED,PAID,false,true",
        "COMPLETED,REFUNDED,false,false", "CANCELLED,UNPAID,false,false",
        "CANCELLED,PARTIALLY_PAID,false,false", "CANCELLED,PAID,false,false"
    })
    void paymentDoesNotReplaceCompletion(BookingStatus status, PaymentStatus payment, boolean canComplete, boolean canReview) {
        Booking booking = booking(status, payment);
        assertEquals(canComplete, policy.canComplete(booking));
        assertEquals(canReview, ReviewService.isEligible(booking));
        if (!canReview) {
            when(bookings.findByIdForUpdate(1L)).thenReturn(Optional.of(booking));
            ReviewService reviewService = new ReviewService(bookings, reviews);
            for (ReviewTargetType target : ReviewTargetType.values()) {
                ApiException error = assertThrows(ApiException.class,
                        () -> reviewService.upsert(booking.getCustomer(), 1L, target, new UpsertBookingReviewRequest(5, "Review")));
                assertEquals("REVIEW_NOT_ELIGIBLE", error.getCode());
            }
            verifyNoInteractions(reviews);
        }
    }

    @Test void completionUsesVietnamTimeAndIncludesExactEnd() {
        Booking booking = booking(BookingStatus.CONFIRMED, PaymentStatus.PAID);
        booking.setEndTime(LocalTime.of(17, 0));
        assertTrue(policy.canComplete(booking));
        booking.setEndTime(LocalTime.of(17, 1));
        assertFalse(policy.canComplete(booking));
        booking.setAppointmentDate(LocalDate.of(2026, 10, 13));
        assertFalse(policy.canComplete(booking));
    }

    @Test void overnightBookingCannotCompleteOnItsStartDate() {
        Booking booking = booking(BookingStatus.CONFIRMED, PaymentStatus.PAID);
        booking.setStartTime(LocalTime.of(23, 30)); booking.setEndTime(LocalTime.of(0, 30));
        assertFalse(policy.canComplete(booking));
        booking.setAppointmentDate(LocalDate.of(2026, 10, 11));
        assertTrue(policy.canComplete(booking));
    }

    @Test void equalStartAndEndMeansNextDayAndRequiresFullElapsedDay() {
        Booking booking = booking(BookingStatus.CONFIRMED, PaymentStatus.PARTIALLY_PAID);
        booking.setStartTime(LocalTime.of(17, 0)); booking.setEndTime(LocalTime.of(17, 0));
        assertFalse(policy.canComplete(booking));
        booking.setAppointmentDate(LocalDate.of(2026, 10, 11));
        assertTrue(policy.canComplete(booking));
    }

    @ParameterizedTest @CsvSource({"PENDING,UNPAID", "CONFIRMED,UNPAID", "CANCELLED,PAID", "CANCELLED,PARTIALLY_PAID"})
    void invalidBookingCannotBeCompleted(BookingStatus status, PaymentStatus payment) {
        Booking booking = booking(status, payment);
        when(bookings.findByIdForUpdate(1L)).thenReturn(Optional.of(booking));
        assertEquals("BOOKING_NOT_COMPLETABLE", assertThrows(ApiException.class,
                () -> service.complete(booking.getCustomer(), 1L)).getCode());
        assertEquals(status, booking.getStatus());
    }

    @Test void otherCustomerCannotCompleteOrReview() {
        Booking booking = booking(BookingStatus.CONFIRMED, PaymentStatus.PAID);
        when(bookings.findByIdForUpdate(1L)).thenReturn(Optional.of(booking));
        UserAccount stranger = new UserAccount(); stranger.setId(2L);
        assertEquals("BOOKING_FORBIDDEN", assertThrows(ApiException.class, () -> service.complete(stranger, 1L)).getCode());
        assertEquals("REVIEW_FORBIDDEN", assertThrows(ApiException.class,
                () -> new ReviewService(bookings, reviews).upsert(stranger, 1L, ReviewTargetType.SERVICE, new UpsertBookingReviewRequest(5, null))).getCode());
        verifyNoInteractions(reviews);
    }

    @Test void prematureCompletionDoesNotChangeState() {
        Booking booking = booking(BookingStatus.CONFIRMED, PaymentStatus.PARTIALLY_PAID);
        booking.setEndTime(LocalTime.of(17, 1));
        when(bookings.findByIdForUpdate(1L)).thenReturn(Optional.of(booking));
        assertThrows(ApiException.class, () -> service.complete(booking.getCustomer(), 1L));
        assertEquals(BookingStatus.CONFIRMED, booking.getStatus());
    }

    private Booking booking(BookingStatus status, PaymentStatus payment) {
        Booking booking = new Booking(); booking.setId(1L);
        UserAccount customer = new UserAccount(); customer.setId(1L); booking.setCustomer(customer);
        booking.setStatus(status); booking.setPaymentStatus(payment);
        booking.setAppointmentDate(LocalDate.of(2026, 10, 12));
        booking.setStartTime(LocalTime.of(15, 0)); booking.setEndTime(LocalTime.of(16, 0));
        return booking;
    }
}
