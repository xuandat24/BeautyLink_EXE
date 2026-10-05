package com.example.backend.service;

public interface RateLimitBackend {
    boolean consume(String key, int maxAttempts, long windowSeconds);
    void clear(String key);
}
