package com.example.backend.service;

import com.example.backend.exception.ApiException;
import com.example.backend.model.PaymentTransaction;
import com.example.backend.model.UserAccount;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkRequest;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkResponse;
import vn.payos.model.v2.paymentRequests.PaymentLink;
import vn.payos.model.v2.paymentRequests.PaymentLinkStatus;
import vn.payos.model.webhooks.Webhook;
import vn.payos.model.webhooks.WebhookData;

import java.math.BigDecimal;
import java.time.Instant;

import static com.example.backend.model.DomainEnums.PaymentProvider.PAYOS;

@Component
public class PayOSPaymentProvider implements PaymentProviderAdapter {
    private static final BigDecimal MIN_AMOUNT = new BigDecimal("2000");
    private final PayOSGateway gateway;
    private final String returnUrl;
    private final String cancelUrl;

    public PayOSPaymentProvider(PayOSGateway gateway,
                                @Value("${app.payos.return-url}") String returnUrl,
                                @Value("${app.payos.cancel-url}") String cancelUrl) {
        this.gateway = gateway;
        this.returnUrl = returnUrl;
        this.cancelUrl = cancelUrl;
    }

    @Override public com.example.backend.model.DomainEnums.PaymentProvider provider() { return PAYOS; }
    @Override public boolean isConfigured() { return gateway.isConfigured(); }

    @Override
    public CheckoutSession createCheckout(PaymentTransaction payment, UserAccount customer, String clientIp) {
        if (payment.getAmount().compareTo(MIN_AMOUNT) < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAYMENT_AMOUNT_TOO_LOW", "Số tiền thanh toán PayOS tối thiểu là 2.000đ");
        }
        CreatePaymentLinkRequest request = CreatePaymentLinkRequest.builder()
                .orderCode(payment.getOrderCode())
                .amount(payment.getAmount().longValueExact())
                .description("BL" + String.format("%07d", Math.floorMod(payment.getOrderCode(), 10_000_000L)))
                .buyerName(customer.getFullName())
                .buyerEmail(customer.getEmail())
                .buyerPhone(customer.getPhone())
                .returnUrl(returnUrl)
                .cancelUrl(cancelUrl)
                .expiredAt(payment.getExpiresAt().getEpochSecond())
                .build();
        CreatePaymentLinkResponse response = gateway.create(request);
        return new CheckoutSession(response.getPaymentLinkId(), response.getCheckoutUrl(), Instant.now());
    }

    @Override
    public ProviderOutcome query(PaymentTransaction payment) {
        PaymentLink provider = gateway.get(payment.getOrderCode());
        if (provider == null || provider.getOrderCode() == null || !payment.getOrderCode().equals(provider.getOrderCode())) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "PAYOS_ORDER_MISMATCH", "PayOS trả về sai mã giao dịch");
        }
        if (payment.getPaymentLinkId() != null && provider.getId() != null && !payment.getPaymentLinkId().equals(provider.getId())) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "PAYOS_LINK_MISMATCH", "PayOS trả về sai mã link thanh toán");
        }
        BigDecimal amount = provider.getAmount() == null ? null : BigDecimal.valueOf(provider.getAmount());
        if (provider.getStatus() == PaymentLinkStatus.PAID
                && (provider.getAmountPaid() == null || provider.getAmountPaid() != payment.getAmount().longValueExact())) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "PAYOS_PAID_AMOUNT_MISMATCH", "Số tiền đã trả trên PayOS không khớp");
        }
        return outcome(provider.getStatus(), amount, null, null, provider.getStatus() == null ? null : provider.getStatus().name(), null, null);
    }

    public VerifiedCallback verifyWebhook(Webhook webhook) {
        WebhookData data = gateway.verify(webhook);
        if (data == null || data.getOrderCode() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAYOS_INVALID_WEBHOOK", "Webhook PayOS thiếu dữ liệu giao dịch");
        }
        OutcomeStatus status = Boolean.TRUE.equals(webhook.getSuccess()) && "00".equals(data.getCode())
                ? OutcomeStatus.PAID : OutcomeStatus.PENDING;
        ProviderOutcome outcome = new ProviderOutcome(status,
                data.getAmount() == null ? null : BigDecimal.valueOf(data.getAmount()),
                data.getPaymentLinkId(), data.getReference(), data.getCode(), data.getCode(), null, null, Instant.now());
        return new VerifiedCallback(Long.toString(data.getOrderCode()), outcome);
    }

    @Override public void cancel(PaymentTransaction payment, String reason) { gateway.cancel(payment.getOrderCode(), reason); }

    public record VerifiedCallback(String merchantReference, ProviderOutcome outcome) {}

    private ProviderOutcome outcome(PaymentLinkStatus providerStatus, BigDecimal amount, String reference,
                                    String responseCode, String transactionStatus, String bankCode, String cardType) {
        OutcomeStatus status = providerStatus == null ? OutcomeStatus.PENDING : switch (providerStatus) {
            case PAID -> OutcomeStatus.PAID;
            case CANCELLED -> OutcomeStatus.CANCELLED;
            case EXPIRED -> OutcomeStatus.EXPIRED;
            case FAILED -> OutcomeStatus.FAILED;
            default -> OutcomeStatus.PENDING;
        };
        return new ProviderOutcome(status, amount, null, reference, responseCode, transactionStatus, bankCode, cardType,
                status == OutcomeStatus.PAID ? Instant.now() : null);
    }
}
