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
import com.example.backend.model.AuthenticationSession;
import org.springframework.security.core.context.SecurityContextHolder;

@Service
public class JwtService {
    public static final String ACCOUNT_SUBJECT_PREFIX = "account:";
    private final SecretKey key;
    private final long expirationMs;
    private final AuthenticationSessions sessions;
    public JwtService(@Value("${app.jwt.secret}") String secret, @Value("${app.jwt.expiration-ms}") long expirationMs, AuthenticationSessions sessions) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = Math.min(expirationMs, AuthenticationSessions.MAX_ABSOLUTE_MS);
        this.sessions = sessions;
    }
    public String createToken(UserAccount user) {
        return token(user, sessions.open(user.getId(), expirationMs));
    }
    public String replaceToken(UserAccount user) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getDetails() instanceof SessionIdentity identity)) {
            throw new JwtException("Missing authenticated session");
        }
        return token(user, sessions.require(identity.id(), user.getId()));
    }
    private String token(UserAccount user, AuthenticationSession session) {
        Instant now = sessions.now();
        return Jwts.builder().subject(ACCOUNT_SUBJECT_PREFIX + user.getId()).claim("role", user.getRole().name())
                .claim("accountId", user.getId())
                .claim("identityVersion", 2)
                .claim("accountUpdatedAt", user.getUpdatedAt().toEpochMilli())
                .claim("authVersion", user.getAuthVersion())
                .claim("sid", session.getId())
                .issuedAt(Date.from(now)).expiration(Date.from(session.getExpiresAt()))
                .signWith(key).compact();
    }
    public String extractSubject(String token) {
        return extractClaims(token).getSubject();
    }
    public Claims extractClaims(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }
    public boolean matchesAccount(Claims claims, UserAccount user) {
        String subject = claims.getSubject();
        boolean accountSubject = (ACCOUNT_SUBJECT_PREFIX + user.getId()).equals(subject);
        boolean legacyPhoneSubject = user.getPhone() != null && user.getPhone().equals(subject);
        if (!accountSubject && !legacyPhoneSubject) return false;
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
        return legacyPhoneSubject && issuedAt != null && issuedAt.toInstant().isAfter(user.getCreatedAt())
                && issuedAt.toInstant().isAfter(user.getUpdatedAt());
    }
    public long getExpirationMs() { return expirationMs; }
    public record SessionIdentity(String id) {}
}
