package com.example.backend.auth;

import com.example.backend.model.AuthenticationSession;
import com.example.backend.repository.AuthenticationSessionRepository;
import io.jsonwebtoken.JwtException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;

@Service
public class AuthenticationSessions {
    public static final Duration IDLE = Duration.ofMinutes(10);
    public static final long MAX_ABSOLUTE_MS = 3_600_000;
    private final AuthenticationSessionRepository sessions;
    private final Clock clock;
    @Autowired public AuthenticationSessions(AuthenticationSessionRepository sessions) { this(sessions, Clock.systemUTC()); }
    public AuthenticationSessions(AuthenticationSessionRepository sessions, Clock clock) { this.sessions = sessions; this.clock = clock; }
    @Transactional public AuthenticationSession open(Long accountId, long ttlMs) {
        Instant now = clock.instant();
        return sessions.save(new AuthenticationSession(accountId, now, now.plusMillis(Math.min(MAX_ABSOLUTE_MS, ttlMs))));
    }
    @Transactional(readOnly = true) public AuthenticationSession require(String id, Long accountId) {
        if (id == null) throw new JwtException("Missing authentication session");
        return eligible(sessions.findById(id).orElseThrow(() -> new JwtException("Unknown authentication session")), accountId);
    }
    @Transactional public AuthenticationSession activity(String id, Long accountId) {
        AuthenticationSession session = eligible(sessions.findLockedById(id)
                .orElseThrow(() -> new JwtException("Unknown authentication session")), accountId);
        session.touch(clock.instant());
        return session;
    }
    @Transactional public void revoke(String id, Long accountId) {
        sessions.findLockedById(id).filter(s -> s.getAccountId().equals(accountId)).ifPresent(AuthenticationSession::revoke);
    }
    private AuthenticationSession eligible(AuthenticationSession session, Long accountId) {
        Instant now = clock.instant();
        if (!session.getAccountId().equals(accountId) || session.isRevoked()
                || !now.isBefore(session.getExpiresAt()) || !now.isBefore(session.getLastActivityAt().plus(IDLE))) {
            throw new JwtException("Authentication session expired or revoked");
        }
        return session;
    }
    public Instant now() { return clock.instant(); }
}
