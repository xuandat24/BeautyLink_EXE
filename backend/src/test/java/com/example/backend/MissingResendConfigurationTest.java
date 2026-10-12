package com.example.backend;

import com.example.backend.repository.OtpVerificationChallengeRepository;
import com.example.backend.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:missing-resend;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.demo-data.enabled=false", "app.otp.resend.api-key=", "app.otp.mail-from=", "app.otp.pepper="
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MissingResendConfigurationTest {
    @Autowired MockMvc mvc;
    @Autowired UserAccountRepository users;
    @Autowired OtpVerificationChallengeRepository challenges;

    @Test
    void missingConfigurationKeepsCatalogHealthyAndOtpFailsClosedWithoutSideEffects() throws Exception {
        long accounts = users.count(), challengeCount = challenges.count();
        mvc.perform(get("/api/v1/categories")).andExpect(status().isOk());
        mvc.perform(post("/api/v1/auth/registration-verification/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"0391111155\",\"email\":\"missing.config@example.com\",\"channel\":\"EMAIL\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code", is("OTP_DELIVERY_UNAVAILABLE")));
        assertEquals(accounts, users.count());
        assertEquals(challengeCount, challenges.count());
    }
}
