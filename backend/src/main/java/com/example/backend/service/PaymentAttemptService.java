package com.example.backend.service;

import com.example.backend.dto.ApiDtos.CreatePaymentRequest;
import com.example.backend.dto.ApiDtos.PaymentResponse;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.*;
import java.time.Instant;
import java.util.*;

import static com.example.backend.model.DomainEnums.*;

/** Provider-neutral payment core used by every newly-created payment attempt. */
@Service
public class PaymentAttemptService {
    private static final Logger log = LoggerFactory.getLogger(PaymentAttemptService.class);
    private final PaymentTransactionRepository payments;
    private final BookingRepository bookings;
    private final PractitionerRepository practitioners;
    private final Map<PaymentProvider, PaymentProviderAdapter> providers;
    private final long reconciliationMinAgeSeconds;
    private final long reconciliationMinIntervalSeconds;

    public PaymentAttemptService(PaymentTransactionRepository payments, BookingRepository bookings,
                                 PractitionerRepository practitioners, List<PaymentProviderAdapter> adapters,
                                 @Value("${app.payment.reconciliation-min-age-seconds:60}") long reconciliationMinAgeSeconds,
                                 @Value("${app.payment.reconciliation-min-interval-seconds:120}") long reconciliationMinIntervalSeconds) {
        this.payments = payments;
        this.bookings = bookings;
        this.practitioners = practitioners;
        EnumMap<PaymentProvider, PaymentProviderAdapter> byProvider = new EnumMap<>(PaymentProvider.class);
        adapters.forEach(adapter -> byProvider.put(adapter.provider(), adapter));
        this.providers = Collections.unmodifiableMap(byProvider);
        this.reconciliationMinAgeSeconds = Math.max(30, reconciliationMinAgeSeconds);
        this.reconciliationMinIntervalSeconds = Math.max(60, reconciliationMinIntervalSeconds);
    }

    @Transactional
    public PaymentResponse create(UserAccount customer, Long bookingId, CreatePaymentRequest request, String clientIp) {
        Booking booking = ownedBooking(customer, bookingId);
        if (booking.getStatus() == BookingStatus.COMPLETED) throw conflict("BOOKING_NOT_PAYABLE", "Lịch hẹn không còn ở trạng thái có thể thanh toán");
        if (isPaid(booking)) {
            return payments.findFirstByBookingIdAndStatusOrderByCreatedAtDesc(bookingId, PaymentTransactionStatus.PAID)
                    .map(this::response).orElseThrow(() -> conflict("PAYMENT_ALREADY_PAID", "Lịch hẹn đã có khoản thanh toán được xác nhận"));
        }

        String voucher = normalizeVoucher(request.voucherCode());
        PaymentTransaction pending = payments.findFirstByBookingIdAndStatusOrderByCreatedAtDesc(bookingId, PaymentTransactionStatus.PENDING).orElse(null);
        if (pending != null) {
            if (isExpired(pending)) throw conflict("PAYMENT_RECONCILING", "Giao dịch cũ đang được đối soát trước khi tạo lần thanh toán mới");
            if (providerOf(pending) == request.provider() && pending.getPaymentOption() == request.paymentOption()
                    && Objects.equals(pending.getVoucherCode(), voucher)) return response(pending);
            throw conflict("PAYMENT_ATTEMPT_EXISTS", "Lịch hẹn đang có một phiên thanh toán khác; vui lòng hoàn tất hoặc chờ phiên đó hết hạn");
        }
        if (booking.getStatus() == BookingStatus.CANCELLED) reopenReleasedSlot(booking);

        PaymentProviderAdapter adapter = requireProvider(request.provider());
        BigDecimal total = booking.getTotalAmount().setScale(0, RoundingMode.HALF_UP);
        BigDecimal payable = total.subtract(calculateDiscount(total, voucher)).max(BigDecimal.ZERO);
        BigDecimal amount = request.paymentOption() == PaymentOption.DEPOSIT_50
                ? payable.multiply(new BigDecimal("0.50")).setScale(0, RoundingMode.HALF_UP) : payable;
        if (amount.signum() <= 0) throw new ApiException(HttpStatus.BAD_REQUEST, "PAYMENT_AMOUNT_INVALID", "Số tiền thanh toán không hợp lệ");

        PaymentTransaction payment = new PaymentTransaction();
        payment.setBooking(booking);
        payment.setProvider(request.provider());
        payment.setOrderCode(nextOrderCode(bookingId));
        payment.setMerchantReference(Long.toString(payment.getOrderCode()));
        payment.setAmount(amount);
        payment.setRemainingAmount(request.paymentOption() == PaymentOption.DEPOSIT_50 ? payable.subtract(amount) : BigDecimal.ZERO);
        payment.setPaymentOption(request.paymentOption());
        payment.setVoucherCode(voucher);
        payment.setStatus(PaymentTransactionStatus.PENDING);
        payment.setExpiresAt(Instant.now().plusSeconds(15 * 60));
        payments.saveAndFlush(payment);

        PaymentProviderAdapter.CheckoutSession checkout = adapter.createCheckout(payment, customer, clientIp);
        payment.setPaymentLinkId(checkout.providerPaymentId());
        payment.setCheckoutUrl(checkout.checkoutUrl());
        if (checkout.providerCreatedAt() != null) payment.setProviderCreatedAt(checkout.providerCreatedAt());
        booking.setStatus(BookingStatus.PENDING);
        booking.setPaymentStatus(PaymentStatus.UNPAID);
        booking.setPaymentRetryAllowed(false);
        return response(payment);
    }

