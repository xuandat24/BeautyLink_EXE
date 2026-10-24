package com.example.backend;

import com.example.backend.auth.JwtService;
import com.example.backend.dto.ApiDtos.AuthResponse;
import com.example.backend.model.ExternalIdentity;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.AuthenticationSessionRepository;
import com.example.backend.repository.ExternalIdentityRepository;
import com.example.backend.repository.UserAccountRepository;
import com.example.backend.service.GoogleTokenVerifier;
import com.example.backend.service.GoogleAuthService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static com.example.backend.model.DomainEnums.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"app.demo-data.enabled=false", "app.partner-catalog.enabled=false"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class GoogleAuthDetachedIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JwtService jwt;
    @Autowired GoogleAuthService googleAuth;
    @Autowired TransactionTemplate transactions;
    @Autowired EntityManager entityManager;
    @Autowired UserAccountRepository users;
    @Autowired ExternalIdentityRepository identities;
    @Autowired AuthenticationSessionRepository sessions;
    @MockitoBean GoogleTokenVerifier tokens;
    @MockitoBean com.example.backend.service.CloudinaryImageGateway imageGateway;

    private Long persistAccount(String email, Role role, AccountStatus state, String subject) {
        return transactions.execute(status -> {
            UserAccount account = new UserAccount();
            account.setFullName("Existing Google Customer");
            account.setEmail(email);
            account.setRole(role);
            account.setStatus(state);
            account = users.saveAndFlush(account);
            if (subject != null) {
                ExternalIdentity identity = new ExternalIdentity();
                identity.setProvider(ExternalIdentity.Provider.GOOGLE);
                identity.setProviderSubject(subject);
                identity.setUserAccount(account);
                identities.saveAndFlush(identity);
            }
            entityManager.flush();
            entityManager.clear();
            return account.getId();
        });
    }

    @Test
    void existingLinkedAccountAuthenticatesAfterPersistenceContextIsCleared() throws Exception {
        Long accountId = persistAccount("detached-google@example.com", Role.CUSTOMER,
                AccountStatus.ACTIVE, "detached-google-subject");
        when(tokens.verify("google-credential")).thenReturn(new GoogleTokenVerifier.VerifiedGoogleIdentity(
                "detached-google-subject", "detached-google@example.com", "Existing Google Customer"));

        String body = mvc.perform(post("/api/v1/auth/google").contentType("application/json")
                .content("{\"credential\":\"google-credential\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String accessToken = json.readTree(body).path("accessToken").asText();
        assertEquals(accountId, json.readTree(body).path("user").path("id").asLong());
        assertEquals(accountId, users.findById(accountId).orElseThrow().getId());
        String sessionId = jwt.extractClaims(accessToken).get("sid", String.class);
        assertEquals(accountId, sessions.findById(sessionId).orElseThrow().getAccountId());
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk()).andExpect(jsonPath("id").value(accountId));
        mvc.perform(post("/api/v1/auth/session/logout").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isNoContent());
        assertTrue(sessions.findById(sessionId).orElseThrow().isRevoked());
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void newGoogleAccountGetsRealSessionAndLinkedRepeatUsesSameAccount() throws Exception {
        when(tokens.verify("new-google-credential")).thenReturn(new GoogleTokenVerifier.VerifiedGoogleIdentity(
                "new-detached-subject", "new-detached@example.com", "New Google Customer"));
        String request = "{\"credential\":\"new-google-credential\"}";
        String first = mvc.perform(post("/api/v1/auth/google").contentType("application/json").content(request))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String second = mvc.perform(post("/api/v1/auth/google").contentType("application/json").content(request))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long accountId = json.readTree(first).path("user").path("id").asLong();
        assertEquals(accountId, json.readTree(second).path("user").path("id").asLong());
        assertEquals(Role.CUSTOMER, users.findById(accountId).orElseThrow().getRole());
        assertEquals(1, identities.findAll().stream().filter(i ->
                i.getProviderSubject().equals("new-detached-subject")).count());
        for (String body : new String[]{first, second}) {
            String token = json.readTree(body).path("accessToken").asText();
            assertEquals(accountId, sessions.findById(jwt.extractClaims(token).get("sid", String.class))
                    .orElseThrow().getAccountId());
            mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk()).andExpect(jsonPath("id").value(accountId));
        }
    }

    @Test
    void detachedLinkedAccountsStillEnforceStatusAndCustomerRole() throws Exception {
        persistAccount("disabled-detached@example.com", Role.CUSTOMER,
                AccountStatus.DISABLED, "disabled-detached-subject");
        persistAccount("supplier-detached@example.com", Role.SUPPLIER,
                AccountStatus.ACTIVE, "supplier-detached-subject");
        when(tokens.verify("disabled-credential")).thenReturn(new GoogleTokenVerifier.VerifiedGoogleIdentity(
                "disabled-detached-subject", "disabled-detached@example.com", "Disabled"));
        when(tokens.verify("supplier-credential")).thenReturn(new GoogleTokenVerifier.VerifiedGoogleIdentity(
                "supplier-detached-subject", "supplier-detached@example.com", "Supplier"));
        long before = sessions.count();
        mvc.perform(post("/api/v1/auth/google").contentType("application/json")
                .content("{\"credential\":\"disabled-credential\"}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("code").value("ACCOUNT_INACTIVE"));
        mvc.perform(post("/api/v1/auth/google").contentType("application/json")
                .content("{\"credential\":\"supplier-credential\"}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("code").value("GOOGLE_CUSTOMER_ONLY"));
        assertEquals(before, sessions.count());
    }

    @Test
    void existingPasswordAccountIsNotLinkedByMatchingGoogleEmail() throws Exception {
        Long accountId = persistAccount("collision-detached@example.com", Role.CUSTOMER,
                AccountStatus.ACTIVE, null);
        when(tokens.verify("collision-credential")).thenReturn(new GoogleTokenVerifier.VerifiedGoogleIdentity(
                "collision-detached-subject", "collision-detached@example.com", "Collision"));
        long before = sessions.count();
        mvc.perform(post("/api/v1/auth/google").contentType("application/json")
                .content("{\"credential\":\"collision-credential\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("code").value("GOOGLE_ACCOUNT_LINK_REQUIRED"));
        assertTrue(identities.findByProviderAndProviderSubject(ExternalIdentity.Provider.GOOGLE,
                "collision-detached-subject").isEmpty());
        assertEquals(AccountStatus.ACTIVE, users.findById(accountId).orElseThrow().getStatus());
        assertEquals(before, sessions.count());
    }

    @Test
    void simultaneousFirstGoogleSignInsShareOneIdentityAndBothGetSessions() throws Exception {
        when(tokens.verify("concurrent-credential")).thenReturn(new GoogleTokenVerifier.VerifiedGoogleIdentity(
                "concurrent-google-subject", "concurrent-google@example.com", "Concurrent Customer"));
        CountDownLatch start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> { start.await(); return googleAuth.authenticate("concurrent-credential"); });
            var second = pool.submit(() -> { start.await(); return googleAuth.authenticate("concurrent-credential"); });
            start.countDown();
            AuthResponse left = first.get(15, TimeUnit.SECONDS);
            AuthResponse right = second.get(15, TimeUnit.SECONDS);
            assertEquals(left.user().id(), right.user().id());
            assertEquals(1, identities.findAll().stream().filter(i ->
                    i.getProviderSubject().equals("concurrent-google-subject")).count());
            for (AuthResponse response : new AuthResponse[]{left, right}) {
                String sid = jwt.extractClaims(response.accessToken()).get("sid", String.class);
                assertEquals(left.user().id(), sessions.findById(sid).orElseThrow().getAccountId());
            }
        }
    }
}
