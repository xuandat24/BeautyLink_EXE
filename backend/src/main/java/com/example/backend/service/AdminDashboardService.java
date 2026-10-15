package com.example.backend.service;

import com.example.backend.dto.AdminDashboardDtos.AdminBookingResponse;
import com.example.backend.dto.AdminDashboardDtos.AdminDashboardSummary;
import com.example.backend.dto.AdminDashboardDtos.AdminDateRange;
import com.example.backend.dto.AdminDashboardDtos.AdminPageResponse;
import com.example.backend.dto.AdminDashboardDtos.AdminPaymentSummary;
import com.example.backend.dto.AdminDashboardDtos.BookingTrendPoint;
import com.example.backend.exception.ApiException;
import com.example.backend.model.Booking;
import com.example.backend.model.PaymentTransaction;
import com.example.backend.repository.BookingRepository;
import com.example.backend.repository.PaymentTransactionRepository;
import com.example.backend.repository.UserAccountRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.example.backend.model.DomainEnums.*;

@Service
public class AdminDashboardService {
    public static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int MAX_RANGE_DAYS = 366;
    private static final EnumSet<PaymentOption> DEPOSIT_OPTIONS = EnumSet.of(PaymentOption.DEPOSIT_05, PaymentOption.DEPOSIT_50);

    private final BookingRepository bookings;
    private final PaymentTransactionRepository payments;
    private final UserAccountRepository users;
    private final Clock clock;

    @Autowired
    public AdminDashboardService(BookingRepository bookings, PaymentTransactionRepository payments,
            UserAccountRepository users) {
        this(bookings, payments, users, Clock.systemUTC());
    }