    @Transactional(readOnly = true)
    public PaymentResponse status(UserAccount customer, String reference) {
        PaymentTransaction payment = payments.findByMerchantReference(reference).orElseGet(() -> legacy(reference));
        if (!payment.getBooking().getCustomer().getId().equals(customer.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "PAYMENT_FORBIDDEN", "Bạn không có quyền xem giao dịch này");
        }
        return response(payment);
    }

    @Transactional
    public ApplyResult applyProviderOutcome(PaymentProvider provider, String reference,
                                            PaymentProviderAdapter.ProviderOutcome outcome, String source) {
        PaymentTransaction payment = payments.findByProviderAndMerchantReferenceForUpdate(provider, reference).orElse(null);
        if (payment == null && provider == PaymentProvider.PAYOS) payment = legacyPayOS(reference);
        if (payment == null) return ApplyResult.NOT_FOUND;
        return applyLocked(payment, outcome, source);
    }

    @Transactional
    public void reconcileById(Long paymentId) {
        PaymentTransaction payment = payments.findByIdForUpdate(paymentId).orElse(null);
        if (payment == null || payment.getStatus() != PaymentTransactionStatus.PENDING) return;
        PaymentProviderAdapter.ProviderOutcome outcome = requireProvider(providerOf(payment)).query(payment);
        ApplyResult result = applyLocked(payment, outcome, "server-reconciliation");
        if (result == ApplyResult.AMOUNT_MISMATCH) {
            payment.setStatus(PaymentTransactionStatus.REVIEW_REQUIRED);
            payment.setRequiresManualReview(true);
            log.error("Reconciliation amount mismatch provider={} reference={}", providerOf(payment), referenceOf(payment));
        }
    }

    @Transactional(readOnly = true)
    public List<Long> reconciliationCandidates() {
        Instant now = Instant.now();
        return payments.findReconciliationCandidates(PaymentTransactionStatus.PENDING,
                        now.minusSeconds(reconciliationMinAgeSeconds),
                        now.minusSeconds(reconciliationMinIntervalSeconds), PageRequest.of(0, 100))
                .stream().map(PaymentTransaction::getId).toList();
    }

    private ApplyResult applyLocked(PaymentTransaction payment, PaymentProviderAdapter.ProviderOutcome outcome, String source) {
        if (outcome.amount() == null || payment.getAmount().compareTo(outcome.amount()) != 0) return ApplyResult.AMOUNT_MISMATCH;
        applyMetadata(payment, outcome);
        if (payment.getStatus() == PaymentTransactionStatus.PAID) return ApplyResult.DUPLICATE;
        if (payment.getStatus() != PaymentTransactionStatus.PENDING
                && outcome.status() != PaymentProviderAdapter.OutcomeStatus.PAID) return ApplyResult.DUPLICATE;

        switch (outcome.status()) {
            case PAID -> markPaid(payment, outcome.paidAt(), source);
            case CANCELLED -> closeAndRelease(payment, PaymentTransactionStatus.CANCELLED, source);
            case EXPIRED -> closeAndRelease(payment, PaymentTransactionStatus.EXPIRED, source);
            case FAILED -> closeAndRelease(payment, PaymentTransactionStatus.FAILED, source);
            case REVIEW_REQUIRED -> {
                payment.setStatus(PaymentTransactionStatus.REVIEW_REQUIRED);
                payment.setRequiresManualReview(true);
                log.error("Payment requires manual review provider={} reference={} source={}", providerOf(payment), referenceOf(payment), source);
            }
            case PENDING -> { return ApplyResult.PENDING; }
        }
        return ApplyResult.UPDATED;
    }

