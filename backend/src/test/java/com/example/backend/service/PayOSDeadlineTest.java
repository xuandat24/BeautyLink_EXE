package com.example.backend.service;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PayOSDeadlineTest {
    @Test void providerWorkIsBoundedAndHasNoImplicitWriteRetries() {
        var options = PayOSGateway.clientOptions("test-client", "test-key", "test-checksum");
        assertEquals(15000, options.getTimeoutMs());
        assertEquals(0, options.getMaxRetries());
    }
}
