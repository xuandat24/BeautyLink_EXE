package com.example.backend.dto;

import com.example.backend.model.DomainEnums.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;

public final class ApiDtos {
    private ApiDtos() {}

    public record RegisterRequest(
            @NotBlank @Size(min = 2, max = 120) String fullName,
            @NotBlank @Pattern(regexp = "^(0|\\+84)[0-9]{9,10}$") String phone,
            @Email String email,
            @NotBlank @Size(min = 8, max = 72) String password) {}
    public record LoginRequest(@NotBlank String identifier, @NotBlank String password) {}
    public record UserResponse(Long id, String fullName, String phone, String email, Role role, int loyaltyPoints) {}
    public record AuthResponse(String accessToken, String tokenType, long expiresInMs, UserResponse user) {}
    public record SupplierRegistrationRequest(
            @NotBlank @Size(min = 2, max = 120) String ownerName,
            @NotBlank @Pattern(regexp = "^(0|\\+84)[0-9]{9,10}$") String phone,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 72) String password,
            @NotBlank @Size(min = 2, max = 160) String businessName,
            @NotBlank @Size(max = 120) String businessType,
            @NotNull Long locationId,
            @NotBlank @Size(max = 255) String addressLine,
            @Size(max = 1500) String description,
            @Size(max = 160) String specialty,
            @NotBlank @Pattern(regexp = "^[0-9]{12}$", message = "CCCD phải gồm đúng 12 chữ số") String cccdNumber,
            @NotBlank @Size(max = 1_200_000) String cccdFrontImage,
            @NotBlank @Size(max = 1_200_000) String cccdBackImage,
            @NotBlank @Size(max = 2_000_000) String imageUrl,
            @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
            @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude) {}
    public record SupplierResponse(Long id, String name, String slug, String businessType, String description,
                                   Long locationId, String locationName, String addressLine, String imageUrl,
                                   Double latitude, Double longitude, VerificationStatus verificationStatus,
                                   double rating, int reviewCount) {}
    public record SupplierRegistrationResponse(AuthResponse auth, SupplierResponse supplier) {}
    public record UpdateSupplierProfileRequest(
            @NotBlank @Size(min = 2, max = 160) String name,
            @NotBlank @Size(max = 120) String businessType,
            @Size(max = 1500) String description,
            @NotBlank @Size(max = 255) String addressLine,
            @NotBlank @Size(max = 2_000_000) String imageUrl,
            @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
            @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude) {}

    public record LocationResponse(Long id, String name, String slug, LocationType type, Long parentId) {}
    public record CategoryResponse(Long id, String slug, String name, String description, String imageUrl) {}
    public record PractitionerResponse(Long id, String displayName, String specialty, String avatarUrl, String bio) {}
    public record CreatePractitionerRequest(@NotBlank @Size(max = 120) String displayName,
                                            @Size(max = 160) String specialty,
                                            @Size(max = 500) String bio,
                                            @Size(max = 2_000_000) String avatarUrl) {}
    public record UpsertSupplierServiceRequest(
            @NotNull Long categoryId,
            @NotBlank @Size(max = 160) String name,
            @Size(max = 1500) String description,
            @NotNull @DecimalMin("1000") @Digits(integer = 10, fraction = 2) BigDecimal price,
            @DecimalMin("1000") @Digits(integer = 10, fraction = 2) BigDecimal originalPrice,
            @Min(15) @Max(480) int durationMinutes,
            @Size(max = 2_000_000) String imageUrl,
            boolean active) {}
    public record SupplierServiceResponse(Long id, Long categoryId, String categorySlug, String categoryName,
                                          String name, String description, BigDecimal price, BigDecimal originalPrice,
                                          int durationMinutes, String imageUrl, boolean active) {}
    public record ServiceResponse(Long id, String name, String description, BigDecimal price, int durationMinutes,
                                  String imageUrl, String categorySlug, Long supplierId, String supplierName,
                                  String supplierAddress, double rating, int serviceReviewCount,
                                  double supplierRating, List<PractitionerResponse> practitioners,
                                  BigDecimal originalPrice, String highlightText, boolean featured,
                                  String supplierImageUrl, String supplierBusinessType, int supplierReviewCount,
                                  boolean supplierDemo, boolean supplierNearbyFeatured, boolean supplierNewPartner,
                                  Double supplierLatitude, Double supplierLongitude) {}
    public record AvailabilityResponse(Long practitionerId, LocalDate date, List<LocalTime> availableSlots) {}

    public record CreateBookingRequest(
            @NotNull Long serviceId,
            @NotNull Long practitionerId,
            @NotNull @FutureOrPresent LocalDate appointmentDate,
            @NotNull LocalTime startTime,
            @Size(max = 500) String note) {}
    public record BookingResponse(Long id, String bookingCode, Long serviceId, String serviceName,
                                  String serviceImageUrl, Long supplierId, String supplierName,
                                  String supplierImageUrl, String supplierAddress,
                                  String practitionerName, LocalDate appointmentDate, LocalTime startTime,
                                  LocalTime endTime, BigDecimal totalAmount, BookingStatus status,
                                  PaymentStatus paymentStatus, boolean reviewEligible,
                                  BookingReviewResponse serviceReview, BookingReviewResponse supplierReview) {}
    public record UpsertBookingReviewRequest(@NotNull @Min(0) @Max(5) Integer rating, @Size(max = 1500) String comment) {}
    public record BookingReviewResponse(Long id, Long bookingId, ReviewTargetType targetType, int rating,
                                        String comment, Instant createdAt, Instant updatedAt) {}
    public record PublicReviewResponse(Long id, ReviewTargetType targetType, int rating, String comment,
                                       String reviewerDisplayName, Long serviceId, String serviceName,
                                       Instant createdAt) {}
    public record PublicSupplierShopResponse(Long id, String name, String slug, String businessType,
                                             String description, String addressLine, String locationName,
                                             String imageUrl, Double latitude, Double longitude,
                                             VerificationStatus verificationStatus, double rating,
                                             int reviewCount, Instant joinedAt, List<ServiceResponse> services,
                                             List<PublicReviewResponse> reviews) {}

    public record ScheduleRuleRequest(
            @NotNull DayOfWeek dayOfWeek,
            @NotNull LocalTime startTime,
            @NotNull LocalTime endTime,
            LocalTime breakStart,
            LocalTime breakEnd,
            @Min(15) @Max(240) int slotMinutes,
            boolean active) {}
    public record ReplaceScheduleRequest(@NotEmpty List<@Valid ScheduleRuleRequest> rules) {}
    public record ScheduleRuleResponse(Long id, DayOfWeek dayOfWeek, LocalTime startTime, LocalTime endTime,
                                       LocalTime breakStart, LocalTime breakEnd, int slotMinutes, boolean active) {}

    public record CreateReportRequest(@NotNull ReportTargetType targetType, @NotNull Long targetId,
                                      @NotBlank @Size(max = 120) String reason,
                                      @NotBlank @Size(max = 1500) String details) {}
    public record UpdateReportRequest(@NotNull ReportStatus status, @Size(max = 1000) String resolutionNote) {}
    public record ReportResponse(Long id, ReportTargetType targetType, Long targetId, String reason, String details,
                                 ReportStatus status, String reporterName, String assignedStaffName,
                                 String resolutionNote, Instant createdAt) {}
}
