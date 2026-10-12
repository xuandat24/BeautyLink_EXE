package com.example.backend;

import com.example.backend.dto.ApiDtos.StartRegistrationVerificationRequest;
import com.example.backend.exception.ApiException;
import com.example.backend.model.DomainEnums.VerificationChannel;
import com.example.backend.repository.OtpVerificationChallengeRepository;
import com.example.backend.repository.UserAccountRepository;
import com.example.backend.service.OtpDeliveryService;
import com.example.backend.service.RegistrationVerificationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:otp-rollback;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.demo-data.enabled=false"
})
@ActiveProfiles("test")
class RegistrationVerificationTransactionTest {
    @Autowired RegistrationVerificationService verification;
    @Autowired OtpVerificationChallengeRepository challenges;
    @Autowired UserAccountRepository users;
    @MockitoBean OtpDeliveryService delivery;

    @Test
    void failedResendDeliveryRollsBackChallengeAndDoesNotCreateAccount() {
        long challengeCount = challenges.count();
        long userCount = users.count();
        when(delivery.isEmailConfigured()).thenReturn(true);
        doThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "OTP_DELIVERY_UNAVAILABLE", "safe failure"))
                .when(delivery).sendEmailCode(anyString(), anyString(), anyLong());

        assertThrows(ApiException.class, () -> verification.start(
                new StartRegistrationVerificationRequest("0912345678", "rollback@example.com", VerificationChannel.EMAIL)));

        assertEquals(challengeCount, challenges.count());
        assertEquals(userCount, users.count());
    }
}
