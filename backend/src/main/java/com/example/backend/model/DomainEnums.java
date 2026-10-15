package com.example.backend.model;

public final class DomainEnums {
    private DomainEnums() {}
    public enum Role { CUSTOMER, SUPPLIER, STAFF, ADMIN }
    public enum Gender { MALE, FEMALE, OTHER }
    // PHONE remains deserializable so older clients receive OTP_EMAIL_ONLY instead of a 500.
    public enum VerificationChannel { PHONE, EMAIL }
    public enum AccountStatus { ACTIVE, SUSPENDED, DISABLED }
    public enum LocationType { PROVINCE_CITY, DISTRICT, WARD_COMMUNE }
    public enum VerificationStatus { PENDING, VERIFIED, REJECTED, SUSPENDED }
    public enum BookingStatus { PENDING, CONFIRMED, COMPLETED, CANCELLED }
    public enum PaymentStatus { UNPAID, PARTIALLY_PAID, PAID, REFUNDED }
    /** DEPOSIT_50 is retained only for persisted legacy attempts and safe continuation. */
    public enum PaymentOption { DEPOSIT_50, DEPOSIT_05, FULL_100 }
    public enum PaymentTransactionStatus { PENDING, PAID, CANCELLED, EXPIRED, FAILED, REVIEW_REQUIRED }
    public enum ReviewTargetType { SERVICE, SUPPLIER }
    public enum ReportStatus { OPEN, IN_REVIEW, RESOLVED, REJECTED }
    public enum ReportTargetType { SUPPLIER, SERVICE, BOOKING, REVIEW, USER }
}
