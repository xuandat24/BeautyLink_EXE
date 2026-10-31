package com.example.backend.dto;

import java.math.BigDecimal;
import java.time.*;
import com.example.backend.model.DomainEnums.*;

public final class ReportingPaymentDtos {
    private ReportingPaymentDtos() {}
    public record Row(String id, String source, String batchId, Long bookingId, String bookingCode,
            Long customerId, String customerName, Long supplierId, String supplierName, Long serviceId,
            String serviceName, Long practitionerId, String practitionerName, LocalDate appointmentDate,
            LocalTime startTime, LocalTime endTime, BookingStatus bookingStatus, Instant bookingCreatedAt,
            BigDecimal serviceValue, PaymentOption paymentOption, BigDecimal amount,
            BigDecimal remainingAmount, Instant paidAt) {}
    public record Summary(BigDecimal total, BigDecimal deposits, BigDecimal fullPayments,
            BigDecimal verifiedAmount, BigDecimal simulatedAmount, BigDecimal remainingAtSalon,
            long transactions, long uniqueBookings, Instant asOf,
            AdminDashboardDtos.AdminPageResponse<Row> rows) {}
}
