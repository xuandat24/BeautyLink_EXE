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
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
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
    private final AvailabilityService availability;
    private final BookingCompletionPolicy time;
    private final TransactionTemplate checkoutTransactions;

    public PaymentService(PaymentTransactionRepository payments, BookingRepository bookings,
                          PractitionerRepository practitioners, PayOSGateway gateway, AvailabilityService availability,
                          PlatformTransactionManager transactionManager, BookingCompletionPolicy time,
                          @Value("${app.payos.return-url}") String returnUrl,
                          @Value("${app.payos.cancel-url}") String cancelUrl,
                          @Value("${app.payos.reconciliation-min-age-seconds:60}") long reconciliationMinAgeSeconds,
                          @Value("${app.payos.reconciliation-min-interval-seconds:120}") long reconciliationMinIntervalSeconds) {
        this.payments = payments;
        this.bookings = bookings;
        this.practitioners = practitioners;
        this.gateway = gateway;
        this.availability = availability;
        this.time = time;
        this.checkoutTransactions = new TransactionTemplate(transactionManager);
        this.checkoutTransactions.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.checkoutTransactions.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
        this.returnUrl = returnUrl;
        this.cancelUrl = cancelUrl;
        this.reconciliationMinAgeSeconds = Math.max(30, reconciliationMinAgeSeconds);
        this.reconciliationMinIntervalSeconds = Math.max(60, reconciliationMinIntervalSeconds);
    }

    private record Creation(Long bookingId, CreatePaymentLinkRequest request, PayOSPaymentResponse response, ApiException error) {}
    private record CreationResult(PayOSPaymentResponse response, ApiException error) {}

    public PayOSPaymentResponse create(UserAccount customer, Long bookingId, CreatePayOSPaymentRequest request) {
        gateway.requireConfigured();
        // Commit the order ledger before any irreversible provider create call.
        Creation creation = checkoutTransactions.execute(s -> reserveCheckout(customer, bookingId, request));
        if (creation.error() != null) throw creation.error();
        if (creation.response() != null) return creation.response();
        CreatePaymentLinkResponse provider;
        try { provider = gateway.create(creation.request()); }
        catch (RuntimeException error) {
            // The provider may have created the link despite a timeout. Never erase/reuse this order.
            throw conflict("PAYMENT_RECONCILING", "Giao dịch đang được đối soát. Vui lòng kiểm tra lịch hẹn, không thanh toán lại.");
        }
        CreationResult result = checkoutTransactions.execute(s -> finishCheckout(customer, creation, provider));
        if (result.error() != null) throw result.error(); // outside committed transaction
        return result.response();
    }

    private Creation reserveCheckout(UserAccount customer, Long bookingId, CreatePayOSPaymentRequest request) {
        Booking booking = ownedBooking(customer, bookingId);
        List<PaymentTransaction> attempts = payments.findAllByBookingIdForUpdate(bookingId);
        if (booking.getStatus() == BookingStatus.CANCELLED && !booking.isPaymentRetryAllowed())
            throw conflict("BOOKING_NOT_PAYABLE", "Lịch hẹn đã được khách hàng hủy. Không thể mở lại thanh toán.");
        if (BookingPaymentPolicy.manual(attempts))
            throw conflict("PAYMENT_REVIEW_REQUIRED", "Giao dịch cần hỗ trợ đối soát. Vui lòng không thanh toán lại.");
        if (booking.getStatus() == BookingStatus.COMPLETED || booking.getPaymentStatus() == PaymentStatus.REFUNDED)
            throw conflict("BOOKING_NOT_PAYABLE", "Lịch hẹn không còn ở trạng thái có thể thanh toán.");
        if (isPaid(booking)) throw paidCancellationError();
        if (attempts.stream().anyMatch(p -> p.getStatus() == PaymentTransactionStatus.PAID))
            throw conflict("PAYMENT_STATE_CONFLICT", "Dữ liệu thanh toán cần hỗ trợ đối soát. Không thanh toán lại.");
        if (!time.beforeStart(booking)) throw conflict("SLOT_UNAVAILABLE", "Lịch hẹn đã bắt đầu hoặc không còn hợp lệ.");
        String voucherCode = normalizeVoucher(request.voucherCode());
        List<PaymentTransaction> pending = attempts.stream().filter(p -> p.getStatus() == PaymentTransactionStatus.PENDING).toList();
        if (!pending.isEmpty()) {
            PaymentTransaction p = pending.getFirst();
            if (pending.size() != 1 || isExpired(p) || p.getCheckoutUrl() == null || booking.getStatus() == BookingStatus.CANCELLED)
                throw conflict("PAYMENT_RECONCILING", "Giao dịch cũ đang được đối soát. Vui lòng kiểm tra lịch hẹn.");
            if (p.getPaymentOption() == request.paymentOption() && Objects.equals(p.getVoucherCode(), voucherCode))
                return new Creation(bookingId, null, response(p), null);
            throw conflict("PAYMENT_ATTEMPT_EXISTS", "Lịch hẹn đang có một phiên PayOS; vui lòng hoàn tất hoặc chờ đối soát.");
        }
        // Historical terminal flags alone are not evidence that an old link is closed.
        for (PaymentTransaction previous : attempts) {
            if (!reconcileLocked(previous))
                return new Creation(bookingId, null, null, reconcilingError());
        }
        if (BookingPaymentPolicy.unresolved(attempts) || isPaid(booking))
            return new Creation(bookingId, null, null, BookingPaymentPolicy.manual(attempts) ? manualError() : isPaid(booking) ? paidCancellationError() : reconcilingError());
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
        Instant expiry = time.now().plusSeconds(CHECKOUT_TTL_SECONDS);
        transaction.setExpiresAt(expiry.isBefore(BookingCompletionPolicy.startsAt(booking)) ? expiry : BookingCompletionPolicy.startsAt(booking));
        payments.saveAndFlush(transaction);

        CreatePaymentLinkRequest paymentRequest = CreatePaymentLinkRequest.builder()
                .orderCode(transaction.getOrderCode()).amount(amount.longValueExact())
                .description(payOSDescription(transaction.getOrderCode()))
                .buyerName(customer.getFullName()).buyerEmail(customer.getEmail()).buyerPhone(customer.getPhone())
                .returnUrl(returnUrl).cancelUrl(cancelUrl).expiredAt(transaction.getExpiresAt().getEpochSecond()).build();
        booking.setStatus(BookingStatus.PENDING);
        booking.setPaymentStatus(PaymentStatus.UNPAID);
        booking.setPaymentRetryAllowed(false);
        return new Creation(bookingId, paymentRequest, null, null);
    }

    private CreationResult finishCheckout(UserAccount customer, Creation creation, CreatePaymentLinkResponse provider) {
        Booking booking = ownedBooking(customer, creation.bookingId());
        PaymentTransaction transaction = payments.findByOrderCodeForUpdate(creation.request().getOrderCode()).orElseThrow(this::notFound);
        if (provider == null || !Objects.equals(provider.getOrderCode(), transaction.getOrderCode())
                || provider.getAmount() == null || provider.getAmount() != transaction.getAmount().longValueExact()
                || provider.getPaymentLinkId() == null || provider.getPaymentLinkId().isBlank()) {
            requireManualReview(transaction, null, "create-response-identity-mismatch");
            return new CreationResult(null, manualError());
        }
        if (transaction.getPaymentLinkId() != null && !transaction.getPaymentLinkId().equals(provider.getPaymentLinkId())) {
            requireManualReview(transaction, null, "create-response-link-mismatch");
            return new CreationResult(null, manualError());
        }
        transaction.setPaymentLinkId(provider.getPaymentLinkId());
        transaction.setProviderCreatedAt(time.now());
        if (transaction.getStatus() != PaymentTransactionStatus.PENDING || booking.getStatus() == BookingStatus.CANCELLED)
            return new CreationResult(response(transaction), null); // do not overwrite webhook/cancel outcomes
        if (provider.getStatus() != PaymentLinkStatus.PENDING || !safeCheckoutUrl(provider.getCheckoutUrl()))
            return new CreationResult(null, reconcilingError());
        transaction.setCheckoutUrl(provider.getCheckoutUrl());
        return new CreationResult(response(transaction), null);
    }

    private boolean safeCheckoutUrl(String value) {
        if (value == null) return false;
        try { var url = java.net.URI.create(value); return "https".equals(url.getScheme()) && "pay.payos.vn".equals(url.getHost()) && url.getUserInfo() == null && (url.getPort() == -1 || url.getPort() == 443); }
        catch (IllegalArgumentException error) { return false; }
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public PayOSPaymentResponse status(UserAccount customer, Long orderCode) {
        PaymentTransaction payment = lockByOrderCode(orderCode);
        if (payment == null) throw notFound();
        if (!payment.getBooking().getCustomer().getId().equals(customer.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "PAYMENT_FORBIDDEN", "Bạn không có quyền xem giao dịch này");
        }
        if (payment.getStatus() == PaymentTransactionStatus.PENDING && shouldReconcile(payment)) reconcileLocked(payment);
        return response(payment);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public boolean handleWebhook(Webhook webhook) {
        WebhookData data = gateway.verify(webhook);
        if (data == null || data.getOrderCode() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAYOS_INVALID_WEBHOOK", "Webhook PayOS thiếu dữ liệu giao dịch");
        }
        PaymentTransaction payment = lockByOrderCode(data.getOrderCode());
        if (payment == null) {
            log.info("PayOS signed verification webhook accepted for unknown orderCode={}", data.getOrderCode());
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
        if (data.getPaymentLinkId() == null || (payment.getPaymentLinkId() != null
                && !payment.getPaymentLinkId().equals(data.getPaymentLinkId()))) {
            requireManualReview(payment, data.getReference(), "webhook-link-mismatch");
            return false;
        }
        if (BookingPaymentPolicy.manualAttempt(payment)) {
            // Preserve verified inbound evidence, but never resolve an operator case automatically.
            if (payment.getPaymentLinkId() == null) payment.setPaymentLinkId(data.getPaymentLinkId());
            if (payment.getPaidAt() == null) payment.setPaidAt(time.now());
            payment.setLastReconciledAt(time.now());
            requireManualReview(payment, data.getReference(), "verified-money-on-unresolved-attempt");
            return true;
        }
        if (payment.getStatus() == PaymentTransactionStatus.PAID) return true;
        if (payment.getPaymentLinkId() == null) payment.setPaymentLinkId(data.getPaymentLinkId());
        if (payment.getPaidAt() == null) payment.setPaidAt(time.now());
        payment.setLastReconciledAt(time.now());
        if (payment.getBooking().getStatus() == BookingStatus.CANCELLED || payment.getBooking().getStatus() == BookingStatus.COMPLETED
                || payment.getBooking().getPaymentStatus() == PaymentStatus.REFUNDED || isPaid(payment.getBooking())) {
            requireManualReview(payment, data.getReference(), "late-or-conflicting-webhook");
        } else {
            markPaid(payment, data.getReference(), time.now(), "webhook");
        }
        return true;
    }

    @Transactional(readOnly = true)
    public List<Long> reconciliationCandidates() {
        Instant now = time.now();
        return payments.findReconciliationCandidates(PaymentTransactionStatus.PENDING,
                        now.minusSeconds(reconciliationMinAgeSeconds),
                        now.minusSeconds(reconciliationMinIntervalSeconds), PageRequest.of(0, 100))
                .stream().map(PaymentTransaction::getId).toList();
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public void reconcileById(Long paymentId) {
        Long bookingId = payments.findBookingIdByPaymentId(paymentId).orElse(null);
        if (bookingId == null || bookings.findByIdForUpdate(bookingId).isEmpty()) return;
        PaymentTransaction payment = payments.findByIdForUpdate(paymentId).orElse(null);
        if (payment != null && !bookingId.equals(payment.getBooking().getId())) throw notFound();
        if (payment == null || payment.getStatus() != PaymentTransactionStatus.PENDING) return;
        reconcileLocked(payment);
    }

    // Every writer serializes on the booking before touching any of its payment attempts.
    // Do not rely on a fetch join implicitly locking joined rows (dialect-dependent).
    private PaymentTransaction lockByOrderCode(Long orderCode) {
        Long bookingId = payments.findBookingIdByOrderCode(orderCode).orElse(null);
        if (bookingId == null || bookings.findByIdForUpdate(bookingId).isEmpty()) return null;
        PaymentTransaction payment = payments.findByOrderCodeForUpdate(orderCode).orElse(null);
        if (payment != null && !bookingId.equals(payment.getBooking().getId())) throw notFound();
        return payment;
    }

    private boolean reconcileLocked(PaymentTransaction payment) {
        payment.setLastReconciledAt(time.now());
        PaymentLink provider;
        try {
            provider = gateway.get(payment.getOrderCode());
        } catch (ApiException exception) {
            log.warn("PayOS reconciliation deferred orderCode={} code={}", payment.getOrderCode(), exception.getCode());
            return false;
        }
        if (!validateProviderIdentity(payment, provider)) return false;
        PaymentLinkStatus providerStatus = provider.getStatus();
        if (providerStatus == null) return false;
        switch (providerStatus) {
            case PAID -> {
                if (provider.getAmountPaid() == null || provider.getAmountPaid() != payment.getAmount().longValueExact()) {
                    requireManualReview(payment, null, "reconciliation-paid-amount-mismatch");
                } else if (payment.getBooking().getStatus() == BookingStatus.CANCELLED || payment.getBooking().getStatus() == BookingStatus.COMPLETED
                        || payment.getBooking().getPaymentStatus() == PaymentStatus.REFUNDED || isPaid(payment.getBooking())) {
                    if (payment.getPaidAt() == null) payment.setPaidAt(time.now());
                    requireManualReview(payment, null, "late-or-conflicting-reconciliation");
                } else {
                    markPaid(payment, null, time.now(), "server-reconciliation");
                }
            }
            case EXPIRED, CANCELLED, FAILED -> {
                if (provider.getAmountPaid() == null || provider.getAmountPaid() != 0) {
                    requireManualReview(payment, null, "closed-link-has-unknown-or-received-money");
                    return false;
                }
                closeAndRelease(payment, PaymentTransactionStatus.valueOf(providerStatus.name()), "server-reconciliation");
            }
            default -> {
                if (provider.getAmountPaid() != null && provider.getAmountPaid() != 0) requireManualReview(payment, null, "incomplete-provider-payment");
                else payment.setStatus(PaymentTransactionStatus.PENDING);
                return provider.getStatus() == PaymentLinkStatus.PENDING && provider.getAmountPaid() != null && provider.getAmountPaid() == 0;
            }
        }
        return true;
    }

    private boolean validateProviderIdentity(PaymentTransaction payment, PaymentLink provider) {
        if (provider == null || provider.getOrderCode() == null || !payment.getOrderCode().equals(provider.getOrderCode())) {
            requireManualReview(payment, null, "reconciliation-order-mismatch");
            return false;
        }
        if (provider.getId() == null || provider.getId().isBlank() || (payment.getPaymentLinkId() != null && !payment.getPaymentLinkId().equals(provider.getId()))) {
            requireManualReview(payment, null, "reconciliation-link-mismatch");
            return false;
        }
        if (provider.getAmount() == null || provider.getAmount() != payment.getAmount().longValueExact()) {
            requireManualReview(payment, null, "reconciliation-amount-mismatch");
            return false;
        }
        if (payment.getPaymentLinkId() == null) payment.setPaymentLinkId(provider.getId());
        return true;
    }

    private void markPaid(PaymentTransaction payment, String reference, Instant paidAt, String source) {
        payment.setStatus(PaymentTransactionStatus.PAID);
        payment.setRequiresManualReview(false);
        if (reference != null) payment.setPaymentReference(reference);
        payment.setPaidAt(paidAt == null ? time.now() : paidAt);
        Booking booking = payment.getBooking();
        booking.setPaymentStatus(payment.getPaymentOption() == PaymentOption.DEPOSIT_50 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.PAID);
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPaymentRetryAllowed(false);
        closeSupersededAttempts(payment);
        log.info("PayOS payment verified orderCode={} paymentLinkId={} source={}", payment.getOrderCode(), payment.getPaymentLinkId(), source);
    }

    private void requireManualReview(PaymentTransaction payment, String reference, String reason) {
        if (payment.getStatus() != PaymentTransactionStatus.PAID) payment.setStatus(PaymentTransactionStatus.REVIEW_REQUIRED);
        payment.setRequiresManualReview(true);
        if (reference != null) payment.setPaymentReference(reference);
        payment.getBooking().setPaymentRetryAllowed(false);
        log.error("PayOS payment requires manual review orderCode={} bookingId={} reason={}",
                payment.getOrderCode(), payment.getBooking().getId(), reason);
    }

    private void closeSupersededAttempts(PaymentTransaction paid) {
        for (PaymentTransaction other : payments.findAllByBookingIdForUpdate(paid.getBooking().getId())) {
            if (other == paid || (paid.getId() != null && Objects.equals(other.getId(), paid.getId()))
                    || other.getStatus() != PaymentTransactionStatus.PENDING) continue;
            try {
                PaymentLink result = gateway.cancel(other.getOrderCode(), "Another payment attempt was completed");
                if (result == null || result.getStatus() == null) continue;
                if (!validateProviderIdentity(other, result)) continue;
                if (result.getStatus() == PaymentLinkStatus.CANCELLED && result.getAmountPaid() != null && result.getAmountPaid() == 0) {
                    other.setStatus(PaymentTransactionStatus.CANCELLED);
                    other.setLastReconciledAt(time.now());
                } else if (result.getStatus() == PaymentLinkStatus.PAID || (result.getAmountPaid() != null && result.getAmountPaid() != 0)) {
                    if (result.getStatus() == PaymentLinkStatus.PAID && result.getAmountPaid() != null
                            && result.getAmountPaid() == other.getAmount().longValueExact() && other.getPaidAt() == null) other.setPaidAt(time.now());
                    requireManualReview(other, null, "superseded-link-received-money");
                }
                // Unknown or pending result stays PENDING and remains a scheduler candidate.
            }
            catch (ApiException exception) {
                log.error("Could not close superseded PayOS attempt orderCode={} code={}", other.getOrderCode(), exception.getCode());
            }
        }
    }

    private void closeAndRelease(PaymentTransaction payment, PaymentTransactionStatus status, String source) {
        payment.setStatus(status);
        Booking booking = payment.getBooking();
        if (booking.getPaymentStatus() == PaymentStatus.UNPAID && booking.getStatus() == BookingStatus.PENDING
                && !BookingPaymentPolicy.unresolved(payments.findAllByBookingIdForUpdate(booking.getId()))) {
            booking.setStatus(BookingStatus.CANCELLED);
            booking.setPaymentStatus(PaymentStatus.UNPAID);
            booking.setPaymentRetryAllowed(true);
        }
        log.info("PayOS payment closed orderCode={} status={} source={}", payment.getOrderCode(), status, source);
    }

    private void reopenReleasedSlot(Booking booking) {
        if (!booking.isPaymentRetryAllowed()) throw conflict("BOOKING_NOT_PAYABLE", "Lịch hẹn đã bị hủy và không thể thanh toán lại");
        practitioners.findByIdForUpdate(booking.getPractitioner().getId()).filter(com.example.backend.model.Practitioner::isActive)
                .orElseThrow(() -> conflict("SLOT_UNAVAILABLE", "Chuyên viên không còn khả dụng"));
        if (!booking.getService().isActive() || !booking.getService().getSupplier().getId().equals(booking.getPractitioner().getSupplier().getId()))
            throw conflict("SLOT_UNAVAILABLE", "Dịch vụ hoặc chuyên viên không còn hợp lệ.");
        var start = booking.getAppointmentDate().atTime(booking.getStartTime());
        var end = BookingCompletionPolicy.appointmentEnd(booking);
        if (!time.validBookingDate(booking.getAppointmentDate()) || !time.hasBookingLead(start))
            throw conflict("SLOT_UNAVAILABLE", "Thời gian đặt lại không còn hợp lệ.");
        boolean occupied = bookings.findByPractitionerIdAndAppointmentDateBetweenAndStatusNot(
                booking.getPractitioner().getId(), booking.getAppointmentDate().minusDays(1), booking.getAppointmentDate().plusDays(1), BookingStatus.CANCELLED)
                .stream().filter(b -> !b.getId().equals(booking.getId())).anyMatch(b -> {
                    return BookingCompletionPolicy.overlaps(b, start, end);
                });
        if (occupied) {
            booking.setPaymentRetryAllowed(false);
            throw conflict("SLOT_UNAVAILABLE", "Khung giờ đã được người khác đặt sau khi giao dịch trước hết hạn");
        }
        if (!availability.availability(booking.getService().getId(), booking.getPractitioner().getId(), booking.getAppointmentDate()).availableSlots().contains(booking.getStartTime()))
            throw conflict("SLOT_UNAVAILABLE", "Khung giờ đặt lại không còn trong lịch làm việc.");
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
        long candidate = time.now().toEpochMilli() * 1000L + Math.floorMod(bookingId, 1000L);
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
        return payment.getExpiresAt() != null && !payment.getExpiresAt().isAfter(time.now());
    }

    private boolean shouldReconcile(PaymentTransaction payment) {
        Instant now = time.now();
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
    private ApiException manualError() { return conflict("PAYMENT_REVIEW_REQUIRED", "Giao dịch cần hỗ trợ đối soát. Vui lòng không thanh toán lại và liên hệ hỗ trợ."); }
    private ApiException reconcilingError() { return conflict("PAYMENT_RECONCILING", "PayOS đang được đối soát. Vui lòng thử làm mới lịch hẹn, không thanh toán lại."); }
    private ApiException uncertainCancellation(PaymentTransaction payment) {
        // Retain PENDING for the scheduler, but withdraw the checkout and all customer
        // actions until verified payment or an approved manual resolution exists.
        payment.setCheckoutUrl(null);
        payment.setRequiresManualReview(true);
        payment.getBooking().setPaymentRetryAllowed(false);
        return reconcilingError();
    }
    private ApiException paidCancellationError() { return conflict("PAYMENT_ALREADY_PAID", "Lịch hẹn đã thanh toán hoặc đặt cọc. Không thể tự hủy hay thanh toán lại; vui lòng liên hệ hỗ trợ."); }

    /** Called under the booking lock. Returns a business outcome so verified evidence can commit. */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public ApiException cancelUnpaidLocked(Booking booking) {
        List<PaymentTransaction> attempts = payments.findAllByBookingIdForUpdate(booking.getId());
        if (BookingPaymentPolicy.manual(attempts)) return manualError();
        if (isPaid(booking)) return paidCancellationError();
        if (booking.getPaymentStatus() != PaymentStatus.UNPAID) return conflict("BOOKING_NOT_CANCELLABLE", "Trạng thái thanh toán cần hỗ trợ xử lý.");
        for (PaymentTransaction p : attempts) {
            if (p.getStatus() == PaymentTransactionStatus.PAID) return conflict("PAYMENT_STATE_CONFLICT", "Giao dịch đã ghi nhận thanh toán. Vui lòng liên hệ hỗ trợ.");
            // Repeated, already verified customer cancellation has no provider side effect.
            if (booking.getStatus() == BookingStatus.CANCELLED && !booking.isPaymentRetryAllowed()
                    && p.getStatus() != PaymentTransactionStatus.PENDING && p.getLastReconciledAt() != null) continue;
            if (!reconcileLocked(p)) {
                return BookingPaymentPolicy.manual(attempts) ? manualError() : uncertainCancellation(p);
            }
            if (isPaid(booking)) return paidCancellationError();
            if (BookingPaymentPolicy.manual(attempts)) return manualError();
            if (p.getStatus() == PaymentTransactionStatus.PENDING) {
                try {
                    PaymentLink closed = gateway.cancel(p.getOrderCode(), "Customer requested booking cancellation");
                    if (closed == null || closed.getStatus() == null) return uncertainCancellation(p);
                    if (!validateProviderIdentity(p, closed)) return manualError();
                    if (closed.getStatus() == PaymentLinkStatus.PAID) {
                        if (closed.getAmountPaid() != null && closed.getAmountPaid() == p.getAmount().longValueExact()
                                && booking.getStatus() != BookingStatus.CANCELLED) markPaid(p, null, time.now(), "cancel-reconciliation");
                        else requireManualReview(p, null, "cancel-raced-with-payment");
                        return BookingPaymentPolicy.manual(attempts) ? manualError() : paidCancellationError();
                    }
                    if (closed.getStatus() != PaymentLinkStatus.CANCELLED || closed.getAmountPaid() == null) return uncertainCancellation(p);
                    if (closed.getAmountPaid() != 0) { requireManualReview(p, null, "cancel-link-received-money"); return manualError(); }
                    p.setStatus(PaymentTransactionStatus.CANCELLED); p.setLastReconciledAt(time.now());
                } catch (ApiException error) { return uncertainCancellation(p); }
            }
        }
        if (BookingPaymentPolicy.unresolved(attempts)) return reconcilingError();
        booking.setStatus(BookingStatus.CANCELLED); booking.setPaymentRetryAllowed(false);
        return null;
    }

    private PayOSPaymentResponse response(PaymentTransaction payment) {
        Booking booking = payment.getBooking();
        List<PaymentTransaction> attempts = payments.findAllByBookingIdOrderByCreatedAtDesc(booking.getId());
        boolean manual = payment.isRequiresManualReview() || BookingPaymentPolicy.manual(attempts);
        boolean checkoutAllowed = payment.getStatus() == PaymentTransactionStatus.PENDING && !isExpired(payment)
                && booking.getStatus() != BookingStatus.CANCELLED && booking.getStatus() != BookingStatus.COMPLETED
                && booking.getPaymentStatus() == PaymentStatus.UNPAID && !manual && time.beforeStart(booking)
                && safeCheckoutUrl(payment.getCheckoutUrl())
                && attempts.stream().filter(p -> p.getStatus() == PaymentTransactionStatus.PENDING).count() <= 1;
        return new PayOSPaymentResponse(booking.getId(), booking.getBookingCode(), payment.getOrderCode(),
                payment.getPaymentLinkId(), checkoutAllowed ? payment.getCheckoutUrl() : null, payment.getAmount(), payment.getRemainingAmount(),
                payment.getPaymentOption(), payment.getStatus(), manual, payment.getExpiresAt());
    }
}
