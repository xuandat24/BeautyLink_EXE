package com.example.backend.service;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;
import static com.example.backend.model.DomainEnums.*;

@Service
public class BookingService {
    private final PaymentService payments;
    private final PaymentTransactionRepository paymentTransactions;
    private final TransactionTemplate cancellationTransactions;
    private final BookingCompletionPolicy completion;
    private final BookingRepository bookings; private final ServiceOfferingRepository services; private final PractitionerRepository practitioners; private final SupplierRepository suppliers; private final AvailabilityService availability; private final BookingReviewRepository reviews;
    public BookingService(BookingRepository bookings, ServiceOfferingRepository services, PractitionerRepository practitioners, SupplierRepository suppliers, AvailabilityService availability, BookingReviewRepository reviews, BookingCompletionPolicy completion, PaymentService payments, PaymentTransactionRepository paymentTransactions, PlatformTransactionManager manager) {
        this.payments = payments; this.paymentTransactions = paymentTransactions;
        this.cancellationTransactions = new TransactionTemplate(manager);
        this.cancellationTransactions.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.cancellationTransactions.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
        this.completion = completion;
        this.bookings = bookings; this.services = services; this.practitioners = practitioners; this.suppliers = suppliers; this.availability = availability; this.reviews = reviews;
    }
    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED) public BookingResponse create(UserAccount customer, CreateBookingRequest request) {
        ServiceOffering service = services.findById(request.serviceId()).filter(ServiceOffering::isActive).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SERVICE_NOT_FOUND", "Không tìm thấy dịch vụ"));
        if (service.getPrice().signum() <= 0) {
            throw new ApiException(HttpStatus.CONFLICT, "SERVICE_PRICE_ON_REQUEST",
                    "Dịch vụ này cần liên hệ cơ sở để được tư vấn và báo giá trước khi đặt lịch.");
        }
        BookingContactPolicy.requireReady(customer);
        Practitioner practitioner;
        if (request.practitionerId() != null) {
            practitioner = practitioners.findByIdForUpdate(request.practitionerId()).filter(Practitioner::isActive)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PRACTITIONER_NOT_FOUND", "Không tìm thấy chuyên viên"));
        } else {
            // Lowest practitioner ID wins. Lock and recheck each candidate before trying the next.
            practitioner = null;
            for (Practitioner candidate : practitioners.findBySupplierIdAndActiveTrue(service.getSupplier().getId()).stream()
                    .sorted(Comparator.comparing(Practitioner::getId)).toList()) {
                if (!candidate.supports(service)) continue;
                Practitioner locked = practitioners.findByIdForUpdate(candidate.getId()).filter(Practitioner::isActive).orElse(null);
                if (locked != null && availability.availability(service.getId(), locked.getId(), request.appointmentDate())
                        .availableSlots().contains(request.startTime())) {
                    practitioner = locked;
                    break;
                }
            }
            if (practitioner == null) throw new ApiException(HttpStatus.CONFLICT, "SLOT_UNAVAILABLE", "Khung giờ này vừa được đặt. Vui lòng chọn khung giờ khác.");
        }
        if (!practitioner.getSupplier().getId().equals(service.getSupplier().getId())) throw new ApiException(HttpStatus.BAD_REQUEST, "PRACTITIONER_MISMATCH", "Chuyên viên không cung cấp dịch vụ này");
        List<LocalTime> slots = availability.availability(service.getId(), practitioner.getId(), request.appointmentDate()).availableSlots();
        if (!slots.contains(request.startTime())) throw new ApiException(HttpStatus.CONFLICT, "SLOT_UNAVAILABLE", "Khung giờ này không còn khả dụng");
        var start = request.appointmentDate().atTime(request.startTime());
        if (!completion.hasBookingLead(start))
            throw new ApiException(HttpStatus.CONFLICT, "SLOT_UNAVAILABLE", "Lịch hẹn đã bắt đầu hoặc không còn hợp lệ.");
        var end = start.plusMinutes(service.getDurationMinutes());
        // Practitioner mutex + READ_COMMITTED avoids an old snapshot after waiting on a competing create/retry.
        if (bookings.findByPractitionerIdAndAppointmentDateBetweenAndStatusNot(practitioner.getId(), request.appointmentDate().minusDays(1), request.appointmentDate().plusDays(1), BookingStatus.CANCELLED)
                .stream().anyMatch(b -> BookingCompletionPolicy.overlaps(b, start, end)))
            throw new ApiException(HttpStatus.CONFLICT, "SLOT_UNAVAILABLE", "Khung giờ này không còn khả dụng");
        Booking booking = new Booking(); booking.setBookingCode("BL-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        booking.setCustomer(customer); booking.setSupplier(service.getSupplier()); booking.setService(service); booking.setPractitioner(practitioner);
        booking.setAppointmentDate(request.appointmentDate()); booking.setStartTime(request.startTime()); booking.setEndTime(request.startTime().plusMinutes(service.getDurationMinutes()));
        booking.setTotalAmount(service.getPrice()); booking.setStatus(BookingStatus.PENDING); booking.setPaymentStatus(PaymentStatus.UNPAID); booking.setPaymentRetryAllowed(false); booking.setCustomerNote(request.note());
        return response(bookings.save(booking));
    }
    @Transactional(readOnly = true) public List<BookingResponse> customerBookings(UserAccount customer) { return bookings.findByCustomerIdOrderByAppointmentDateDescStartTimeDesc(customer.getId()).stream().map(this::response).toList(); }
    @Transactional(readOnly = true) public BookingResponse customerBooking(UserAccount customer, Long id) {
        Booking b = bookings.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "BOOKING_NOT_FOUND", "Không tìm thấy lịch hẹn"));
        if (!b.getCustomer().getId().equals(customer.getId())) throw new ApiException(HttpStatus.FORBIDDEN, "BOOKING_FORBIDDEN", "Bạn không có quyền xem lịch hẹn này");
        return response(b);
    }
    @Transactional(readOnly = true) public BookingHistoryStatusResponse bookingHistoryStatus(UserAccount customer) { return new BookingHistoryStatusResponse(bookings.existsByCustomerId(customer.getId())); }
    @Transactional(readOnly = true) public List<BookingResponse> supplierBookings(UserAccount owner) {
        Supplier supplier = suppliers.findByOwnerId(owner.getId()).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SUPPLIER_NOT_FOUND", "Không tìm thấy nhà cung cấp"));
        return bookings.findBySupplierIdOrderByAppointmentDateDescStartTimeDesc(supplier.getId()).stream().map(this::response).toList();
    }
    private record Cancellation(BookingResponse response, com.example.backend.exception.ApiException error) {}
    public BookingResponse cancel(UserAccount customer, Long bookingId) {
        Cancellation result = cancellationTransactions.execute(s -> {
        Booking booking = bookings.findByIdForUpdate(bookingId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "BOOKING_NOT_FOUND", "Không tìm thấy lịch hẹn"));
        if (!booking.getCustomer().getId().equals(customer.getId())) throw new ApiException(HttpStatus.FORBIDDEN, "BOOKING_FORBIDDEN", "Bạn không thể hủy lịch hẹn này");
        if (booking.getStatus() == BookingStatus.COMPLETED) throw new ApiException(HttpStatus.CONFLICT, "BOOKING_COMPLETED", "Lịch hẹn đã hoàn thành");
        ApiException error = payments.cancelUnpaidLocked(booking);
        return new Cancellation(error == null ? response(booking) : null, error);
        });
        // Verified PAID/manual-review evidence commits even when the customer gets a business conflict.
        if (result.error() != null) throw result.error();
        return result.response();
    }
    @Transactional public BookingResponse complete(UserAccount customer, Long bookingId) {
        Booking booking = bookings.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "BOOKING_NOT_FOUND", "Không tìm thấy lịch hẹn"));
        if (!booking.getCustomer().getId().equals(customer.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "BOOKING_FORBIDDEN", "Bạn chỉ có thể xác nhận lịch hẹn của chính mình");
        }
        if (paymentTransactions.hasUnresolvedByBookingId(bookingId))
            throw new ApiException(HttpStatus.CONFLICT, "PAYMENT_REVIEW_REQUIRED", "Giao dịch cần đối soát. Vui lòng liên hệ hỗ trợ trước khi xác nhận hoàn thành.");
        // Retrying an already accepted confirmation is safe.
        if (booking.getStatus() == BookingStatus.COMPLETED) return response(booking);
        if (!completion.canComplete(booking)) {
            throw new ApiException(HttpStatus.CONFLICT, "BOOKING_NOT_COMPLETABLE",
                    "Chỉ xác nhận sau khi dịch vụ kết thúc, lịch hẹn đã được xác nhận và có thanh toán hoặc đặt cọc");
        }
        booking.setStatus(BookingStatus.COMPLETED);
        booking.setPaymentRetryAllowed(false);
        return response(booking);
    }
    private BookingResponse response(Booking b) {
        var attempts = paymentTransactions.findAllByBookingIdOrderByCreatedAtDesc(b.getId());
        boolean blocked = BookingPaymentPolicy.unresolved(attempts);
        String reason = BookingPaymentPolicy.reason(b, attempts, completion.now());
        if (reason == null && b.getStatus() == BookingStatus.CANCELLED && b.isPaymentRetryAllowed()) {
            try {
                if (!availability.availability(b.getService().getId(), b.getPractitioner().getId(), b.getAppointmentDate()).availableSlots().contains(b.getStartTime())) reason = "SLOT_UNAVAILABLE";
            } catch (ApiException error) { reason = "SLOT_UNAVAILABLE"; }
        }
        var last = attempts.stream().filter(p -> p.getStatus() == PaymentTransactionStatus.PENDING).findFirst()
                .orElse(attempts.isEmpty() ? null : attempts.getFirst());
        BookingReviewResponse serviceReview = reviews.findByBookingIdAndTargetType(b.getId(), ReviewTargetType.SERVICE).map(this::reviewResponse).orElse(null);
        BookingReviewResponse supplierReview = reviews.findByBookingIdAndTargetType(b.getId(), ReviewTargetType.SUPPLIER).map(this::reviewResponse).orElse(null);
        return new BookingResponse(b.getId(), b.getBookingCode(), b.getService().getId(), b.getService().getName(),
                b.getService().getImageUrl(), b.getSupplier().getId(), b.getSupplier().getName(),
                b.getSupplier().getImageUrl(), b.getSupplier().getAddressLine(), b.getPractitioner().getDisplayName(),
                b.getAppointmentDate(), b.getStartTime(), b.getEndTime(), b.getTotalAmount(), b.getStatus(),
                b.getPaymentStatus(), !blocked && ReviewService.isEligible(b), serviceReview, supplierReview, !blocked && completion.canComplete(b),
                BookingPaymentPolicy.canCancel(b, attempts), reason == null && (b.getStatus() != BookingStatus.CANCELLED || b.isPaymentRetryAllowed()), reason,
                last == null ? null : last.getPaymentOption(), last == null ? null : last.getVoucherCode(),
                attempts.stream().anyMatch(p -> p.getStatus() == PaymentTransactionStatus.PENDING),
                last == null ? null : last.getAmount(), last == null ? null : last.getRemainingAmount());
    }
    private BookingReviewResponse reviewResponse(BookingReview review) {
        return new BookingReviewResponse(review.getId(), review.getBooking().getId(), review.getTargetType(), review.getRating(), review.getComment(), review.getCreatedAt(), review.getUpdatedAt());
    }
}
