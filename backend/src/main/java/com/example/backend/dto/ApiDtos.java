package com.example.backend.dto;

import com.example.backend.model.DomainEnums.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import java.util.Set;

public final class ApiDtos {
    private ApiDtos() {}

    public record RegisterRequest(
            @NotBlank(message = "Họ tên không được để trống") @Size(min = 2, max = 120, message = "Họ tên phải có từ 2 đến 120 ký tự")
            @Pattern(regexp = "^\\s*[\\p{L}]+(?:\\s+[\\p{L}]+)*\\s*$", message = "Họ tên chỉ được chứa chữ cái và khoảng trắng") String fullName,
            @NotBlank(message = "Số điện thoại không được để trống") @Pattern(regexp = "^0(?:3|5|7|8|9)[0-9]{8}$", message = "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09") String phone,
            @NotBlank(message = "Email không được để trống") @Email(message = "Email không đúng định dạng") @Size(max = 254, message = "Email tối đa 254 ký tự") String email,
            @NotBlank(message = "Mật khẩu không được để trống") @Size(min = 8, max = 72, message = "Mật khẩu phải có từ 8 đến 72 ký tự")
            @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])\\S+$", message = "Mật khẩu phải có chữ hoa, chữ thường và chữ số") String password,
            @NotNull(message = "Vui lòng chọn giới tính") Gender gender,
            @NotNull(message = "Ngày sinh không được để trống") @Past(message = "Ngày sinh phải là một ngày hợp lệ trong quá khứ") LocalDate dateOfBirth,
            @NotBlank(message = "Bạn cần xác minh email trước khi đăng ký") @Size(max = 120) String verificationToken) {}
    public record LoginRequest(
            @NotBlank(message = "Số điện thoại hoặc email không được để trống") @Size(max = 254, message = "Thông tin đăng nhập quá dài") String identifier,
            @NotBlank(message = "Mật khẩu không được để trống") @Size(max = 72, message = "Mật khẩu tối đa 72 ký tự") String password) {}
    public record GoogleLoginRequest(
            @NotBlank(message = "Thiếu thông tin xác thực Google") @Size(max = 20_000) String credential) {}
    public record StartPasswordResetRequest(
            @NotBlank(message = "Số điện thoại hoặc email không được để trống")
            @Size(max = 254, message = "Thông tin tài khoản quá dài") String identifier) {}
    public record StartPasswordResetResponse(String challengeId, long expiresInSeconds, String message) {}
    public record ConfirmPasswordResetRequest(
            @NotBlank(message = "Phiên đặt lại mật khẩu không hợp lệ") @Size(max = 36) String challengeId,
            @NotBlank(message = "Mã OTP không được để trống")
            @Pattern(regexp = "^[0-9]{6}$", message = "Mã OTP phải gồm 6 chữ số") String otpCode,
            @NotBlank(message = "Mật khẩu mới không được để trống")
            @Size(min = 8, max = 72, message = "Mật khẩu phải có từ 8 đến 72 ký tự")
            @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])\\S+$", message = "Mật khẩu phải có chữ hoa, chữ thường và chữ số") String newPassword) {}
    public record ConfirmPasswordResetResponse(String message) {}
    public record UserResponse(Long id, String fullName, String phone, String email, Gender gender,
                               LocalDate dateOfBirth, Role role, int loyaltyPoints,
                               boolean bookingContactConfirmed) {}
    public record AdminCustomerResponse(Long id, String fullName, Gender gender, LocalDate dateOfBirth,
                                        String phone, String email, long bookingsPlaced, long paidBookings,
                                        long completedBookings, Instant lastBookingAt,
                                        BigDecimal totalVerifiedOnlineAmount) {}
    public record AuthResponse(String accessToken, String tokenType, long expiresInMs, UserResponse user) {}
    public record UpdatePhoneRequest(
            @NotBlank(message = "Số điện thoại không được để trống")
            @Pattern(regexp = "^0(?:3|5|7|8|9)[0-9]{8}$", message = "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09") String phone) {}
    public record UpdateCustomerProfileRequest(
            @Size(min = 2, max = 120, message = "Họ tên phải có từ 2 đến 120 ký tự")
            @Pattern(regexp = "^\\s*[\\p{L}]+(?:\\s+[\\p{L}]+)*\\s*$", message = "Họ tên chỉ được chứa chữ cái và khoảng trắng") String fullName,
            @Pattern(regexp = "^0(?:3|5|7|8|9)[0-9]{8}$", message = "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09") String phone,
            Gender gender,
            @Past(message = "Ngày sinh phải là một ngày hợp lệ trong quá khứ") LocalDate dateOfBirth,
            boolean confirmBookingContact) {}
    public record SupplierRegistrationRequest(
            @NotBlank @Size(min = 2, max = 120) String ownerName,
            @NotBlank @Pattern(regexp = "^(?:0|\\+84)(?:3|5|7|8|9)[0-9]{8}$", message = "Số điện thoại không đúng định dạng di động Việt Nam") String phone,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 72) String password,
            @NotBlank @Size(max = 120) String verificationToken,
            @NotBlank @Size(min = 2, max = 160) String businessName,
            @NotBlank @Size(max = 120) String businessType,
            @NotNull Long locationId,
            @NotBlank @Size(max = 255) String addressLine,
            @Size(max = 1500) String description,
            @Size(max = 160) String specialty,
            @NotBlank @Pattern(regexp = "^[0-9]{12}$", message = "CCCD phải gồm đúng 12 chữ số") String cccdNumber,
            @NotBlank @Size(max = 1_200_000) String cccdFrontImage,
            @NotBlank @Size(max = 1_200_000) String cccdBackImage,
            @NotBlank @Size(max = 1_500_000) String imageUrl,
            @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
            @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude) {}
    public record StartRegistrationVerificationRequest(
            @NotBlank(message = "Số điện thoại không được để trống") @Pattern(regexp = "^0(?:3|5|7|8|9)[0-9]{8}$", message = "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09") String phone,
            @NotBlank(message = "Email không được để trống") @Email(message = "Email không đúng định dạng") @Size(max = 254) String email,
            VerificationChannel channel) {}
    public record StartRegistrationVerificationResponse(String challengeId, long expiresInSeconds, Set<String> requiredChannels) {}
    public record ConfirmRegistrationVerificationRequest(
            @NotBlank @Size(max = 36) String challengeId,
            // Kept only so older clients deserialize safely; email-only verification ignores it.
            @Pattern(regexp = "^$|^[0-9]{6}$", message = "Mã OTP cũ phải gồm 6 chữ số") String phoneCode,
            @Pattern(regexp = "^$|^[0-9]{6}$", message = "Mã email phải gồm 6 chữ số") String emailCode) {}
    public record ConfirmRegistrationVerificationResponse(String registrationToken, long expiresInSeconds) {}
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
            @NotBlank @Size(max = 1_500_000) String imageUrl,
            @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
            @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude) {}

    public record LocationResponse(Long id, String name, String slug, LocationType type, Long parentId) {}
    public record CategoryResponse(Long id, String slug, String name, String description, String imageUrl) {}
    public record PractitionerResponse(Long id, String displayName, String specialty, String avatarUrl, String bio) {}
    public record SupplierPractitionerResponse(Long id, String displayName, String specialty, String avatarUrl,
                                               String bio, boolean active, boolean serviceAssignmentsRestricted,
                                               Set<Long> supportedServiceIds) {}
    public record UpdatePractitionerAssignmentsRequest(@NotNull Set<@Positive Long> serviceIds) {}
    public record UpdatePractitionerStatusRequest(boolean active) {}
    public record CreatePractitionerRequest(@NotBlank @Size(max = 120) String displayName,
                                            @Size(max = 160) String specialty,
                                            @Size(max = 500) String bio,
                                            @Size(max = 1_500_000) String avatarUrl) {}
    public record UpsertSupplierServiceRequest(
            @NotNull Long categoryId,
            @NotBlank @Size(max = 160) String name,
            @Size(max = 1500) String description,
            @NotNull @DecimalMin("1000") @Digits(integer = 10, fraction = 2) BigDecimal price,
            @DecimalMin("1000") @Digits(integer = 10, fraction = 2) BigDecimal originalPrice,
            @Min(15) @Max(480) int durationMinutes,
            @Size(max = 1_500_000) String imageUrl,
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
    public record CapacitySlotResponse(LocalTime time, int availablePractitioners, String state) {}
    public record ServiceCapacityResponse(LocalDate date, int qualifiedPractitioners,
                                          List<CapacitySlotResponse> slots, String reason) {}

    public record CreateBookingRequest(
            @NotNull(message = "Vui lòng chọn dịch vụ") @Positive(message = "Dịch vụ không hợp lệ") Long serviceId,
            @Positive(message = "Chuyên viên không hợp lệ") Long practitionerId,
            @NotNull(message = "Vui lòng chọn ngày hẹn") LocalDate appointmentDate,
            @NotNull(message = "Vui lòng chọn khung giờ") LocalTime startTime,
            @Size(max = 500, message = "Ghi chú tối đa 500 ký tự") String note) {}
    public record BookingResponse(Long id, String bookingCode, Long serviceId, String serviceName,
                                  String serviceImageUrl, Long supplierId, String supplierName,
                                  String supplierImageUrl, String supplierAddress,
                                  String practitionerName, LocalDate appointmentDate, LocalTime startTime,
                                  LocalTime endTime, BigDecimal totalAmount, BookingStatus status,
                                  PaymentStatus paymentStatus, boolean reviewEligible,
                                  BookingReviewResponse serviceReview, BookingReviewResponse supplierReview,
                                  boolean completionEligible, boolean cancelEligible,
                                  boolean paymentEligible, String paymentBlockerReason,
                                  PaymentOption paymentOption, String paymentVoucherCode, boolean paymentAttemptActive,
                                  BigDecimal paymentAmount, BigDecimal paymentRemainingAmount) {}
    public record BookingHistoryStatusResponse(boolean hasPreviousBooking) {}
    public record PaymentReviewAttempt(Long id, Long orderCode, String paymentLinkId,
            PaymentTransactionStatus appStatus, boolean manual, BigDecimal expectedAmount, Instant paidAt, Instant updatedAt,
            String providerStatus, Long providerOrderCode, String providerLinkId, Long providerAmount, Long amountPaid,
            boolean identityMatches, String errorCode) {}
    public record PaymentReviewPreview(Long bookingId, BookingStatus bookingStatus, PaymentStatus paymentStatus,
            boolean retryAllowed, String fingerprint, boolean canCloseZeroMoney, boolean proposedRetryAllowed,
            String blocker, boolean canCloseZeroSecondary, List<PaymentReviewAttempt> attempts) {}
    public record CloseZeroMoneyRequest(
            @NotBlank @Pattern(regexp = "[a-f0-9]{64}") String fingerprint,
            @NotBlank @Pattern(regexp = "[A-Za-z0-9_.-]{3,80}") String caseReference) {}
    public record PaymentReviewResolution(Long bookingId, BookingStatus bookingStatus,
            boolean retryAllowed, Long auditId, boolean alreadyApplied) {}
    public record UpsertBookingReviewRequest(
            @NotNull(message = "Vui lòng chọn số sao") @Min(value = 1, message = "Đánh giá tối thiểu 1 sao") @Max(value = 5, message = "Đánh giá tối đa 5 sao") Integer rating,
            @Size(max = 1500, message = "Nội dung đánh giá tối đa 1500 ký tự") String comment) {}
    public record BookingReviewResponse(Long id, Long bookingId, ReviewTargetType targetType, int rating,
                                        String comment, Instant createdAt, Instant updatedAt) {}
    public record PublicReviewResponse(Long id, ReviewTargetType targetType, int rating, String comment,
                                       String reviewerDisplayName, Long serviceId, String serviceName,
                                       Instant createdAt) {}
    public record PublicReviewPageResponse(List<PublicReviewResponse> content, long totalElements,
                                          int totalPages, int page, int size, double rating) {}
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

    public record CreateReportRequest(
            @NotNull(message = "Vui lòng chọn loại đối tượng") ReportTargetType targetType,
            @NotNull(message = "Đối tượng báo cáo không được để trống") @Positive(message = "Đối tượng báo cáo không hợp lệ") Long targetId,
            @NotBlank(message = "Tiêu đề không được để trống") @Size(min = 2, max = 120, message = "Tiêu đề phải có từ 2 đến 120 ký tự") String reason,
            @NotBlank(message = "Nội dung không được để trống") @Size(min = 10, max = 1500, message = "Nội dung phải có từ 10 đến 1500 ký tự") String details) {}
    public record UpdateReportRequest(
            @NotNull(message = "Vui lòng chọn trạng thái") ReportStatus status,
            @Size(max = 1000, message = "Ghi chú xử lý tối đa 1000 ký tự") String resolutionNote) {
        @AssertTrue(message = "Cần nhập ghi chú xử lý khi hoàn tất hoặc từ chối báo cáo")
        public boolean isResolutionNoteValid() {
            return status == null || (status != ReportStatus.RESOLVED && status != ReportStatus.REJECTED)
                    || (resolutionNote != null && !resolutionNote.isBlank());
        }
    }
    public record CreatePayOSPaymentRequest(
            @NotNull(message = "Vui lòng chọn hình thức thanh toán") PaymentOption paymentOption,
            @Pattern(regexp = "^[A-Z0-9_-]{3,40}$", message = "Mã voucher không hợp lệ") String voucherCode) {}
    public record PaymentQuoteResponse(BigDecimal originalAmount, BigDecimal discountAmount,
                                       BigDecimal payableAmount, BigDecimal amount, BigDecimal remainingAmount,
                                       PaymentOption paymentOption, boolean paymentAvailable,
                                       String unavailableReason) {}
    public record PayOSPaymentResponse(Long bookingId, String bookingCode, Long orderCode, String paymentLinkId,
                                       String checkoutUrl, BigDecimal amount, BigDecimal remainingAmount,
                                       PaymentOption paymentOption, PaymentTransactionStatus status,
                                       boolean requiresManualReview, Instant expiresAt) {}
    public record PayOSWebhookResponse(boolean success) {}
    public record ReportResponse(Long id, ReportTargetType targetType, Long targetId, String reason, String details,
                                 ReportStatus status, String reporterName, String assignedStaffName,
                                 String resolutionNote, Instant createdAt) {}
}
