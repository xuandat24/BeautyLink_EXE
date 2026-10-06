package com.example.backend;

import com.example.backend.service.VnPayProductionConfigurationValidator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class VnPayProductionConfigurationValidatorTest {
    @Test
    void allowsApplicationToStartWithVnPayExplicitlyDisabled() {
        assertDoesNotThrow(() -> validator("", "", "https://sandbox.vnpayment.vn/pay",
                "http://localhost/return", "https://sandbox.vnpayment.vn/query", "127.0.0.1",
                "http://localhost:5173").run(null));
    }

    @Test
    void rejectsProductionCredentialsCombinedWithSandboxDefaults() {
        IllegalStateException error = assertThrows(IllegalStateException.class, () -> validator(
                "ABCDEFGH", "a-production-secret-value", "https://sandbox.vnpayment.vn/pay",
                "https://api.example.com/api/v1/payments/vnpay/return",
                "https://sandbox.vnpayment.vn/query", "8.8.8.8", "https://beauty.example.com").run(null));
        assertTrue(error.getMessage().contains("sandbox"));
    }

    @Test
    void acceptsCompleteNonSandboxProductionConfiguration() {
        assertDoesNotThrow(() -> validator("ABCDEFGH", "a-production-secret-value",
                "https://pay.provider.example/vpcpay.html",
                "https://api.example.com/api/v1/payments/vnpay/return",
                "https://merchant.provider.example/api/transaction", "8.8.8.8",
                "https://beauty.example.com").run(null));
    }

    private VnPayProductionConfigurationValidator validator(String code, String secret, String pay,
            String returnUrl, String query, String serverIp, String frontend) {
        return new VnPayProductionConfigurationValidator(code, secret, pay, returnUrl, query, serverIp, frontend);
    }
}
