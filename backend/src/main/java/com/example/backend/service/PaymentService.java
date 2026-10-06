package com.example.backend.service;

import com.example.backend.dto.ApiDtos.CreatePayOSPaymentRequest;
import com.example.backend.dto.ApiDtos.PayOSPaymentResponse;
import com.example.backend.exception.ApiException;
import com.example.backend.model.Booking;
import com.example.backend.model.PaymentTransaction;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.BookingRepository;
import com.example.backend.repository.PaymentTransactionRepository;
import com.example.backend.repository.PractitionerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkRequest;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkResponse;
import vn.payos.model.v2.paymentRequests.PaymentLink;
import vn.payos.model.v2.paymentRequests.PaymentLinkStatus;
import vn.payos.model.webhooks.Webhook;
import vn.payos.model.webhooks.WebhookData;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

import static com.example.backend.model.DomainEnums.*;

/** Canonical PayOS-only payment business service. */
@Service
public class PaymentService {
    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);
    private static final BigDecimal MIN_PAYOS_AMOUNT = new BigDecimal("2000");
    private static final long CHECKOUT_TTL_SECONDS = 15 * 60;

    private final PaymentTransactionRepository payments;
    private final BookingRepository bookings;
    private final PractitionerRepository practitioners;
    private final PayOSGateway gateway;
    private final String returnUrl;
    private final String cancelUrl;
    private final long reconciliationMinAgeSeconds;
    private final long reconciliationMinIntervalSeconds;

    public PaymentService(PaymentTransactionRepository payments, BookingRepository bookings,
                          PractitionerRepository practitioners, PayOSGateway gateway,
                          @Value("${app.payos.return-url}") String returnUrl,
                          @Value("${app.payos.cancel-url}") String cancelUrl,
                          @Value("${app.payos.reconciliation-min-age-seconds:60}") long reconciliationMinAgeSeconds,
                          @Value("${app.payos.reconciliation-min-interval-seconds:120}") long reconciliationMinIntervalSeconds) {
        this.payments = payments;
        this.bookings = bookings;
        this.practitioners = practitioners;
        this.gateway = gateway;
        this.returnUrl = returnUrl;
        this.cancelUrl = cancelUrl;
        this.reconciliationMinAgeSeconds = Math.max(30, reconciliationMinAgeSeconds);
        this.reconciliationMinIntervalSeconds = Math.max(60, reconciliationMinIntervalSeconds);
    }

    @Transactional
    public PayOSPaymentResponse create(UserAccount customer, Long bookingId, CreatePayOSPaymentRequest request) {
        Booking booking = ownedBooking(customer, bookingId);
        if (booking.getStatus() == BookingStatus.COMPLETED) {
            throw conflict("BOOKING_NOT_PAYABLE", "Lịch hẹn không còn ở trạng thái có thể thanh toán");
        }
        if (isPaid(booking)) {
            return payments.findFirstByBookingIdAndStatusOrderByCreatedAtDesc(bookingId, PaymentTransactionStatus.PAID)
                    .map(this::response)
                    .orElseThrow(() -> conflict("PAYMENT_ALREADY_PAID", "Lịch hẹn đã được thanh toán"));
        }

        String voucherCode = normalizeVoucher(request.voucherCode());
        PaymentTransaction pending = payments.findFirstByBookingIdAndStatusOrderByCreatedAtDesc(
                bookingId, PaymentTransactionStatus.PENDING).orElse(null);
        if (pending != null) {
            if (isExpired(pending)) {
                throw conflict("PAYMENT_RECONCILING", "Giao dịch cũ đang được PayOS đối soát trước khi tạo lần thanh toán mới");
            }
            if (pending.getPaymentOption() == request.paymentOption()
                    && Objects.equals(pending.getVoucherCode(), voucherCode)) return response(pending);
            throw conflict("PAYMENT_ATTEMPT_EXISTS", "Lịch hẹn đang có một phiên PayOS; vui lòng hoàn tất hoặc chờ đối soát");
        }

        if (booking.getStatus() == BookingStatus.CANCELLED) reopenReleasedSlot(booking);

        BigDecimal total = booking.getTotalAmount().setScale(0, RoundingMode.HALF_UP);
        BigDecimal payable = total.subtract(calculateDiscount(total, voucherCode)).max(BigDecimal.ZERO);
        BigDecimal amount = request.paymentOption() == PaymentOption.DEPOSIT_50
                ? payable.multiply(new BigDecimal("0.50")).setScale(0, RoundingMode.HALF_UP) : payable;
        BigDecimal remaining = request.paymentOption() == PaymentOption.DEPOSIT_50
                ? payable.subtract(amount) : BigDecimal.ZERO;
        if (amount.compareTo(MIN_PAYOS_AMOUNT) < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAYMENT_AMOUNT_TOO_LOW", "Số tiền thanh toán PayOS tối thiểu là 2.000đ");
        }

        PaymentTransaction transaction = new PaymentTransaction();
        transaction.setBooking(booking);
        transaction.setOrderCode(nextOrderCode(bookingId));
        transaction.setMerchantReference(Long.toString(transaction.getOrderCode()));
        transaction.setAmount(amount);
        transaction.setRemainingAmount(remaining);
        transaction.setPaymentOption(request.paymentOption());
        transaction.setVoucherCode(voucherCode);
        transaction.setStatus(PaymentTransactionStatus.PENDING);
        transaction.setExpiresAt(Instant.now().plusSeconds(CHECKOUT_TTL_SECONDS));
        payments.saveAndFlush(transaction);

        CreatePaymentLinkRequest paymentRequest = CreatePaymentLinkRequest.builder()
                .orderCode(transaction.getOrderCode()).amount(amount.longValueExact())
                .description(payOSDescription(transaction.getOrderCode()))
                .buyerName(customer.getFullName()).buyerEmail(customer.getEmail()).buyerPhone(customer.getPhone())
                .returnUrl(returnUrl).cancelUrl(cancelUrl).expiredAt(transaction.getExpiresAt().getEpochSecond()).build();
        CreatePaymentLinkResponse payOS = gateway.create(paymentRequest);
        transaction.setPaymentLinkId(payOS.getPaymentLinkId());
        transaction.setCheckoutUrl(payOS.getCheckoutUrl());
        transaction.setProviderCreatedAt(Instant.now());
        booking.setStatus(BookingStatus.PENDING);
        booking.setPaymentStatus(PaymentStatus.UNPAID);
        booking.setPaymentRetryAllowed(false);
        return response(transaction);
    }

    @Transactional
    public PayOSPaymentResponse status(UserAccount customer, Long orderCode) {
        PaymentTransaction payment = payments.findByOrderCodeForUpdate(orderCode).orElseThrow(this::notFound);
        if (!payment.getBooking().getCustomer().getId().equals(customer.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "PAYMENT_FORBIDDEN", "Bạn không có quyền xem giao dịch này");
        }
        if (payment.getStatus() == PaymentTransactionStatus.PENDING && shouldReconcile(payment)) reconcileLocked(payment);
        return response(payment);
    }

    @Transactional
    public boolean handleWebhook(Webhook webhook) {
        WebhookData data = gateway.verify(webhook);
        if (data == null || data.getOrderCode() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAYOS_INVALID_WEBHOOK", "Webhook PayOS thiếu dữ liệu giao dịch");
        }
        PaymentTransaction payment = payments.findByOrderCodeForUpdate(data.getOrderCode()).orElse(null);
        if (payment == null) {
            log.info("PayOS signed verification webhook accepted for unknown orderCode={}", data.getOrderCode());
            return true;
        }
        if (payment.getStatus() == PaymentTransactionStatus.PAID) {
            log.info("PayOS duplicate paid webhook ignored orderCode={}", data.getOrderCode());
            return true;
        }
        if (!Boolean.TRUE.equals(webhook.getSuccess()) || !"00".equals(data.getCode())) {
            log.info("PayOS non-success webhook ignored orderCode={} code={}", data.getOrderCode(), data.getCode());
            return true;
        }
        if (data.getAmount() == null || payment.getAmount().longValueExact() != data.getAmount()) {
            requireManualReview(payment, data.getReference(), "webhook-amount-mismatch");
            return false;
        }
        if (payment.getPaymentLinkId() != null && data.getPaymentLinkId() != null
                && !payment.getPaymentLinkId().equals(data.getPaymentLinkId())) {
            requireManualReview(payment, data.getReference(), "webhook-link-mismatch");
            return false;
        }
        payment.setLastReconciledAt(Instant.now());
        if (payment.getBooking().getStatus() == BookingStatus.CANCELLED || isPaid(payment.getBooking())) {
            requireManualReview(payment, data.getReference(), "late-or-conflicting-webhook");
        } else {
            markPaid(payment, data.getReference(), Instant.now(), "webhook");
        }
        return true;
    }

    @Transactional(readOnly = true)
    public List<Long> reconciliationCandidates() {
        Instant now = Instant.now();
        return payments.findReconciliationCandidates(PaymentTransactionStatus.PENDING,
                        now.minusSeconds(reconciliationMinAgeSeconds),
                        now.minusSeconds(reconciliationMinIntervalSeconds), PageRequest.of(0, 100))
                .stream().map(PaymentTransaction::getId).toList();
    }

    @Transactional
    public void reconcileById(Long paymentId) {
        PaymentTransaction payment = payments.findByIdForUpdate(paymentId).orElse(null);
        if (payment == null || payment.getStatus() != PaymentTransactionStatus.PENDING) return;
        reconcileLocked(payment);
    }

    private void reconcileLocked(PaymentTransaction payment) {
        payment.setLastReconciledAt(Instant.now());
        PaymentLink provider;
        try {
            provider = gateway.get(payment.getOrderCode());
        } catch (ApiException exception) {
            log.warn("PayOS reconciliation deferred orderCode={} code={}", payment.getOrderCode(), exception.getCode());
            return;
        }
        if (!validateProviderIdentity(payment, provider)) return;
        PaymentLinkStatus providerStatus = provider.getStatus();
        if (providerStatus == null) return;
        switch (providerStatus) {
            case PAID -> {
                if (provider.getAmountPaid() == null || provider.getAmountPaid() != payment.getAmount().longValueExact()) {
                    requireManualReview(payment, null, "reconciliation-paid-amount-mismatch");
                } else if (payment.getBooking().getStatus() == BookingStatus.CANCELLED || isPaid(payment.getBooking())) {
                    requireManualReview(payment, null, "late-or-conflicting-reconciliation");
                } else {
                    markPaid(payment, null, Instant.now(), "server-reconciliation");
                }
            }
            case EXPIRED -> closeAndRelease(payment, PaymentTransactionStatus.EXPIRED, "server-reconciliation");
            case CANCELLED -> closeAndRelease(payment, PaymentTransactionStatus.CANCELLED, "server-reconciliation");
            case FAILED -> closeAndRelease(payment, PaymentTransactionStatus.FAILED, "server-reconciliation");
            default -> log.debug("PayOS transaction remains pending orderCode={} providerStatus={}", payment.getOrderCode(), providerStatus);
        }
    }

    private boolean validateProviderIdentity(PaymentTransaction payment, PaymentLink provider) {
        if (provider == null || provider.getOrderCode() == null || !payment.getOrderCode().equals(provider.getOrderCode())) {
            requireManualReview(payment, null, "reconciliation-order-mismatch");
            return false;
        }
        if (payment.getPaymentLinkId() != null && provider.getId() != null && !payment.getPaymentLinkId().equals(provider.getId())) {
            requireManualReview(payment, null, "reconciliation-link-mismatch");
            return false;
        }
        if (provider.getAmount() == null || provider.getAmount() != payment.getAmount().longValueExact()) {
            requireManualReview(payment, null, "reconciliation-amount-mismatch");
            return false;
        }
        return true;
    }

    private void markPaid(PaymentTransaction payment, String reference, Instant paidAt, String source) {
        payment.setStatus(PaymentTransactionStatus.PAID);
        payment.setRequiresManualReview(false);
        if (reference != null) payment.setPaymentReference(reference);
        payment.setPaidAt(paidAt == null ? Instant.now() : paidAt);
        Booking booking = payment.getBooking();
        booking.setPaymentStatus(payment.getPaymentOption() == PaymentOption.DEPOSIT_50 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.PAID);
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPaymentRetryAllowed(false);
        closeSupersededAttempts(payment);
        log.info("PayOS payment verified orderCode={} paymentLinkId={} source={}", payment.getOrderCode(), payment.getPaymentLinkId(), source);
    }

    private void requireManualReview(PaymentTransaction payment, String reference, String reason) {
        payment.setStatus(PaymentTransactionStatus.REVIEW_REQUIRED);
        payment.setRequiresManualReview(true);
        if (reference != null) payment.setPaymentReference(reference);
        payment.setPaidAt(Instant.now());
        payment.getBooking().setPaymentRetryAllowed(false);
        log.error("PayOS payment requires manual review orderCode={} bookingId={} reason={}",
                payment.getOrderCode(), payment.getBooking().getId(), reason);
    }

    private void closeSupersededAttempts(PaymentTransaction paid) {
        for (PaymentTransaction other : payments.findAllByBookingIdOrderByCreatedAtDesc(paid.getBooking().getId())) {
            if (other == paid || (paid.getId() != null && Objects.equals(other.getId(), paid.getId()))
                    || other.getStatus() != PaymentTransactionStatus.PENDING) continue;
            try { gateway.cancel(other.getOrderCode(), "Another payment attempt was completed"); }
            catch (ApiException exception) {
                log.error("Could not close superseded PayOS attempt orderCode={} code={}", other.getOrderCode(), exception.getCode());
            }
            other.setStatus(PaymentTransactionStatus.CANCELLED);
        }
    }

    private void closeAndRelease(PaymentTransaction payment, PaymentTransactionStatus status, String source) {
        payment.setStatus(status);
        Booking booking = payment.getBooking();
        if (!isPaid(booking) && booking.getStatus() == BookingStatus.PENDING) {
            booking.setStatus(BookingStatus.CANCELLED);
            booking.setPaymentStatus(PaymentStatus.UNPAID);
            booking.setPaymentRetryAllowed(true);
        }
        log.info("PayOS payment closed orderCode={} status={} source={}", payment.getOrderCode(), status, source);
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

    private Booking ownedBooking(UserAccount customer, Long bookingId) {
        Booking booking = bookings.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "BOOKING_NOT_FOUND", "Không tìm thấy lịch hẹn"));
        if (!booking.getCustomer().getId().equals(customer.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "BOOKING_FORBIDDEN", "Bạn không thể thanh toán lịch hẹn này");
        }
        return booking;
    }

    private Long nextOrderCode(Long bookingId) {
        long candidate = System.currentTimeMillis() * 1000L + Math.floorMod(bookingId, 1000L);
        while (payments.existsByOrderCode(candidate)) candidate++;
        return candidate;
    }

    private String payOSDescription(Long orderCode) {
        return "BL" + String.format("%07d", Math.floorMod(orderCode, 10_000_000L));
    }

    private String normalizeVoucher(String voucherCode) {
        return voucherCode == null || voucherCode.isBlank() ? null : voucherCode.trim().toUpperCase(Locale.ROOT);
    }

    private BigDecimal calculateDiscount(BigDecimal total, String code) {
        if (code == null) return BigDecimal.ZERO;
        return switch (code) {
            case "BEAUTY50" -> total.compareTo(new BigDecimal("200000")) >= 0 ? new BigDecimal("50000") : invalidVoucher();
            case "BEAUTY100" -> total.compareTo(new BigDecimal("500000")) >= 0 ? new BigDecimal("100000") : invalidVoucher();
            case "PINK15" -> total.multiply(new BigDecimal("0.15")).min(new BigDecimal("150000")).setScale(0, RoundingMode.HALF_UP);
            default -> throw new ApiException(HttpStatus.BAD_REQUEST, "VOUCHER_INVALID", "Mã voucher không hợp lệ hoặc đã hết hạn");
        };
    }

    private BigDecimal invalidVoucher() {
        throw new ApiException(HttpStatus.BAD_REQUEST, "VOUCHER_MINIMUM_NOT_MET", "Đơn hàng chưa đạt giá trị tối thiểu của voucher");
    }

    private boolean isExpired(PaymentTransaction payment) {
        return payment.getExpiresAt() != null && !payment.getExpiresAt().isAfter(Instant.now());
    }

    private boolean shouldReconcile(PaymentTransaction payment) {
        Instant now = Instant.now();
        if (payment.getCreatedAt().isAfter(now.minusSeconds(reconciliationMinAgeSeconds)) && !isExpired(payment)) return false;
        return payment.getLastReconciledAt() == null
                || !payment.getLastReconciledAt().isAfter(now.minusSeconds(reconciliationMinIntervalSeconds));
    }

    private boolean isPaid(Booking booking) {
        return booking.getPaymentStatus() == PaymentStatus.PAID || booking.getPaymentStatus() == PaymentStatus.PARTIALLY_PAID;
    }

    private ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "PAYMENT_NOT_FOUND", "Không tìm thấy giao dịch PayOS");
    }

    private ApiException conflict(String code, String message) { return new ApiException(HttpStatus.CONFLICT, code, message); }

    private PayOSPaymentResponse response(PaymentTransaction payment) {
        Booking booking = payment.getBooking();
        return new PayOSPaymentResponse(booking.getId(), booking.getBookingCode(), payment.getOrderCode(),
                payment.getPaymentLinkId(), payment.getCheckoutUrl(), payment.getAmount(), payment.getRemainingAmount(),
                payment.getPaymentOption(), payment.getStatus(), payment.isRequiresManualReview(), payment.getExpiresAt());
    }
}
