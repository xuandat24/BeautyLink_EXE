package com.example.backend;

import com.example.backend.dto.ApiDtos.ConfirmRegistrationVerificationRequest;
import com.example.backend.dto.ApiDtos.StartRegistrationVerificationRequest;
import com.example.backend.exception.ApiException;
import com.example.backend.model.OtpVerificationChallenge;
import com.example.backend.repository.OtpVerificationChallengeRepository;
import com.example.backend.service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RegistrationVerificationServiceTest {
    @Mock OtpVerificationChallengeRepository challenges;
    @Mock OtpDeliveryService delivery;
    @Mock AuthAbuseGuard abuseGuard;

    @Test
    void verifiedTokenMatchesContactsAndCanOnlyBeConsumedOnce() {
        OtpHashingService hashing = new OtpHashingService("test-otp-pepper-that-is-longer-than-thirty-two-bytes");
        RegistrationVerificationService service = new RegistrationVerificationService(
                challenges, hashing, delivery, abuseGuard, 600, 900, 5);
        ArgumentCaptor<OtpVerificationChallenge> saved = ArgumentCaptor.forClass(OtpVerificationChallenge.class);
        ArgumentCaptor<String> phoneCode = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> emailCode = ArgumentCaptor.forClass(String.class);
        when(challenges.save(saved.capture())).thenAnswer(invocation -> invocation.getArgument(0));

        var started = service.start(new StartRegistrationVerificationRequest("0912345678", "Owner@Example.com"));
        verify(delivery).sendPhoneCode(eq("0912345678"), phoneCode.capture(), anyLong());
        verify(delivery).sendEmailCode(eq("owner@example.com"), emailCode.capture(), anyLong());
        OtpVerificationChallenge challenge = saved.getValue();
        when(challenges.findLockedById(started.challengeId())).thenReturn(Optional.of(challenge));

        var confirmed = service.confirm(new ConfirmRegistrationVerificationRequest(
                started.challengeId(), phoneCode.getValue(), emailCode.getValue()), "198.51.100.10");
        when(challenges.findByRegistrationTokenHash(any())).thenReturn(Optional.of(challenge));

        service.consume(confirmed.registrationToken(), "0912345678", "owner@example.com");
        assertNotNull(challenge.getConsumedAt());
        assertThrows(ApiException.class,
                () -> service.consume(confirmed.registrationToken(), "0912345678", "owner@example.com"));
    }

    @Test
    void wrongOtpConsumesAttemptBudgetWithoutIssuingToken() {
        OtpHashingService hashing = new OtpHashingService("test-otp-pepper-that-is-longer-than-thirty-two-bytes");
        RegistrationVerificationService service = new RegistrationVerificationService(
                challenges, hashing, delivery, abuseGuard, 600, 900, 5);
        ArgumentCaptor<OtpVerificationChallenge> saved = ArgumentCaptor.forClass(OtpVerificationChallenge.class);
        when(challenges.save(saved.capture())).thenAnswer(invocation -> invocation.getArgument(0));
        var started = service.start(new StartRegistrationVerificationRequest("0912345678", null));
        when(challenges.findLockedById(started.challengeId())).thenReturn(Optional.of(saved.getValue()));

        ApiException exception = assertThrows(ApiException.class,
                () -> service.confirm(new ConfirmRegistrationVerificationRequest(started.challengeId(), "000000", null), "198.51.100.11"));

        assertEquals("OTP_INVALID", exception.getCode());
        assertEquals(1, saved.getValue().getAttempts());
        assertNull(saved.getValue().getRegistrationTokenHash());
    }
}
