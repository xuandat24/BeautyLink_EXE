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
import static com.example.backend.model.DomainEnums.*;

@Service
public class BookingService {
    private final BookingRepository bookings; private final ServiceOfferingRepository services; private final PractitionerRepository practitioners; private final SupplierRepository suppliers; private final AvailabilityService availability; private final BookingReviewRepository reviews;
    public BookingService(BookingRepository bookings, ServiceOfferingRepository services, PractitionerRepository practitioners, SupplierRepository suppliers, AvailabilityService availability, BookingReviewRepository reviews) {
        this.bookings = bookings; this.services = services; this.practitioners = practitioners; this.suppliers = suppliers; this.availability = availability; this.reviews = reviews;
    }
    @Transactional public BookingResponse create(UserAccount customer, CreateBookingRequest request) {
        ServiceOffering service = services.findById(request.serviceId()).filter(ServiceOffering::isActive).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SERVICE_NOT_FOUND", "Không tìm thấy dịch vụ"));
        Practitioner practitioner;
        if (request.practitionerId() != null) {
            practitioner = practitioners.findById(request.practitionerId()).filter(Practitioner::isActive)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PRACTITIONER_NOT_FOUND", "Không tìm thấy chuyên viên"));
        } else {
            practitioner = practitioners.findBySupplierIdAndActiveTrue(service.getSupplier().getId()).stream()
                    .filter(candidate -> availability.availability(service.getId(), candidate.getId(), request.appointmentDate())
                            .availableSlots().contains(request.startTime()))
                    .findFirst()
                    .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "SLOT_UNAVAILABLE", "Không còn chuyên viên phù hợp cho khung giờ này"));
        }
        if (!practitioner.getSupplier().getId().equals(service.getSupplier().getId())) throw new ApiException(HttpStatus.BAD_REQUEST, "PRACTITIONER_MISMATCH", "Chuyên viên không cung cấp dịch vụ này");
        List<LocalTime> slots = availability.availability(service.getId(), practitioner.getId(), request.appointmentDate()).availableSlots();
        if (!slots.contains(request.startTime())) throw new ApiException(HttpStatus.CONFLICT, "SLOT_UNAVAILABLE", "Khung giờ này không còn khả dụng");
        Booking booking = new Booking(); booking.setBookingCode("BL-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        booking.setCustomer(customer); booking.setSupplier(service.getSupplier()); booking.setService(service); booking.setPractitioner(practitioner);
        booking.setAppointmentDate(request.appointmentDate()); booking.setStartTime(request.startTime()); booking.setEndTime(request.startTime().plusMinutes(service.getDurationMinutes()));
        booking.setTotalAmount(service.getPrice()); booking.setStatus(BookingStatus.PENDING); booking.setPaymentStatus(PaymentStatus.UNPAID); booking.setCustomerNote(request.note());
        return response(bookings.save(booking));
    }
    @Transactional(readOnly = true) public List<BookingResponse> customerBookings(UserAccount customer) { return bookings.findByCustomerIdOrderByAppointmentDateDescStartTimeDesc(customer.getId()).stream().map(this::response).toList(); }
    @Transactional(readOnly = true) public List<BookingResponse> supplierBookings(UserAccount owner) {
        Supplier supplier = suppliers.findByOwnerId(owner.getId()).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SUPPLIER_NOT_FOUND", "Không tìm thấy nhà cung cấp"));
        return bookings.findBySupplierIdOrderByAppointmentDateDescStartTimeDesc(supplier.getId()).stream().map(this::response).toList();
    }
    @Transactional public BookingResponse cancel(UserAccount customer, Long bookingId) {
        Booking booking = bookings.findById(bookingId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "BOOKING_NOT_FOUND", "Không tìm thấy lịch hẹn"));
        if (!booking.getCustomer().getId().equals(customer.getId())) throw new ApiException(HttpStatus.FORBIDDEN, "BOOKING_FORBIDDEN", "Bạn không thể hủy lịch hẹn này");
        if (booking.getStatus() == BookingStatus.COMPLETED) throw new ApiException(HttpStatus.CONFLICT, "BOOKING_COMPLETED", "Lịch hẹn đã hoàn thành");
        booking.setStatus(BookingStatus.CANCELLED); return response(booking);
    }
    private BookingResponse response(Booking b) {
        BookingReviewResponse serviceReview = reviews.findByBookingIdAndTargetType(b.getId(), ReviewTargetType.SERVICE).map(this::reviewResponse).orElse(null);
        BookingReviewResponse supplierReview = reviews.findByBookingIdAndTargetType(b.getId(), ReviewTargetType.SUPPLIER).map(this::reviewResponse).orElse(null);
        return new BookingResponse(b.getId(), b.getBookingCode(), b.getService().getId(), b.getService().getName(),
                b.getService().getImageUrl(), b.getSupplier().getId(), b.getSupplier().getName(),
                b.getSupplier().getImageUrl(), b.getSupplier().getAddressLine(), b.getPractitioner().getDisplayName(),
                b.getAppointmentDate(), b.getStartTime(), b.getEndTime(), b.getTotalAmount(), b.getStatus(),
                b.getPaymentStatus(), ReviewService.isEligible(b), serviceReview, supplierReview);
    }
    private BookingReviewResponse reviewResponse(BookingReview review) {
        return new BookingReviewResponse(review.getId(), review.getBooking().getId(), review.getTargetType(), review.getRating(), review.getComment(), review.getCreatedAt(), review.getUpdatedAt());
    }
}
