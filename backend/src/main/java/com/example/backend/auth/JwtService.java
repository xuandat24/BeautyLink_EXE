package com.example.backend.auth;

import com.example.backend.model.UserAccount;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

@Service
public class JwtService {
    private final SecretKey key;
    private final long expirationMs;
    public JwtService(@Value("${app.jwt.secret}") String secret, @Value("${app.jwt.expiration-ms}") long expirationMs) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }
    public String createToken(UserAccount user) {
        Instant now = Instant.now();
        return Jwts.builder().subject(user.getPhone()).claim("role", user.getRole().name())
                .claim("accountId", user.getId())
                .claim("accountUpdatedAt", user.getUpdatedAt().toEpochMilli())
                .claim("authVersion", user.getAuthVersion())
                .issuedAt(Date.from(now)).expiration(Date.from(now.plusMillis(expirationMs)))
                .signWith(key).compact();
    }
    public String extractSubject(String token) {
        return extractClaims(token).getSubject();
    }
    public Claims extractClaims(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }
    public boolean matchesAccount(Claims claims, UserAccount user) {
        if (!user.getPhone().equals(claims.getSubject())) return false;
        if (claims.containsKey("accountId") || claims.containsKey("accountUpdatedAt")) {
            Long accountId = claims.get("accountId", Long.class);
            Long updatedAt = claims.get("accountUpdatedAt", Long.class);
            if (!user.getId().equals(accountId) || updatedAt == null
                    || updatedAt != user.getUpdatedAt().toEpochMilli()) return false;
            Number authVersion = claims.get("authVersion", Number.class);
            return authVersion == null || authVersion.intValue() == user.getAuthVersion();
        }
        // Legacy tokens have only a phone subject. Accept them only when the
        // persisted identity predates issuance; a phone reassignment updates it.
        // JWT iat has second precision, so equality is rejected conservatively.
        Date issuedAt = claims.getIssuedAt();
        return issuedAt != null && issuedAt.toInstant().isAfter(user.getCreatedAt())
                && issuedAt.toInstant().isAfter(user.getUpdatedAt());
    }
    public long getExpirationMs() { return expirationMs; }
}
