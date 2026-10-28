package com.example.backend.service;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PayOSDeadlineTest {
    @Test void providerWorkIsBoundedAndHasNoImplicitWriteRetries() {
        var options = PayOSGateway.clientOptions("test-client", "test-key", "test-checksum");
        assertEquals(15000, options.getTimeoutMs());
        assertEquals(0, options.getMaxRetries());
        assertEquals(15000, options.getHttpClient().callTimeoutMillis(), "SDK per-read timeout is not a total response deadline");
        assertFalse(options.getHttpClient().followRedirects());
        assertFalse(options.getHttpClient().retryOnConnectionFailure());
        options.close();
    }
}
