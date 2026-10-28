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
    public BookingCompletionPolicy(Clock clock) { this.clock = clock; }
    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    public static final long HOLD_SECONDS = 12 * 60;
    public static Instant holdUntil(Booking booking) { return booking.getCreatedAt().plusSeconds(HOLD_SECONDS); }
    public static Instant reviewOpensAt(Booking booking) {
        Instant start = startsAt(booking);
        Instant end = appointmentEnd(booking).atZone(ZONE).toInstant();
        return start.plusMillis(Duration.between(start, end).toMillis() / 2);
    }
    public Instant now() { return clock.instant(); }
    public LocalDate today() { return now().atZone(ZONE).toLocalDate(); }
    public static Instant startsAt(Booking booking) { return booking.getAppointmentDate().atTime(booking.getStartTime()).atZone(ZONE).toInstant(); }
    public boolean beforeStart(Booking booking) { return now().isBefore(startsAt(booking)); }
    public boolean validBookingDate(LocalDate date) { LocalDate today = today(); return !date.isBefore(today) && !date.isAfter(today.plusMonths(1)); }
    public boolean hasBookingLead(LocalDateTime start) { return !start.atZone(ZONE).toInstant().isBefore(now().plusSeconds(1800)); }

    public boolean canComplete(Booking booking) {
        return booking.getStatus() == BookingStatus.CONFIRMED
                && hasVerifiedPayment(booking)
                && !now().isBefore(scheduledEnd(booking));
    }

    public static boolean hasVerifiedPayment(Booking booking) {
        return booking.getPaymentStatus() == PaymentStatus.PAID
                || booking.getPaymentStatus() == PaymentStatus.PARTIALLY_PAID;
    }

    private Instant scheduledEnd(Booking booking) {
        return appointmentEnd(booking).atZone(ZONE).toInstant();
    }
    public static LocalDateTime appointmentEnd(Booking booking) {
        LocalDate endDate = booking.getAppointmentDate();
        // A service may finish after midnight.
        if (!booking.getEndTime().isAfter(booking.getStartTime())) endDate = endDate.plusDays(1);
        return endDate.atTime(booking.getEndTime());
    }
    public static boolean overlaps(Booking other, LocalDateTime start, LocalDateTime end) {
        return start.isBefore(appointmentEnd(other)) && end.isAfter(other.getAppointmentDate().atTime(other.getStartTime()));
    }
}
