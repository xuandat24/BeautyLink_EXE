package com.example.backend.dto;

import com.example.backend.model.DomainEnums.*;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.*;
import java.time.*;
import java.math.BigDecimal;
import java.util.List;

public final class AdminDetailDtos {
    private AdminDetailDtos() {}
    public record OwnedSalon(Long id, String name, VerificationStatus approvalStatus) {}
    public record AccountDetail(Long id, String fullName, String email, String phone, Gender gender,
            LocalDate dateOfBirth, Role role, AccountStatus status, Instant createdAt, Instant updatedAt,
            List<OwnedSalon> salons) {}
    public record ProfilePatch(@NotBlank @Size(min=2,max=120) String fullName, Gender gender,
            @Past LocalDate dateOfBirth, @NotNull Instant expectedUpdatedAt) {
        @JsonAnySetter public void rejectUnknown(String field, Object value) {
            throw new IllegalArgumentException("Unsupported profile field");
        }
    }
    public record ServiceDetail(Long id, String name, String category, BigDecimal price, int durationMinutes, boolean active) {}
    public record PaymentRow(Long id, Long orderCode, Long bookingId, String bookingCode, String supplierName,
            PaymentOption paymentOption, PaymentTransactionStatus status, BigDecimal amount,
            BigDecimal remainingAmount, Instant createdAt, Instant paidAt, boolean requiresManualReview,
            boolean canonicalVerified, PaymentStatus bookingPaymentStatus) {}
    public record PaymentLedger(BigDecimal verifiedOnlineAmount, BigDecimal deposits, BigDecimal fullPayments,
            BigDecimal remainingAtSalon, long attempts, long reviewRequiredAttempts, long failedAttempts,
            AdminDashboardDtos.AdminPageResponse<PaymentRow> rows) {}
}
