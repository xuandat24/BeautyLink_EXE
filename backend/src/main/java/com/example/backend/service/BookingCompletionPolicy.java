package com.example.backend.service;

import com.example.backend.model.Booking;
import org.springframework.stereotype.Component;
import java.time.*;
import static com.example.backend.model.DomainEnums.*;

/** Appointment times are local to Vietnam, independent of the server timezone. */
@Component
public class BookingCompletionPolicy {
    private final Clock clock;

    public BookingCompletionPolicy() { this(Clock.systemUTC()); }
    BookingCompletionPolicy(Clock clock) { this.clock = clock; }

    public boolean canComplete(Booking booking) {
        return booking.getStatus() == BookingStatus.CONFIRMED
                && hasVerifiedPayment(booking)
                && !clock.instant().isBefore(scheduledEnd(booking));
    }

    public static boolean hasVerifiedPayment(Booking booking) {
        return booking.getPaymentStatus() == PaymentStatus.PAID
                || booking.getPaymentStatus() == PaymentStatus.PARTIALLY_PAID;
    }

    private Instant scheduledEnd(Booking booking) {
        LocalDate endDate = booking.getAppointmentDate();
        // A service may finish after midnight.
        if (!booking.getEndTime().isAfter(booking.getStartTime())) endDate = endDate.plusDays(1);
        return endDate.atTime(booking.getEndTime()).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();
    }
}
