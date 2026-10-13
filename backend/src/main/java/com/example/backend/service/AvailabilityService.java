package com.example.backend.service;

import com.example.backend.dto.ApiDtos.AvailabilityResponse;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;

@Service
public class AvailabilityService {
    private final BookingCompletionPolicy time;
    private final PractitionerRepository practitioners; private final ServiceOfferingRepository services;
    private final AvailabilityRuleRepository rules; private final ScheduleExceptionRepository exceptions; private final BookingRepository bookings;
    public AvailabilityService(PractitionerRepository practitioners, ServiceOfferingRepository services, AvailabilityRuleRepository rules, ScheduleExceptionRepository exceptions, BookingRepository bookings, BookingCompletionPolicy time) {
        this.practitioners = practitioners; this.services = services; this.rules = rules; this.exceptions = exceptions; this.bookings = bookings; this.time = time;
    }
    public AvailabilityResponse availability(Long serviceId, Long practitionerId, LocalDate date) {
        return availability(serviceId, practitionerId, date, null);
    }
    public AvailabilityResponse availability(Long serviceId, Long practitionerId, LocalDate date, Long excludedBookingId) {
        LocalDate today = time.today();
        if (date.isBefore(today)) throw new ApiException(HttpStatus.BAD_REQUEST, "PAST_DATE", "Không thể đặt lịch trong quá khứ");
        if (date.isAfter(today.plusMonths(1))) throw new ApiException(HttpStatus.BAD_REQUEST, "DATE_TOO_FAR", "Chỉ có thể đặt lịch trước tối đa 1 tháng");
        ServiceOffering service = services.findById(serviceId).filter(ServiceOffering::isActive).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SERVICE_NOT_FOUND", "Không tìm thấy dịch vụ"));
        Practitioner practitioner = practitioners.findById(practitionerId).filter(Practitioner::isActive).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PRACTITIONER_NOT_FOUND", "Không tìm thấy chuyên viên"));
        if (!practitioner.getSupplier().getId().equals(service.getSupplier().getId())) throw new ApiException(HttpStatus.BAD_REQUEST, "PRACTITIONER_MISMATCH", "Chuyên viên không cung cấp dịch vụ này");
        ScheduleException exception = exceptions.findByPractitionerIdAndExceptionDate(practitionerId, date).orElse(null);
        if (exception != null && !exception.isAvailable()) return new AvailabilityResponse(practitionerId, date, List.of());
        List<Booking> booked = bookings.findByPractitionerIdAndAppointmentDateBetweenAndStatusNot(practitionerId,
                date.minusDays(1), date.plusDays(1), com.example.backend.model.DomainEnums.BookingStatus.CANCELLED)
                .stream().filter(b -> !Objects.equals(b.getId(), excludedBookingId)).toList();
        SortedSet<LocalTime> slots = new TreeSet<>();
        // The previous day's overnight window may supply slots after midnight on this date.
        for (LocalDate opening : List.of(date.minusDays(1), date)) {
            ScheduleException override = opening.equals(date) ? exception : exceptions.findByPractitionerIdAndExceptionDate(practitionerId, opening).orElse(null);
            if (override != null && !override.isAvailable()) continue;
            AvailabilityRule rule = rules.findByPractitionerIdAndDayOfWeekAndActiveTrue(practitionerId, opening.getDayOfWeek()).orElse(null);
            LocalTime start = override != null && override.getStartTime() != null ? override.getStartTime() : rule == null ? null : rule.getStartTime();
            LocalTime end = override != null && override.getEndTime() != null ? override.getEndTime() : rule == null ? null : rule.getEndTime();
            if (start == null || end == null || start.equals(end)) continue;
            int step = rule == null ? 30 : rule.getSlotMinutes();
            if (step <= 0 || service.getDurationMinutes() <= 0) throw new ApiException(HttpStatus.CONFLICT, "SCHEDULE_INVALID", "Lịch làm việc chưa hợp lệ.");
            LocalDateTime windowStart = opening.atTime(start), windowEnd = opening.plusDays(end.isBefore(start) ? 1 : 0).atTime(end);
            LocalDateTime breakStart = rule == null || rule.getBreakStart() == null ? null : opening.plusDays(end.isBefore(start) && rule.getBreakStart().isBefore(start) ? 1 : 0).atTime(rule.getBreakStart());
            LocalDateTime breakEnd = breakStart == null || rule.getBreakEnd() == null ? null : breakStart.toLocalDate().plusDays(!rule.getBreakEnd().isAfter(rule.getBreakStart()) ? 1 : 0).atTime(rule.getBreakEnd());
            // LocalDateTime increases monotonically: LocalTime wrap cannot cause an infinite loop.
            for (LocalDateTime cursor = windowStart; !cursor.plusMinutes(service.getDurationMinutes()).isAfter(windowEnd); cursor = cursor.plusMinutes(step)) {
                LocalDateTime slotStart = cursor, slotEnd = cursor.plusMinutes(service.getDurationMinutes());
                if (!cursor.toLocalDate().equals(date) || !time.hasBookingLead(cursor)) continue;
                boolean duringBreak = breakStart != null && breakEnd != null && slotStart.isBefore(breakEnd) && slotEnd.isAfter(breakStart);
                if (!duringBreak && booked.stream().noneMatch(b -> BookingCompletionPolicy.overlaps(b, slotStart, slotEnd))) slots.add(cursor.toLocalTime());
            }
        }
        return new AvailabilityResponse(practitionerId, date, List.copyOf(slots));
    }
}
