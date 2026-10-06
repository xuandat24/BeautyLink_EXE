package com.example.backend;

import com.example.backend.service.RedisRateLimitBackend;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RedisRateLimitBackendTest {
    @Test
    void redisFailureUsesBoundedInMemoryFallback() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        when(redis.execute(any(), anyList(), any())).thenThrow(new DataAccessResourceFailureException("offline"));
        RedisRateLimitBackend backend = new RedisRateLimitBackend(redis);

        assertTrue(backend.consume("login:test", 2, 60));
        assertTrue(backend.consume("login:test", 2, 60));
        assertFalse(backend.consume("login:test", 2, 60));
        backend.clear("login:test");
        assertTrue(backend.consume("login:test", 2, 60));
    }
}