    private void applyMetadata(PaymentTransaction payment, PaymentProviderAdapter.ProviderOutcome outcome) {
        payment.setLastReconciledAt(Instant.now());
        payment.setProviderTransactionId(trim(outcome.providerTransactionId(), 120));
        if (outcome.paymentReference() != null) payment.setPaymentReference(trim(outcome.paymentReference(), 120));
        payment.setProviderResponseCode(trim(outcome.responseCode(), 20));
        payment.setProviderTransactionStatus(trim(outcome.transactionStatus(), 20));
        payment.setBankCode(trim(outcome.bankCode(), 30));
        payment.setCardType(trim(outcome.cardType(), 30));
    }

    private void markPaid(PaymentTransaction payment, Instant paidAt, String source) {
        payment.setStatus(PaymentTransactionStatus.PAID);
        payment.setPaidAt(paidAt == null ? Instant.now() : paidAt);
        Booking booking = payment.getBooking();
        if (booking.getStatus() == BookingStatus.CANCELLED || isPaid(booking)) {
            payment.setRequiresManualReview(true);
            booking.setPaymentRetryAllowed(false);
            log.error("Late or duplicate payment requires manual resolution provider={} reference={} bookingId={} source={}",
                    providerOf(payment), referenceOf(payment), booking.getId(), source);
            return;
        }
        booking.setPaymentStatus(payment.getPaymentOption() == PaymentOption.DEPOSIT_50
                ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.PAID);
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPaymentRetryAllowed(false);
        closeSupersededAttempts(payment);
        log.info("Payment verified provider={} reference={} source={}", providerOf(payment), referenceOf(payment), source);
    }

    private void closeSupersededAttempts(PaymentTransaction paid) {
        for (PaymentTransaction other : payments.findAllByBookingIdOrderByCreatedAtDesc(paid.getBooking().getId())) {
            if (Objects.equals(other.getId(), paid.getId()) || other.getStatus() != PaymentTransactionStatus.PENDING) continue;
            try { requireProvider(providerOf(other)).cancel(other, "Another payment attempt was completed"); }
            catch (ApiException exception) { log.error("Could not close superseded payment provider={} reference={} code={}", providerOf(other), referenceOf(other), exception.getCode()); }
            other.setStatus(PaymentTransactionStatus.CANCELLED);
        }
    }

    private void closeAndRelease(PaymentTransaction payment, PaymentTransactionStatus status, String source) {
        payment.setStatus(status);
        Booking booking = payment.getBooking();
        if (booking.getPaymentStatus() == PaymentStatus.UNPAID && booking.getStatus() == BookingStatus.PENDING) {
            booking.setStatus(BookingStatus.CANCELLED);
            booking.setPaymentRetryAllowed(true);
        }
        log.info("Payment closed provider={} reference={} status={} source={}", providerOf(payment), referenceOf(payment), status, source);
    }

    private void reopenReleasedSlot(Booking booking) {
        if (!booking.isPaymentRetryAllowed()) throw conflict("BOOKING_NOT_PAYABLE", "Lịch hẹn đã bị hủy và không thể thanh toán lại");
        practitioners.findByIdForUpdate(booking.getPractitioner().getId())
                .orElseThrow(() -> conflict("SLOT_UNAVAILABLE", "Chuyên viên không còn khả dụng"));
        boolean occupied = bookings.existsByPractitionerIdAndAppointmentDateAndStartTimeAndStatusNotAndIdNot(
                booking.getPractitioner().getId(), booking.getAppointmentDate(), booking.getStartTime(), BookingStatus.CANCELLED, booking.getId());
        if (occupied) {
            booking.setPaymentRetryAllowed(false);
            throw conflict("SLOT_UNAVAILABLE", "Khung giờ đã được người khác đặt sau khi giao dịch trước hết hạn");
        }
        booking.setStatus(BookingStatus.PENDING);
    }

