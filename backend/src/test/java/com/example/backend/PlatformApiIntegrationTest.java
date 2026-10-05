package com.example.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.backend.repository.SupplierVerificationRepository;
import com.example.backend.repository.BookingRepository;
import com.example.backend.repository.PaymentTransactionRepository;
import com.example.backend.service.PayOSGateway;
import com.example.backend.model.DomainEnums.BookingStatus;
import com.example.backend.model.DomainEnums.PaymentStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkResponse;
import vn.payos.model.webhooks.WebhookData;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.Instant;
import java.math.RoundingMode;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PlatformApiIntegrationTest {
    private static final String TEST_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired SupplierVerificationRepository supplierVerifications;
    @Autowired BookingRepository bookings;
    @Autowired PaymentTransactionRepository paymentTransactions;
    @MockitoBean PayOSGateway payOSGateway;

    @Test
    void validationReturnsFieldMessagesForCustomerAndAdminInput() throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"A\",\"phone\":\"123\",\"email\":\"sai\",\"password\":\"123\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.fields.fullName", not(emptyString())))
                .andExpect(jsonPath("$.fields.phone", not(emptyString())))
                .andExpect(jsonPath("$.fields.email", not(emptyString())))
                .andExpect(jsonPath("$.fields.password", not(emptyString())));

        String customerToken = login("0900000001", "BeautyLinkTest123!");
        String adminToken = login("0900000004", "BeautyLinkTest123!");
        JsonNode service = objectMapper.readTree(mvc.perform(get("/api/v1/homepage/services"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get(0);
        String createdReport = mvc.perform(post("/api/v1/reports")
                        .header("Authorization", "Bearer " + customerToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetType\":\"SERVICE\",\"targetId\":" + service.path("id").asLong()
                                + ",\"reason\":\"Sai thông tin\",\"details\":\"Nội dung báo cáo đủ dài để kiểm thử.\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long reportId = objectMapper.readTree(createdReport).path("id").asLong();

        mvc.perform(patch("/api/v1/reports/" + reportId)
                        .header("Authorization", "Bearer " + adminToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"RESOLVED\",\"resolutionNote\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.fields.resolutionNoteValid", not(emptyString())));
    }

    @Test
    void publicCatalogExposesSeededLocationsCategoriesAndServices() throws Exception {
        String rootLocations = mvc.perform(get("/api/v1/locations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].type", is("PROVINCE_CITY")))
                .andReturn().getResponse().getContentAsString();

        mvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(5)))
                .andExpect(jsonPath("$[*].slug", hasItem("makeup")));

        mvc.perform(get("/api/v1/categories/makeup/services"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[0].practitioners", not(empty())));

        JsonNode roots = objectMapper.readTree(rootLocations);
        long hcmId = 0;
        long hanoiId = 0;
        for (JsonNode root : roots) {
            if ("ho-chi-minh".equals(root.path("slug").asText())) hcmId = root.path("id").asLong();
            if ("ha-noi".equals(root.path("slug").asText())) hanoiId = root.path("id").asLong();
        }
        mvc.perform(get("/api/v1/categories/makeup/services").param("locationId", Long.toString(hcmId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())));

        for (String slug : new String[]{"makeup", "hair", "spa", "nails", "skincare"}) {
            mvc.perform(get("/api/v1/categories/" + slug + "/services").param("locationId", Long.toString(hanoiId)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(2))))
                    .andExpect(jsonPath("$[*].supplierDemo", everyItem(is(true))));
        }

        String homepage = mvc.perform(get("/api/v1/homepage/services").param("locationId", Long.toString(hcmId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(12))))
                .andExpect(jsonPath("$[*].supplierDemo", hasItem(true)))
                .andExpect(jsonPath("$[*].featured", hasItem(true)))
                .andReturn().getResponse().getContentAsString();

        long supplierId = objectMapper.readTree(homepage).get(0).path("supplierId").asLong();
        mvc.perform(get("/api/v1/suppliers/" + supplierId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is((int) supplierId)))
                .andExpect(jsonPath("$.verificationStatus", is("VERIFIED")))
                .andExpect(jsonPath("$.services", not(empty())))
                .andExpect(jsonPath("$.reviews").isArray())
                .andExpect(jsonPath("$.owner").doesNotExist());
    }

    @Test
    void customerCanRegisterAndUseProtectedProfileEndpoint() throws Exception {
        String registerBody = """
                {"fullName":"Nguyen An","phone":"0912345678","email":"an@example.com","password":"StrongPass123!"}
                """;

        String response = mvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken", not(emptyString())))
                .andExpect(jsonPath("$.user.role", is("CUSTOMER")))
                .andReturn().getResponse().getContentAsString();

        JsonNode payload = objectMapper.readTree(response);
        String token = payload.path("accessToken").asText();
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phone", is("0912345678")));
    }

    @Test
    void protectedEndpointRejectsAnonymousRequests() throws Exception {
        mvc.perform(get("/api/v1/bookings/mine"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void productMutationsRequireAdminRole() throws Exception {
        mvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Restricted product\",\"price\":100000}"))
                .andExpect(status().isUnauthorized());

        String customerToken = login("0900000001", "BeautyLinkTest123!");
        mvc.perform(post("/api/products")
                        .header("Authorization", "Bearer " + customerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Restricted product\",\"price\":100000}"))
                .andExpect(status().isForbidden());

        String adminToken = login("0900000004", "BeautyLinkTest123!");
        mvc.perform(post("/api/products")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Admin product\",\"price\":100000}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name", is("Admin product")));
    }

    @Test
    void repeatedFailedLoginsAreRateLimitedWithoutEchoingCredentials() throws Exception {
        for (int attempt = 0; attempt < 8; attempt++) {
            mvc.perform(post("/api/v1/auth/login")
                            .with(request -> { request.setRemoteAddr("198.51.100.77"); return request; })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"identifier\":\"attacker@example.com\",\"password\":\"WrongPass123!\"}"))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/v1/auth/login")
                        .with(request -> { request.setRemoteAddr("198.51.100.77"); return request; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"attacker@example.com\",\"password\":\"WrongPass123!\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code", is("RATE_LIMITED")))
                .andExpect(content().string(not(containsString("attacker@example.com"))))
                .andExpect(content().string(not(containsString("WrongPass123!"))));
    }

    @Test
    void invalidRegistrationsAreRateLimitedBeforeBeanValidation() throws Exception {
        for (int attempt = 0; attempt < 5; attempt++) {
            mvc.perform(post("/api/v1/auth/register-supplier")
                            .with(request -> { request.setRemoteAddr("198.51.100.80"); return request; })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"ownerName\":\"x\"}"))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(post("/api/v1/auth/register-supplier")
                        .with(request -> { request.setRemoteAddr("198.51.100.80"); return request; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ownerName\":\"x\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code", is("RATE_LIMITED")));
    }

    @Test
    void duplicateRegistrationUsesGenericConflictAndFakeImageBytesAreRejected() throws Exception {
        mvc.perform(post("/api/v1/auth/register")
                        .with(request -> { request.setRemoteAddr("198.51.100.78"); return request; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Duplicate User\",\"phone\":\"0900000001\",\"email\":\"unused@example.com\",\"password\":\"StrongPass123!\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code", is("REGISTRATION_CONFLICT")))
                .andExpect(content().string(not(containsString("PHONE_EXISTS"))));

        JsonNode locations = objectMapper.readTree(mvc.perform(get("/api/v1/locations"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        long cityId = locations.get(0).path("id").asLong();
        String invalidImageBody = """
                {"ownerName":"Fake Image","phone":"0934567891","email":"fake.image@example.com",
                 "password":"StrongPass123!","businessName":"Fake Image Studio","businessType":"Studio",
                 "locationId":%d,"addressLine":"25 Nguyen Trai","description":"Studio trang diem",
                 "specialty":"Trang diem","cccdNumber":"079203001235",
                 "cccdFrontImage":"data:image/jpeg;base64,aGVsbG8=","cccdBackImage":"%s",
                 "imageUrl":"%s","latitude":10.7769,"longitude":106.7009}
                """.formatted(cityId, TEST_PNG, TEST_PNG);
        mvc.perform(post("/api/v1/auth/register-supplier")
                        .with(request -> { request.setRemoteAddr("198.51.100.79"); return request; })
                        .contentType(MediaType.APPLICATION_JSON).content(invalidImageBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("INVALID_IDENTITY_IMAGE")));
    }

    @Test
    void oversizedRequestIsRejectedBeforeJsonDeserialization() throws Exception {
        String oversizedBody = "x".repeat(4 * 1024 * 1024 + 1);
        mvc.perform(post("/api/v1/auth/register-supplier")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(oversizedBody))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code", is("REQUEST_TOO_LARGE")));
    }

    @Test
    void customerCanBookAnAvailableSlotAndReadItBack() throws Exception {
        String customerToken = login("0900000001", "BeautyLinkTest123!");
        JsonNode services = objectMapper.readTree(mvc.perform(get("/api/v1/homepage/services"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        long serviceId = services.get(0).path("id").asLong();
        long practitionerId = services.get(0).path("practitioners").get(0).path("id").asLong();
        LocalDate date = LocalDate.now().plusDays(1);
        while (date.getDayOfWeek() != DayOfWeek.MONDAY) date = date.plusDays(1);

        mvc.perform(post("/api/v1/bookings")
                        .header("Authorization", "Bearer " + customerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"serviceId\":" + serviceId + ",\"practitionerId\":" + practitionerId + ",\"appointmentDate\":\"" + date + "\",\"startTime\":\"09:00\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.bookingCode", startsWith("BL-")))
                .andExpect(jsonPath("$.status", is("PENDING")))
                .andExpect(jsonPath("$.paymentStatus", is("UNPAID")));

        mvc.perform(get("/api/v1/bookings/mine").header("Authorization", "Bearer " + customerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[*].status", hasItem("PENDING")));
    }

    @Test
    void paidCustomerBookingCanReviewServiceAndSupplier() throws Exception {
        String customerToken = login("0900000001", "BeautyLinkTest123!");
        JsonNode services = objectMapper.readTree(mvc.perform(get("/api/v1/homepage/services"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode service = services.get(0);
        long serviceId = service.path("id").asLong();
        long practitionerId = service.path("practitioners").get(0).path("id").asLong();

        LocalDate date = null;
        String slot = null;
        for (int day = 1; day <= 30 && slot == null; day++) {
            LocalDate candidateDate = LocalDate.now().plusDays(day);
            JsonNode availability = objectMapper.readTree(mvc.perform(get("/api/v1/services/" + serviceId + "/availability")
                            .param("practitionerId", Long.toString(practitionerId))
                            .param("date", candidateDate.toString()))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
            if (!availability.path("availableSlots").isEmpty()) {
                date = candidateDate;
                slot = availability.path("availableSlots").get(0).asText();
            }
        }
        assertNotNull(slot, "A seeded practitioner should have an available review-test slot");

        String created = mvc.perform(post("/api/v1/bookings")
                        .header("Authorization", "Bearer " + customerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"serviceId\":" + serviceId + ",\"practitionerId\":" + practitionerId + ",\"appointmentDate\":\"" + date + "\",\"startTime\":\"" + slot + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.reviewEligible", is(false)))
                .andExpect(jsonPath("$.serviceReview").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        long bookingId = objectMapper.readTree(created).path("id").asLong();
        var paidBooking = bookings.findById(bookingId).orElseThrow();
        paidBooking.setPaymentStatus(PaymentStatus.PAID);
        paidBooking.setStatus(BookingStatus.CONFIRMED);
        bookings.saveAndFlush(paidBooking);

        String serviceReview = mvc.perform(put("/api/v1/bookings/" + bookingId + "/reviews/SERVICE")
                        .header("Authorization", "Bearer " + customerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rating\":5,\"comment\":\"Dich vu rat tot\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.targetType", is("SERVICE")))
                .andExpect(jsonPath("$.rating", is(5)))
                .andReturn().getResponse().getContentAsString();
        long serviceReviewId = objectMapper.readTree(serviceReview).path("id").asLong();

        mvc.perform(put("/api/v1/bookings/" + bookingId + "/reviews/SUPPLIER")
                        .header("Authorization", "Bearer " + customerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rating\":4,\"comment\":\"Cua hang sach se\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.targetType", is("SUPPLIER")))
                .andExpect(jsonPath("$.rating", is(4)));

        mvc.perform(put("/api/v1/bookings/" + bookingId + "/reviews/SERVICE")
                        .header("Authorization", "Bearer " + customerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rating\":3,\"comment\":\"Da cap nhat\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is((int) serviceReviewId)))
                .andExpect(jsonPath("$.rating", is(3)));

        JsonNode mine = objectMapper.readTree(mvc.perform(get("/api/v1/bookings/mine")
                        .header("Authorization", "Bearer " + customerToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode reviewedBooking = null;
        for (JsonNode candidate : mine) if (candidate.path("id").asLong() == bookingId) reviewedBooking = candidate;
        assertNotNull(reviewedBooking);
        assertTrue(reviewedBooking.path("reviewEligible").asBoolean());
        assertTrue(reviewedBooking.path("serviceReview").path("rating").asInt() == 3);
        assertTrue(reviewedBooking.path("supplierReview").path("rating").asInt() == 4);

        mvc.perform(put("/api/v1/bookings/" + bookingId + "/reviews/SERVICE")
                        .header("Authorization", "Bearer " + customerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rating\":6}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void payOSWebhookVerifiesAndConfirmsCustomerBooking() throws Exception {
        String customerToken = login("0900000001", "BeautyLinkTest123!");
        JsonNode service = objectMapper.readTree(mvc.perform(get("/api/v1/homepage/services"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get(0);
        long serviceId = service.path("id").asLong();
        long practitionerId = service.path("practitioners").get(0).path("id").asLong();
        LocalDate date = LocalDate.now().plusDays(1);
        String slot = null;
        for (int day = 1; day <= 30 && slot == null; day++) {
            date = LocalDate.now().plusDays(day);
            JsonNode availability = objectMapper.readTree(mvc.perform(get("/api/v1/services/" + serviceId + "/availability")
                            .param("practitionerId", Long.toString(practitionerId)).param("date", date.toString()))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
            if (!availability.path("availableSlots").isEmpty()) slot = availability.path("availableSlots").get(0).asText();
        }
        assertNotNull(slot);
        String created = mvc.perform(post("/api/v1/bookings")
                        .header("Authorization", "Bearer " + customerToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"serviceId\":" + serviceId + ",\"practitionerId\":" + practitionerId
                                + ",\"appointmentDate\":\"" + date + "\",\"startTime\":\"" + slot + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long bookingId = objectMapper.readTree(created).path("id").asLong();

        when(payOSGateway.create(any())).thenAnswer(invocation -> {
            var request = (vn.payos.model.v2.paymentRequests.CreatePaymentLinkRequest) invocation.getArgument(0);
            assertTrue(request.getDescription().length() <= 9, "PayOS description must be at most 9 characters");
            assertTrue(request.getDescription().startsWith("BL"));
            var response = mock(CreatePaymentLinkResponse.class);
            when(response.getOrderCode()).thenReturn(request.getOrderCode());
            when(response.getAmount()).thenReturn(request.getAmount());
            when(response.getPaymentLinkId()).thenReturn("payos-link-test");
            when(response.getCheckoutUrl()).thenReturn("https://pay.payos.vn/web/test");
            return response;
        });
        String paymentJson = mvc.perform(post("/api/v1/payments/payos/bookings/" + bookingId)
                        .header("Authorization", "Bearer " + customerToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentOption\":\"DEPOSIT_50\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("PENDING")))
                .andExpect(jsonPath("$.checkoutUrl", is("https://pay.payos.vn/web/test")))
                .andReturn().getResponse().getContentAsString();
        JsonNode payment = objectMapper.readTree(paymentJson);
        long expectedDeposit = bookings.findById(bookingId).orElseThrow().getTotalAmount()
                .multiply(new java.math.BigDecimal("0.50")).setScale(0, RoundingMode.HALF_UP).longValueExact();
        assertTrue(payment.path("amount").asLong() == expectedDeposit, "Deposit must be 50% of the discounted booking total");
        long orderCode = payment.path("orderCode").asLong();
        long amount = payment.path("amount").asLong();
        WebhookData verifiedData = mock(WebhookData.class);
        when(verifiedData.getOrderCode()).thenReturn(orderCode);
        when(verifiedData.getAmount()).thenReturn(amount);
        when(verifiedData.getPaymentLinkId()).thenReturn("payos-link-test");
        when(verifiedData.getReference()).thenReturn("BANK-REF-001");
        when(verifiedData.getCode()).thenReturn("00");
        when(payOSGateway.verify(any())).thenReturn(verifiedData);

        mvc.perform(post("/api/v1/payments/payos/webhook").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"00\",\"desc\":\"success\",\"success\":true,\"data\":{\"orderCode\":"
                                + orderCode + ",\"amount\":" + amount + ",\"code\":\"00\"},\"signature\":\"signed\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success", is(true)));
        mvc.perform(get("/api/v1/payments/payos/" + orderCode).header("Authorization", "Bearer " + customerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status", is("PAID")));
        mvc.perform(get("/api/v1/bookings/mine").header("Authorization", "Bearer " + customerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id == " + bookingId + ")].paymentStatus", hasItem("PAID")));
    }

    @Test
    void demoSupplierScheduleRemainsAvailableThroughTheNextMonth() throws Exception {
        JsonNode services = objectMapper.readTree(mvc.perform(get("/api/v1/homepage/services"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode service = null;
        for (JsonNode candidate : services) {
            if (candidate.path("supplierDemo").asBoolean()) {
                service = candidate;
                break;
            }
        }
        assertNotNull(service, "The demo catalog should expose at least one fake supplier");
        long serviceId = service.path("id").asLong();
        long practitionerId = service.path("practitioners").get(0).path("id").asLong();
        LocalDate lastBookableDate = LocalDate.now().plusMonths(1);
        while (lastBookableDate.getDayOfWeek() == DayOfWeek.SUNDAY) {
            lastBookableDate = lastBookableDate.minusDays(1);
        }

        mvc.perform(get("/api/v1/services/" + serviceId + "/availability")
                        .param("practitionerId", Long.toString(practitionerId))
                        .param("date", lastBookableDate.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date", is(lastBookableDate.toString())))
                .andExpect(jsonPath("$.availableSlots", not(empty())));
    }

    @Test
    void supplierCanReadAndReplaceOwnedPractitionerSchedule() throws Exception {
        String supplierToken = login("0900000002", "BeautyLinkTest123!");
        JsonNode people = objectMapper.readTree(mvc.perform(get("/api/v1/supplier/practitioners")
                        .header("Authorization", "Bearer " + supplierToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        long practitionerId = people.get(0).path("id").asLong();

        mvc.perform(put("/api/v1/supplier/practitioners/" + practitionerId + "/schedule")
                        .header("Authorization", "Bearer " + supplierToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rules\":[{\"dayOfWeek\":\"MONDAY\",\"startTime\":\"09:00\",\"endTime\":\"18:00\",\"breakStart\":\"12:00\",\"breakEnd\":\"13:00\",\"slotMinutes\":30,\"active\":true}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].dayOfWeek", is("MONDAY")));
    }

    @Test
    void supplierCanRegisterAndReceivesAReadyToConfigureWorkspace() throws Exception {
        JsonNode locations = objectMapper.readTree(mvc.perform(get("/api/v1/locations"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        long cityId = locations.get(0).path("id").asLong();
        String body = """
                {"ownerName":"Le Minh","phone":"0934567890","email":"partner.new@example.com",
                 "password":"StrongPass123!","businessName":"Minh Beauty House","businessType":"Makeup Studio",
                 "locationId":%d,"addressLine":"25 Nguyen Trai","description":"Studio trang diem",
                 "specialty":"Trang diem co dau","cccdNumber":"079203001234",
                 "cccdFrontImage":"%s","cccdBackImage":"%s",
                 "imageUrl":"%s","latitude":10.7769,"longitude":106.7009}
                """.formatted(cityId, TEST_PNG, TEST_PNG, TEST_PNG);

        String response = mvc.perform(post("/api/v1/auth/register-supplier")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.auth.accessToken", not(emptyString())))
                .andExpect(jsonPath("$.auth.user.role", is("SUPPLIER")))
                .andExpect(jsonPath("$.supplier.verificationStatus", is("VERIFIED")))
                .andExpect(jsonPath("$.supplier.latitude", is(10.7769)))
                .andExpect(jsonPath("$.supplier.cccdNumber").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        JsonNode registration = objectMapper.readTree(response);
        String token = registration.path("auth").path("accessToken").asText();
        long supplierId = registration.path("supplier").path("id").asLong();
        var verification = supplierVerifications.findBySupplierId(supplierId).orElseThrow();
        assertTrue(verification.getEncryptedCccdNumber().startsWith("v1:"));
        assertFalse(verification.getEncryptedCccdNumber().contains("079203001234"));

        mvc.perform(get("/api/v1/supplier/profile").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name", is("Minh Beauty House")));
        JsonNode people = objectMapper.readTree(mvc.perform(get("/api/v1/supplier/practitioners")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)))
                .andReturn().getResponse().getContentAsString());
        long practitionerId = people.get(0).path("id").asLong();
        mvc.perform(get("/api/v1/supplier/practitioners/" + practitionerId + "/schedule")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(7)));

        mvc.perform(put("/api/v1/supplier/practitioners/" + practitionerId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"displayName":"Le Minh Artist","specialty":"Makeup",
                                 "bio":"Chuyen vien trang diem","avatarUrl":"%s"}
                                """.formatted(TEST_PNG)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName", is("Le Minh Artist")))
                .andExpect(jsonPath("$.avatarUrl", startsWith("data:image/png;base64,")));

        mvc.perform(put("/api/v1/supplier/profile")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Minh Beauty House","businessType":"Makeup Studio",
                                 "description":"Studio trang diem chuyen nghiep","addressLine":"25 Nguyen Trai",
                                 "imageUrl":"%s","latitude":10.777,"longitude":106.701}
                                """.formatted(TEST_PNG)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.imageUrl", startsWith("data:image/png;base64,")));

        JsonNode categories = objectMapper.readTree(mvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        long categoryId = categories.get(0).path("id").asLong();
        mvc.perform(post("/api/v1/supplier/services")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId":%d,"name":"Makeup du tiec","description":"Phong cach tu nhien",
                                 "price":450000,"originalPrice":600000,"durationMinutes":90,
                                 "imageUrl":"%s","active":true}
                                """.formatted(categoryId, TEST_PNG)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.active", is(true)));

        mvc.perform(get("/api/v1/supplier/services").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));

        mvc.perform(get("/api/v1/homepage/services").param("locationId", Long.toString(cityId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].supplierId", is((int) supplierId)))
                .andExpect(jsonPath("$[0].supplierDemo", is(false)))
                .andExpect(jsonPath("$[0].featured", is(true)));
    }

    @Test
    void customerReportCanBeResolvedByStaff() throws Exception {
        String customerToken = login("0900000001", "BeautyLinkTest123!");
        String staffToken = login("0900000003", "BeautyLinkTest123!");
        String created = mvc.perform(post("/api/v1/reports")
                        .header("Authorization", "Bearer " + customerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetType\":\"BOOKING\",\"targetId\":999,\"reason\":\"Can ho tro\",\"details\":\"Khach hang can thay doi lich hen\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status", is("OPEN")))
                .andReturn().getResponse().getContentAsString();
        long reportId = objectMapper.readTree(created).path("id").asLong();

        mvc.perform(patch("/api/v1/reports/" + reportId)
                        .header("Authorization", "Bearer " + staffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"RESOLVED\",\"resolutionNote\":\"Da lien he khach hang\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("RESOLVED")))
                .andExpect(jsonPath("$.assignedStaffName", not(emptyString())));
    }

    private String login(String identifier, String password) throws Exception {
        String response = mvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"" + identifier + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).path("accessToken").asText();
    }
}
