package com.example.backend.service;

import okhttp3.OkHttpClient;
import java.util.concurrent.TimeUnit;
import vn.payos.core.ClientOptions;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkRequest;
import vn.payos.model.v2.paymentRequests.PaymentLinkStatus;
import com.example.backend.exception.ApiException;

/** Explicit local Postman simulation only; excluded from the production JAR. */
public class PayOSCheckoutSimulationProbe {
    public static void main(String[] args) {
        var options = ClientOptions.builder().clientId("local-test-client").apiKey("local-test-key")
                .checksumKey("local-payos-checksum-only").baseURL("http://127.0.0.1:4901/payos")
                .maxRetries(0).timeoutMs(2000).httpClient(new OkHttpClient.Builder()
                        .connectTimeout(2, TimeUnit.SECONDS).readTimeout(2, TimeUnit.SECONDS)
                        .retryOnConnectionFailure(false).build()).build();
        try (var gateway = new PayOSGateway(options)) {
            var normal = gateway.create(request(101L));
            if (!Long.valueOf(101).equals(normal.getOrderCode()) || !PayOSQrInstructions.usable(normal.getQrCode(), java.math.BigDecimal.valueOf(11000))) throw new AssertionError("Signed QR create failed");
            try { gateway.create(request(102L)); throw new AssertionError("Expected lost acknowledgement"); }
            catch (ApiException expected) { if (!"PAYOS_CREATE_FAILED".equals(expected.getCode())) throw expected; }
            var recovered = gateway.get(102L);
            if (!Long.valueOf(102).equals(recovered.getOrderCode()) || !"local-102".equals(recovered.getId())
                    || recovered.getStatus() != PaymentLinkStatus.PENDING || recovered.getAmountPaid() != 0L) throw new AssertionError("Recovery identity mismatch");
            System.out.println("PASS actual SDK/gateway -> local signed PayOS simulation: fresh QR + lost acknowledgement GET recovery. No real payment.");
        }
    }
    private static CreatePaymentLinkRequest request(Long order) {
        return CreatePaymentLinkRequest.builder().orderCode(order).amount(11000L).description("LOCAL TEST ONLY")
                .returnUrl("http://localhost/test-return").cancelUrl("http://localhost/test-cancel").build();
    }
}
