package com.example.backend.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static com.example.backend.service.TransactionalEmailSender.FailureKind.*;

@Service
public class ResendTransactionalEmailSender implements TransactionalEmailSender, AutoCloseable {
    private static final Logger log = LoggerFactory.getLogger(ResendTransactionalEmailSender.class);
    private final RestClient resendClient;
    private final ClientResources resources;
    private final String resendApiKey;
    private final String mailHost;
    private final ObjectProvider<JavaMailSender> mailSender;

    @Autowired
    public ResendTransactionalEmailSender(
            @Value("${app.otp.resend.api-key:}") String resendApiKey,
            @Value("${app.otp.resend.connect-timeout-ms:5000}") long connectTimeoutMs,
            @Value("${app.otp.resend.read-timeout-ms:10000}") long readTimeoutMs,
            @Value("${spring.mail.host:}") String mailHost,
            ObjectProvider<JavaMailSender> mailSender) {
        this(buildClient(connectTimeoutMs, readTimeoutMs), resendApiKey, mailHost, mailSender);
    }

    public ResendTransactionalEmailSender(RestClient resendClient, String resendApiKey) {
        this(new ClientResources(resendClient, null), resendApiKey, "", null);
    }

    private ResendTransactionalEmailSender(ClientResources resources, String resendApiKey, String mailHost,
            ObjectProvider<JavaMailSender> mailSender) {
        this.resources = resources;
        this.resendClient = resources.client();
        this.resendApiKey = normalize(resendApiKey);
        this.mailHost = normalize(mailHost);
        this.mailSender = mailSender;
    }

    @Override
    public DeliveryReceipt send(EmailMessage message) {
        if (!StringUtils.hasText(message.from()) || !StringUtils.hasText(message.to())) {
            throw failure(PERMANENT, "EMAIL_ADDRESS_MISSING");
        }
        if (StringUtils.hasText(resendApiKey)) return sendWithResend(message);
        if (isSmtpConfigured()) return sendWithSmtp(message);
        throw failure(PERMANENT, "EMAIL_TRANSPORT_NOT_CONFIGURED");
    }

    @Override
    public DeliveryReceipt sendReminder(EmailMessage message) {
        // SMTP fallback has neither this HTTP deadline nor this provider idempotency contract.
        if (!StringUtils.hasText(resendApiKey)) throw failure(PERMANENT, "EMAIL_REMINDER_RESEND_REQUIRED");
        if (!StringUtils.hasText(message.idempotencyKey())) throw failure(PERMANENT, "EMAIL_REMINDER_IDEMPOTENCY_REQUIRED");
        return send(message);
    }

    @Override
    public boolean isConfigured() {
        return StringUtils.hasText(resendApiKey) || isSmtpConfigured();
    }

    private DeliveryReceipt sendWithResend(EmailMessage message) {
        try {
            ResendEmailResponse response = resendClient.post()
                    .uri("/emails")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + resendApiKey)
                    .headers(headers -> {
                        if (StringUtils.hasText(message.idempotencyKey())) {
                            headers.set("Idempotency-Key", message.idempotencyKey());
                        }
                    })
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new ResendEmailRequest(message.from(), List.of(message.to()), message.subject(),
                            message.htmlBody(), message.textBody(), blankToNull(message.replyTo())))
                    .retrieve()
                    .body(ResendEmailResponse.class);
            if (response == null || !StringUtils.hasText(response.id())) {
                throw failure(AMBIGUOUS, "EMAIL_PROVIDER_ACK_MISSING");
            }
            return new DeliveryReceipt(response.id());
        } catch (EmailDeliveryException exception) {
            throw exception;
        } catch (RestClientResponseException exception) {
            int status = exception.getStatusCode().value();
            log.warn("Resend rejected transactional email status={}", status);
            if (status == 408 || status == 409 || status == 425 || status == 429 || status >= 500) {
                throw failure(TRANSIENT, status == 429 ? "EMAIL_PROVIDER_RATE_LIMITED" : "EMAIL_PROVIDER_UNAVAILABLE");
            }
            throw failure(PERMANENT, "EMAIL_PROVIDER_REJECTED");
        } catch (ResourceAccessException exception) {
            log.warn("Resend transactional email result is ambiguous type={}", exception.getClass().getSimpleName());
            throw failure(AMBIGUOUS, "EMAIL_PROVIDER_RESULT_AMBIGUOUS");
        } catch (RuntimeException exception) {
            log.warn("Transactional email failed unexpectedly type={}", exception.getClass().getSimpleName());
            throw failure(TRANSIENT, "EMAIL_PROVIDER_UNAVAILABLE");
        }
    }

    private DeliveryReceipt sendWithSmtp(EmailMessage message) {
        try {
            JavaMailSender sender = mailSender.getIfAvailable();
            MimeMessage mimeMessage = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, false, StandardCharsets.UTF_8.name());
            helper.setFrom(message.from());
            helper.setTo(message.to());
            if (StringUtils.hasText(message.replyTo())) helper.setReplyTo(message.replyTo());
            helper.setSubject(message.subject());
            helper.setText(message.textBody(), message.htmlBody());
            sender.send(mimeMessage);
            return new DeliveryReceipt("smtp-accepted");
        } catch (Exception exception) {
            log.warn("SMTP transactional email result is ambiguous type={}", exception.getClass().getSimpleName());
            throw failure(AMBIGUOUS, "EMAIL_SMTP_RESULT_AMBIGUOUS");
        }
    }

    private boolean isSmtpConfigured() {
        return mailSender != null && mailSender.getIfAvailable() != null && StringUtils.hasText(mailHost);
    }

    static ClientResources buildClient(long connectTimeoutMs, long readTimeoutMs) {
        var transport = new BoundedResendRequestFactory(connectTimeoutMs, readTimeoutMs);
        return new ClientResources(RestClient.builder().baseUrl("https://api.resend.com").requestFactory(transport).build(), transport);
    }
    record ClientResources(RestClient client, BoundedResendRequestFactory transport) implements AutoCloseable {
        @Override public void close() { if (transport != null) transport.close(); }
    }
    @jakarta.annotation.PreDestroy @Override public void close() { resources.close(); }

    private static EmailDeliveryException failure(FailureKind kind, String code) {
        return new EmailDeliveryException(kind, code);
    }

    private static String normalize(String value) { return value == null ? "" : value.trim(); }
    private static String blankToNull(String value) { return StringUtils.hasText(value) ? value.trim() : null; }

    private record ResendEmailRequest(String from, List<String> to, String subject, String html, String text,
                                      @JsonProperty("reply_to") String replyTo) {}
    private record ResendEmailResponse(String id) {}
}
