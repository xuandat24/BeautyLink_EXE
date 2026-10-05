package com.example.backend.service;

import com.example.backend.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vn.payos.PayOS;
import vn.payos.exception.PayOSException;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkRequest;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkResponse;
import vn.payos.model.v2.paymentRequests.PaymentLink;
import vn.payos.model.webhooks.ConfirmWebhookResponse;
import vn.payos.model.webhooks.Webhook;
import vn.payos.model.webhooks.WebhookData;

@Component
public class PayOSGateway {
    private final String clientId;
    private final String apiKey;
    private final String checksumKey;

    public PayOSGateway(@Value("${app.payos.client-id:}") String clientId,
                        @Value("${app.payos.api-key:}") String apiKey,
                        @Value("${app.payos.checksum-key:}") String checksumKey) {
        this.clientId = clientId;
        this.apiKey = apiKey;
        this.checksumKey = checksumKey;
    }

    public CreatePaymentLinkResponse create(CreatePaymentLinkRequest request) {
        ensureConfigured();
        PayOS payOS = new PayOS(clientId, apiKey, checksumKey);
        try {
            return payOS.paymentRequests().create(request);
        } catch (PayOSException ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "PAYOS_CREATE_FAILED", "Không thể tạo phiên thanh toán PayOS. Vui lòng thử lại");
        } finally {
            payOS.close();
        }
    }

    public WebhookData verify(Webhook webhook) {
        ensureConfigured();
        PayOS payOS = new PayOS(clientId, apiKey, checksumKey);
        try {
            return payOS.webhooks().verify(webhook);
        } catch (PayOSException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAYOS_INVALID_SIGNATURE", "Chữ ký webhook PayOS không hợp lệ");
        } finally {
            payOS.close();
        }
    }

    public PaymentLink get(Long orderCode) {
        ensureConfigured();
        PayOS payOS = new PayOS(clientId, apiKey, checksumKey);
        try {
            return payOS.paymentRequests().get(orderCode);
        } catch (PayOSException ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "PAYOS_RECONCILIATION_FAILED", "Không thể đối soát giao dịch với PayOS. Vui lòng thử lại");
        } finally {
            payOS.close();
        }
    }

    public PaymentLink cancel(Long orderCode, String reason) {
        ensureConfigured();
        PayOS payOS = new PayOS(clientId, apiKey, checksumKey);
        try {
            return payOS.paymentRequests().cancel(orderCode, reason);
        } catch (PayOSException ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "PAYOS_CANCEL_FAILED", "Không thể đóng phiên thanh toán PayOS cũ");
        } finally {
            payOS.close();
        }
    }

    public ConfirmWebhookResponse confirmWebhook(String webhookUrl) {
        ensureConfigured();
        PayOS payOS = new PayOS(clientId, apiKey, checksumKey);
        try {
            return payOS.webhooks().confirm(webhookUrl);
        } catch (PayOSException ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "PAYOS_WEBHOOK_CONFIRM_FAILED", "Không thể đăng ký webhook với PayOS");
        } finally {
            payOS.close();
        }
    }

    public boolean isConfigured() {
        return StringUtils.hasText(clientId) && StringUtils.hasText(apiKey) && StringUtils.hasText(checksumKey);
    }

    private void ensureConfigured() {
        if (!isConfigured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "PAYOS_NOT_CONFIGURED", "Cổng PayOS chưa được cấu hình trên máy chủ");
        }
    }
}
