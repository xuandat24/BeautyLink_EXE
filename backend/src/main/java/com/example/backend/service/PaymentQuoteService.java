package com.example.backend.service;

import com.example.backend.dto.ApiDtos.PaymentQuoteResponse;
import com.example.backend.exception.ApiException;
import com.example.backend.model.DomainEnums.PaymentOption;
import com.example.backend.model.ServiceOffering;
import com.example.backend.repository.ServiceOfferingRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;

/** One authoritative VND calculation shared by preview and payment reservation. */
@Service
public class PaymentQuoteService {
    static final BigDecimal MIN_PAYOS_AMOUNT = new BigDecimal("2000");
    private static final BigDecimal DEPOSIT_RATE = new BigDecimal("0.05");

    private final ServiceOfferingRepository services;
    private final PromotionService promotions;

    public PaymentQuoteService(ServiceOfferingRepository services, PromotionService promotions) {
        this.services = services;
        this.promotions = promotions;
    }

    @Transactional(readOnly = true)
    public PaymentQuoteResponse quoteService(Long serviceId, PaymentOption option, String voucherCode) {
        ServiceOffering service = services.findById(serviceId).filter(ServiceOffering::isActive)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SERVICE_NOT_FOUND", "Không tìm thấy dịch vụ"));
        return calculate(service.getPrice(), option, voucherCode);
    }

    @Transactional(readOnly = true)
    public PaymentQuoteResponse calculate(BigDecimal bookingTotal, PaymentOption option, String rawVoucherCode) {
        if (option == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAYMENT_OPTION_REQUIRED", "Vui lòng chọn hình thức thanh toán");
        }
        if (option == PaymentOption.DEPOSIT_50) {
            throw new ApiException(HttpStatus.CONFLICT, "POLICY_CHANGED",
                    "Cọc 50% chỉ áp dụng cho giao dịch cũ. Vui lòng chọn cọc 5% hoặc thanh toán 100%.");
        }
        BigDecimal original = bookingTotal.max(BigDecimal.ZERO).setScale(0, RoundingMode.HALF_UP);
        String voucherCode = normalizeVoucher(rawVoucherCode);
        BigDecimal discount = promotions.discount(original, voucherCode);
        BigDecimal payable = original.subtract(discount).max(BigDecimal.ZERO);
        BigDecimal amount = option == PaymentOption.DEPOSIT_05
                ? payable.multiply(DEPOSIT_RATE).setScale(0, RoundingMode.HALF_UP)
                : payable;
        BigDecimal remaining = option == PaymentOption.DEPOSIT_05
                ? payable.subtract(amount)
                : BigDecimal.ZERO;

        String unavailableReason = null;
        if (payable.signum() == 0) unavailableReason = "PAYMENT_UNAVAILABLE_ZERO";
        else if (amount.compareTo(MIN_PAYOS_AMOUNT) < 0) {
            unavailableReason = option == PaymentOption.DEPOSIT_05 && payable.compareTo(MIN_PAYOS_AMOUNT) >= 0
                    ? "DEPOSIT_TOO_LOW_USE_FULL_PAYMENT"
                    : "PAYMENT_UNAVAILABLE_AMOUNT_TOO_LOW";
        }
        return new PaymentQuoteResponse(original, discount, payable, amount, remaining, option,
                unavailableReason == null, unavailableReason);
    }

    public void requireAvailable(PaymentQuoteResponse quote) {
        if (quote.paymentAvailable()) return;
        String message = switch (quote.unavailableReason()) {
            case "PAYMENT_UNAVAILABLE_ZERO" -> "Đơn hàng không còn số tiền cần thanh toán qua PayOS";
            case "DEPOSIT_TOO_LOW_USE_FULL_PAYMENT" -> "Tiền cọc 5% dưới mức tối thiểu 2.000đ. Vui lòng chọn thanh toán 100%.";
            default -> "Số tiền thanh toán thấp hơn mức tối thiểu 2.000đ của PayOS";
        };
        throw new ApiException(HttpStatus.BAD_REQUEST, quote.unavailableReason(), message);
    }

    private String normalizeVoucher(String voucherCode) {
        return voucherCode == null || voucherCode.isBlank() ? null : voucherCode.trim().toUpperCase(Locale.ROOT);
    }

}
