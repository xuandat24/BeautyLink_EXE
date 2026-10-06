package com.example.backend.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

@Component
@ConditionalOnProperty(name = "app.security.rate-limit.backend", havingValue = "redis")
public class RedisRateLimitBackend implements RateLimitBackend {
    private static final Logger log = LoggerFactory.getLogger(RedisRateLimitBackend.class);
    private static final DefaultRedisScript<Long> CONSUME = new DefaultRedisScript<>("""
            local current = redis.call('INCR', KEYS[1])
            if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
            return current
            """, Long.class);
    private final StringRedisTemplate redis;
    // Keeps authentication available on a single instance while a managed Redis
    // service is being repaired. A configured Redis backend remains preferred
    // whenever it is reachable.
    private final InMemoryRateLimitBackend fallback = new InMemoryRateLimitBackend();

    public RedisRateLimitBackend(StringRedisTemplate redis) { this.redis = redis; }

    @Override
    public boolean consume(String key, int maxAttempts, long windowSeconds) {
        try {
            Long count = redis.execute(CONSUME, List.of("beautylink:rate:" + key), Long.toString(windowSeconds));
            if (count == null) return consumeWithFallback(key, maxAttempts, windowSeconds, "empty Redis response");
            return count <= maxAttempts;
        } catch (DataAccessException ex) {
            return consumeWithFallback(key, maxAttempts, windowSeconds, ex.getClass().getSimpleName());
        }
    }

    @Override
    public void clear(String key) {
        try {
            redis.delete("beautylink:rate:" + key);
        } catch (DataAccessException ex) {
            log.warn("Redis rate limiter unavailable; cleared local fallback key instead ({})", ex.getClass().getSimpleName());
        }
        fallback.clear(key);
    }

    private boolean consumeWithFallback(String key, int maxAttempts, long windowSeconds, String reason) {
        log.warn("Redis rate limiter unavailable; applying bounded single-instance fallback ({})", reason);
        return fallback.consume(key, maxAttempts, windowSeconds);
    }
}
