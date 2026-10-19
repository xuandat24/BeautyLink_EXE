package com.example.backend.service;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import static com.example.backend.model.DomainEnums.BookingStatus;

@Service
@Transactional(readOnly = true)
public class AvailabilityService {
    private final BookingCompletionPolicy time;
    private final PractitionerRepository practitioners;
    private final ServiceOfferingRepository services;
    private final AvailabilityRuleRepository rules;
    private final ScheduleExceptionRepository exceptions;
    private final BookingRepository bookings;

    public AvailabilityService(PractitionerRepository practitioners, ServiceOfferingRepository services,
            AvailabilityRuleRepository rules, ScheduleExceptionRepository exceptions, BookingRepository bookings,
            BookingCompletionPolicy time) {
        this.practitioners = practitioners;
        this.services = services;
        this.rules = rules;
        this.exceptions = exceptions;
        this.bookings = bookings;
        this.time = time;
    }

    public AvailabilityResponse availability(Long serviceId, Long practitionerId, LocalDate date) {
        return availability(serviceId, practitionerId, date, null);
    }

    public AvailabilityResponse availability(Long serviceId, Long practitionerId, LocalDate date, Long excludedBookingId) {
        validateDate(date);
        ServiceOffering service = requireService(serviceId);
        Practitioner practitioner = practitioners.findById(practitionerId).filter(Practitioner::isActive)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PRACTITIONER_NOT_FOUND", "Không tìm thấy chuyên viên"));
        if (!practitioner.getSupplier().getId().equals(service.getSupplier().getId()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "PRACTITIONER_MISMATCH", "Chuyên viên không thuộc cơ sở này");
        return new AvailabilityResponse(practitionerId, date, slotsFor(service, practitioner, date, excludedBookingId, false));
    }

    /** Shop-wide capacity is the union of qualified workers' schedule slots, not one worker's calendar. */
    public ServiceCapacityResponse capacity(Long serviceId, LocalDate date) {
        validateDate(date);
        ServiceOffering service = requireService(serviceId);
        List<Practitioner> qualified = practitioners.findBySupplierIdAndActiveTrue(service.getSupplier().getId()).stream()
                .filter(p -> p.supports(service)).toList();
        SortedMap<LocalTime, Integer> remaining = new TreeMap<>();
        for (Practitioner practitioner : qualified) {
            for (LocalTime slot : slotsFor(service, practitioner, date, null, true)) remaining.putIfAbsent(slot, 0);
            for (LocalTime slot : slotsFor(service, practitioner, date, null, false)) remaining.merge(slot, 1, Integer::sum);
        }
        List<CapacitySlotResponse> slots = remaining.entrySet().stream()
                .map(e -> new CapacitySlotResponse(e.getKey(), e.getValue(),
                        e.getValue() == 0 ? "FULLY_BOOKED" : "AVAILABLE")).toList();
        String reason = qualified.isEmpty() ? "NO_QUALIFIED_PRACTITIONER" : slots.isEmpty() ? "OUTSIDE_WORKING_HOURS" : null;
        return new ServiceCapacityResponse(date, qualified.size(), slots, reason);
    }

    private ServiceOffering requireService(Long id) {
        return services.findById(id).filter(ServiceOffering::isActive)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SERVICE_NOT_FOUND", "Không tìm thấy dịch vụ"));
    }

    private void validateDate(LocalDate date) {
        LocalDate today = time.today();
        if (date.isBefore(today)) throw new ApiException(HttpStatus.BAD_REQUEST, "PAST_DATE", "Không thể đặt lịch trong quá khứ");
        if (date.isAfter(today.plusMonths(1))) throw new ApiException(HttpStatus.BAD_REQUEST, "DATE_TOO_FAR", "Chỉ có thể đặt lịch trước tối đa 1 tháng");
    }

    private List<LocalTime> slotsFor(ServiceOffering service, Practitioner practitioner, LocalDate date,
                                      Long excludedBookingId, boolean ignoreBookings) {
        if (!practitioner.supports(service)) return List.of();
        Long practitionerId = practitioner.getId();
        ScheduleException exception = exceptions.findByPractitionerIdAndExceptionDate(practitionerId, date).orElse(null);
        if (exception != null && !exception.isAvailable()) return List.of();
        List<Booking> booked = ignoreBookings ? List.of() : bookings.findByPractitionerIdAndAppointmentDateBetweenAndStatusNot(
                practitionerId, date.minusDays(1), date.plusDays(1), BookingStatus.CANCELLED).stream()
                .filter(b -> !Objects.equals(b.getId(), excludedBookingId)).toList();
        SortedSet<LocalTime> slots = new TreeSet<>();
        for (LocalDate opening : List.of(date.minusDays(1), date)) {
            ScheduleException override = opening.equals(date) ? exception
                    : exceptions.findByPractitionerIdAndExceptionDate(practitionerId, opening).orElse(null);
            if (override != null && !override.isAvailable()) continue;
            AvailabilityRule rule = rules.findByPractitionerIdAndDayOfWeekAndActiveTrue(practitionerId, opening.getDayOfWeek()).orElse(null);
            LocalTime start = override != null && override.getStartTime() != null ? override.getStartTime() : rule == null ? null : rule.getStartTime();
            LocalTime end = override != null && override.getEndTime() != null ? override.getEndTime() : rule == null ? null : rule.getEndTime();
            if (start == null || end == null || start.equals(end)) continue;
            int step = rule == null ? 30 : rule.getSlotMinutes();
            if (step <= 0 || service.getDurationMinutes() <= 0)
                throw new ApiException(HttpStatus.CONFLICT, "SCHEDULE_INVALID", "Lịch làm việc chưa hợp lệ.");
            LocalDateTime windowStart = opening.atTime(start);
            LocalDateTime windowEnd = opening.plusDays(end.isBefore(start) ? 1 : 0).atTime(end);
            LocalDateTime breakStart = rule == null || rule.getBreakStart() == null ? null
                    : opening.plusDays(end.isBefore(start) && rule.getBreakStart().isBefore(start) ? 1 : 0).atTime(rule.getBreakStart());
            LocalDateTime breakEnd = breakStart == null || rule.getBreakEnd() == null ? null
                    : breakStart.toLocalDate().plusDays(!rule.getBreakEnd().isAfter(rule.getBreakStart()) ? 1 : 0).atTime(rule.getBreakEnd());
            for (LocalDateTime cursor = windowStart; !cursor.plusMinutes(service.getDurationMinutes()).isAfter(windowEnd); cursor = cursor.plusMinutes(step)) {
                LocalDateTime slotEnd = cursor.plusMinutes(service.getDurationMinutes());
                if (!cursor.toLocalDate().equals(date) || !time.hasBookingLead(cursor)) continue;
                boolean duringBreak = breakStart != null && breakEnd != null && cursor.isBefore(breakEnd) && slotEnd.isAfter(breakStart);
                boolean overlapsBooking = false;
                if (!duringBreak) for (Booking booking : booked) {
                    if (BookingCompletionPolicy.overlaps(booking, cursor, slotEnd)) { overlapsBooking = true; break; }
                }
                if (!duringBreak && !overlapsBooking) slots.add(cursor.toLocalTime());
            }
        }
        return List.copyOf(slots);
    }
}
