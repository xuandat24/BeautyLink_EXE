package com.example.backend.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Component
@ConditionalOnProperty(name = "app.security.rate-limit.backend", havingValue = "memory", matchIfMissing = true)
public class InMemoryRateLimitBackend implements RateLimitBackend {
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final AtomicLong operations = new AtomicLong();

    @Override
    public boolean consume(String key, int maxAttempts, long windowSeconds) {
        Instant now = Instant.now();
        boolean[] allowed = {true};
        windows.compute(key, (ignored, current) -> {
            Window active = current == null || !current.resetAt().isAfter(now)
                    ? new Window(0, now.plusSeconds(windowSeconds)) : current;
            if (active.attempts() >= maxAttempts) {
                allowed[0] = false;
                return active;
            }
            return new Window(active.attempts() + 1, active.resetAt());
        });
        if ((operations.incrementAndGet() & 255) == 0) {
            windows.entrySet().removeIf(entry -> !entry.getValue().resetAt().isAfter(now));
        }
        return allowed[0];
    }

    @Override public void clear(String key) { windows.remove(key); }
    private record Window(int attempts, Instant resetAt) {}
}
