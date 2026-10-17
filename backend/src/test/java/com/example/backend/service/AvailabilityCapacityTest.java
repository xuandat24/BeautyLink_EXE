package com.example.backend.service;

import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static com.example.backend.model.DomainEnums.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AvailabilityCapacityTest {
    final PractitionerRepository practitioners = mock(PractitionerRepository.class);
    final ServiceOfferingRepository services = mock(ServiceOfferingRepository.class);
    final AvailabilityRuleRepository rules = mock(AvailabilityRuleRepository.class);
    final ScheduleExceptionRepository exceptions = mock(ScheduleExceptionRepository.class);
    final BookingRepository bookings = mock(BookingRepository.class);
    final BookingCompletionPolicy clock = new BookingCompletionPolicy(Clock.fixed(Instant.parse("2030-05-01T00:00:00Z"), ZoneOffset.UTC));
    final AvailabilityService availability = new AvailabilityService(practitioners, services, rules, exceptions, bookings, clock);

    @Test void fourDaysKeepCapacityUntilEveryQualifiedWorkerIsBusy() {
        Supplier supplier = new Supplier(); supplier.setId(1L);
        ServiceOffering service = new ServiceOffering(); service.setId(10L); service.setSupplier(supplier);
        service.setActive(true); service.setDurationMinutes(90);
        when(services.findById(10L)).thenReturn(Optional.of(service));
        List<Practitioner> people = new ArrayList<>();
        for (long id = 1; id <= 4; id++) {
            Practitioner person = new Practitioner(); person.setId(id); person.setSupplier(supplier); person.setActive(true);
            people.add(person);
            AvailabilityRule rule = new AvailabilityRule(); rule.setStartTime(LocalTime.of(9, 0)); rule.setEndTime(LocalTime.of(12, 0));
            rule.setBreakStart(LocalTime.of(11, 30)); rule.setBreakEnd(LocalTime.of(12, 0)); rule.setSlotMinutes(30);
            when(rules.findByPractitionerIdAndDayOfWeekAndActiveTrue(eq(id), any())).thenReturn(Optional.of(rule));
        }
        // One worker is explicitly not assigned to this service.
        people.get(3).setServiceAssignmentsRestricted(true);
        when(practitioners.findBySupplierIdAndActiveTrue(1L)).thenReturn(people);
        for (int offset = 1; offset <= 4; offset++) {
            LocalDate day = clock.today().plusDays(offset);
            int occupied = offset - 1;
            for (long id = 1; id <= 3; id++) {
                List<Booking> blocked = id <= occupied ? List.of(booking(id, day)) : List.of();
                when(bookings.findByPractitionerIdAndAppointmentDateBetweenAndStatusNot(eq(id), any(), any(), eq(BookingStatus.CANCELLED)))
                        .thenReturn(blocked);
            }
            var response = availability.capacity(10L, day);
            assertEquals(3, response.qualifiedPractitioners());
            var ten = response.slots().stream().filter(slot -> slot.time().equals(LocalTime.of(10, 0))).findFirst().orElseThrow();
            assertEquals(3 - occupied, ten.availablePractitioners());
            assertEquals(occupied == 3 ? "FULLY_BOOKED" : "AVAILABLE", ten.state());
            assertTrue(response.slots().stream().noneMatch(slot -> slot.time().equals(LocalTime.of(10, 30))));
        }
    }

    @Test void noQualifiedPersonHasExplicitReason() {
        Supplier supplier = new Supplier(); supplier.setId(1L);
        ServiceOffering service = new ServiceOffering(); service.setId(10L); service.setSupplier(supplier); service.setActive(true);
        when(services.findById(10L)).thenReturn(Optional.of(service));
        when(practitioners.findBySupplierIdAndActiveTrue(1L)).thenReturn(List.of());
        assertEquals("NO_QUALIFIED_PRACTITIONER", availability.capacity(10L, clock.today().plusDays(1)).reason());
    }

    private Booking booking(long id, LocalDate day) {
        Booking booking = new Booking(); booking.setId(id); booking.setAppointmentDate(day);
        booking.setStartTime(LocalTime.of(10, 0)); booking.setEndTime(LocalTime.of(11, 30));
        booking.setStatus(BookingStatus.PENDING); booking.setPaymentStatus(PaymentStatus.UNPAID);
        return booking;
    }
}
