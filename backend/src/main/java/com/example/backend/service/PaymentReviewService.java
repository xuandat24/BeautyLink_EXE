package com.example.backend.service;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import static com.example.backend.model.DomainEnums.*;

@Service
public class PaymentReviewService {
    public static final String AUDIT_REASON = "PMT-AUDIT:ZERO-MONEY";
    public static final String SECONDARY_REASON = "PMT-AUDIT:ZERO-SECONDARY";
    private final BookingRepository bookings;
    private final PaymentTransactionRepository payments;
    private final PractitionerRepository practitioners;
    private final SupportReportRepository reports;
    private final PayOSGateway gateway;
    private final AvailabilityService availability;
    private final BookingCompletionPolicy time;
    private final ObjectMapper json;
    public PaymentReviewService(BookingRepository bookings, PaymentTransactionRepository payments, PractitionerRepository practitioners,
            SupportReportRepository reports, PayOSGateway gateway, AvailabilityService availability, BookingCompletionPolicy time, ObjectMapper json) {
        this.bookings = bookings; this.payments = payments; this.practitioners = practitioners; this.reports = reports;
        this.gateway = gateway; this.availability = availability; this.time = time; this.json = json;
    }
    @Transactional(readOnly = true) public PaymentReviewPreview preview(UserAccount operator, Long id) {
        requireOperator(operator);
        Booking b = bookings.findById(id).orElseThrow(this::notFound);
        return inspect(b, payments.findAllByBookingIdOrderByCreatedAtDesc(id));
    }
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PaymentReviewResolution closeZeroMoney(UserAccount operator, Long id, CloseZeroMoneyRequest request) {
        return resolve(operator, id, request, false);
    }
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PaymentReviewResolution closeZeroSecondary(UserAccount operator, Long id, CloseZeroMoneyRequest request) {
        return resolve(operator, id, request, true);
    }
    private PaymentReviewResolution resolve(UserAccount operator, Long id, CloseZeroMoneyRequest request, boolean secondary) {
        requireOperator(operator);
        Booking b = bookings.findByIdForUpdate(id).orElseThrow(this::notFound);
        List<PaymentTransaction> attempts = payments.findAllByBookingIdForUpdate(id);
        // Same root lock order as webhook/cancel. Retry planning also shares the practitioner mutex.
        practitioners.findByIdForUpdate(b.getPractitioner().getId()).orElseThrow(this::notFound);
        PaymentReviewPreview current = inspect(b, attempts);
        if (!(secondary ? current.canCloseZeroSecondary() : current.canCloseZeroMoney()))
            throw conflict(secondary ? "PAYMENT_REVIEW_SECONDARY_UNSAFE" : current.blocker());
        String reason = secondary ? SECONDARY_REASON : AUDIT_REASON;
        var previous = reports.findFirstByTargetTypeAndTargetIdAndReasonAndResolutionNote(ReportTargetType.BOOKING, id, reason, request.fingerprint());
        if (previous.isPresent() && identicalResolvedCase(previous.get(), current)) {
            // A repeat must still fetch provider proof; new money/mismatch cannot be bypassed by an old audit.
            return new PaymentReviewResolution(id, b.getStatus(), b.isPaymentRetryAllowed(), previous.get().getId(), true);
        }
        if (!current.fingerprint().equals(request.fingerprint())) throw conflict("PAYMENT_REVIEW_STALE");
        boolean retry = secondary ? b.isPaymentRetryAllowed() : current.proposedRetryAllowed();
        for (int i = 0; i < attempts.size(); i++) {
            PaymentTransaction p = attempts.get(i);
            PaymentReviewAttempt evidence = current.attempts().stream().filter(a -> a.id().equals(p.getId())).findFirst().orElseThrow();
            // A verified primary payment is untouched, including amount, paidAt and timestamps.
            if (!secondary || p.getStatus() != PaymentTransactionStatus.PAID) {
                p.setPaymentLinkId(evidence.providerLinkId());
                p.setStatus(PaymentTransactionStatus.valueOf(evidence.providerStatus()));
                p.setRequiresManualReview(false); p.setCheckoutUrl(null); p.setLastReconciledAt(time.now());
            }
            // One bounded record per attempt, rather than truncating a large all-attempt proof.
            audit(operator, id, "PMT-AUDIT:PROVIDER-SNAPSHOT", serialize(evidence), request.fingerprint());
        }
        String before = b.getStatus().name();
        if (!secondary) { b.setStatus(BookingStatus.CANCELLED); b.setPaymentRetryAllowed(retry); }
        var summary = audit(operator, id, reason, serialize(Map.of("caseReference", request.caseReference(), "before", before,
                "bookingStatus", b.getStatus().name(), "paymentStatus", b.getPaymentStatus().name(), "retryAllowed", retry,
                "attemptIds", current.attempts().stream().map(PaymentReviewAttempt::id).toList(), "fingerprint", request.fingerprint())), request.fingerprint());
        return new PaymentReviewResolution(id, b.getStatus(), retry, summary.getId(), false);
    }
    private PaymentReviewPreview inspect(Booking b, List<PaymentTransaction> records) {
        List<PaymentReviewAttempt> evidence = records.stream().sorted(Comparator.comparing(PaymentTransaction::getId)).map(this::observe).toList();
        String blocker = null;
        if (records.isEmpty()) blocker = "PAYMENT_REVIEW_NO_ATTEMPTS";
        else if (b.getStatus() == BookingStatus.COMPLETED || b.getPaymentStatus() != PaymentStatus.UNPAID
                || records.stream().anyMatch(p -> p.getStatus() == PaymentTransactionStatus.PAID || p.getPaidAt() != null)) blocker = "PAYMENT_REVIEW_MONEY_EVIDENCE";
        else if (evidence.stream().anyMatch(e -> !e.identityMatches() || e.errorCode() != null)) blocker = "PAYMENT_REVIEW_PROVIDER_UNVERIFIED";
        else if (evidence.stream().anyMatch(e -> e.amountPaid() == null || e.amountPaid() != 0 || !Set.of("CANCELLED", "EXPIRED", "FAILED").contains(e.providerStatus()))) blocker = "PAYMENT_REVIEW_NOT_ZERO_TERMINAL";
        boolean retry = blocker == null && !(b.getStatus() == BookingStatus.CANCELLED && !b.isPaymentRetryAllowed())
                && evidence.stream().allMatch(e -> Set.of("EXPIRED", "FAILED").contains(e.providerStatus())) && retrySlotValid(b);
        boolean secondary = safeZeroSecondary(b, records, evidence);
        String fingerprint = digest(serialize(List.of(b.getId(), b.getStatus(), b.getPaymentStatus(), b.isPaymentRetryAllowed(),
                b.getAppointmentDate(), b.getStartTime(), b.getEndTime(), b.getService().getId(), b.getPractitioner().getId(), retry, secondary, evidence)));
        return new PaymentReviewPreview(b.getId(), b.getStatus(), b.getPaymentStatus(), b.isPaymentRetryAllowed(), fingerprint, blocker == null, retry, blocker, secondary, evidence);
    }
    private boolean safeZeroSecondary(Booking b, List<PaymentTransaction> records, List<PaymentReviewAttempt> evidence) {
        if (records.size() < 2 || !Set.of(BookingStatus.CONFIRMED, BookingStatus.COMPLETED).contains(b.getStatus())) return false;
        var primary = records.stream().filter(p -> p.getStatus() == PaymentTransactionStatus.PAID).toList();
        if (primary.size() != 1) return false;
        PaymentTransaction paid = primary.get(0);
        PaymentStatus expected = paid.getPaymentOption() == PaymentOption.DEPOSIT_50 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.PAID;
        if (b.getPaymentStatus() != expected || paid.isRequiresManualReview() || paid.getPaidAt() == null
                || paid.getPaymentLinkId() == null || paid.getPaymentLinkId().isBlank()) return false;
        return evidence.stream().allMatch(e -> {
            if (!e.identityMatches() || e.errorCode() != null || e.amountPaid() == null) return false;
            if (e.id().equals(paid.getId())) return e.providerStatus().equals("PAID") && e.amountPaid() > 0 && e.amountPaid().equals(e.providerAmount());
            return e.appStatus() != PaymentTransactionStatus.PAID && e.paidAt() == null && e.amountPaid() == 0
                    && Set.of("CANCELLED", "EXPIRED", "FAILED").contains(e.providerStatus());
        });
    }
    private boolean retrySlotValid(Booking b) {
        if (!time.validBookingDate(b.getAppointmentDate()) || !time.hasBookingLead(b.getAppointmentDate().atTime(b.getStartTime()))
                || !b.getPractitioner().isActive() || !b.getService().isActive()) return false;
        try { return availability.availability(b.getService().getId(), b.getPractitioner().getId(), b.getAppointmentDate(), b.getId()).availableSlots().contains(b.getStartTime()); }
        catch (ApiException error) { return false; }
    }
    private PaymentReviewAttempt observe(PaymentTransaction p) {
        var providerStatus = "UNKNOWN"; Long providerOrder = null, amount = null, received = null; String link = null, errorCode = null;
        boolean matches = false;
        try {
            var result = gateway.get(p.getOrderCode());
            if (result != null) {
                providerStatus = result.getStatus() == null ? "UNKNOWN" : result.getStatus().name(); providerOrder = result.getOrderCode();
                link = result.getId(); amount = result.getAmount(); received = result.getAmountPaid();
                matches = Objects.equals(p.getOrderCode(), providerOrder) && link != null && !link.isBlank()
                        && (p.getPaymentLinkId() == null || p.getPaymentLinkId().equals(link))
                        && amount != null && p.getAmount().longValueExact() == amount;
            }
        } catch (ApiException error) { errorCode = error.getCode(); }
        return new PaymentReviewAttempt(p.getId(), p.getOrderCode(), p.getPaymentLinkId(), p.getStatus(), p.isRequiresManualReview(),
                p.getAmount(), p.getPaidAt(), p.getUpdatedAt(), providerStatus, providerOrder, link, amount, received, matches, errorCode);
    }
    private SupportReport audit(UserAccount operator, Long bookingId, String reason, String details, String fingerprint) {
        if (details.length() > 1500) throw conflict("PAYMENT_REVIEW_AUDIT_TOO_LARGE");
        SupportReport report = new SupportReport(); report.setReporter(operator); report.setAssignedStaff(operator);
        report.setTargetType(ReportTargetType.BOOKING); report.setTargetId(bookingId); report.setReason(reason); report.setDetails(details);
        report.setStatus(ReportStatus.RESOLVED); report.setResolutionNote(fingerprint); report.setResolvedAt(time.now());
        return reports.saveAndFlush(report);
    }
    private String serialize(Object value) { try { return json.writeValueAsString(value); } catch (JsonProcessingException e) { throw new IllegalStateException("Cannot encode payment review evidence"); } }
    private boolean identicalResolvedCase(SupportReport audit, PaymentReviewPreview current) {
        try {
            var data = json.readTree(audit.getDetails());
            return data.path("bookingStatus").asText().equals(current.bookingStatus().name())
                    && data.path("paymentStatus").asText().equals(current.paymentStatus().name())
                    && data.path("retryAllowed").asBoolean() == current.retryAllowed()
                    && json.convertValue(data.path("attemptIds"), new com.fasterxml.jackson.core.type.TypeReference<List<Long>>() {})
                            .equals(current.attempts().stream().map(PaymentReviewAttempt::id).toList())
                    && current.attempts().stream().allMatch(e -> !e.manual() && e.appStatus().name().equals(e.providerStatus()) && Objects.equals(e.paymentLinkId(), e.providerLinkId()));
        } catch (JsonProcessingException error) { return false; }
    }
    private String digest(String data) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data.getBytes(StandardCharsets.UTF_8))); } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); } }
    private void requireOperator(UserAccount user) { if (user == null || user.getRole() != Role.ADMIN || user.getStatus() != AccountStatus.ACTIVE) throw new ApiException(HttpStatus.FORBIDDEN, "PAYMENT_REVIEW_FORBIDDEN", "Chỉ quản trị viên được phép đối soát."); }
    private ApiException notFound() { return new ApiException(HttpStatus.NOT_FOUND, "BOOKING_NOT_FOUND", "Không tìm thấy lịch hẹn"); }
    private ApiException conflict(String code) { return new ApiException(HttpStatus.CONFLICT, code, "Không thể đóng hồ sơ an toàn. Hãy tải preview mới hoặc liên hệ người phụ trách đối soát."); }
}
