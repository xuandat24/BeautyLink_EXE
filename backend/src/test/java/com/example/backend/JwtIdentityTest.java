package com.example.backend;

import com.example.backend.auth.JwtService;
import com.example.backend.model.UserAccount;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import static org.junit.jupiter.api.Assertions.*;

class JwtIdentityTest {
    private static final String SECRET = "test-jwt-secret-that-is-long-enough-for-hmac-sha";
    private final JwtService jwt = new JwtService(SECRET, 3_600_000);

    @Test
    void freshTokenMatchesAndOldTokenStaysInvalidAfterPhoneChangesBack() {
        UserAccount user = account();
        String token = jwt.createToken(user);
        assertTrue(jwt.matchesAccount(jwt.extractClaims(token), user));
        user.setPhone("0391111112");
        ReflectionTestUtils.invokeMethod(user, "touch");
        assertFalse(jwt.matchesAccount(jwt.extractClaims(token), user));
        user.setPhone("0391111111");
        ReflectionTestUtils.invokeMethod(user, "touch");
        assertFalse(jwt.matchesAccount(jwt.extractClaims(token), user));
        assertTrue(jwt.matchesAccount(jwt.extractClaims(jwt.createToken(user)), user));
    }

    @Test
    void accountIdBindingRejectsPhoneReassignedToExistingAccount() {
        UserAccount first = account();
        String token = jwt.createToken(first);
        UserAccount other = account();
        other.setId(2L);
        assertFalse(jwt.matchesAccount(jwt.extractClaims(token), other));
    }

    @Test
    void unchangedLegacyIdentityIsAcceptedButUpdatedOrSameSecondIdentityIsRejected() {
        UserAccount user = account();
        Instant issued = Instant.now().minusSeconds(2).truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
        var claims = jwt.extractClaims(legacyToken(user.getPhone(), issued));
        assertTrue(jwt.matchesAccount(claims, user));
        ReflectionTestUtils.setField(user, "updatedAt", issued);
        assertFalse(jwt.matchesAccount(claims, user));
        ReflectionTestUtils.setField(user, "updatedAt", Instant.now());
        assertFalse(jwt.matchesAccount(claims, user));
    }

    @Test
    void suspendedAccountCannotBeEnabledByClaims() {
        UserAccount user = account();
        user.setStatus(com.example.backend.model.DomainEnums.AccountStatus.SUSPENDED);
        // Role/status are taken from the database by the authentication filter,
        // never trusted from a browser or the token's role claim.
        var users = org.mockito.Mockito.mock(com.example.backend.repository.UserAccountRepository.class);
        org.mockito.Mockito.when(users.findById(user.getId())).thenReturn(java.util.Optional.of(user));
        var details = new com.example.backend.auth.AccountDetailsService(users)
                .loadUserForToken(jwt.extractClaims(jwt.createToken(user)), jwt);
        assertFalse(details.isEnabled());
    }

    private UserAccount account() {
        UserAccount user = new UserAccount();
        user.setId(1L);
        user.setPhone("0391111111");
        user.setPasswordHash("test-hash");
        ReflectionTestUtils.setField(user, "createdAt", Instant.now().minusSeconds(20));
        ReflectionTestUtils.setField(user, "updatedAt", Instant.now().minusSeconds(10).truncatedTo(java.time.temporal.ChronoUnit.MILLIS));
        return user;
    }

    private String legacyToken(String phone, Instant issuedAt) {
        return Jwts.builder().subject(phone).claim("role", "CUSTOMER")
                .issuedAt(Date.from(issuedAt)).expiration(Date.from(Instant.now().plusSeconds(3600)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
    }
}
