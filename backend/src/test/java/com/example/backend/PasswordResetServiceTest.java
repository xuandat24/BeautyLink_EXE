package com.example.backend;

import com.example.backend.dto.ApiDtos.ConfirmPasswordResetRequest;
import com.example.backend.dto.ApiDtos.StartPasswordResetRequest;
import com.example.backend.exception.ApiException;
import com.example.backend.model.PasswordResetChallenge;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.PasswordResetChallengeRepository;
import com.example.backend.repository.UserAccountRepository;
import com.example.backend.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static com.example.backend.model.DomainEnums.AccountStatus.ACTIVE;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {
    @Mock PasswordResetChallengeRepository challenges;
    @Mock UserAccountRepository users;
    @Mock OtpDeliveryService delivery;
    @Mock AuthAbuseGuard abuseGuard;
    private PasswordEncoder encoder;
    private PasswordResetService service;

    @BeforeEach
    void setUp() {
        encoder = new BCryptPasswordEncoder(4);
        service = new PasswordResetService(challenges, users,
                new OtpHashingService("test-password-reset-pepper-that-is-longer-than-thirty-two-bytes"),
                delivery, encoder, abuseGuard, 600, 5);
    }

    @Test
    void registeredPhoneReceivesEmailOtpAndCanResetPasswordOnce() {
        UserAccount user = activeUser();
        ArgumentCaptor<PasswordResetChallenge> saved = ArgumentCaptor.forClass(PasswordResetChallenge.class);
        ArgumentCaptor<String> otp = ArgumentCaptor.forClass(String.class);
        when(delivery.isEmailConfigured()).thenReturn(true);
        when(users.findByPhone("0908433898")).thenReturn(Optional.of(user));
        when(challenges.save(saved.capture())).thenAnswer(invocation -> invocation.getArgument(0));

        var started = service.start(new StartPasswordResetRequest("0908 433-898"), "198.51.100.20");

        verify(delivery).sendPasswordResetCode(eq("owner@example.com"), otp.capture(), eq(10L));
        PasswordResetChallenge challenge = saved.getValue();
        when(challenges.findLockedById(started.challengeId())).thenReturn(Optional.of(challenge));
        when(users.findById(user.getId())).thenReturn(Optional.of(user));

        var result = service.confirm(new ConfirmPasswordResetRequest(
                started.challengeId(), otp.getValue(), "NewStrongPassword123!"), "198.51.100.20");

        assertTrue(result.message().contains("đặt lại"));
        assertTrue(encoder.matches("NewStrongPassword123!", user.getPasswordHash()));
        assertEquals(1, user.getAuthVersion());
        assertNotNull(challenge.getConsumedAt());
        assertThrows(ApiException.class, () -> service.confirm(new ConfirmPasswordResetRequest(
                started.challengeId(), otp.getValue(), "AnotherStrongPassword123!"), "198.51.100.20"));
    }

    @Test
    void wrongOtpConsumesAttemptBudgetWithoutChangingPassword() {
        UserAccount user = activeUser();
        ArgumentCaptor<PasswordResetChallenge> saved = ArgumentCaptor.forClass(PasswordResetChallenge.class);
        when(delivery.isEmailConfigured()).thenReturn(true);
        when(users.findByEmailIgnoreCase("owner@example.com")).thenReturn(Optional.of(user));
        when(challenges.save(saved.capture())).thenAnswer(invocation -> invocation.getArgument(0));
        var started = service.start(new StartPasswordResetRequest("Owner@Example.com"), "198.51.100.21");
        when(challenges.findLockedById(started.challengeId())).thenReturn(Optional.of(saved.getValue()));
        String previousHash = user.getPasswordHash();

        ApiException error = assertThrows(ApiException.class, () -> service.confirm(new ConfirmPasswordResetRequest(
                started.challengeId(), "000000", "NewStrongPassword123!"), "198.51.100.21"));

        assertEquals("PASSWORD_RESET_INVALID", error.getCode());
        assertEquals(1, saved.getValue().getAttempts());
        assertEquals(previousHash, user.getPasswordHash());
    }

    @Test
    void unknownAccountGetsSameGenericResponseWithoutSendingEmail() {
        ArgumentCaptor<PasswordResetChallenge> saved = ArgumentCaptor.forClass(PasswordResetChallenge.class);
        when(delivery.isEmailConfigured()).thenReturn(true);
        when(users.findByPhone("0900000099")).thenReturn(Optional.empty());
        when(challenges.save(saved.capture())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.start(new StartPasswordResetRequest("0900000099"), "198.51.100.22");

        assertNotNull(response.challengeId());
        assertTrue(response.message().startsWith("Nếu tài khoản tồn tại"));
        assertNull(saved.getValue().getUserId());
        verify(delivery, never()).sendPasswordResetCode(anyString(), anyString(), anyLong());
    }

    private UserAccount activeUser() {
        UserAccount user = new UserAccount();
        user.setId(42L);
        user.setFullName("Owner Example");
        user.setPhone("0908433898");
        user.setEmail("Owner@Example.com");
        user.setPasswordHash(encoder.encode("OldStrongPassword123!"));
        user.setStatus(ACTIVE);
        return user;
    }
}