    AdminDashboardService(BookingRepository bookings, PaymentTransactionRepository payments,
            UserAccountRepository users, Clock clock) {
        this.bookings = bookings;
        this.payments = payments;
        this.users = users;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public AdminDashboardSummary summary(LocalDate fromDate, LocalDate toDate, boolean includeDemo) {
        Range range = range(fromDate, toDate, includeDemo);
        long totalBookings = bookings.countAdminBookings(range.from(), range.to(), Role.CUSTOMER, includeDemo);
        long paidBookings = bookings.countAdminVerifiedPaidBookings(range.from(), range.to(),
                PaymentTransactionStatus.PAID, Role.CUSTOMER, includeDemo);
        LocalDateTime localNow = LocalDateTime.ofInstant(clock.instant(), BUSINESS_ZONE);
        long upcoming = bookings.countAdminUpcomingBookings(range.from(), range.to(), localNow.toLocalDate(),
                localNow.toLocalTime(), EnumSet.of(BookingStatus.PENDING, BookingStatus.CONFIRMED),
                Role.CUSTOMER, includeDemo);
        List<BookingTrendPoint> trends = trendPoints(range, includeDemo);
        List<Booking> recent = bookings.findAdminRecent(range.from(), range.to(), Role.CUSTOMER, includeDemo,
                PageRequest.of(0, 10));
        return new AdminDashboardSummary(range.response(), users.countByRole(Role.CUSTOMER),
                bookings.countAdminBookingCustomers(range.from(), range.to(), Role.CUSTOMER, includeDemo),
                totalBookings,
                bookings.countAdminVerifiedPaidCustomers(range.from(), range.to(), PaymentTransactionStatus.PAID,
                        Role.CUSTOMER, includeDemo),
                paidBookings, upcoming,
                payments.countAdminReconciliationIssues(range.from(), range.to(),
                        PaymentTransactionStatus.REVIEW_REQUIRED, Role.CUSTOMER, includeDemo),
                bookings.countAdminBookingsByStatus(range.from(), range.to(), BookingStatus.COMPLETED,
                        Role.CUSTOMER, includeDemo),
                bookings.countAdminBookingsByStatus(range.from(), range.to(), BookingStatus.CANCELLED,
                        Role.CUSTOMER, includeDemo),
                bookings.findAdminRepeatCustomerIds(range.from(), range.to(), Role.CUSTOMER, includeDemo).size(),
                totalBookings == 0 ? 0 : BigDecimal.valueOf(paidBookings * 100.0 / totalBookings)
                        .setScale(1, RoundingMode.HALF_UP).doubleValue(),
                clock.instant(), trends, mapBookings(recent));
    }

    @Transactional(readOnly = true)
    public AdminPaymentSummary paymentSummary(LocalDate fromDate, LocalDate toDate, boolean includeDemo) {
        Range range = range(fromDate, toDate, includeDemo);
        return new AdminPaymentSummary(range.response(),
                money(payments.sumAdminCanonicalPaidAmount(range.from(), range.to(), PaymentTransactionStatus.PAID,
                        Role.CUSTOMER, includeDemo)),
                money(payments.sumAdminCanonicalPaidAmountByOptions(range.from(), range.to(), DEPOSIT_OPTIONS,
                        PaymentTransactionStatus.PAID, Role.CUSTOMER, includeDemo)),
                money(payments.sumAdminCanonicalPaidAmountByOptions(range.from(), range.to(),
                        EnumSet.of(PaymentOption.FULL_100), PaymentTransactionStatus.PAID, Role.CUSTOMER, includeDemo)),
                money(payments.sumAdminCanonicalRemainingByOptions(range.from(), range.to(), DEPOSIT_OPTIONS,
                        PaymentTransactionStatus.PAID, Role.CUSTOMER, includeDemo)),
                payments.countAdminCanonicalPaid(range.from(), range.to(), PaymentTransactionStatus.PAID,
                        Role.CUSTOMER, includeDemo),
                payments.countAdminCanonicalPaidByOptions(range.from(), range.to(), DEPOSIT_OPTIONS,
                        PaymentTransactionStatus.PAID, Role.CUSTOMER, includeDemo),
                payments.countAdminCanonicalPaidByOptions(range.from(), range.to(), EnumSet.of(PaymentOption.FULL_100),
                        PaymentTransactionStatus.PAID, Role.CUSTOMER, includeDemo),
                payments.countAdminReconciliationIssues(range.from(), range.to(),
                        PaymentTransactionStatus.REVIEW_REQUIRED, Role.CUSTOMER, includeDemo), clock.instant());
    }

    @Transactional(readOnly = true)
    public AdminPageResponse<AdminBookingResponse> searchBookings(LocalDate fromDate, LocalDate toDate,
            boolean includeDemo, BookingStatus bookingStatus, PaymentStatus paymentStatus, String query,
            int page, int size) {
        Range range = range(fromDate, toDate, includeDemo);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        String normalizedQuery = query == null || query.isBlank() ? null : query.trim();
        Page<Booking> result = bookings.searchAdminBookings(range.from(), range.to(), bookingStatus, paymentStatus,
                normalizedQuery, Role.CUSTOMER, includeDemo,
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt", "id")));
        return new AdminPageResponse<>(mapBookings(result.getContent()), result.getTotalElements(),
                result.getTotalPages(), result.getNumber(), result.getSize());
    }

    @Transactional(readOnly = true)
    public AdminBookingResponse booking(Long id) {
        Booking booking = bookings.findAdminBookingById(id, Role.CUSTOMER)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "BOOKING_NOT_FOUND", "Không tìm thấy lịch hẹn."));
        return mapBookings(List.of(booking)).getFirst();
    }

