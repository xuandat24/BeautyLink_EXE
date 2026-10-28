package com.example.backend.service;

import com.example.backend.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vn.payos.PayOS;
import vn.payos.core.ClientOptions;
import okhttp3.OkHttpClient;
import okhttp3.EventListener;
import okhttp3.Call;
import okhttp3.Connection;
import okhttp3.Handshake;
import okhttp3.Request;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Autowired;
import vn.payos.exception.PayOSException;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkRequest;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkResponse;
import vn.payos.model.v2.paymentRequests.PaymentLink;
import vn.payos.model.webhooks.ConfirmWebhookResponse;
import vn.payos.model.webhooks.Webhook;
import vn.payos.model.webhooks.WebhookData;

@Component
public class PayOSGateway implements AutoCloseable {
    private final String clientId;
    private final String apiKey;
    private final String checksumKey;
    private final ClientOptions options;
    private final AtomicBoolean closed = new AtomicBoolean();

    @Autowired
    public PayOSGateway(@Value("${app.payos.client-id:}") String clientId,
                        @Value("${app.payos.api-key:}") String apiKey,
                        @Value("${app.payos.checksum-key:}") String checksumKey) {
        this(clientOptions(clientId, apiKey, checksumKey));
    }

    PayOSGateway(ClientOptions options) {
        this.clientId = options.getClientId(); this.apiKey = options.getApiKey(); this.checksumKey = options.getChecksumKey();
        this.options = options;
    }

    // Per-operation SDK state; HTTP connection/thread pools are owned once by this Spring bean.
    private PayOS client() {
        ensureConfigured();
        if (closed.get()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "PAYOS_STOPPING", "Cổng thanh toán đang khởi động lại.");
        return new PayOS(options);
    }

    public CreatePaymentLinkResponse create(CreatePaymentLinkRequest request) {
        ensureConfigured();
        PayOS payOS = client();
        try {
            return payOS.paymentRequests().create(request);
        } catch (RuntimeException ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "PAYOS_CREATE_FAILED", "Không thể tạo phiên thanh toán PayOS. Vui lòng thử lại");
        }
    }

    public WebhookData verify(Webhook webhook) {
        ensureConfigured();
        PayOS payOS = client();
        try {
            return payOS.webhooks().verify(webhook);
        } catch (PayOSException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAYOS_INVALID_SIGNATURE", "Chữ ký webhook PayOS không hợp lệ");
        }
    }

    public PaymentLink get(Long orderCode) {
        ensureConfigured();
        PayOS payOS = client();
        try {
            return payOS.paymentRequests().get(orderCode);
        } catch (RuntimeException ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "PAYOS_RECONCILIATION_FAILED", "Không thể đối soát giao dịch với PayOS. Vui lòng thử lại");
        }
    }

    public PaymentLink cancel(Long orderCode, String reason) {
        ensureConfigured();
        PayOS payOS = client();
        try {
            return payOS.paymentRequests().cancel(orderCode, reason);
        } catch (RuntimeException ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "PAYOS_CANCEL_FAILED", "Không thể đóng phiên thanh toán PayOS cũ");
        }
    }

    public ConfirmWebhookResponse confirmWebhook(String webhookUrl) {
        ensureConfigured();
        PayOS payOS = client();
        try {
            return payOS.webhooks().confirm(webhookUrl);
        } catch (PayOSException ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "PAYOS_WEBHOOK_CONFIRM_FAILED", "Không thể đăng ký webhook với PayOS");
        }
    }

    // Bound provider work below the checkout HTTP deadline. Never retry a provider write implicitly.
    static ClientOptions clientOptions(String clientId, String apiKey, String checksumKey) {
        return ClientOptions.builder().clientId(clientId).apiKey(apiKey).checksumKey(checksumKey)
                .timeoutMs(15000).maxRetries(0)
                .httpClient(new OkHttpClient.Builder().connectTimeout(15000, TimeUnit.MILLISECONDS)
                        .readTimeout(15000, TimeUnit.MILLISECONDS).writeTimeout(15000, TimeUnit.MILLISECONDS)
                        .retryOnConnectionFailure(false).eventListenerFactory(call -> new TransportTiming()).build()).build();
    }

    @Override @PreDestroy public void close() { if (closed.compareAndSet(false, true)) options.close(); }

    private static final class TransportTiming extends EventListener {
        private long connect, tls, sent;
        @Override public void callStart(Call call) {
            CheckoutTrace.record("provider_connect", 0); CheckoutTrace.record("provider_tls", 0);
        }
        @Override public void connectStart(Call call, InetSocketAddress address, Proxy proxy) { connect = System.nanoTime(); }
        @Override public void connectEnd(Call call, InetSocketAddress address, Proxy proxy, okhttp3.Protocol protocol) { CheckoutTrace.record("provider_connect", System.nanoTime() - connect); }
        @Override public void secureConnectStart(Call call) { tls = System.nanoTime(); }
        @Override public void secureConnectEnd(Call call, Handshake handshake) { CheckoutTrace.record("provider_tls", System.nanoTime() - tls); }
        @Override public void requestHeadersEnd(Call call, Request request) { sent = System.nanoTime(); }
        @Override public void responseHeadersStart(Call call) { if (sent != 0) CheckoutTrace.record("provider_ttfb", System.nanoTime() - sent); }
    }

    public boolean isConfigured() {
        return StringUtils.hasText(clientId) && StringUtils.hasText(apiKey) && StringUtils.hasText(checksumKey);
    }
    public void requireConfigured() { ensureConfigured(); }

    private void ensureConfigured() {
        if (!isConfigured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "PAYOS_NOT_CONFIGURED", "Cổng PayOS chưa được cấu hình trên máy chủ");
        }
    }
}
