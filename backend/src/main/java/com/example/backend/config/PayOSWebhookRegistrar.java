package com.example.backend.config;

import com.example.backend.exception.ApiException;
import com.example.backend.service.PayOSGateway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vn.payos.model.webhooks.ConfirmWebhookResponse;

@Component
public class PayOSWebhookRegistrar implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(PayOSWebhookRegistrar.class);
    private final PayOSGateway gateway;
    private final String webhookUrl;

    public PayOSWebhookRegistrar(PayOSGateway gateway, @Value("${app.payos.webhook-url:}") String webhookUrl) {
        this.gateway = gateway;
        this.webhookUrl = webhookUrl;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!gateway.isConfigured()) {
            log.warn("PayOS channel is not configured; webhook registration skipped");
            return;
        }
        if (!StringUtils.hasText(webhookUrl)) {
            log.warn("PAYOS_WEBHOOK_URL is empty; PayOS webhook registration skipped");
            return;
        }
        try {
            ConfirmWebhookResponse response = gateway.confirmWebhook(webhookUrl);
            log.info("PayOS webhook registered url={} bank={} shortName={}", response.getWebhookUrl(), response.getName(), response.getShortName());
        } catch (ApiException ex) {
            log.error("PayOS webhook registration failed code={} message={}", ex.getCode(), ex.getMessage());
        } catch (RuntimeException ex) {
            log.error("PayOS webhook registration failed unexpectedly type={} message={}",
                    ex.getClass().getName(), ex.getMessage(), ex);
        }
    }
}
