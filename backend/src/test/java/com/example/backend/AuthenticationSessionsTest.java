package com.example.backend;

import com.example.backend.auth.AuthenticationSessions;
import com.example.backend.model.AuthenticationSession;
import com.example.backend.repository.AuthenticationSessionRepository;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthenticationSessionsTest {
    private final Instant start = Instant.parse("2026-10-24T00:00:00Z");
    private final Clock clock = mock(Clock.class);
    private final AuthenticationSessionRepository repository = mock(AuthenticationSessionRepository.class);
    private final AuthenticationSessions sessions = new AuthenticationSessions(repository, clock);
    private AuthenticationSession session;
    @BeforeEach void setup() {
        when(clock.instant()).thenReturn(start);
        when(repository.save(any())).thenAnswer(call -> call.getArgument(0));
        session = sessions.open(42L, 86_400_000);
        when(repository.findById(session.getId())).thenReturn(Optional.of(session));
        when(repository.findLockedById(session.getId())).thenReturn(Optional.of(session));
    }
    @Test void ordinaryReadsDoNotRenewAndExactTenMinutesIsExpired() {
        when(clock.instant()).thenReturn(start.plusSeconds(599));
        assertSame(session, sessions.require(session.getId(), 42L));
        assertEquals(start, session.getLastActivityAt());
        when(clock.instant()).thenReturn(start.plusSeconds(600));
        assertThrows(JwtException.class, () -> sessions.require(session.getId(), 42L));
        assertThrows(JwtException.class, () -> sessions.activity(session.getId(), 42L));
        assertEquals(start, session.getLastActivityAt());
    }
    @Test void activityBeforeDeadlineRenewsIdleButCannotExtendAbsoluteLimit() {
        assertEquals(start.plusSeconds(3600), session.getExpiresAt());
        for (int minute = 9; minute <= 54; minute += 9) {
            when(clock.instant()).thenReturn(start.plusSeconds(minute * 60));
            sessions.activity(session.getId(), 42L);
        }
        when(clock.instant()).thenReturn(start.plusSeconds(3599));
        assertSame(session, sessions.require(session.getId(), 42L));
        when(clock.instant()).thenReturn(start.plusSeconds(3600));
        assertThrows(JwtException.class, () -> sessions.activity(session.getId(), 42L));
        assertEquals(start.plusSeconds(3600), session.getExpiresAt());
    }
    @Test void suspendedTabCannotReviveSessionAndOwnerBindingIsRequired() {
        assertThrows(JwtException.class, () -> sessions.require(session.getId(), 43L));
        assertThrows(JwtException.class, () -> sessions.require(null, 42L));
        when(clock.instant()).thenReturn(start.plus(Duration.ofHours(8)));
        assertThrows(JwtException.class, () -> sessions.activity(session.getId(), 42L));
    }
    @Test void logoutIsIdempotentAndRevokesAllCopiesOfSameSid() {
        sessions.revoke(session.getId(), 43L);
        assertFalse(session.isRevoked());
        sessions.revoke(session.getId(), 42L);
        sessions.revoke(session.getId(), 42L);
        assertTrue(session.isRevoked());
        assertThrows(JwtException.class, () -> sessions.require(session.getId(), 42L));
        assertThrows(JwtException.class, () -> sessions.activity(session.getId(), 42L));
    }
    @Test void configuredShorterAbsoluteLifetimeIsRetained() {
        assertEquals(start.plusSeconds(120), sessions.open(42L, 120_000).getExpiresAt());
    }
}
