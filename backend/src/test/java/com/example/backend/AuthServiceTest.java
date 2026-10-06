package com.example.backend;

import com.example.backend.auth.JwtService;
import com.example.backend.dto.ApiDtos.LoginRequest;
import com.example.backend.dto.ApiDtos.RegisterRequest;
import com.example.backend.exception.ApiException;
import com.example.backend.model.DomainEnums.AccountStatus;
import com.example.backend.model.DomainEnums.Gender;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.UserAccountRepository;
import com.example.backend.service.AuthService;
import com.example.backend.service.RegistrationVerificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    private static final String PASSWORD = "StrongPassword123!";

    @Mock UserAccountRepository users;
    @Mock RegistrationVerificationService verification;
    private JwtService jwt;
    private PasswordEncoder encoder;
    private AuthService service;

    @BeforeEach
    void setUp() {
        encoder = new BCryptPasswordEncoder(4);
        jwt = new JwtService("test-jwt-secret-that-is-long-enough-for-hmac-sha", 3_600_000);
        service = new AuthService(users, encoder, jwt, verification);
    }

    @Test
    void loginByEmailIsCaseInsensitiveAndReturnsJwt() {
        UserAccount user = activeUser(encoder.encode(PASSWORD));
        when(users.findByEmailIgnoreCase("Owner@Example.com")).thenReturn(Optional.of(user));

        var response = service.login(new LoginRequest("Owner@Example.com", PASSWORD));

        assertTrue(response.accessToken().length() > 20);
        assertEquals(user.getId(), response.user().id());
    }

    @Test
    void loginByNormalizedPhoneSucceeds() {
        UserAccount user = activeUser(encoder.encode(PASSWORD));
        when(users.findByPhone("0912345678")).thenReturn(Optional.of(user));

        var response = service.login(new LoginRequest("0912 345-678", PASSWORD));

        assertEquals(user.getPhone(), response.user().phone());
    }

    @Test
    void validTwoBcryptPrefixIsAccepted() {
        String twoAHash = encoder.encode(PASSWORD);
        UserAccount user = activeUser("$2b$" + twoAHash.substring(4));
        when(users.findByPhone(user.getPhone())).thenReturn(Optional.of(user));

        assertTrue(service.login(new LoginRequest(user.getPhone(), PASSWORD)).accessToken().length() > 20);
    }

    @Test
    void wrongPasswordInactiveOrMissingUserReturnSameGenericUnauthorizedError() {
        UserAccount wrongPassword = activeUser(encoder.encode(PASSWORD));
        UserAccount inactive = activeUser(encoder.encode(PASSWORD));
        inactive.setStatus(AccountStatus.DISABLED);
        when(users.findByEmailIgnoreCase("wrong@example.com")).thenReturn(Optional.of(wrongPassword));
        when(users.findByEmailIgnoreCase("inactive@example.com")).thenReturn(Optional.of(inactive));
        when(users.findByEmailIgnoreCase("missing@example.com")).thenReturn(Optional.empty());

        assertInvalidCredentials(() -> service.login(new LoginRequest("wrong@example.com", "WrongPassword123!")));
        assertInvalidCredentials(() -> service.login(new LoginRequest("inactive@example.com", PASSWORD)));
        assertInvalidCredentials(() -> service.login(new LoginRequest("missing@example.com", PASSWORD)));
    }

    @Test
    void nullBlankAndMalformedHashesAreRejectedBeforePasswordEncoder() {
        PasswordEncoder guardedEncoder = org.mockito.Mockito.mock(PasswordEncoder.class);
        AuthService guardedService = new AuthService(users, guardedEncoder, jwt, verification);
        for (String hash : new String[]{null, "", "not-a-bcrypt-hash"}) {
            UserAccount user = activeUser(hash);
            when(users.findByPhone(user.getPhone())).thenReturn(Optional.of(user));

            assertInvalidCredentials(() -> guardedService.login(new LoginRequest(user.getPhone(), PASSWORD)));
        }

        verify(guardedEncoder, never()).matches(any(), any());
    }

    @Test
    void registrationStoresOnlyBcryptHash() {
        when(users.saveAndFlush(any(UserAccount.class))).thenAnswer(invocation -> {
            UserAccount user = invocation.getArgument(0);
            user.setId(99L);
            return user;
        });
        RegisterRequest request = new RegisterRequest("Nguyen Van An", "0912345678", "owner@example.com", PASSWORD,
                Gender.MALE, LocalDate.of(1995, 6, 15), "valid-registration-token");

        service.register(request);

        verify(verification).consume("valid-registration-token", "0912345678", "owner@example.com");
        org.mockito.ArgumentCaptor<UserAccount> saved = org.mockito.ArgumentCaptor.forClass(UserAccount.class);
        verify(users).saveAndFlush(saved.capture());
        assertTrue(saved.getValue().getPasswordHash().startsWith("$2a$"));
        assertTrue(encoder.matches(PASSWORD, saved.getValue().getPasswordHash()));
    }

    private UserAccount activeUser(String passwordHash) {
        UserAccount user = new UserAccount();
        user.setId(31L);
        user.setFullName("Owner Example");
        user.setPhone("0912345678");
        user.setEmail("owner@example.com");
        user.setPasswordHash(passwordHash);
        user.setStatus(AccountStatus.ACTIVE);
        return user;
    }

    private void assertInvalidCredentials(Runnable call) {
        ApiException error = assertThrows(ApiException.class, call::run);
        assertEquals("INVALID_CREDENTIALS", error.getCode());
        assertEquals(401, error.getStatus().value());
    }
}
