package com.example.backend.controller;

import com.example.backend.auth.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import io.jsonwebtoken.JwtException;
import java.time.Instant;

@RestController
@RequestMapping("/api/v1/auth/session")
public class SessionController {
    private final AuthenticationSessions sessions;
    public SessionController(AuthenticationSessions sessions) { this.sessions = sessions; }
    @PostMapping("/activity") public SessionExpiry activity(Authentication auth) {
        var principal = (AccountDetailsService.AccountPrincipal) auth.getPrincipal();
        var identity = (JwtService.SessionIdentity) auth.getDetails();
        try {
            var session = sessions.activity(identity.id(), principal.getAccountId());
            return new SessionExpiry(session.getLastActivityAt().plus(AuthenticationSessions.IDLE), session.getExpiresAt());
        } catch (JwtException error) { throw new ResponseStatusException(HttpStatus.UNAUTHORIZED); }
    }
    @PostMapping("/logout") @ResponseStatus(HttpStatus.NO_CONTENT) public void logout(Authentication auth) {
        sessions.revoke(((JwtService.SessionIdentity) auth.getDetails()).id(),
                ((AccountDetailsService.AccountPrincipal) auth.getPrincipal()).getAccountId());
    }
    public record SessionExpiry(Instant idleExpiresAt, Instant absoluteExpiresAt) {}
}
