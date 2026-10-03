package com.example.backend.model;

public final class DomainEnums {
    private DomainEnums() {}
    public enum Role { CUSTOMER, SUPPLIER, STAFF, ADMIN }
    public enum AccountStatus { ACTIVE, SUSPENDED, DISABLED }
    public enum LocationType { PROVINCE_CITY, DISTRICT, WARD_COMMUNE }
    public enum VerificationStatus { PENDING, VERIFIED, REJECTED, SUSPENDED }
    public enum BookingStatus { PENDING, CONFIRMED, COMPLETED, CANCELLED }
    public enum PaymentStatus { SIMULATED, UNPAID, PAID, REFUNDED }
    public enum ReviewTargetType { SERVICE, SUPPLIER }
    public enum ReportStatus { OPEN, IN_REVIEW, RESOLVED, REJECTED }
    public enum ReportTargetType { SUPPLIER, SERVICE, BOOKING, REVIEW, USER }
}
