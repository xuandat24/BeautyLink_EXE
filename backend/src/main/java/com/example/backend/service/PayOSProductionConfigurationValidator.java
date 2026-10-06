package com.example.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.URI;

/** Fails production startup before traffic is accepted when live PayOS settings are unsafe or incomplete. */
@Component
@Profile("prod")
public class PayOSProductionConfigurationValidator implements ApplicationRunner {
    private final String clientId;
    private final String apiKey;
    private final String checksumKey;
    private final String returnUrl;
    private final String cancelUrl;
    private final String webhookUrl;

    public PayOSProductionConfigurationValidator(
            @Value("${app.payos.client-id:}") String clientId,
            @Value("${app.payos.api-key:}") String apiKey,
            @Value("${app.payos.checksum-key:}") String checksumKey,
            @Value("${app.payos.return-url:}") String returnUrl,
            @Value("${app.payos.cancel-url:}") String cancelUrl,
            @Value("${app.payos.webhook-url:}") String webhookUrl) {
        this.clientId = clientId;
        this.apiKey = apiKey;
        this.checksumKey = checksumKey;
        this.returnUrl = returnUrl;
        this.cancelUrl = cancelUrl;
        this.webhookUrl = webhookUrl;
    }

    @Override
    public void run(ApplicationArguments args) {
        int credentials = present(clientId) + present(apiKey) + present(checksumKey);
        if (credentials == 0) return;
        if (credentials != 3) {
            throw new IllegalStateException("PayOS production credentials are incomplete");
        }
        requirePublicHttps("PAYOS_RETURN_URL", returnUrl);
        requirePublicHttps("PAYOS_CANCEL_URL", cancelUrl);
        requirePublicHttps("PAYOS_WEBHOOK_URL", webhookUrl);
        if (!URI.create(webhookUrl).getPath().equals("/api/v1/payments/payos/webhook")) {
            throw new IllegalStateException("PAYOS_WEBHOOK_URL must target /api/v1/payments/payos/webhook");
        }
    }

    private int present(String value) { return StringUtils.hasText(value) ? 1 : 0; }

    private void requirePublicHttps(String name, String value) {
        if (!StringUtils.hasText(value)) throw new IllegalStateException(name + " is required when PayOS is enabled");
        URI uri;
        try { uri = URI.create(value); }
        catch (IllegalArgumentException exception) { throw new IllegalStateException(name + " must be a valid HTTPS URL"); }
        String host = uri.getHost();
        if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || host.isBlank()
                || "localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host) || "::1".equals(host)) {
            throw new IllegalStateException(name + " must be a public HTTPS URL");
        }
    }
}
