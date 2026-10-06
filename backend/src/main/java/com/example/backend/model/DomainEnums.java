package com.example.backend.model;

public final class DomainEnums {
    private DomainEnums() {}
    public enum Role { CUSTOMER, SUPPLIER, STAFF, ADMIN }
    public enum Gender { MALE, FEMALE, OTHER }
    public enum VerificationChannel { PHONE, EMAIL }
    public enum AccountStatus { ACTIVE, SUSPENDED, DISABLED }
    public enum LocationType { PROVINCE_CITY, DISTRICT, WARD_COMMUNE }
    public enum VerificationStatus { PENDING, VERIFIED, REJECTED, SUSPENDED }
    public enum BookingStatus { PENDING, CONFIRMED, COMPLETED, CANCELLED }
    public enum PaymentStatus { SIMULATED, UNPAID, PARTIALLY_PAID, PAID, REFUNDED }
    public enum PaymentProvider { PAYOS, VNPAY }
    public enum PaymentOption { DEPOSIT_50, FULL_100 }
    public enum PaymentTransactionStatus { PENDING, PAID, CANCELLED, EXPIRED, FAILED, REVIEW_REQUIRED }
    public enum ReviewTargetType { SERVICE, SUPPLIER }
    public enum ReportStatus { OPEN, IN_REVIEW, RESOLVED, REJECTED }
    public enum ReportTargetType { SUPPLIER, SERVICE, BOOKING, REVIEW, USER }
}
