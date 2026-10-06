package com.example.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.InetAddress;
import java.net.URI;
import java.util.Locale;

/** Prevents a partially configured production merchant from silently using sandbox/local endpoints. */
@Component
@Profile("prod")
public class VnPayProductionConfigurationValidator implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(VnPayProductionConfigurationValidator.class);
    private final String tmnCode;
    private final String hashSecret;
    private final String payUrl;
    private final String returnUrl;
    private final String queryUrl;
    private final String serverIp;
    private final String frontendUrl;

    public VnPayProductionConfigurationValidator(
            @Value("${app.vnpay.tmn-code:}") String tmnCode,
            @Value("${app.vnpay.hash-secret:}") String hashSecret,
            @Value("${app.vnpay.pay-url:}") String payUrl,
            @Value("${app.vnpay.return-url:}") String returnUrl,
            @Value("${app.vnpay.query-url:}") String queryUrl,
            @Value("${app.vnpay.server-ip:}") String serverIp,
            @Value("${app.frontend-url:}") String frontendUrl) {
        this.tmnCode = tmnCode;
        this.hashSecret = hashSecret;
        this.payUrl = payUrl;
        this.returnUrl = returnUrl;
        this.queryUrl = queryUrl;
        this.serverIp = serverIp;
        this.frontendUrl = frontendUrl;
    }

    @Override
    public void run(ApplicationArguments args) {
        boolean hasCode = StringUtils.hasText(tmnCode);
        boolean hasSecret = StringUtils.hasText(hashSecret);
        if (!hasCode && !hasSecret) {
            log.warn("VNPAY production merchant is disabled because credentials are not configured");
            return;
        }
        require(hasCode && hasSecret, "VNPAY_TMN_CODE and VNPAY_HASH_SECRET must be configured together");
        require(tmnCode.matches("^[A-Za-z0-9]{8}$"), "VNPAY_TMN_CODE must be 8 alphanumeric characters");
        require(hashSecret.length() >= 16, "VNPAY_HASH_SECRET is unexpectedly short");
        requireProductionHttps(payUrl, "VNPAY_PAY_URL");
        requireProductionHttps(queryUrl, "VNPAY_QUERY_URL");
        requireProductionHttps(returnUrl, "VNPAY_RETURN_URL");
        require(returnUrl.endsWith("/api/v1/payments/vnpay/return"),
                "VNPAY_RETURN_URL must target the backend VNPAY return endpoint");
        requireProductionHttps(frontendUrl, "FRONTEND_URL");
        requirePublicIp(serverIp, "VNPAY_SERVER_IP must be a public server IP literal agreed with VNPAY");
        log.info("VNPAY production configuration validated without exposing merchant credentials");
    }

    private void requireProductionHttps(String value, String name) {
        try {
            URI uri = URI.create(value);
            String host = uri.getHost();
            require("https".equalsIgnoreCase(uri.getScheme()) && StringUtils.hasText(host), name + " must be an absolute HTTPS URL");
            String normalizedHost = host.toLowerCase(Locale.ROOT);
            require(!normalizedHost.contains("sandbox") && !"localhost".equals(normalizedHost)
                    && !normalizedHost.startsWith("127."), name + " cannot use a sandbox or local endpoint in production");
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException(name + " is not a valid production URL");
        }
    }

    private void requirePublicIp(String value, String message) {
        String literal = ClientIpResolver.normalizeLiteral(value);
        require(literal != null, message);
        try {
            InetAddress address = InetAddress.getByName(literal);
            require(!address.isAnyLocalAddress() && !address.isLoopbackAddress() && !address.isLinkLocalAddress()
                    && !address.isSiteLocalAddress() && !address.isMulticastAddress(), message);
        } catch (Exception exception) {
            throw new IllegalStateException(message);
        }
    }

    private void require(boolean condition, String message) {
        if (!condition) throw new IllegalStateException("Unsafe VNPAY production configuration: " + message);
    }
}
