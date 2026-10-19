package com.example.backend.dto;

import com.example.backend.model.DomainEnums.BookingStatus;
import com.example.backend.model.DomainEnums.PaymentOption;
import com.example.backend.model.DomainEnums.PaymentStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public final class AdminDashboardDtos {
    private AdminDashboardDtos() {}

    public record AdminDateRange(LocalDate fromDate, LocalDate toDate, String timezone, boolean includeDemo) {}
    public record BookingTrendPoint(LocalDate date, long bookings, long uniqueCustomers) {}
    public record AdminBookingResponse(
            Long id, String bookingCode, Long customerId, String customerName, String customerPhone,
            Long supplierId, String supplierName, String serviceName, String practitionerName,
            LocalDate appointmentDate, LocalTime startTime, LocalTime endTime, BigDecimal totalAmount,
            BookingStatus status, PaymentStatus paymentStatus, Instant createdAt,
            PaymentOption verifiedPaymentOption, BigDecimal verifiedOnlineAmount,
            BigDecimal remainingAtSalon, Instant verifiedPaidAt, boolean paymentReviewRequired) {}
    public record AdminPageResponse<T>(List<T> content, long totalElements, int totalPages, int page, int size) {}
    public record AdminDashboardSummary(
            AdminDateRange range, long registeredCustomers, long customersWhoBooked, long totalBookings,
            long paidBookingCustomers, long verifiedPaidBookings, long upcomingBookings,
            long reconciliationIssues, long completedBookings, long cancelledBookings, long repeatCustomers,
            double bookingToPaymentConversion, Instant generatedAt,
            List<BookingTrendPoint> bookingTrends, List<AdminBookingResponse> recentBookings) {}
    public record AdminPaymentSummary(
            AdminDateRange range, BigDecimal verifiedOnlineCollected, BigDecimal verifiedDeposits,
            BigDecimal verifiedFullPayments, BigDecimal remainingAtSalon,
            long verifiedPaymentBookings, long depositBookings, long fullPaymentBookings,
            long reconciliationIssues, Instant generatedAt) {}
    public record AdminRevenueRow(
            Long paymentId, Instant paidAt, String bookingCode, String supplierName,
            String serviceName, PaymentOption paymentOption, BigDecimal amount,
            BigDecimal remainingAtSalon) {}
}
