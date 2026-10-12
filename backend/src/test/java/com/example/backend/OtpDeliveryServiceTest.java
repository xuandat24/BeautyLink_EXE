package com.example.backend;

import com.example.backend.exception.ApiException;
import com.example.backend.service.OtpDeliveryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class OtpDeliveryServiceTest {
    private MockRestServiceServer server;
    private RestClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.resend.com");
        server = MockRestServiceServer.bindTo(builder).build();
        client = builder.build();
    }

    @Test
    void sendsOtpThroughResendHttpsContract() {
        server.expect(once(), requestTo("https://api.resend.com/emails"))
                .andExpect(method(POST))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer secret-resend-key"))
                .andExpect(content().string(containsString("owner@example.com")))
                .andExpect(content().string(containsString("123456")))
                .andExpect(content().string(containsString("BeautyLink")))
                .andRespond(withSuccess("{\"id\":\"email_123\"}", MediaType.APPLICATION_JSON));

        service("secret-resend-key").sendEmailCode("owner@example.com", "123456", 10);
        server.verify();
    }

    @Test
    void missingApiKeyFailsClosedBeforeNetworkCall() {
        ApiException error = assertThrows(ApiException.class,
                () -> service("").sendEmailCode("owner@example.com", "123456", 10));
        assertEquals("OTP_DELIVERY_UNAVAILABLE", error.getCode());
        server.verify();
    }

    @Test
    void mapsRateLimitAndProviderRejectionToSafeBusinessErrors() {
        server.expect(requestTo("https://api.resend.com/emails"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS)
                        .contentType(MediaType.APPLICATION_JSON).body("{\"message\":\"rate limited\"}"));
        ApiException limited = assertThrows(ApiException.class,
                () -> service("secret").sendEmailCode("owner@example.com", "123456", 10));
        assertEquals("OTP_PROVIDER_RATE_LIMITED", limited.getCode());
        server.verify();

        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.resend.com");
        server = MockRestServiceServer.bindTo(builder).build();
        client = builder.build();
        server.expect(requestTo("https://api.resend.com/emails"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.UNAUTHORIZED)
                        .contentType(MediaType.APPLICATION_JSON).body("{\"message\":\"invalid key\"}"));
        ApiException rejected = assertThrows(ApiException.class,
                () -> service("secret").sendEmailCode("owner@example.com", "123456", 10));
        assertEquals("OTP_DELIVERY_UNAVAILABLE", rejected.getCode());
        assertFalse(rejected.getMessage().contains("invalid key"));
        server.verify();

        builder = RestClient.builder().baseUrl("https://api.resend.com");
        server = MockRestServiceServer.bindTo(builder).build();
        client = builder.build();
        server.expect(requestTo("https://api.resend.com/emails"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.BAD_GATEWAY));
        ApiException unavailable = assertThrows(ApiException.class,
                () -> service("secret").sendEmailCode("owner@example.com", "123456", 10));
        assertEquals("OTP_DELIVERY_UNAVAILABLE", unavailable.getCode());
        server.verify();
    }

    @Test
    void networkFailureFailsClosedWithoutRetrying() {
        server.expect(once(), requestTo("https://api.resend.com/emails"))
                .andRespond(request -> { throw new ResourceAccessException("simulated timeout"); });
        ApiException timeout = assertThrows(ApiException.class,
                () -> service("secret").sendEmailCode("owner@example.com", "123456", 10));
        assertEquals("OTP_DELIVERY_UNAVAILABLE", timeout.getCode());
        server.verify();
    }

    private OtpDeliveryService service(String apiKey) {
        return new OtpDeliveryService(client, apiKey, "BeautyLink <otp@example.com>");
    }
}
