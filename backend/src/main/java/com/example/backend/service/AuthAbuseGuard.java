package com.example.backend.service;

import com.example.backend.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class AuthAbuseGuard {
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final AtomicLong operations = new AtomicLong();
    private final Clock clock = Clock.systemUTC();
    private final int loginMaxPerIdentifier;
    private final int loginMaxPerIp;
    private final long loginWindowSeconds;
    private final int registrationMaxPerIp;
    private final long registrationWindowSeconds;

    public AuthAbuseGuard(
            @Value("${app.security.login.max-per-identifier:8}") int loginMaxPerIdentifier,
            @Value("${app.security.login.max-per-ip:20}") int loginMaxPerIp,
            @Value("${app.security.login.window-seconds:900}") long loginWindowSeconds,
            @Value("${app.security.registration.max-per-ip:5}") int registrationMaxPerIp,
            @Value("${app.security.registration.window-seconds:3600}") long registrationWindowSeconds) {
        this.loginMaxPerIdentifier = loginMaxPerIdentifier;
        this.loginMaxPerIp = loginMaxPerIp;
        this.loginWindowSeconds = loginWindowSeconds;
        this.registrationMaxPerIp = registrationMaxPerIp;
        this.registrationWindowSeconds = registrationWindowSeconds;
    }

    public void checkLogin(String remoteAddress, String identifier) {
        consume("login-ip:" + digest(safe(remoteAddress)), loginMaxPerIp, loginWindowSeconds);
        consume(loginIdentifierKey(identifier), loginMaxPerIdentifier, loginWindowSeconds);
    }

    public void loginSucceeded(String identifier) {
        windows.remove(loginIdentifierKey(identifier));
    }

    public void checkRegistration(String remoteAddress) {
        consume("registration-ip:" + digest(safe(remoteAddress)), registrationMaxPerIp, registrationWindowSeconds);
    }

    private String loginIdentifierKey(String identifier) {
        String raw = safe(identifier).trim().toLowerCase(Locale.ROOT);
        String normalized = raw.contains("@") ? raw : AuthService.normalizePhone(raw);
        return "login-id:" + digest(normalized);
    }

    private void consume(String key, int maxAttempts, long windowSeconds) {
        Instant now = clock.instant();
        AtomicBoolean blocked = new AtomicBoolean(false);
        windows.compute(key, (ignored, current) -> {
            Window active = current == null || !current.resetAt().isAfter(now)
                    ? new Window(0, now.plusSeconds(windowSeconds))
                    : current;
            if (active.attempts() >= maxAttempts) {
                blocked.set(true);
                return active;
            }
            return new Window(active.attempts() + 1, active.resetAt());
        });
        if ((operations.incrementAndGet() & 255) == 0) {
            windows.entrySet().removeIf(entry -> !entry.getValue().resetAt().isAfter(now));
        }
        if (blocked.get()) {
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

    private record Window(int attempts, Instant resetAt) {}
}