    private PaymentProviderAdapter requireProvider(PaymentProvider provider) {
        PaymentProviderAdapter adapter = providers.get(provider);
        if (adapter == null || !adapter.isConfigured()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                "PAYMENT_PROVIDER_NOT_CONFIGURED", "Cổng thanh toán " + provider + " chưa được cấu hình trên máy chủ");
        return adapter;
    }

    private Booking ownedBooking(UserAccount customer, Long id) {
        Booking booking = bookings.findByIdForUpdate(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "BOOKING_NOT_FOUND", "Không tìm thấy lịch hẹn"));
        if (!booking.getCustomer().getId().equals(customer.getId())) throw new ApiException(HttpStatus.FORBIDDEN, "BOOKING_FORBIDDEN", "Bạn không thể thanh toán lịch hẹn này");
        return booking;
    }

    private PaymentTransaction legacy(String reference) {
        try { return payments.findByOrderCode(Long.valueOf(reference)).orElseThrow(this::notFound); }
        catch (NumberFormatException exception) { throw notFound(); }
    }

    private PaymentTransaction legacyPayOS(String reference) {
        try {
            PaymentTransaction payment = payments.findByOrderCodeForUpdate(Long.valueOf(reference)).orElse(null);
            return payment != null && providerOf(payment) == PaymentProvider.PAYOS ? payment : null;
        } catch (NumberFormatException exception) { return null; }
    }

    private PaymentResponse response(PaymentTransaction payment) {
        Booking booking = payment.getBooking();
        return new PaymentResponse(booking.getId(), booking.getBookingCode(), providerOf(payment), referenceOf(payment),
                payment.getPaymentLinkId(), payment.getCheckoutUrl(), payment.getAmount(), payment.getRemainingAmount(),
                payment.getPaymentOption(), payment.getStatus(), payment.isRequiresManualReview(), payment.getExpiresAt());
    }

    private PaymentProvider providerOf(PaymentTransaction payment) { return payment.getProvider() == null ? PaymentProvider.PAYOS : payment.getProvider(); }
    private String referenceOf(PaymentTransaction payment) { return payment.getMerchantReference() == null ? Long.toString(payment.getOrderCode()) : payment.getMerchantReference(); }
    private boolean isPaid(Booking booking) { return booking.getPaymentStatus() == PaymentStatus.PAID || booking.getPaymentStatus() == PaymentStatus.PARTIALLY_PAID; }
    private boolean isExpired(PaymentTransaction payment) { return payment.getExpiresAt() != null && !payment.getExpiresAt().isAfter(Instant.now()); }
    private String trim(String value, int max) { return value == null ? null : value.substring(0, Math.min(value.length(), max)); }
    private ApiException notFound() { return new ApiException(HttpStatus.NOT_FOUND, "PAYMENT_NOT_FOUND", "Không tìm thấy giao dịch"); }
    private ApiException conflict(String code, String message) { return new ApiException(HttpStatus.CONFLICT, code, message); }

    private Long nextOrderCode(Long bookingId) {
        long candidate = System.currentTimeMillis() * 1000L + Math.floorMod(bookingId, 1000L);
        while (payments.existsByOrderCode(candidate)) candidate++;
        return candidate;
    }

    private String normalizeVoucher(String code) { return code == null || code.isBlank() ? null : code.trim().toUpperCase(Locale.ROOT); }
    private BigDecimal calculateDiscount(BigDecimal total, String code) {
        if (code == null) return BigDecimal.ZERO;
        return switch (code) {
            case "BEAUTY50" -> total.compareTo(new BigDecimal("200000")) >= 0 ? new BigDecimal("50000") : invalidVoucher();
            case "BEAUTY100" -> total.compareTo(new BigDecimal("500000")) >= 0 ? new BigDecimal("100000") : invalidVoucher();
            case "PINK15" -> total.multiply(new BigDecimal("0.15")).min(new BigDecimal("150000")).setScale(0, RoundingMode.HALF_UP);
            default -> throw new ApiException(HttpStatus.BAD_REQUEST, "VOUCHER_INVALID", "Mã voucher không hợp lệ hoặc đã hết hạn");
        };
    }
    private BigDecimal invalidVoucher() { throw new ApiException(HttpStatus.BAD_REQUEST, "VOUCHER_MINIMUM_NOT_MET", "Đơn hàng chưa đạt giá trị tối thiểu của voucher"); }

    public enum ApplyResult { UPDATED, DUPLICATE, PENDING, NOT_FOUND, AMOUNT_MISMATCH }
}
