package com.example.backend;

import com.example.backend.service.PayOSProductionConfigurationValidator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PayOSProductionConfigurationValidatorTest {
    @Test
    void allowsPayOSDisabledForStagedDeployment() {
        assertDoesNotThrow(() -> validator("", "", "", "http://localhost/success",
                "http://localhost/cancel", "").run(null));
    }

    @Test
    void rejectsPartialCredentials() {
        assertThrows(IllegalStateException.class, () -> validator("client", "", "checksum",
                "https://app.example/success", "https://app.example/cancel",
                "https://api.example/api/v1/payments/payos/webhook").run(null));
    }

    @Test
    void rejectsNonHttpsProductionCallback() {
        assertThrows(IllegalStateException.class, () -> validator("client", "api", "checksum",
                "http://app.example/success", "https://app.example/cancel",
                "https://api.example/api/v1/payments/payos/webhook").run(null));
    }

    @Test
    void acceptsCompleteSecureConfiguration() {
        assertDoesNotThrow(() -> validator("client", "api", "checksum",
                "https://app.example/?payment=success", "https://app.example/?payment=cancelled",
                "https://api.example/api/v1/payments/payos/webhook").run(null));
    }

    private PayOSProductionConfigurationValidator validator(String clientId, String apiKey, String checksum,
                                                             String returnUrl, String cancelUrl, String webhookUrl) {
        return new PayOSProductionConfigurationValidator(clientId, apiKey, checksum, returnUrl, cancelUrl, webhookUrl);
    }
}
