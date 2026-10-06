package com.example.backend.service;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkRequest;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkResponse;
import vn.payos.model.v2.paymentRequests.PaymentLink;
import vn.payos.model.v2.paymentRequests.PaymentLinkStatus;
import vn.payos.model.webhooks.Webhook;
import vn.payos.model.webhooks.WebhookData;

import java.math.*;
import java.time.Instant;
import java.util.Locale;
import static com.example.backend.model.DomainEnums.*;

@Service
public class PaymentService {
    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);
    private static final BigDecimal MIN_PAYOS_AMOUNT = new BigDecimal("2000");
    private final PaymentTransactionRepository payments;
    private final BookingRepository bookings;
    private final PractitionerRepository practitioners;
    private final PayOSGateway gateway;
    private final String returnUrl;
    private final String cancelUrl;

    public PaymentService(PaymentTransactionRepository payments, BookingRepository bookings, PractitionerRepository practitioners, PayOSGateway gateway,
                          @Value("${app.payos.return-url}") String returnUrl,
                          @Value("${app.payos.cancel-url}") String cancelUrl) {
        this.payments = payments;
        this.bookings = bookings;
        this.practitioners = practitioners;
        this.gateway = gateway;
        this.returnUrl = returnUrl;
        this.cancelUrl = cancelUrl;
    }

    @Transactional
    public PayOSPaymentResponse create(UserAccount customer, Long bookingId, CreatePayOSPaymentRequest request) {
        Booking booking = ownedBooking(customer, bookingId);
        if (booking.getStatus() == BookingStatus.COMPLETED) {
            throw new ApiException(HttpStatus.CONFLICT, "BOOKING_NOT_PAYABLE", "Lịch hẹn không còn ở trạng thái có thể thanh toán");
        }
        if (isPaid(booking)) {
            return payments.findFirstByBookingIdAndStatusOrderByCreatedAtDesc(bookingId, PaymentTransactionStatus.PAID).map(this::response)
                    .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "PAYMENT_ALREADY_PAID", "Lịch hẹn đã được thanh toán"));
        }

        String voucherCode = normalizeVoucher(request.voucherCode());
        PaymentTransaction existing = payments.findFirstByBookingIdAndStatusOrderByCreatedAtDesc(bookingId, PaymentTransactionStatus.PENDING).orElse(null);
        if (existing != null) {
            if (isExpired(existing)) reconcile(existing);
            if (existing.getStatus() == PaymentTransactionStatus.PAID) return response(existing);
            if (existing.getStatus() == PaymentTransactionStatus.PENDING) {
                if (existing.getPaymentOption() != request.paymentOption() || !java.util.Objects.equals(existing.getVoucherCode(), voucherCode)) {
                    throw new ApiException(HttpStatus.CONFLICT, "PAYMENT_LINK_EXISTS", "Lịch hẹn đã có link PayOS đang chờ thanh toán");
                }
                return response(existing);
            }
        }

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            if (!booking.isPaymentRetryAllowed()) {
                throw new ApiException(HttpStatus.CONFLICT, "BOOKING_NOT_PAYABLE", "Lịch hẹn đã bị hủy và không thể thanh toán lại");
            }
            practitioners.findByIdForUpdate(booking.getPractitioner().getId())
                    .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "SLOT_UNAVAILABLE", "Chuyên viên không còn khả dụng"));
            boolean occupied = bookings.existsByPractitionerIdAndAppointmentDateAndStartTimeAndStatusNotAndIdNot(
                    booking.getPractitioner().getId(), booking.getAppointmentDate(), booking.getStartTime(), BookingStatus.CANCELLED, booking.getId());
            if (occupied) {
                booking.setPaymentRetryAllowed(false);
                throw new ApiException(HttpStatus.CONFLICT, "SLOT_UNAVAILABLE", "Khung giờ đã được người khác đặt sau khi giao dịch trước hết hạn");
            }
            booking.setStatus(BookingStatus.PENDING);
        }

        BigDecimal total = booking.getTotalAmount().setScale(0, RoundingMode.HALF_UP);
        BigDecimal discount = calculateDiscount(total, voucherCode);
        BigDecimal discountedTotal = total.subtract(discount).max(BigDecimal.ZERO);
        BigDecimal amount = request.paymentOption() == PaymentOption.DEPOSIT_50
                ? discountedTotal.multiply(new BigDecimal("0.50")).setScale(0, RoundingMode.HALF_UP)
                : discountedTotal;
        BigDecimal remaining = request.paymentOption() == PaymentOption.DEPOSIT_50
                ? discountedTotal.subtract(amount)
                : BigDecimal.ZERO;
        if (amount.compareTo(MIN_PAYOS_AMOUNT) < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAYMENT_AMOUNT_TOO_LOW", "Số tiền thanh toán PayOS tối thiểu là 2.000đ");
        }

        PaymentTransaction transaction = new PaymentTransaction();
        transaction.setBooking(booking);
        transaction.setProvider(PaymentProvider.PAYOS);
        transaction.setOrderCode(nextOrderCode(booking.getId()));
        transaction.setMerchantReference(Long.toString(transaction.getOrderCode()));
        transaction.setAmount(amount);
        transaction.setRemainingAmount(remaining);
        transaction.setPaymentOption(request.paymentOption());
        transaction.setVoucherCode(voucherCode);
        transaction.setStatus(PaymentTransactionStatus.PENDING);
        Instant expiresAt = Instant.now().plusSeconds(15 * 60);
        transaction.setExpiresAt(expiresAt);

        CreatePaymentLinkRequest paymentRequest = CreatePaymentLinkRequest.builder()
                .orderCode(transaction.getOrderCode())
                .amount(amount.longValueExact())
                .description(payOSDescription(transaction.getOrderCode()))
                .buyerName(customer.getFullName())
                .buyerEmail(customer.getEmail())
                .buyerPhone(customer.getPhone())
                .returnUrl(returnUrl)
                .cancelUrl(cancelUrl)
                .expiredAt(expiresAt.getEpochSecond())
                .build();
        CreatePaymentLinkResponse payOS = gateway.create(paymentRequest);
        transaction.setPaymentLinkId(payOS.getPaymentLinkId());
        transaction.setCheckoutUrl(payOS.getCheckoutUrl());
        booking.setStatus(BookingStatus.PENDING);
        booking.setPaymentStatus(PaymentStatus.UNPAID);
        booking.setPaymentRetryAllowed(false);
        payments.save(transaction);
        return response(transaction);
    }

    @Transactional
    public PayOSPaymentResponse status(UserAccount customer, Long orderCode) {
        PaymentTransaction payment = payments.findByOrderCode(orderCode)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PAYMENT_NOT_FOUND", "Không tìm thấy giao dịch PayOS"));
        if (!payment.getBooking().getCustomer().getId().equals(customer.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "PAYMENT_FORBIDDEN", "Bạn không có quyền xem giao dịch này");
        }
        if (payment.getStatus() == PaymentTransactionStatus.PENDING) {
            reconcile(payment);
        }
        return response(payment);
    }

    @Transactional
    public void reconcileExpiredPayments() {
        for (PaymentTransaction payment : payments.findByStatusAndExpiresAtBefore(PaymentTransactionStatus.PENDING, Instant.now())) {
            try {
                reconcile(payment);
            } catch (ApiException ex) {
                log.error("PayOS scheduled reconciliation failed orderCode={} code={}", payment.getOrderCode(), ex.getCode());
            }
        }
    }

    @Transactional
    public boolean handleWebhook(Webhook webhook) {
        WebhookData data = gateway.verify(webhook);
        if (data == null || data.getOrderCode() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAYOS_INVALID_WEBHOOK", "Webhook PayOS thiếu dữ liệu giao dịch");
        }
        PaymentTransaction payment = payments.findByOrderCode(data.getOrderCode()).orElse(null);
        if (payment == null) {
            log.info("PayOS signed webhook accepted for unknown orderCode={} (channel verification sample)", data.getOrderCode());
            return true;
        }
        if (payment.getStatus() == PaymentTransactionStatus.PAID) {
            log.info("PayOS duplicate paid webhook ignored orderCode={}", data.getOrderCode());
            return true;
        }
        if (!Boolean.TRUE.equals(webhook.getSuccess()) || !"00".equals(data.getCode())) {
            log.info("PayOS non-success webhook orderCode={} code={}", data.getOrderCode(), data.getCode());
            return true;
        }
        if (data.getAmount() == null || payment.getAmount().longValueExact() != data.getAmount()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAYOS_AMOUNT_MISMATCH", "Số tiền webhook không khớp với giao dịch");
        }
        if (payment.getPaymentLinkId() != null && data.getPaymentLinkId() != null
                && !payment.getPaymentLinkId().equals(data.getPaymentLinkId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAYOS_LINK_MISMATCH", "Mã link PayOS không khớp");
        }
        if (payment.getBooking().getStatus() == BookingStatus.CANCELLED) {
            recordLatePaymentWithoutRebooking(payment, data.getReference());
        } else {
            markPaid(payment, data.getReference(), "webhook");
        }
        return true;
    }

    private void reconcile(PaymentTransaction payment) {
        PaymentLink provider = gateway.get(payment.getOrderCode());
        if (provider == null || provider.getOrderCode() == null || !payment.getOrderCode().equals(provider.getOrderCode())) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "PAYOS_ORDER_MISMATCH", "PayOS trả về sai mã giao dịch");
        }
        if (payment.getPaymentLinkId() != null && provider.getId() != null
                && !payment.getPaymentLinkId().equals(provider.getId())) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "PAYOS_LINK_MISMATCH", "PayOS trả về sai mã link thanh toán");
        }
        long expectedAmount = payment.getAmount().longValueExact();
        if (provider.getAmount() == null || provider.getAmount() != expectedAmount) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "PAYOS_AMOUNT_MISMATCH", "Số tiền đối soát PayOS không khớp");
        }

        PaymentLinkStatus providerStatus = provider.getStatus();
        if (providerStatus == null) return;
        switch (providerStatus) {
            case PAID -> {
                if (provider.getAmountPaid() == null || provider.getAmountPaid() != expectedAmount) {
                    throw new ApiException(HttpStatus.BAD_GATEWAY, "PAYOS_PAID_AMOUNT_MISMATCH", "Số tiền đã trả trên PayOS không khớp");
                }
                markPaid(payment, null, "server-reconciliation");
            }
            case EXPIRED -> expireAndRelease(payment, "payos-reconciliation");
            case CANCELLED -> closeAndRelease(payment, PaymentTransactionStatus.CANCELLED, providerStatus);
            case FAILED -> closeAndRelease(payment, PaymentTransactionStatus.FAILED, providerStatus);
            default -> log.debug("PayOS reconciliation pending orderCode={} providerStatus={}", payment.getOrderCode(), providerStatus);
        }
    }

    private void markPaid(PaymentTransaction payment, String reference, String source) {
        payment.setStatus(PaymentTransactionStatus.PAID);
        if (reference != null) payment.setPaymentReference(reference);
        payment.setPaidAt(Instant.now());
        Booking booking = payment.getBooking();
        booking.setPaymentStatus(payment.getPaymentOption() == PaymentOption.DEPOSIT_50
                ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.PAID);
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPaymentRetryAllowed(false);
        closeSupersededAttempts(payment);
        log.info("PayOS payment verified orderCode={} paymentLinkId={} source={}", payment.getOrderCode(), payment.getPaymentLinkId(), source);
    }

    private void closeSupersededAttempts(PaymentTransaction paid) {
        for (PaymentTransaction other : payments.findAllByBookingIdOrderByCreatedAtDesc(paid.getBooking().getId())) {
            if (other == paid || other.getStatus() != PaymentTransactionStatus.PENDING) continue;
            try {
                gateway.cancel(other.getOrderCode(), "Another payment attempt was completed");
                other.setStatus(PaymentTransactionStatus.CANCELLED);
                log.info("Closed superseded PayOS attempt orderCode={} paidOrderCode={}", other.getOrderCode(), paid.getOrderCode());
            } catch (ApiException exception) {
                log.error("Could not close superseded PayOS attempt orderCode={} code={}", other.getOrderCode(), exception.getCode());
            }
        }
    }

    private void expireAndRelease(PaymentTransaction payment, String source) {
        payment.setStatus(PaymentTransactionStatus.EXPIRED);
        Booking booking = payment.getBooking();
        if (!isPaid(booking) && booking.getStatus() == BookingStatus.PENDING) {
            booking.setStatus(BookingStatus.CANCELLED);
            booking.setPaymentStatus(PaymentStatus.UNPAID);
            booking.setPaymentRetryAllowed(true);
        }
        log.info("PayOS payment expired and booking slot released orderCode={} bookingId={} source={}", payment.getOrderCode(), booking.getId(), source);
    }

    private void closeAndRelease(PaymentTransaction payment, PaymentTransactionStatus status, PaymentLinkStatus providerStatus) {
        payment.setStatus(status);
        Booking booking = payment.getBooking();
        if (!isPaid(booking) && booking.getStatus() == BookingStatus.PENDING) {
            booking.setStatus(BookingStatus.CANCELLED);
            booking.setPaymentStatus(PaymentStatus.UNPAID);
            booking.setPaymentRetryAllowed(true);
        }
        log.info("PayOS payment status reconciled orderCode={} providerStatus={}", payment.getOrderCode(), providerStatus);
    }

    private void recordLatePaymentWithoutRebooking(PaymentTransaction payment, String reference) {
        payment.setStatus(PaymentTransactionStatus.PAID);
        payment.setPaymentReference(reference);
        payment.setPaidAt(Instant.now());
        payment.getBooking().setPaymentStatus(payment.getPaymentOption() == PaymentOption.DEPOSIT_50
                ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.PAID);
        payment.getBooking().setPaymentRetryAllowed(false);
        log.error("PayOS payment arrived after slot release; manual resolution required orderCode={} bookingId={}",
                payment.getOrderCode(), payment.getBooking().getId());
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

    private boolean isPaid(Booking booking) {
        return booking.getPaymentStatus() == PaymentStatus.PAID
                || booking.getPaymentStatus() == PaymentStatus.PARTIALLY_PAID;
    }

    private PayOSPaymentResponse response(PaymentTransaction payment) {
        Booking booking = payment.getBooking();
        return new PayOSPaymentResponse(booking.getId(), booking.getBookingCode(), payment.getOrderCode(),
                payment.getPaymentLinkId(), payment.getCheckoutUrl(), payment.getAmount(), payment.getRemainingAmount(),
                payment.getPaymentOption(), payment.getStatus(), payment.getExpiresAt());
    }
}
