package com.example.backend.controller;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.service.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import vn.payos.model.webhooks.Webhook;

@RestController
@RequestMapping("/api/v1/payments/payos")
public class PaymentController {
    private final PaymentService payments;
    private final PaymentAttemptService attempts;
    private final PayOSPaymentProvider payOS;
    private final CurrentAccountService current;

    public PaymentController(PaymentService payments, PaymentAttemptService attempts,
                             PayOSPaymentProvider payOS, CurrentAccountService current) {
        this.payments = payments;
        this.attempts = attempts;
        this.payOS = payOS;
        this.current = current;
    }

    @PostMapping("/bookings/{bookingId}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public PayOSPaymentResponse create(Authentication auth, @PathVariable Long bookingId,
                                       @Valid @RequestBody CreatePayOSPaymentRequest request) {
        return payments.create(current.require(auth), bookingId, request);
    }

    @GetMapping("/{orderCode}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public PayOSPaymentResponse status(Authentication auth, @PathVariable Long orderCode) {
        return payments.status(current.require(auth), orderCode);
    }

    @PostMapping("/webhook")
    public PayOSWebhookResponse webhook(@RequestBody Webhook webhook) {
        PayOSPaymentProvider.VerifiedCallback callback = payOS.verifyWebhook(webhook);
        PaymentAttemptService.ApplyResult result = attempts.applyProviderOutcome(
                com.example.backend.model.DomainEnums.PaymentProvider.PAYOS,
                callback.merchantReference(), callback.outcome(), "payos-webhook");
        return new PayOSWebhookResponse(result != PaymentAttemptService.ApplyResult.AMOUNT_MISMATCH);
    }
}
