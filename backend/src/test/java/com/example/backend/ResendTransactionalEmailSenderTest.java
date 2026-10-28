package com.example.backend;

import com.example.backend.service.ResendTransactionalEmailSender;
import com.example.backend.service.TransactionalEmailSender;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
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

class ResendTransactionalEmailSenderTest {
    private MockRestServiceServer server;
    private ResendTransactionalEmailSender sender;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.resend.com");
        server = MockRestServiceServer.bindTo(builder).build();
        sender = new ResendTransactionalEmailSender(builder.build(), "resend-secret");
    }

    @Test
    void sendsMultipartContentWithStableProviderIdempotencyKey() {
        server.expect(once(), requestTo("https://api.resend.com/emails"))
                .andExpect(method(POST))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer resend-secret"))
                .andExpect(header("Idempotency-Key", "booking-42-customer"))
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.from").value("BeautyLink <no-reply@beautylink.cloud>"))
                .andExpect(jsonPath("$.to[0]").value("customer@example.com"))
                .andExpect(jsonPath("$.reply_to").value("support@beautylink.cloud"))
                .andExpect(jsonPath("$.text").value(containsString("plain confirmation")))
                .andExpect(jsonPath("$.html").value(containsString("<strong>confirmation</strong>")))
                .andRespond(withSuccess("{\"id\":\"resend-message-42\"}", MediaType.APPLICATION_JSON));

        var receipt = sender.send(message());

        assertEquals("resend-message-42", receipt.providerMessageId());
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(ints = {408, 409, 425, 429, 500, 503})
    void retryableProviderResponsesAreClassifiedAsTransient(int status) {
        server.expect(once(), requestTo("https://api.resend.com/emails"))
                .andRespond(withStatus(HttpStatus.valueOf(status)));

        var failure = assertThrows(TransactionalEmailSender.EmailDeliveryException.class,
                () -> sender.send(message()));

        assertEquals(TransactionalEmailSender.FailureKind.TRANSIENT, failure.getKind());
        assertEquals(status == 429 ? "EMAIL_PROVIDER_RATE_LIMITED" : "EMAIL_PROVIDER_UNAVAILABLE",
                failure.getSafeCode());
        server.verify();
    }

    @Test
    void invalidRecipientResponseIsPermanent() {
        server.expect(once(), requestTo("https://api.resend.com/emails"))
                .andRespond(withStatus(HttpStatus.UNPROCESSABLE_ENTITY));

        var failure = assertThrows(TransactionalEmailSender.EmailDeliveryException.class,
                () -> sender.send(message()));

        assertEquals(TransactionalEmailSender.FailureKind.PERMANENT, failure.getKind());
        assertEquals("EMAIL_PROVIDER_REJECTED", failure.getSafeCode());
        server.verify();
    }

    @Test
    void timeoutIsAmbiguousSoRetryCanReuseTheSameIdempotencyKey() {
        server.expect(once(), requestTo("https://api.resend.com/emails"))
                .andRespond(request -> { throw new ResourceAccessException("simulated timeout"); });

        var failure = assertThrows(TransactionalEmailSender.EmailDeliveryException.class,
                () -> sender.send(message()));

        assertEquals(TransactionalEmailSender.FailureKind.AMBIGUOUS, failure.getKind());
        assertEquals("EMAIL_PROVIDER_RESULT_AMBIGUOUS", failure.getSafeCode());
        server.verify();
    }

    @Test
    void successWithoutProviderMessageIdIsAmbiguous() {
        server.expect(once(), requestTo("https://api.resend.com/emails"))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        var failure = assertThrows(TransactionalEmailSender.EmailDeliveryException.class,
                () -> sender.send(message()));

        assertEquals(TransactionalEmailSender.FailureKind.AMBIGUOUS, failure.getKind());
        assertEquals("EMAIL_PROVIDER_ACK_MISSING", failure.getSafeCode());
        server.verify();
    }

    private TransactionalEmailSender.EmailMessage message() {
        return new TransactionalEmailSender.EmailMessage(
                "BeautyLink <no-reply@beautylink.cloud>",
                "support@beautylink.cloud",
                "customer@example.com",
                "Booking confirmed",
                "plain confirmation",
                "<strong>confirmation</strong>",
                "booking-42-customer");
    }

    @Test void remindersNeverFallBackToUnboundedNonIdempotentSmtpOrSendWithoutAKey() {
        try (var unconfigured = new ResendTransactionalEmailSender(RestClient.builder().build(), "")) {
            var error = assertThrows(TransactionalEmailSender.EmailDeliveryException.class, () -> unconfigured.sendReminder(message()));
            assertEquals(TransactionalEmailSender.FailureKind.PERMANENT, error.getKind());
            assertEquals("EMAIL_REMINDER_RESEND_REQUIRED", error.getSafeCode());
        }
        var missing = new TransactionalEmailSender.EmailMessage("from@example.test", "", "to@example.test", "test", "test", "test", "");
        assertEquals("EMAIL_REMINDER_IDEMPOTENCY_REQUIRED", assertThrows(TransactionalEmailSender.EmailDeliveryException.class, () -> sender.sendReminder(missing)).getSafeCode());
        server.verify();
    }
}