    @Transactional(readOnly = true)
    public AdminPageResponse<AdminBookingResponse> customerBookings(Long customerId, boolean includeDemo,
            int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        Page<Booking> result = bookings.findAdminCustomerBookings(customerId, Role.CUSTOMER, includeDemo,
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt", "id")));
        return new AdminPageResponse<>(mapBookings(result.getContent()), result.getTotalElements(),
                result.getTotalPages(), result.getNumber(), result.getSize());
    }

    public Range range(LocalDate requestedFrom, LocalDate requestedTo, boolean includeDemo) {
        LocalDate today = LocalDate.now(clock.withZone(BUSINESS_ZONE));
        LocalDate toDate = requestedTo == null ? today : requestedTo;
        LocalDate fromDate = requestedFrom == null ? toDate.minusDays(29) : requestedFrom;
        if (toDate.isBefore(fromDate)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "Ngày kết thúc phải từ ngày bắt đầu trở đi.");
        }
        long days = toDate.toEpochDay() - fromDate.toEpochDay() + 1;
        if (days > MAX_RANGE_DAYS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DATE_RANGE_TOO_LARGE", "Khoảng thời gian tối đa là 366 ngày.");
        }
        return new Range(fromDate, toDate, fromDate.atStartOfDay(BUSINESS_ZONE).toInstant(),
                toDate.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant(), includeDemo);
    }

    private List<AdminBookingResponse> mapBookings(List<Booking> source) {
        if (source.isEmpty()) return List.of();
        List<Long> ids = source.stream().map(Booking::getId).toList();
        Map<Long, PaymentTransaction> canonical = new HashMap<>();
        payments.findCanonicalPaidByBookingIds(ids, PaymentTransactionStatus.PAID)
                .forEach(payment -> canonical.put(payment.getBooking().getId(), payment));
        Set<Long> reviewIds = new HashSet<>(payments.findReviewBookingIds(ids, PaymentTransactionStatus.REVIEW_REQUIRED));
        return source.stream().map(booking -> {
            PaymentTransaction paid = canonical.get(booking.getId());
            return new AdminBookingResponse(booking.getId(), booking.getBookingCode(), booking.getCustomer().getId(),
                    booking.getCustomer().getFullName(), booking.getCustomer().getPhone(), booking.getSupplier().getId(),
                    booking.getSupplier().getName(), booking.getService().getName(), booking.getPractitioner().getDisplayName(),
                    booking.getAppointmentDate(), booking.getStartTime(), booking.getEndTime(), booking.getTotalAmount(),
                    booking.getStatus(), booking.getPaymentStatus(), booking.getCreatedAt(),
                    paid == null ? null : paid.getPaymentOption(), paid == null ? null : paid.getAmount(),
                    paid == null ? null : paid.getRemainingAmount(), paid == null ? null : paid.getPaidAt(),
                    reviewIds.contains(booking.getId()));
        }).toList();
    }

    private List<BookingTrendPoint> trendPoints(Range range, boolean includeDemo) {
        long rangeDays = range.toDate().toEpochDay() - range.fromDate().toEpochDay() + 1;
        int bucketDays = rangeDays > 60 ? 7 : 1;
        List<BookingTrendPoint> result = new ArrayList<>();
        for (LocalDate bucketStart = range.fromDate(); !bucketStart.isAfter(range.toDate());
                bucketStart = bucketStart.plusDays(bucketDays)) {
            LocalDate bucketEndExclusive = bucketStart.plusDays(bucketDays);
            if (bucketEndExclusive.isAfter(range.toDate().plusDays(1))) {
                bucketEndExclusive = range.toDate().plusDays(1);
            }
            Instant bucketFrom = bucketStart.atStartOfDay(BUSINESS_ZONE).toInstant();
            Instant bucketTo = bucketEndExclusive.atStartOfDay(BUSINESS_ZONE).toInstant();
            result.add(new BookingTrendPoint(bucketStart,
                    bookings.countAdminBookings(bucketFrom, bucketTo, Role.CUSTOMER, includeDemo),
                    bookings.countAdminBookingCustomers(bucketFrom, bucketTo, Role.CUSTOMER, includeDemo)));
        }
        return result;
    }

    private BigDecimal money(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    public record Range(LocalDate fromDate, LocalDate toDate, Instant from, Instant to, boolean includeDemo) {
        AdminDateRange response() {
            return new AdminDateRange(fromDate, toDate, BUSINESS_ZONE.getId(), includeDemo);
        }
    }
}
