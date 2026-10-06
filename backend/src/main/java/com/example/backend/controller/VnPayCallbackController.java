package com.example.backend.controller;

import com.example.backend.dto.ApiDtos.VnPayIpnResponse;
import com.example.backend.exception.ApiException;
import com.example.backend.service.PaymentAttemptService;
import com.example.backend.service.VnPayPaymentProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Map;

import static com.example.backend.model.DomainEnums.PaymentProvider.VNPAY;

@RestController
@RequestMapping("/api/v1/payments/vnpay")
public class VnPayCallbackController {
    private static final Logger log = LoggerFactory.getLogger(VnPayCallbackController.class);
    private final VnPayPaymentProvider vnPay;
    private final PaymentAttemptService payments;
    private final String frontendUrl;

    public VnPayCallbackController(VnPayPaymentProvider vnPay, PaymentAttemptService payments,
            @Value("${app.frontend-url:http://localhost:5173}") String frontendUrl) {
        this.vnPay = vnPay;
        this.payments = payments;
        this.frontendUrl = frontendUrl;
    }

    /** VNPAY retries this endpoint. It must always be idempotent and return the documented JSON codes. */
    @GetMapping("/ipn")
    public ResponseEntity<VnPayIpnResponse> ipn(@RequestParam Map<String, String> parameters) {
        try {
            VnPayPaymentProvider.VerifiedCallback callback = vnPay.verifyCallback(parameters);
            PaymentAttemptService.ApplyResult result = payments.applyProviderOutcome(
                    VNPAY, callback.merchantReference(), callback.outcome(), "vnpay-ipn");
            return ResponseEntity.ok(switch (result) {
                case UPDATED, PENDING -> new VnPayIpnResponse("00", "Confirm Success");
                case DUPLICATE -> new VnPayIpnResponse("02", "Order already confirmed");
                case NOT_FOUND -> new VnPayIpnResponse("01", "Order not found");
                case AMOUNT_MISMATCH -> new VnPayIpnResponse("04", "Invalid amount");
            });
        } catch (ApiException exception) {
            log.warn("VNPAY IPN rejected code={}", exception.getCode());
            String code = "VNPAY_INVALID_SIGNATURE".equals(exception.getCode()) ? "97" : "99";
            return ResponseEntity.ok(new VnPayIpnResponse(code, "Invalid request"));
        } catch (RuntimeException exception) {
            log.error("VNPAY IPN processing failed", exception);
            return ResponseEntity.ok(new VnPayIpnResponse("99", "Unknown error"));
        }
    }

    /** The browser return is UX-only. It verifies the signature but never changes payment state. */
    @GetMapping("/return")
    public ResponseEntity<Void> paymentReturn(@RequestParam Map<String, String> parameters) {
        String result = "pending";
        String reference = "";
        try {
            VnPayPaymentProvider.VerifiedCallback callback = vnPay.verifyCallback(parameters);
            reference = callback.merchantReference();
            result = callback.outcome().status() == com.example.backend.service.PaymentProviderAdapter.OutcomeStatus.PAID
                    ? "success" : callback.outcome().status() == com.example.backend.service.PaymentProviderAdapter.OutcomeStatus.CANCELLED
                    ? "cancelled" : "pending";
        } catch (ApiException ignored) {
            result = "invalid";
        }
        URI location = UriComponentsBuilder.fromUriString(frontendUrl)
                .queryParam("payment", result)
                .queryParam("provider", "VNPAY")
                .queryParam("reference", reference)
                .build().encode().toUri();
        return ResponseEntity.status(HttpStatus.FOUND).location(location).build();
    }
}
