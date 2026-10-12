package com.example.backend;

import com.example.backend.exception.ApiException;
import com.example.backend.service.OtpDeliveryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
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
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.from").value("BeautyLink <no-reply@beautylink.cloud>"))
                .andExpect(jsonPath("$.to[0]").value("owner@example.com"))
                .andExpect(jsonPath("$.subject").value("Mã xác minh đăng ký BeautyLink"))
                .andExpect(content().string(containsString("Không chia sẻ mã")))
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
    void missingSenderFailsClosedBeforeNetworkCall() {
        ApiException error = assertThrows(ApiException.class, () ->
                new OtpDeliveryService(client, "secret", " ").sendEmailCode("owner@example.com", "123456", 10));
        assertEquals("OTP_DELIVERY_UNAVAILABLE", error.getCode());
        assertEquals(503, error.getStatus().value());
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(ints = {400, 401, 403, 422, 429, 500, 502, 503, 504})
    void allProviderErrorsAreSafeAndNotRetried(int status) {
        server.expect(once(), requestTo("https://api.resend.com/emails"))
                .andRespond(withStatus(HttpStatus.valueOf(status)).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"message\":\"sensitive-provider-detail\"}"));
        ApiException error = assertThrows(ApiException.class, () ->
                service("secret").sendEmailCode("owner@example.com", "123456", 10));
        assertEquals(status == 429 ? "OTP_PROVIDER_RATE_LIMITED" : "OTP_DELIVERY_UNAVAILABLE", error.getCode());
        assertEquals(503, error.getStatus().value());
        assertFalse(error.getMessage().contains("sensitive-provider-detail"));
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"id\":\" \"}", "null", "invalid-json"})
    void successWithoutValidProviderIdIsNotReportedAsSent(String response) {
        server.expect(once(), requestTo("https://api.resend.com/emails"))
                .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));
        ApiException error = assertThrows(ApiException.class, () ->
                service("secret").sendEmailCode("owner@example.com", "123456", 10));
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
        return new OtpDeliveryService(client, apiKey, "BeautyLink <no-reply@beautylink.cloud>");
    }
}
