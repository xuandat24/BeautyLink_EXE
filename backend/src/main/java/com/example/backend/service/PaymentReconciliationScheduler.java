package com.example.backend.service;

import com.example.backend.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class PaymentReconciliationScheduler {
    private static final Logger log = LoggerFactory.getLogger(PaymentReconciliationScheduler.class);
    private final PaymentAttemptService payments;

    public PaymentReconciliationScheduler(PaymentAttemptService payments) { this.payments = payments; }

    @Scheduled(fixedDelayString = "${app.payment.reconciliation-ms:60000}",
            initialDelayString = "${app.payment.reconciliation-initial-delay-ms:60000}")
    public void reconcileExpiredAttempts() {
        for (Long id : payments.reconciliationCandidates()) {
            try { payments.reconcileById(id); }
            catch (ApiException exception) { log.error("Payment reconciliation failed paymentId={} code={}", id, exception.getCode()); }
            catch (RuntimeException exception) { log.error("Payment reconciliation failed paymentId={}", id, exception); }
        }
    }
}
