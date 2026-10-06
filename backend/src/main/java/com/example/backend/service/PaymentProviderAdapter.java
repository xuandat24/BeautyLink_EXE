package com.example.backend.service;

import com.example.backend.model.PaymentTransaction;
import com.example.backend.model.UserAccount;
import com.example.backend.model.DomainEnums.PaymentProvider;

import java.math.BigDecimal;
import java.time.Instant;

/** Provider boundary: business state changes remain inside PaymentService. */
public interface PaymentProviderAdapter {
    PaymentProvider provider();
    boolean isConfigured();
    CheckoutSession createCheckout(PaymentTransaction payment, UserAccount customer, String clientIp);
    ProviderOutcome query(PaymentTransaction payment);
    void cancel(PaymentTransaction payment, String reason);

    enum OutcomeStatus { PENDING, PAID, CANCELLED, EXPIRED, FAILED, REVIEW_REQUIRED }

    record CheckoutSession(String providerPaymentId, String checkoutUrl, Instant providerCreatedAt) {}

    record ProviderOutcome(OutcomeStatus status, BigDecimal amount, String providerTransactionId,
                           String paymentReference, String responseCode, String transactionStatus,
                           String bankCode, String cardType, Instant paidAt) {}
}
