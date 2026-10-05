package com.example.backend.service;

import com.example.backend.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;

@Service
public class AuthAbuseGuard {
    private final RateLimitBackend backend;
    private final int loginMaxPerIdentifier;
    private final int loginMaxPerIp;
    private final long loginWindowSeconds;
    private final int registrationMaxPerIp;
    private final long registrationWindowSeconds;
    private final int verificationMaxPerTarget;
    private final long verificationWindowSeconds;

    public AuthAbuseGuard(
            RateLimitBackend backend,
            @Value("${app.security.login.max-per-identifier:8}") int loginMaxPerIdentifier,
            @Value("${app.security.login.max-per-ip:20}") int loginMaxPerIp,
            @Value("${app.security.login.window-seconds:900}") long loginWindowSeconds,
            @Value("${app.security.registration.max-per-ip:5}") int registrationMaxPerIp,
            @Value("${app.security.registration.window-seconds:3600}") long registrationWindowSeconds,
            @Value("${app.security.verification.max-per-target:5}") int verificationMaxPerTarget,
            @Value("${app.security.verification.window-seconds:3600}") long verificationWindowSeconds) {
        this.backend = backend;
        this.loginMaxPerIdentifier = loginMaxPerIdentifier;
        this.loginMaxPerIp = loginMaxPerIp;
        this.loginWindowSeconds = loginWindowSeconds;
        this.registrationMaxPerIp = registrationMaxPerIp;
        this.registrationWindowSeconds = registrationWindowSeconds;
        this.verificationMaxPerTarget = verificationMaxPerTarget;
        this.verificationWindowSeconds = verificationWindowSeconds;
    }

    public void checkLogin(String remoteAddress, String identifier) {
        consume("login-ip:" + digest(safe(remoteAddress)), loginMaxPerIp, loginWindowSeconds);
        consume(loginIdentifierKey(identifier), loginMaxPerIdentifier, loginWindowSeconds);
    }

    public void loginSucceeded(String identifier) {
        backend.clear(loginIdentifierKey(identifier));
    }

    public void checkRegistration(String remoteAddress) {
        consume("registration-ip:" + digest(safe(remoteAddress)), registrationMaxPerIp, registrationWindowSeconds);
    }

    public void checkVerificationTarget(String phone, String email) {
        consume("verification-phone:" + digest(AuthService.normalizePhone(phone)), verificationMaxPerTarget, verificationWindowSeconds);
        if (email != null && !email.isBlank()) {
            consume("verification-email:" + digest(email.trim().toLowerCase(Locale.ROOT)), verificationMaxPerTarget, verificationWindowSeconds);
        }
    }

    public void checkVerificationAttempt(String remoteAddress, String challengeId) {
        consume("verification-ip:" + digest(safe(remoteAddress)), loginMaxPerIp, loginWindowSeconds);
        consume("verification-challenge:" + digest(safe(challengeId)), loginMaxPerIdentifier, loginWindowSeconds);
    }

    private String loginIdentifierKey(String identifier) {
        String raw = safe(identifier).trim().toLowerCase(Locale.ROOT);
        String normalized = raw.contains("@") ? raw : AuthService.normalizePhone(raw);
        return "login-id:" + digest(normalized);
    }

    private void consume(String key, int maxAttempts, long windowSeconds) {
        if (!backend.consume(key, maxAttempts, windowSeconds)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Bạn đã thử quá nhiều lần. Vui lòng đợi rồi thử lại");
        }
    }

    private String digest(String value) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(bytes, 0, 16);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is required", ex);
        }
    }

    private String safe(String value) {
        return value == null ? "unknown" : value;
    }
}
