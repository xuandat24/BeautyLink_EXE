package com.example.backend.dto;

import com.example.backend.model.DomainEnums.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;

public final class AdminV2Dtos {
    private AdminV2Dtos() {}
    public enum Granularity { DAY, WEEK, MONTH }
    public record Metric(BigDecimal value, BigDecimal previous, Double changePercent, String basis) {}
    public record Trend(LocalDate date, long bookings, BigDecimal verifiedOnlineAmount, BigDecimal completedServiceValue) {}
    public record StatusCount(BookingStatus status, long count) {}
    public record TopSalon(Long id, String name, String location, long bookings, BigDecimal verifiedOnlineAmount, BigDecimal completedServiceValue) {}
    public record PopularService(Long id, String name, String supplierName, long bookings, double percentage) {}
    public record Insights(AdminDashboardDtos.AdminDateRange range, Granularity granularity,
            Metric totalBookings, Metric users, Metric revenue, Metric activePartners, Metric onlinePaymentRate,
            Metric completedBookings, Metric completedServiceValue, Metric returningCustomers, long bookingCustomers, long paymentAttempts, long successfulAttempts, Double paymentAttemptSuccessRate,
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
