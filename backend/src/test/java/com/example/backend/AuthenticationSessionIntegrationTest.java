package com.example.backend;

import com.example.backend.auth.*;
import com.example.backend.model.UserAccount;
import com.example.backend.model.DomainEnums.Role;
import com.example.backend.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.Date;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"app.demo-data.enabled=false", "app.partner-catalog.enabled=false"})
@AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
@Import(AuthenticationSessionIntegrationTest.TimeConfig.class)
class AuthenticationSessionIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired UserAccountRepository users;
    @Autowired AuthenticationSessionRepository rows;
    @Autowired JwtService jwt;
    @Autowired ObjectMapper json;
    @Autowired MutableClock clock;
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    com.example.backend.service.CloudinaryImageGateway imageGateway;
    @BeforeEach void resetTime() { clock.time = Instant.now(); }
    static class MutableClock extends Clock {
        Instant time = Instant.now();
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return time; }
    }
    @TestConfiguration static class TimeConfig {
        @Bean MutableClock sessionClock() { return new MutableClock(); }
        @Bean @Primary AuthenticationSessions controlledSessions(AuthenticationSessionRepository repo, MutableClock clock) {
            return new AuthenticationSessions(repo, clock);
        }
    }
    private UserAccount account(Role role) {
        var user = new UserAccount(); user.setFullName("Session test"); user.setRole(role);
        user.setPhone("0399999999"); user.setEmail("session-test@example.com");
        user.setPasswordHash(new BCryptPasswordEncoder(4).encode("Password123!"));
        return users.saveAndFlush(user);
    }
    @ParameterizedTest @EnumSource(Role.class)
    void allRolesAreServerExpiredWithoutFrontendTimers(Role role) throws Exception {
        var user = account(role); String token = jwt.createToken(user);
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        var row = rows.findById(jwt.extractClaims(token).get("sid", String.class)).orElseThrow();
        Instant original = row.getLastActivityAt();
        clock.time = original.plusSeconds(599);
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        assertEquals(original, row.getLastActivityAt(), "background reads cannot extend idle");
        clock.time = original.plusSeconds(600);
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/session/activity").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        assertEquals(original, row.getLastActivityAt());
    }
    @Test void normalPasswordLoginActivityAndLogoutRevokeSameToken() throws Exception {
        account(Role.CUSTOMER);
        var response = mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                .content("{\"identifier\":\"session-test@example.com\",\"password\":\"Password123!\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String token = json.readTree(response).path("accessToken").asText();
        String sid = jwt.extractClaims(token).get("sid", String.class);
        clock.time = clock.time.plusSeconds(300);
        mvc.perform(post("/api/v1/auth/session/activity").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        assertEquals(clock.time, rows.findById(sid).orElseThrow().getLastActivityAt());
        mvc.perform(get("/api/v1/bookings/mine").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        mvc.perform(post("/api/v1/auth/session/logout").header("Authorization", "Bearer " + token)).andExpect(status().isNoContent());
        assertTrue(rows.findById(sid).orElseThrow().isRevoked());
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }
    @Test void missingUnknownAndWrongOwnerSidFailEvenForSignedTokens() throws Exception {
        var first = account(Role.CUSTOMER); String issued = jwt.createToken(first);
        var claims = jwt.extractClaims(issued);
        // Use the configured JwtService signing material only to generate alternate signed claims.
        var key = (javax.crypto.SecretKey) org.springframework.test.util.ReflectionTestUtils.getField(jwt, "key");
        assertNotNull(key);
        for (String sid : new String[] {"", "00000000-0000-4000-8000-000000000000"}) {
            var altered = new java.util.HashMap<String,Object>(claims); altered.remove("sid");
            if (!sid.isEmpty()) altered.put("sid", sid);
            String bad = Jwts.builder().claims(altered).signWith(key).compact();
            mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + bad)).andExpect(status().isUnauthorized());
        }
        var row = rows.findById(claims.get("sid", String.class)).orElseThrow();
        org.springframework.test.util.ReflectionTestUtils.setField(row, "accountId", first.getId() + 1);
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + issued)).andExpect(status().isUnauthorized());
    }
    @Test void expiredJwtAndAnonymousFailWhileProfileReplacementRetainsSessionDeadline() throws Exception {
        var user = account(Role.CUSTOMER); String token = jwt.createToken(user); var original = jwt.extractClaims(token);
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
        String replacement = json.readTree(mvc.perform(patch("/api/v1/auth/me/phone").header("Authorization", "Bearer " + token)
                .contentType("application/json").content("{\"phone\":\"0399999999\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("accessToken").asText();
        assertEquals(original.get("sid"), jwt.extractClaims(replacement).get("sid"));
        assertEquals(original.getExpiration(), jwt.extractClaims(replacement).getExpiration());
        var key = (javax.crypto.SecretKey) org.springframework.test.util.ReflectionTestUtils.getField(jwt, "key");
        String expired = Jwts.builder().claims(original).expiration(Date.from(Instant.now().minusSeconds(60))).signWith(key).compact();
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + expired)).andExpect(status().isUnauthorized());
    }

    @Test void changedPhoneRetainsSessionInvalidatesOldTokenAndLogoutRevokesReplacement() throws Exception {
        var user = account(Role.CUSTOMER);
        String token = jwt.createToken(user); var original = jwt.extractClaims(token);
        String sid = original.get("sid", String.class);
        var session = rows.findById(sid).orElseThrow();
        Instant activity = session.getLastActivityAt(); long count = rows.count();
        String replacement = json.readTree(mvc.perform(patch("/api/v1/auth/me/phone")
                .header("Authorization", "Bearer " + token).contentType("application/json")
                .content("{\"phone\":\"0399999998\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("accessToken").asText();
        assertEquals("0399999998", users.findById(user.getId()).orElseThrow().getPhone());
        assertEquals(sid, jwt.extractClaims(replacement).get("sid"));
        assertEquals(original.getExpiration(), jwt.extractClaims(replacement).getExpiration());
        assertEquals(count, rows.count(), "profile edits must not create a new session");
        assertEquals(activity, session.getLastActivityAt());
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + replacement))
                .andExpect(status().isOk()).andExpect(jsonPath("id").value(user.getId()))
                .andExpect(jsonPath("phone").value("0399999998"));
        mvc.perform(post("/api/v1/auth/session/logout").header("Authorization", "Bearer " + replacement)).andExpect(status().isNoContent());
        mvc.perform(patch("/api/v1/auth/me/phone").header("Authorization", "Bearer " + replacement)
                .contentType("application/json").content("{\"phone\":\"0399999997\"}"))
                .andExpect(status().isUnauthorized());
        assertEquals("0399999998", users.findById(user.getId()).orElseThrow().getPhone());
    }

    @Test void idleExpiryRejectsPhoneMutationWithoutRenewingSession() throws Exception {
        var user = account(Role.CUSTOMER); String token = jwt.createToken(user);
        var session = rows.findById(jwt.extractClaims(token).get("sid", String.class)).orElseThrow();
        Instant activity = session.getLastActivityAt();
        clock.time = activity.plusSeconds(600);
        mvc.perform(patch("/api/v1/auth/me/phone").header("Authorization", "Bearer " + token)
                .contentType("application/json").content("{\"phone\":\"0399999998\"}"))
                .andExpect(status().isUnauthorized());
        assertEquals("0399999999", users.findById(user.getId()).orElseThrow().getPhone());
        assertEquals(activity, session.getLastActivityAt());
    }
}
