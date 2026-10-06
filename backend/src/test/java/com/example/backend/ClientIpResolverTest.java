package com.example.backend;

import com.example.backend.service.ClientIpResolver;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ClientIpResolverTest {
    @Test
    void trustedRailwayEdgeUsesValidatedRealIp() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("10.0.0.8");
        request.addHeader("X-Real-IP", "203.0.113.42");

        assertEquals("203.0.113.42", new ClientIpResolver(true).resolve(request));
    }

    @Test
    void invalidProxyHeaderFallsBackToRemoteAddress() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("198.51.100.9");
        request.addHeader("X-Real-IP", "203.0.113.42, 10.0.0.1");

        assertEquals("198.51.100.9", new ClientIpResolver(true).resolve(request));
    }

    @Test
    void defaultModeNeverTrustsCallerSuppliedProxyHeader() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("198.51.100.9");
        request.addHeader("X-Real-IP", "203.0.113.42");

        assertEquals("198.51.100.9", new ClientIpResolver(false).resolve(request));
    }
}
