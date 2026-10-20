package com.example.backend.service;

import com.example.backend.exception.ApiException;
import com.example.backend.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"app.cloudinary.enabled=true",
        "spring.datasource.url=jdbc:h2:mem:cloudinary-api;MODE=MySQL;DB_CLOSE_DELAY=-1"})
@ActiveProfiles("test")
@AutoConfigureMockMvc
class PublicImageApiIntegrationTest {
    static final String PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    static final String URL = "https://res.cloudinary.com/test-cloud/image/upload/v123/beautylink/public/12345678-1234-1234-1234-123456789abc.webp";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired SupplierVerificationRepository verifications;
    @Autowired PractitionerRepository practitioners;
    @Autowired ServiceOfferingRepository services;
    @Autowired UserAccountRepository users;
    @Autowired SupplierRepository suppliers;
    @MockitoBean CloudinaryImageGateway gateway;
    @MockitoBean RegistrationVerificationService verification;
    @MockitoBean OtpDeliveryService mail;

    @Test void publicImagesPersistOnAllExistingColumnsButIdentityImagesRemainEncrypted() throws Exception {
        when(gateway.upload(PNG)).thenReturn(new CloudinaryImageGateway.UploadedImage(
                "beautylink/public/12345678-1234-1234-1234-123456789abc", URL));
        long city = json.readTree(mvc.perform(get("/api/v1/locations")).andReturn().getResponse().getContentAsString()).get(0).path("id").asLong();
        var registration = json.readTree(mvc.perform(post("/api/v1/auth/register-supplier")
                .contentType(MediaType.APPLICATION_JSON).content("""
                {"ownerName":"Le Minh","phone":"0934567890","email":"media.partner@example.com","verificationToken":"test-token",
                 "password":"StrongPass123!","businessName":"Media Beauty House","businessType":"Makeup Studio",
                 "locationId":%d,"addressLine":"25 Nguyen Trai","description":"Studio trang diem",
                 "specialty":"Makeup","cccdNumber":"079203001234","cccdFrontImage":"%s","cccdBackImage":"%s",
                 "imageUrl":"%s","latitude":10.7769,"longitude":106.7009}
                """.formatted(city, PNG, PNG, PNG)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.supplier.imageUrl").value(URL))
                .andReturn().getResponse().getContentAsString());
        String bearer = "Bearer " + registration.path("auth").path("accessToken").asText();
        long supplierId = registration.path("supplier").path("id").asLong();
        assertEquals(URL, suppliers.findById(supplierId).orElseThrow().getImageUrl());
        assertTrue(verifications.findBySupplierId(supplierId).orElseThrow().getEncryptedFrontImage().startsWith("v1:"));
        verify(gateway, times(1)).upload(PNG); // Not the two CCCD images.

        mvc.perform(put("/api/v1/supplier/profile").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content("""
                  {"name":"Media Beauty House","businessType":"Makeup Studio","addressLine":"25 Nguyen Trai","imageUrl":"%s","latitude":10.7769,"longitude":106.7009}
                  """.formatted(PNG))).andExpect(status().isOk()).andExpect(jsonPath("$.imageUrl").value(URL));
        long practitioner = json.readTree(mvc.perform(post("/api/v1/supplier/practitioners")
                .header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"Lan Anh\",\"specialty\":\"Makeup\",\"avatarUrl\":\"" + PNG + "\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.avatarUrl").value(URL))
                .andReturn().getResponse().getContentAsString()).path("id").asLong();
        mvc.perform(put("/api/v1/supplier/practitioners/" + practitioner).header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content("{\"displayName\":\"Lan Anh\",\"avatarUrl\":\"" + URL + "\"}"))
                .andExpect(status().isOk());
        assertEquals(URL, practitioners.findById(practitioner).orElseThrow().getAvatarUrl());
        long category = json.readTree(mvc.perform(get("/api/v1/categories")).andReturn().getResponse().getContentAsString()).get(0).path("id").asLong();
        long service = json.readTree(mvc.perform(post("/api/v1/supplier/services").header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content("""
                {"categoryId":%d,"name":"Makeup du tiec","price":450000,"durationMinutes":90,"imageUrl":"%s","active":true}
                """.formatted(category, PNG))).andExpect(status().isCreated()).andExpect(jsonPath("$.imageUrl").value(URL))
                .andReturn().getResponse().getContentAsString()).path("id").asLong();
        assertEquals(URL, services.findById(service).orElseThrow().getImageUrl());
        mvc.perform(put("/api/v1/supplier/services/" + service).header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content("""
                {"categoryId":%d,"name":"Makeup du tiec","price":450000,"durationMinutes":90,"imageUrl":"%s","active":true}
                """.formatted(category, PNG)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.imageUrl").value(URL));
        verify(gateway, times(5)).upload(PNG);
        mvc.perform(get("/api/v1/supplier/profile").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.imageUrl").value(URL));

        when(gateway.upload(anyString())).thenThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "IMAGE_STORAGE_UNAVAILABLE", "safe"));
        mvc.perform(put("/api/v1/supplier/practitioners/" + practitioner).header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content("{\"displayName\":\"Changed Name\",\"avatarUrl\":\"" + PNG + "\"}"))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("IMAGE_STORAGE_UNAVAILABLE"));
        assertEquals("Lan Anh", practitioners.findById(practitioner).orElseThrow().getDisplayName());
        assertEquals(URL, practitioners.findById(practitioner).orElseThrow().getAvatarUrl());
        int uploads = mockingDetails(gateway).getInvocations().size();
        mvc.perform(put("/api/v1/supplier/practitioners/" + practitioner).contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"Changed Name\",\"avatarUrl\":\"" + PNG + "\"}"))
                .andExpect(status().isUnauthorized());
        assertEquals(uploads, mockingDetails(gateway).getInvocations().size());
    }

    @Test void failedUploadRollsBackRegistrationAndForgedRasterNeverCallsProvider() throws Exception {
        when(gateway.upload(anyString())).thenThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "IMAGE_STORAGE_UNAVAILABLE", "safe"));
        long city = json.readTree(mvc.perform(get("/api/v1/locations")).andReturn().getResponse().getContentAsString()).get(0).path("id").asLong();
        String request = """
                {"ownerName":"Le Minh","phone":"0934567891","email":"media.failed@example.com","verificationToken":"test-token",
                 "password":"StrongPass123!","businessName":"Failed Beauty House","businessType":"Makeup Studio",
                 "locationId":%d,"addressLine":"25 Nguyen Trai","cccdNumber":"079203001235","cccdFrontImage":"%s","cccdBackImage":"%s","imageUrl":"%s","latitude":10.7769,"longitude":106.7009}
                """.formatted(city, PNG, PNG, PNG);
        mvc.perform(post("/api/v1/auth/register-supplier").contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isServiceUnavailable());
        assertFalse(users.existsByPhone("0934567891"));
        reset(gateway);
        mvc.perform(post("/api/v1/auth/register-supplier").contentType(MediaType.APPLICATION_JSON)
                .content(request.replace("\"imageUrl\":\"" + PNG, "\"imageUrl\":\"data:image/png;base64,ZmFrZQ==")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_IMAGE"));
        verifyNoInteractions(gateway);
        assertFalse(users.existsByPhone("0934567891"));
    }
}
