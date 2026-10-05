package com.example.backend.service;

import com.example.backend.exception.ApiException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConditionalOnProperty(name = "app.security.rate-limit.backend", havingValue = "redis")
public class RedisRateLimitBackend implements RateLimitBackend {
    private static final DefaultRedisScript<Long> CONSUME = new DefaultRedisScript<>("""
            local current = redis.call('INCR', KEYS[1])
            if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
            return current
            """, Long.class);
    private final StringRedisTemplate redis;

    public RedisRateLimitBackend(StringRedisTemplate redis) { this.redis = redis; }

    @Override
    public boolean consume(String key, int maxAttempts, long windowSeconds) {
        try {
            Long count = redis.execute(CONSUME, List.of("beautylink:rate:" + key), Long.toString(windowSeconds));
            if (count == null) throw unavailable();
            return count <= maxAttempts;
        } catch (DataAccessException ex) {
            throw unavailable();
        }
    }

    @Override
    public void clear(String key) {
        try {
            redis.delete("beautylink:rate:" + key);
        } catch (DataAccessException ex) {
            throw unavailable();
        }
    }

    private ApiException unavailable() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "RATE_LIMIT_UNAVAILABLE", "Hệ thống bảo vệ đăng nhập tạm thời không khả dụng. Vui lòng thử lại sau");
    }
}
