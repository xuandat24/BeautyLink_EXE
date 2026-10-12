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
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.backend.model.OtpVerificationChallenge;
import org.mockito.ArgumentCaptor;
import java.time.Instant;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.junit.jupiter.api.BeforeEach;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:otp-rollback;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.demo-data.enabled=false",
        "app.security.verification.max-per-target=2"
})
@ActiveProfiles("test")
@AutoConfigureMockMvc
class RegistrationVerificationTransactionTest {
    private static final AtomicInteger CLIENT_NUMBER = new AtomicInteger(100);
    private String clientAddress;
    @BeforeEach void useIndependentClientAddress() { clientAddress = "192.0.2." + CLIENT_NUMBER.incrementAndGet(); }
    private static final String TEST_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    @Autowired RegistrationVerificationService verification;
    @Autowired OtpVerificationChallengeRepository challenges;
    @Autowired UserAccountRepository users;
    @MockitoBean OtpDeliveryService delivery;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

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

    @Test
    void customerMustVerifyEmailAndCanUseTokenOnlyOnce() throws Exception {
        String phone = "0391111101", email = "customer.otp@example.com";
        String body = customerBody(phone, email, "unverified-token");
        mvc.perform(clientPost("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code", is("VERIFICATION_REQUIRED")));
        String token = verifiedToken(phone, email);
        mvc.perform(clientPost("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(customerBody(phone, email, token)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.user.role", is("CUSTOMER")));
        mvc.perform(clientPost("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(customerBody(phone, email, token)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code", is("VERIFICATION_REQUIRED")));
        assertEquals(email, users.findByPhone(phone).orElseThrow().getEmail());
    }

    @Test
    void supplierRegistersAfterRealVerificationServiceConsumesEmailToken() throws Exception {
        String token = verifiedToken("0391111102", "supplier.otp@example.com");
        long cityId = mapper.readTree(mvc.perform(get("/api/v1/locations"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get(0).path("id").asLong();
        var body = mapper.createObjectNode();
        body.put("ownerName", "Nguyen Supplier").put("phone", "0391111102").put("email", "supplier.otp@example.com")
                .put("password", "StrongPass123!").put("verificationToken", token).put("businessName", "OTP Test Spa")
                .put("businessType", "Spa").put("locationId", cityId).put("addressLine", "123 Test Street")
                .put("cccdNumber", "111222333444").put("cccdFrontImage", TEST_PNG).put("cccdBackImage", TEST_PNG)
                .put("imageUrl", TEST_PNG).put("latitude", 21.03).put("longitude", 105.85);
        String response = mvc.perform(clientPost("/api/v1/auth/register-supplier").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(body)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.auth.user.role", is("SUPPLIER")))
                .andReturn().getResponse().getContentAsString();
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + mapper.readTree(response).path("auth").path("accessToken").asText()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role", is("SUPPLIER")));
    }

    @Test
    void wrongAttemptPersistsAndExpiredOtpCannotIssueToken() throws Exception {
        when(delivery.isEmailConfigured()).thenReturn(true);
        var started = verification.start(new StartRegistrationVerificationRequest("0391111103", "wrong.otp@example.com", VerificationChannel.EMAIL));
        ArgumentCaptor<String> code = ArgumentCaptor.forClass(String.class);
        verify(delivery).sendEmailCode(anyString(), code.capture(), anyLong());
        String wrong = "000000".equals(code.getValue()) ? "999999" : "000000";
        mvc.perform(clientPost("/api/v1/auth/registration-verification/confirm").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"challengeId\":\"" + started.challengeId() + "\",\"emailCode\":\"" + wrong + "\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code", is("OTP_INVALID")));
        OtpVerificationChallenge challenge = challenges.findById(started.challengeId()).orElseThrow();
        assertEquals(1, challenge.getAttempts());
        challenge.setExpiresAt(Instant.now().minusSeconds(1));
        challenges.saveAndFlush(challenge);
        mvc.perform(clientPost("/api/v1/auth/registration-verification/confirm").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"challengeId\":\"" + started.challengeId() + "\",\"emailCode\":\"" + code.getValue() + "\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code", is("OTP_INVALID")));
    }

    @Test
    void sendSpamIsBoundedAndBlockedRequestDoesNotSendOrCreateChallenge() {
        when(delivery.isEmailConfigured()).thenReturn(true);
        var request = new StartRegistrationVerificationRequest("0391111104", "limited.otp@example.com", VerificationChannel.EMAIL);
        verification.start(request);
        verification.start(request);
        long count = challenges.count();
        ApiException error = assertThrows(ApiException.class, () -> verification.start(request));
        assertEquals("RATE_LIMITED", error.getCode());
        assertEquals(429, error.getStatus().value());
        verify(delivery, times(2)).sendEmailCode(anyString(), anyString(), anyLong());
        assertEquals(count, challenges.count());
    }

    private String verifiedToken(String phone, String email) throws Exception {
        when(delivery.isEmailConfigured()).thenReturn(true);
        String response = mvc.perform(clientPost("/api/v1/auth/registration-verification/start")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"phone\":\"" + phone + "\",\"email\":\"" + email + "\",\"channel\":\"EMAIL\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.requiredChannels[0]", is("EMAIL")))
                .andReturn().getResponse().getContentAsString();
        ArgumentCaptor<String> code = ArgumentCaptor.forClass(String.class);
        verify(delivery).sendEmailCode(anyString(), code.capture(), anyLong());
        String confirmed = mvc.perform(clientPost("/api/v1/auth/registration-verification/confirm")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"challengeId\":\"" + mapper.readTree(response).path("challengeId").asText() + "\",\"emailCode\":\"" + code.getValue() + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(confirmed).path("registrationToken").asText();
    }

    private String customerBody(String phone, String email, String token) {
        return "{\"fullName\":\"Nguyen Customer\",\"phone\":\"" + phone + "\",\"email\":\"" + email + "\",\"password\":\"StrongPass123!\",\"gender\":\"MALE\",\"dateOfBirth\":\"1995-01-01\",\"verificationToken\":\"" + token + "\"}";
    }

    private MockHttpServletRequestBuilder clientPost(String path) {
        return post(path).with(request -> { request.setRemoteAddr(clientAddress); return request; });
    }
}
