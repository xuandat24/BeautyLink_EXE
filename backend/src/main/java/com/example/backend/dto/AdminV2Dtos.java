package com.example.backend.dto;

import com.example.backend.model.DomainEnums.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonProperty;

public final class AdminV2Dtos {
    private AdminV2Dtos() {}
    public enum Granularity { DAY, WEEK, MONTH }
    public enum ComparisonStatus { COMPARABLE, LOW_BASE, NEW_ACTIVITY, UNCHANGED, NO_DENOMINATOR, INSUFFICIENT_HISTORY, CURRENT_SNAPSHOT, NEGATIVE_VALUE }
    public enum MetricUnit { BOOKING, ACCOUNT, PARTNER, CUSTOMER, VND, PERCENT }
    public record Period(Instant startInclusive, Instant endExclusive) {}
    public record Metric(BigDecimal currentValue, BigDecimal previousValue, BigDecimal absoluteChange,
            BigDecimal relativeChangePercent, BigDecimal percentagePointChange, ComparisonStatus comparisonStatus,
            MetricUnit unit, String metricDefinition, Long currentNumerator, Long currentDenominator,
            Long previousNumerator, Long previousDenominator, boolean lowSample) {
        // Legacy aliases share one definition and keep null for unknown history; coordinate client rollout.
        @JsonProperty public BigDecimal value() { return currentValue; }
        @JsonProperty public BigDecimal previous() { return previousValue; }
        @JsonProperty public Double changePercent() { return relativeChangePercent == null ? null : relativeChangePercent.doubleValue(); }
        @JsonProperty public String basis() { return metricDefinition; }
    }
    public record Trend(LocalDate date, long bookings, BigDecimal verifiedOnlineAmount, BigDecimal completedServiceValue, BigDecimal reportPaymentAmount) {}
    public record StatusCount(BookingStatus status, long count) {}
    public record TopSalon(Long id, String name, String location, long bookings, BigDecimal verifiedOnlineAmount, BigDecimal completedServiceValue, BigDecimal reportPaymentAmount) {}
    public record PopularService(Long id, String name, String supplierName, long bookings, double percentage) {}
    public record Insights(AdminDashboardDtos.AdminDateRange range, Granularity granularity,
            Period currentPeriod, Period previousPeriod, String timezone, Instant asOf,
            int lowBaseThreshold, int smallRateDenominator,
            Metric totalBookings, Metric users, Metric revenue, Metric activePartners, Metric onlinePaymentRate,
            Metric completedBookings, Metric completedServiceValue, Metric returningCustomers, Metric reportPayments, Metric reportOnlinePaymentRate, Metric completedBookingSnapshot, Metric reportActivePartners, long bookingCustomers, long paymentAttempts, long successfulAttempts, Double paymentAttemptSuccessRate,
            List<Trend> trends, List<StatusCount> statuses, List<TopSalon> topSalons, List<PopularService> popularServices) {}
    public record UserRow(Long id, String fullName, String email, Role role, AccountStatus status, Instant createdAt) {}
    public record SalonRow(Long id, String name, String ownerName, String ownerEmail, String businessType,
            String location, String address, VerificationStatus approvalStatus, boolean active,
            long serviceCount, long practitionerCount, long bookingCount) {}
    public record ServiceRow(Long id, String name, BigDecimal price, int durationMinutes, boolean active) {}
    public record PractitionerRow(Long id, String name, String specialty, boolean active) {}
    public record ScheduleRow(Long practitionerId, DayOfWeek day, LocalTime start, LocalTime end,
            LocalTime breakStart, LocalTime breakEnd, boolean active) {}
    public record SalonDetail(SalonRow salon, List<ServiceRow> services, List<PractitionerRow> practitioners,
            List<ScheduleRow> schedules, List<AdminDashboardDtos.AdminBookingResponse> recentBookings) {}
    public record ReviewRow(Long id, ReviewTargetType targetType, String supplierName, String serviceName,
            int rating, String comment, Instant createdAt) {}
}
