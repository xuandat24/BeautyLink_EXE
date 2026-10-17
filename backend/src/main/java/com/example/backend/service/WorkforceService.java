package com.example.backend.service;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static com.example.backend.model.DomainEnums.BookingStatus;

@Service
public class WorkforceService {
    private final PractitionerRepository practitioners;
    private final ServiceOfferingRepository services;
    private final BookingRepository bookings;
    private final BookingCompletionPolicy time;

    public WorkforceService(PractitionerRepository practitioners, ServiceOfferingRepository services,
            BookingRepository bookings, BookingCompletionPolicy time) {
        this.practitioners = practitioners;
        this.services = services;
        this.bookings = bookings;
        this.time = time;
    }

    @Transactional(readOnly = true)
    public List<SupplierPractitionerResponse> list(UserAccount owner, Long supplierId) {
        return practitioners.findBySupplierIdOrderById(supplierId).stream()
                .filter(p -> p.getSupplier().getOwner().getId().equals(owner.getId())).map(this::response).toList();
    }

    @Transactional
    public SupplierPractitionerResponse assign(UserAccount owner, Long id, UpdatePractitionerAssignmentsRequest request) {
        Practitioner person = ownedLocked(owner, id);
        Set<ServiceOffering> selected = new HashSet<>();
        for (Long serviceId : request.serviceIds()) {
            ServiceOffering service = services.findById(serviceId)
                    .filter(s -> s.getSupplier().getId().equals(person.getSupplier().getId()) && s.isActive())
                    .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "SERVICE_MISMATCH", "Dịch vụ không thuộc cơ sở này"));
            selected.add(service);
        }
        for (Booking booking : futureBookings(person)) {
            if (selected.stream().noneMatch(s -> s.getId().equals(booking.getService().getId())))
                throw conflict();
        }
        person.getSupportedServices().clear();
        person.getSupportedServices().addAll(selected);
        person.setServiceAssignmentsRestricted(true);
        return response(practitioners.save(person));
    }

    @Transactional
    public SupplierPractitionerResponse status(UserAccount owner, Long id, UpdatePractitionerStatusRequest request) {
        Practitioner person = ownedLocked(owner, id);
        if (!request.active() && !futureBookings(person).isEmpty()) throw conflict();
        person.setActive(request.active());
        return response(practitioners.save(person));
    }

    private Practitioner ownedLocked(UserAccount owner, Long id) {
        return practitioners.findOwnedForUpdate(id, owner.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PRACTITIONER_NOT_FOUND", "Không tìm thấy chuyên viên của cơ sở"));
    }

    private List<Booking> futureBookings(Practitioner person) {
        return bookings.findByPractitionerIdAndAppointmentDateGreaterThanEqualAndStatusNot(
                person.getId(), time.today(), BookingStatus.CANCELLED).stream()
                .filter(b -> time.beforeStart(b)).toList();
    }

    private ApiException conflict() {
        return new ApiException(HttpStatus.CONFLICT, "FUTURE_BOOKINGS", "Chuyên viên có lịch hẹn sắp tới; hãy giữ đủ nhân sự cho các lịch này.");
    }

    private SupplierPractitionerResponse response(Practitioner p) {
        return new SupplierPractitionerResponse(p.getId(), p.getDisplayName(), p.getSpecialty(), p.getAvatarUrl(),
                p.getBio(), p.isActive(), p.isServiceAssignmentsRestricted(), p.getSupportedServices().stream()
                        .map(ServiceOffering::getId).collect(java.util.stream.Collectors.toSet()));
    }
}
