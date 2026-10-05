package com.example.backend;

import com.example.backend.exception.ApiException;
import com.example.backend.service.RedisRateLimitBackend;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RedisRateLimitBackendTest {
    @Test
    void redisFailureFailsClosed() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        when(redis.execute(any(), anyList(), any())).thenThrow(new DataAccessResourceFailureException("offline"));
        RedisRateLimitBackend backend = new RedisRateLimitBackend(redis);

        ApiException exception = assertThrows(ApiException.class, () -> backend.consume("login:test", 5, 60));

        assertEquals("RATE_LIMIT_UNAVAILABLE", exception.getCode());
    }
}
