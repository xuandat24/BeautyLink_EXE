package com.example.backend.service;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.time.*;
import static com.example.backend.model.DomainEnums.BookingStatus;

@Service
public class ScheduleService {
    private final PractitionerRepository practitioners; private final AvailabilityRuleRepository rules;
    private final BookingRepository bookings; private final BookingCompletionPolicy time;
    public ScheduleService(PractitionerRepository practitioners, AvailabilityRuleRepository rules,
                           BookingRepository bookings, BookingCompletionPolicy time) { this.practitioners = practitioners; this.rules = rules; this.bookings = bookings; this.time = time; }
    public List<ScheduleRuleResponse> get(UserAccount owner, Long practitionerId) {
        requireOwned(owner, practitionerId); return rules.findByPractitionerIdOrderByDayOfWeek(practitionerId).stream().map(this::response).toList();
    }
    @Transactional public List<ScheduleRuleResponse> replace(UserAccount owner, Long practitionerId, ReplaceScheduleRequest request) {
        Practitioner practitioner = practitioners.findOwnedForUpdate(practitionerId, owner.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PRACTITIONER_NOT_FOUND", "Không tìm thấy chuyên viên thuộc cơ sở"));
        if (request.rules().stream().map(ScheduleRuleRequest::dayOfWeek).distinct().count() != request.rules().size()) throw new ApiException(HttpStatus.BAD_REQUEST, "DUPLICATE_DAY", "Mỗi ngày chỉ được cấu hình một lần");
        for (ScheduleRuleRequest input : request.rules()) validate(input);
        for (Booking booking : bookings.findByPractitionerIdAndAppointmentDateGreaterThanEqualAndStatusNot(
                practitionerId, time.today(), BookingStatus.CANCELLED)) {
            if (!time.beforeStart(booking)) continue;
            ScheduleRuleRequest next = request.rules().stream()
                    .filter(r -> r.dayOfWeek() == booking.getAppointmentDate().getDayOfWeek()).findFirst().orElse(null);
            LocalTime start = booking.getStartTime();
            LocalTime end = booking.getEndTime();
            if (next == null || !next.active() || !end.isAfter(start) || start.isBefore(next.startTime())
                    || end.isAfter(next.endTime()) || (next.breakStart() != null
                    && start.isBefore(next.breakEnd()) && end.isAfter(next.breakStart())))
                throw new ApiException(HttpStatus.CONFLICT, "FUTURE_BOOKINGS", "Lịch mới xung đột với lịch hẹn sắp tới của chuyên viên.");
        }
        rules.deleteByPractitionerId(practitionerId); rules.flush();
        List<AvailabilityRule> saved = request.rules().stream().map(input -> {
            AvailabilityRule rule = new AvailabilityRule(); rule.setPractitioner(practitioner); rule.setDayOfWeek(input.dayOfWeek()); rule.setStartTime(input.startTime()); rule.setEndTime(input.endTime());
            rule.setBreakStart(input.breakStart()); rule.setBreakEnd(input.breakEnd()); rule.setSlotMinutes(input.slotMinutes()); rule.setActive(input.active()); return rule;
        }).map(rules::save).toList();
        return saved.stream().map(this::response).toList();
    }
    private Practitioner requireOwned(UserAccount owner, Long id) { return practitioners.findByIdAndSupplierOwnerId(id, owner.getId()).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PRACTITIONER_NOT_FOUND", "Không tìm thấy chuyên viên thuộc nhà cung cấp này")); }
    private void validate(ScheduleRuleRequest r) {
        if (!r.startTime().isBefore(r.endTime())) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_HOURS", "Giờ bắt đầu phải trước giờ kết thúc");
        if ((r.breakStart() == null) != (r.breakEnd() == null)) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_BREAK", "Cần nhập đủ giờ bắt đầu và kết thúc nghỉ");
        if (r.breakStart() != null && (!r.breakStart().isBefore(r.breakEnd()) || r.breakStart().isBefore(r.startTime()) || r.breakEnd().isAfter(r.endTime()))) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_BREAK", "Giờ nghỉ phải nằm trong giờ làm việc");
    }
    private ScheduleRuleResponse response(AvailabilityRule r) { return new ScheduleRuleResponse(r.getId(), r.getDayOfWeek(), r.getStartTime(), r.getEndTime(), r.getBreakStart(), r.getBreakEnd(), r.getSlotMinutes(), r.isActive()); }
}
