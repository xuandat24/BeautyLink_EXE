package com.example.backend;
import java.time.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class BrowserFixtureDateTest {
    @Test void futureHistoryBookingsNeverLandOnTheClosedSundayAcrossWeekBoundaries() {
        for(int day=0;day<7;day++) {
            var today=LocalDate.of(2026,10,26).plusDays(day);
            var next=BookingReviewSmokeServer.futureFixtureDate(today);
            assertEquals(DayOfWeek.MONDAY,next.getDayOfWeek());
            assertFalse(next.isBefore(today.plusDays(2)));
        }
        assertEquals(LocalDate.of(2026,11,2),BookingReviewSmokeServer.futureFixtureDate(LocalDate.of(2026,10,30)));
    }
}
