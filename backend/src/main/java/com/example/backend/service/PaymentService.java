package com.example.backend.service;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkRequest;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkResponse;
import vn.payos.model.webhooks.Webhook;
import vn.payos.model.webhooks.WebhookData;

import java.math.*;
import java.time.Instant;
import java.util.Locale;
import static com.example.backend.model.DomainEnums.*;

@Service
public class PaymentService {
    private static final BigDecimal MIN_PAYOS_AMOUNT = new BigDecimal("2000");
    private final PaymentTransactionRepository payments;
    private final BookingRepository bookings;
    private final PayOSGateway gateway;
    private final String returnUrl;
    private final String cancelUrl;

    public PaymentService(PaymentTransactionRepository payments, BookingRepository bookings, PayOSGateway gateway,
                          @Value("${app.payos.return-url}") String returnUrl,
                          @Value("${app.payos.cancel-url}") String cancelUrl) {
        this.payments = payments;
        this.bookings = bookings;
        this.gateway = gateway;
        this.returnUrl = returnUrl;
        this.cancelUrl = cancelUrl;
    }

    @Transactional
    public PayOSPaymentResponse create(UserAccount customer, Long bookingId, CreatePayOSPaymentRequest request) {
        Booking booking = ownedBooking(customer, bookingId);
        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED) {
            throw new ApiException(HttpStatus.CONFLICT, "BOOKING_NOT_PAYABLE", "Lịch hẹn không còn ở trạng thái có thể thanh toán");
        }
        if (booking.getPaymentStatus() == PaymentStatus.PAID) {
            return payments.findByBookingId(bookingId).map(this::response)
                    .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "PAYMENT_ALREADY_PAID", "Lịch hẹn đã được thanh toán"));
        }

        String voucherCode = normalizeVoucher(request.voucherCode());
        PaymentTransaction existing = payments.findByBookingId(bookingId).orElse(null);
        if (existing != null && existing.getStatus() == PaymentTransactionStatus.PENDING) {
            if (existing.getPaymentOption() != request.paymentOption() || !java.util.Objects.equals(existing.getVoucherCode(), voucherCode)) {
                throw new ApiException(HttpStatus.CONFLICT, "PAYMENT_LINK_EXISTS", "Lịch hẹn đã có link PayOS đang chờ thanh toán");
            }
            return response(existing);
        }

        BigDecimal total = booking.getTotalAmount().setScale(0, RoundingMode.HALF_UP);
        BigDecimal discount = calculateDiscount(total, voucherCode);
        BigDecimal baseDue = request.paymentOption() == PaymentOption.DEPOSIT_50
                ? total.multiply(new BigDecimal("0.5")).setScale(0, RoundingMode.HALF_UP)
                : total;
        BigDecimal amount = baseDue.subtract(discount).max(BigDecimal.ZERO);
        BigDecimal remaining = request.paymentOption() == PaymentOption.DEPOSIT_50
                ? total.subtract(total.multiply(new BigDecimal("0.5")).setScale(0, RoundingMode.HALF_UP))
                : BigDecimal.ZERO;
        if (amount.compareTo(MIN_PAYOS_AMOUNT) < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAYMENT_AMOUNT_TOO_LOW", "Số tiền thanh toán PayOS tối thiểu là 2.000đ");
        }

        PaymentTransaction transaction = existing == null ? new PaymentTransaction() : existing;
        transaction.setBooking(booking);
        transaction.setOrderCode(nextOrderCode(booking.getId()));
        transaction.setAmount(amount);
        transaction.setRemainingAmount(remaining);
        transaction.setPaymentOption(request.paymentOption());
        transaction.setVoucherCode(voucherCode);
        transaction.setStatus(PaymentTransactionStatus.PENDING);

        CreatePaymentLinkRequest paymentRequest = CreatePaymentLinkRequest.builder()
                .orderCode(transaction.getOrderCode())
                .amount(amount.longValueExact())
                .description(("BL " + booking.getBookingCode()).substring(0, Math.min(25, ("BL " + booking.getBookingCode()).length())))
                .buyerName(customer.getFullName())
                .buyerEmail(customer.getEmail())
                .buyerPhone(customer.getPhone())
                .returnUrl(returnUrl)
                .cancelUrl(cancelUrl)
                .expiredAt(Instant.now().plusSeconds(15 * 60).getEpochSecond())
                .build();
        CreatePaymentLinkResponse payOS = gateway.create(paymentRequest);
        transaction.setPaymentLinkId(payOS.getPaymentLinkId());
        transaction.setCheckoutUrl(payOS.getCheckoutUrl());
        booking.setStatus(BookingStatus.PENDING);
        booking.setPaymentStatus(PaymentStatus.UNPAID);
        payments.save(transaction);
        return response(transaction);
    }

    @Transactional(readOnly = true)
    public PayOSPaymentResponse status(UserAccount customer, Long orderCode) {
        PaymentTransaction payment = payments.findByOrderCode(orderCode)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PAYMENT_NOT_FOUND", "Không tìm thấy giao dịch PayOS"));
        if (!payment.getBooking().getCustomer().getId().equals(customer.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "PAYMENT_FORBIDDEN", "Bạn không có quyền xem giao dịch này");
        }
        return response(payment);
    }

    @Transactional
    public boolean handleWebhook(Webhook webhook) {
        WebhookData data = gateway.verify(webhook);
        if (data == null || data.getOrderCode() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAYOS_INVALID_WEBHOOK", "Webhook PayOS thiếu dữ liệu giao dịch");
        }
        PaymentTransaction payment = payments.findByOrderCode(data.getOrderCode()).orElse(null);
        if (payment == null) return true; // Allows payOS's signed webhook verification sample.
        if (payment.getStatus() == PaymentTransactionStatus.PAID) return true;
        if (!Boolean.TRUE.equals(webhook.getSuccess()) || !"00".equals(data.getCode())) return true;
        if (data.getAmount() == null || payment.getAmount().longValueExact() != data.getAmount()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAYOS_AMOUNT_MISMATCH", "Số tiền webhook không khớp với giao dịch");
        }
        if (payment.getPaymentLinkId() != null && data.getPaymentLinkId() != null
                && !payment.getPaymentLinkId().equals(data.getPaymentLinkId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAYOS_LINK_MISMATCH", "Mã link PayOS không khớp");
        }
        payment.setStatus(PaymentTransactionStatus.PAID);
        payment.setPaymentReference(data.getReference());
        payment.setPaidAt(Instant.now());
        Booking booking = payment.getBooking();
        booking.setPaymentStatus(PaymentStatus.PAID);
        booking.setStatus(BookingStatus.CONFIRMED);
        return true;
    }

    private Booking ownedBooking(UserAccount customer, Long bookingId) {
        Booking booking = bookings.findById(bookingId)
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

    private PayOSPaymentResponse response(PaymentTransaction payment) {
        Booking booking = payment.getBooking();
        return new PayOSPaymentResponse(booking.getId(), booking.getBookingCode(), payment.getOrderCode(),
                payment.getPaymentLinkId(), payment.getCheckoutUrl(), payment.getAmount(), payment.getRemainingAmount(),
                payment.getPaymentOption(), payment.getStatus());
    }
}
