package com.example.backend.service;

import com.example.backend.auth.JwtService;
import com.example.backend.exception.ApiException;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static com.example.backend.model.DomainEnums.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"app.cloudinary.enabled=true", "app.demo-data.enabled=false", "app.partner-catalog.enabled=false"})
@AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class CustomerAvatarApiIntegrationTest {
    static final String PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    static final String URL = "https://res.cloudinary.com/test/image/upload/avatar.png";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserAccountRepository users;
    @Autowired AuthenticationSessionRepository sessions;
    @Autowired EntityManager em;
    @Autowired JwtService jwt;
    @MockitoBean CloudinaryImageGateway images;

    private UserAccount account(Role role) {
        var user = new UserAccount(); user.setFullName("Avatar Customer"); user.setRole(role);
        user.setEmail("avatar-" + role + "@example.com"); user.setAvatarUrl("https://example.com/old.png");
        return users.saveAndFlush(user);
    }
    private String body(String image) throws Exception { return json.writeValueAsString(java.util.Map.of("image", image)); }

    @Test void uploadPersistsAndRotatesTokenWithoutRenewingSessionOrChangingOtherAccount() throws Exception {
        var user = account(Role.CUSTOMER); var other = account(Role.SUPPLIER);
        String old = jwt.createToken(user); var claims = jwt.extractClaims(old);
        when(images.upload(PNG)).thenReturn(new CloudinaryImageGateway.UploadedImage("avatar-test", URL));
        String response = mvc.perform(patch("/api/v1/auth/me/avatar").header("Authorization", "Bearer " + old)
                .contentType("application/json").content(body(PNG)))
                .andExpect(status().isOk()).andExpect(jsonPath("user.avatarUrl").value(URL))
                .andReturn().getResponse().getContentAsString();
        String replacement = json.readTree(response).path("accessToken").asText();
        assertEquals(claims.get("sid"), jwt.extractClaims(replacement).get("sid"));
        assertEquals(claims.getExpiration(), jwt.extractClaims(replacement).getExpiration());
        assertEquals(1, sessions.count());
        em.flush(); em.clear();
        assertEquals(URL, users.findById(user.getId()).orElseThrow().getAvatarUrl());
        assertEquals("https://example.com/old.png", users.findById(other.getId()).orElseThrow().getAvatarUrl());
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + old)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + replacement))
                .andExpect(status().isOk()).andExpect(jsonPath("avatarUrl").value(URL));
        mvc.perform(post("/api/v1/auth/session/logout").header("Authorization", "Bearer " + replacement)).andExpect(status().isNoContent());
        mvc.perform(patch("/api/v1/auth/me/avatar").header("Authorization", "Bearer " + replacement)
                .contentType("application/json").content(body(PNG))).andExpect(status().isUnauthorized());
        verify(images, times(1)).upload(PNG);
    }

    @Test void invalidImageAndProviderFailureKeepOldAvatarAndSession() throws Exception {
        var user = account(Role.CUSTOMER); String token = jwt.createToken(user);
        for (String image : new String[]{"data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,YmFk", "javascript:alert(1)", "http://example.com/a.png"}) {
            mvc.perform(patch("/api/v1/auth/me/avatar").header("Authorization", "Bearer " + token)
                    .contentType("application/json").content(body(image))).andExpect(status().isBadRequest());
        }
        verify(images, never()).upload(anyString());
        when(images.upload(PNG)).thenThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "IMAGE_STORAGE_UNAVAILABLE", "Upload unavailable"));
        mvc.perform(patch("/api/v1/auth/me/avatar").header("Authorization", "Bearer " + token)
                .contentType("application/json").content(body(PNG))).andExpect(status().isServiceUnavailable());
        assertEquals("https://example.com/old.png", users.findById(user.getId()).orElseThrow().getAvatarUrl());
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
    }

    @ParameterizedTest @EnumSource(value = Role.class, names = {"SUPPLIER", "STAFF", "ADMIN"})
    void nonCustomerCannotUseCustomerAvatarEndpoint(Role role) throws Exception {
        String token = jwt.createToken(account(role));
        mvc.perform(patch("/api/v1/auth/me/avatar").header("Authorization", "Bearer " + token)
                .contentType("application/json").content(body(PNG))).andExpect(status().isForbidden());
        verify(images, never()).upload(anyString());
    }

    @Test void anonymousAndSuspendedCannotUpload() throws Exception {
        mvc.perform(patch("/api/v1/auth/me/avatar").contentType("application/json").content(body(PNG))).andExpect(status().isUnauthorized());
        var user = account(Role.CUSTOMER); String token = jwt.createToken(user);
        user.setStatus(AccountStatus.SUSPENDED); users.saveAndFlush(user); em.clear();
        mvc.perform(patch("/api/v1/auth/me/avatar").header("Authorization", "Bearer " + token)
                .contentType("application/json").content(body(PNG))).andExpect(status().isUnauthorized());
        verify(images, never()).upload(anyString());
    }
}
