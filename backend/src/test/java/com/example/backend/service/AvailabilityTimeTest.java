package com.example.backend.service;

import com.example.backend.model.*;
import com.example.backend.repository.*;
import com.example.backend.exception.ApiException;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AvailabilityTimeTest {
    final PractitionerRepository practitioners = mock(PractitionerRepository.class);
    final ServiceOfferingRepository services = mock(ServiceOfferingRepository.class);
    final AvailabilityRuleRepository rules = mock(AvailabilityRuleRepository.class);
    final ScheduleExceptionRepository exceptions = mock(ScheduleExceptionRepository.class);
    final BookingRepository bookings = mock(BookingRepository.class);
    final AvailabilityRule rule = new AvailabilityRule();
    final ServiceOffering offering = new ServiceOffering();
    @BeforeEach void setup() {
        var supplier = new Supplier(); supplier.setId(1L);
        var p = new Practitioner(); p.setId(1L); p.setSupplier(supplier); p.setActive(true);
        offering.setSupplier(supplier); offering.setActive(true); offering.setDurationMinutes(60);
        when(practitioners.findById(1L)).thenReturn(Optional.of(p)); when(services.findById(1L)).thenReturn(Optional.of(offering));
        rule.setStartTime(LocalTime.of(9, 0)); rule.setEndTime(LocalTime.of(19, 0)); rule.setSlotMinutes(30);
        when(rules.findByPractitionerIdAndDayOfWeekAndActiveTrue(eq(1L), any())).thenReturn(Optional.of(rule));
    }
    AvailabilityService at(String instant) { return new AvailabilityService(practitioners, services, rules, exceptions, bookings,
            new BookingCompletionPolicy(Clock.fixed(Instant.parse(instant), ZoneOffset.UTC))); }
    @ParameterizedTest @CsvSource({"UTC", "Asia/Ho_Chi_Minh", "America/Los_Angeles"})
    void timezoneDoesNotChangeLeadOrDate(String zone) {
        TimeZone previous = TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone(zone));
            var exact = at("2030-05-01T01:30:00Z").availability(1L, 1L, LocalDate.of(2030, 5, 1)).availableSlots();
            assertTrue(exact.contains(LocalTime.of(9, 0)), "exact 30 minute lead allowed in HCM");
            var after = at("2030-05-01T01:30:00.000000001Z").availability(1L, 1L, LocalDate.of(2030, 5, 1)).availableSlots();
            assertFalse(after.contains(LocalTime.of(9, 0))); assertTrue(after.contains(LocalTime.of(9, 30)));
        } finally { TimeZone.setDefault(previous); }
    }
    @Test void oneCalendarMonthClampsJanuaryEndAndRejectsPast() {
        var service = at("2032-01-30T17:00:00Z"); // 31 Jan HCM, leap year
        assertFalse(service.availability(1L, 1L, LocalDate.of(2032, 2, 29)).availableSlots().isEmpty());
        assertEquals("DATE_TOO_FAR", assertThrows(ApiException.class, () -> service.availability(1L, 1L, LocalDate.of(2032, 3, 1))).getCode());
        assertEquals("PAST_DATE", assertThrows(ApiException.class, () -> service.availability(1L, 1L, LocalDate.of(2032, 1, 30))).getCode());
    }
    @Test void midnightLeadUsesNextVietnamDateAndPreviousOvernightWindow() {
        rule.setStartTime(LocalTime.of(22, 0)); rule.setEndTime(LocalTime.of(2, 0));
        var service = at("2030-05-01T16:45:00Z"); // 23:45 HCM
        assertTrue(service.availability(1L, 1L, LocalDate.of(2030, 5, 1)).availableSlots().isEmpty());
        var slots = service.availability(1L, 1L, LocalDate.of(2030, 5, 2)).availableSlots();
        assertEquals(List.of(LocalTime.of(0, 30), LocalTime.of(1, 0), LocalTime.of(22, 0), LocalTime.of(22, 30), LocalTime.of(23, 0), LocalTime.of(23, 30)), slots);
    }
    @Test void adjacentDateOvernightBookingBlocksItsEntireInterval() {
        rule.setStartTime(LocalTime.of(22, 0)); rule.setEndTime(LocalTime.of(2, 0));
        var booked = new Booking(); booked.setId(12L); booked.setAppointmentDate(LocalDate.of(2030, 5, 1));
        booked.setStartTime(LocalTime.of(23, 30)); booked.setEndTime(LocalTime.of(1, 0));
        when(bookings.findByPractitionerIdAndAppointmentDateBetweenAndStatusNot(any(), any(), any(), any())).thenReturn(List.of(booked));
        var slots = at("2030-05-01T12:00:00Z").availability(1L, 1L, LocalDate.of(2030, 5, 2)).availableSlots();
        assertFalse(slots.contains(LocalTime.MIDNIGHT)); assertFalse(slots.contains(LocalTime.of(0, 30))); assertTrue(slots.contains(LocalTime.of(1, 0)));
    }
    @Test void localTimeWrapCannotInventSlotsOrLoopForever() {
        rule.setStartTime(LocalTime.of(23, 30)); rule.setEndTime(LocalTime.of(23, 59));
        assertTrue(at("2030-05-01T00:00:00Z").availability(1L, 1L, LocalDate.of(2030, 5, 2)).availableSlots().isEmpty());
        rule.setSlotMinutes(0);
        assertEquals("SCHEDULE_INVALID", assertThrows(ApiException.class, () -> at("2030-05-01T00:00:00Z").availability(1L, 1L, LocalDate.of(2030, 5, 2))).getCode());
    }
}
