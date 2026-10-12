package com.example.backend;

import com.example.backend.auth.JwtService;
import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import com.example.backend.service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import java.time.*;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import vn.payos.model.webhooks.*;
import vn.payos.model.v2.paymentRequests.*;
import static com.example.backend.model.DomainEnums.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=${REVIEW_TEST_JDBC_URL:jdbc:h2:mem:review-release;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000}",
    "spring.datasource.driver-class-name=${REVIEW_TEST_DRIVER:org.h2.Driver}",
    "spring.datasource.username=${REVIEW_TEST_USERNAME:sa}",
    "spring.datasource.password=${REVIEW_TEST_PASSWORD:}"
})
@ActiveProfiles("test")
@AutoConfigureMockMvc
class BookingReviewReleaseTest {
    @org.junit.jupiter.api.BeforeAll
    static void protectProductionDatabase() {
        String url = System.getenv("REVIEW_TEST_JDBC_URL");
        if (url != null && !url.equals("jdbc:mysql://127.0.0.1:3306/beautylink_review_test")) {
            throw new IllegalStateException("Only the isolated loopback review test database is allowed");
        }
    }
    @Autowired BookingRepository bookings;
    @Autowired BookingReviewRepository reviews;
    @Autowired ServiceOfferingRepository services;
    @Autowired PractitionerRepository practitioners;
    @Autowired UserAccountRepository users;
    @Autowired PaymentTransactionRepository payments;
    @Autowired BookingService bookingService;
    @Autowired ReviewService reviewService;
    @Autowired PaymentService paymentService;
    @Autowired CatalogService catalog;
    @Autowired PlatformTransactionManager transactions;
    @Autowired JwtService jwt;
    @Autowired MockMvc mvc;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @MockitoBean PayOSGateway gateway;

    private <T> T tx(java.util.function.Supplier<T> action) {
        return new TransactionTemplate(transactions).execute(status -> action.get());
    }
    private UserAccount customer() { return users.findByPhone("0900000001").orElseThrow(); }
    private Booking fixture(BookingStatus state, PaymentStatus payment) {
        return tx(() -> {
            ServiceOffering offering = services.findAll().stream().filter(s -> !practitioners.findBySupplierIdAndActiveTrue(s.getSupplier().getId()).isEmpty()).findFirst().orElseThrow();
            Booking b = new Booking(); b.setBookingCode("BL-" + UUID.randomUUID().toString().substring(0, 12));
            b.setCustomer(customer()); b.setService(offering); b.setSupplier(offering.getSupplier());
            b.setPractitioner(practitioners.findBySupplierIdAndActiveTrue(offering.getSupplier().getId()).get(0));
            b.setAppointmentDate(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).minusDays(2));
            b.setStartTime(LocalTime.of(10, 0)); b.setEndTime(LocalTime.of(11, 0));
            b.setTotalAmount(offering.getPrice()); b.setStatus(state); b.setPaymentStatus(payment);
            return bookings.saveAndFlush(b);
        });
    }
    private PaymentTransaction payment(Booking b) {
        PaymentTransaction p = new PaymentTransaction(); p.setBooking(b);
        p.setOrderCode(b.getId() + 9000000); p.setPaymentLinkId("test-" + b.getId());
        p.setAmount(new BigDecimal("250000")); p.setRemainingAmount(new BigDecimal("250000"));
        p.setPaymentOption(PaymentOption.DEPOSIT_50); p.setStatus(PaymentTransactionStatus.PENDING);
        return payments.saveAndFlush(p);
    }
    private Webhook webhook(PaymentTransaction p) {
        Webhook w = mock(Webhook.class); WebhookData d = mock(WebhookData.class);
        when(w.getSuccess()).thenReturn(true); when(d.getOrderCode()).thenReturn(p.getOrderCode());
        when(d.getAmount()).thenReturn(p.getAmount().longValueExact()); when(d.getCode()).thenReturn("00");
        when(d.getPaymentLinkId()).thenReturn(p.getPaymentLinkId()); when(d.getReference()).thenReturn("TEST-REFERENCE");
        when(gateway.verify(w)).thenReturn(d); return w;
    }
    private void providerPaid(PaymentTransaction p) {
        PaymentLink link = mock(PaymentLink.class);
        when(link.getOrderCode()).thenReturn(p.getOrderCode()); when(link.getId()).thenReturn(p.getPaymentLinkId());
        when(link.getAmount()).thenReturn(p.getAmount().longValueExact()); when(link.getAmountPaid()).thenReturn(p.getAmount().longValueExact());
        when(link.getStatus()).thenReturn(PaymentLinkStatus.PAID); when(gateway.get(p.getOrderCode())).thenReturn(link);
    }
    // Hold the first transaction's real row lock while the second writer enters.
    // The bounded timeout proves it cannot finish before the first transaction commits.
    private List<String> serialize(Long id, Runnable first, Runnable second) throws Exception {
        CountDownLatch locked = new CountDownLatch(1), release = new CountDownLatch(1), started = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            Future<String> a = pool.submit(() -> tx(() -> {
                bookings.findByIdForUpdate(id).orElseThrow(); locked.countDown();
                try { assertTrue(release.await(5, TimeUnit.SECONDS)); } catch (InterruptedException e) { throw new IllegalStateException(e); }
                return outcome(first);
            }));
            assertTrue(locked.await(5, TimeUnit.SECONDS));
            Future<String> b = pool.submit(() -> { started.countDown(); return outcome(second); });
            try {
                assertTrue(started.await(5, TimeUnit.SECONDS));
                assertThrows(TimeoutException.class, () -> b.get(150, TimeUnit.MILLISECONDS));
            } finally { release.countDown(); }
            return List.of(a.get(10, TimeUnit.SECONDS), b.get(10, TimeUnit.SECONDS));
        }
    }
    private String outcome(Runnable action) {
        try { action.run(); return "OK"; } catch (ApiException e) { return e.getCode(); }
    }

    @ParameterizedTest @CsvSource({"true,true", "true,false", "false,true", "false,false"})
    void cancelAndPaidProviderNeverLoseBookingState(boolean cancelFirst, boolean useWebhook) throws Exception {
        Booking b = fixture(BookingStatus.PENDING, PaymentStatus.UNPAID); PaymentTransaction p = payment(b);
        Webhook w = webhook(p); providerPaid(p); UserAccount c = customer();
        Runnable cancel = () -> bookingService.cancel(c, b.getId());
        Runnable paid = () -> { if (useWebhook) paymentService.handleWebhook(w); else paymentService.reconcileById(p.getId()); };
        assertEquals(List.of("OK", "OK"), serialize(b.getId(), cancelFirst ? cancel : paid, cancelFirst ? paid : cancel));
        Booking finalBooking = bookings.findById(b.getId()).orElseThrow(); PaymentTransaction finalPayment = payments.findById(p.getId()).orElseThrow();
        assertEquals(BookingStatus.CANCELLED, finalBooking.getStatus()); assertFalse(finalBooking.isPaymentRetryAllowed());
        assertEquals(cancelFirst ? PaymentTransactionStatus.REVIEW_REQUIRED : PaymentTransactionStatus.PAID, finalPayment.getStatus());
        assertEquals(cancelFirst ? PaymentStatus.UNPAID : PaymentStatus.PARTIALLY_PAID, finalBooking.getPaymentStatus());
    }
    @Test void duplicateWebhookAndReconciliationAreSerializedAndIdempotent() throws Exception {
        Booking b = fixture(BookingStatus.PENDING, PaymentStatus.UNPAID); PaymentTransaction p = payment(b); Webhook w = webhook(p);
        providerPaid(p);
        serialize(b.getId(), () -> paymentService.handleWebhook(w), () -> paymentService.reconcileById(p.getId()));
        Instant paidAt = payments.findById(p.getId()).orElseThrow().getPaidAt();
        serialize(b.getId(), () -> paymentService.handleWebhook(w), () -> paymentService.handleWebhook(w));
        assertEquals(paidAt, payments.findById(p.getId()).orElseThrow().getPaidAt());
        assertEquals(BookingStatus.CONFIRMED, bookings.findById(b.getId()).orElseThrow().getStatus());
    }
    @ParameterizedTest @CsvSource({"true", "false"})
    void completeAndCancelSerializeWithoutLostUpdate(boolean completeFirst) throws Exception {
        Booking b = fixture(BookingStatus.CONFIRMED, PaymentStatus.PARTIALLY_PAID); UserAccount c = customer();
        Runnable complete = () -> bookingService.complete(c, b.getId()), cancel = () -> bookingService.cancel(c, b.getId());
        assertEquals(List.of("OK", completeFirst ? "BOOKING_COMPLETED" : "BOOKING_NOT_COMPLETABLE"), serialize(b.getId(), completeFirst ? complete : cancel, completeFirst ? cancel : complete));
        assertEquals(completeFirst ? BookingStatus.COMPLETED : BookingStatus.CANCELLED, bookings.findById(b.getId()).orElseThrow().getStatus());
        assertEquals(PaymentStatus.PARTIALLY_PAID, bookings.findById(b.getId()).orElseThrow().getPaymentStatus());
    }
    @Test void twoCompletionsAreIdempotent() throws Exception {
        Booking b = fixture(BookingStatus.CONFIRMED, PaymentStatus.PAID); UserAccount c = customer();
        Runnable complete = () -> bookingService.complete(c, b.getId());
        assertEquals(List.of("OK", "OK"), serialize(b.getId(), complete, complete));
        assertEquals(BookingStatus.COMPLETED, bookings.findById(b.getId()).orElseThrow().getStatus());
    }
    @ParameterizedTest @CsvSource({"SERVICE,SERVICE,1", "SUPPLIER,SUPPLIER,1", "SERVICE,SUPPLIER,2"})
    void concurrentReviewsPreserveUniquenessAndBothTargets(ReviewTargetType a, ReviewTargetType b, int count) throws Exception {
        Booking booking = fixture(BookingStatus.COMPLETED, PaymentStatus.PARTIALLY_PAID); UserAccount c = customer();
        assertEquals(List.of("OK", "OK"), serialize(booking.getId(),
                () -> reviewService.upsert(c, booking.getId(), a, new UpsertBookingReviewRequest(1, "first")),
                () -> reviewService.upsert(c, booking.getId(), b, new UpsertBookingReviewRequest(5, "second"))));
        assertEquals(count, reviews.findAll().stream().filter(r -> r.getBooking().getId().equals(booking.getId())).count());
        assertEquals(5, reviews.findByBookingIdAndTargetType(booking.getId(), b).orElseThrow().getRating());
    }

    @Test void scopePaginationAggregatesAndRefundedLegacyReviewsAgree() {
        Booking source = fixture(BookingStatus.COMPLETED, PaymentStatus.PAID); UserAccount c = customer();
        Long serviceId = source.getService().getId(), supplierId = source.getSupplier().getId();
        long beforeService = catalog.serviceReviews(serviceId, 0, 100).totalElements();
        long beforeSupplier = catalog.supplierReviews(supplierId, 0, 100).totalElements();
        List<Long> serviceReviewIds = new ArrayList<>();
        Instant identicalCreatedAt = Instant.now().plusSeconds(60);
        for (int i = 0; i < 105; i++) {
            Booking b = fixture(BookingStatus.COMPLETED, PaymentStatus.PAID);
            var serviceReview = reviewService.upsert(c, b.getId(), ReviewTargetType.SERVICE, new UpsertBookingReviewRequest(1, "Service"));
            var supplierReview = reviewService.upsert(c, b.getId(), ReviewTargetType.SUPPLIER, new UpsertBookingReviewRequest(5, "Supplier"));
            serviceReviewIds.add(serviceReview.id());
            jdbc.update("update booking_reviews set created_at = ? where id = ?", java.sql.Timestamp.from(identicalCreatedAt), serviceReview.id());
            jdbc.update("update booking_reviews set created_at = ? where id = ?", java.sql.Timestamp.from(identicalCreatedAt), supplierReview.id());
        }
        PublicReviewPageResponse first = catalog.serviceReviews(serviceId, 0, 999), second = catalog.serviceReviews(serviceId, 1, 100);
        assertEquals(100, first.size()); assertEquals(100, first.content().size());
        assertEquals(beforeService + 105, first.totalElements()); assertEquals(beforeSupplier + 105, catalog.supplierReviews(supplierId, 0, 100).totalElements());
        Set<Long> ids = new HashSet<>(); first.content().forEach(r -> assertTrue(ids.add(r.id()))); second.content().forEach(r -> assertTrue(ids.add(r.id())));
        assertTrue(first.content().stream().allMatch(r -> r.targetType() == ReviewTargetType.SERVICE && r.serviceId().equals(serviceId)));
        assertTrue(catalog.supplierReviews(supplierId, 0, 100).content().stream().allMatch(r -> r.targetType() == ReviewTargetType.SUPPLIER));
        assertEquals(first.content(), catalog.serviceReviews(serviceId, 0, 100).content());
        assertEquals(serviceReviewIds.reversed().subList(0, 100), first.content().stream().map(PublicReviewResponse::id).toList());
        ServiceResponse summary = catalog.service(serviceId);
        assertEquals(first.totalElements(), summary.serviceReviewCount()); assertEquals(first.rating(), summary.rating());
        assertEquals(catalog.supplierReviews(supplierId, 0, 100).rating(), summary.supplierRating());
        // Same supplier, distinct service must not inherit reviews or supplier's rating.
        Long otherService = tx(() -> services.findBySupplierIdAndActiveTrue(supplierId).stream().filter(s -> !s.getId().equals(serviceId)).findFirst().orElseThrow().getId());
        assertTrue(catalog.serviceReviews(otherService, 0, 100).content().stream().allMatch(r -> r.serviceId().equals(otherService)));
        if (catalog.serviceReviews(otherService, 0, 100).totalElements() == 0) assertEquals(0, catalog.service(otherService).rating());
        reviewService.upsert(c, source.getId(), ReviewTargetType.SERVICE, new UpsertBookingReviewRequest(4, "legacy"));
        tx(() -> { Booking b = bookings.findByIdForUpdate(source.getId()).orElseThrow(); b.setPaymentStatus(PaymentStatus.REFUNDED); return null; });
        assertEquals(first.totalElements(), catalog.serviceReviews(serviceId, 0, 100).totalElements());
        assertFalse(catalog.serviceReviews(serviceId, 0, 100).content().stream().anyMatch(r -> "legacy".equals(r.comment())));
        assertThrows(ApiException.class, () -> reviewService.upsert(c, source.getId(), ReviewTargetType.SUPPLIER, new UpsertBookingReviewRequest(5, null)));
        assertThrows(ApiException.class, () -> catalog.serviceReviews(serviceId, -1, 20));
        assertThrows(ApiException.class, () -> catalog.supplierReviews(supplierId, 0, 0));
    }

    @ParameterizedTest @CsvSource({"0,400", "1,200", "5,200", "6,400"})
    void ratingBoundariesAndBothTargets(int rating, int status) throws Exception {
        Booking b = fixture(BookingStatus.COMPLETED, PaymentStatus.PAID);
        for (ReviewTargetType target : ReviewTargetType.values()) mvc.perform(put("/api/v1/bookings/" + b.getId() + "/reviews/" + target)
                .header("Authorization", "Bearer " + jwt.createToken(customer())).contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":" + rating + ",\"comment\":\"\"}")).andExpect(status().is(status));
    }
    @ParameterizedTest @CsvSource({
        "PENDING,UNPAID", "PENDING,PARTIALLY_PAID", "PENDING,PAID", "PENDING,REFUNDED",
        "CONFIRMED,UNPAID", "CONFIRMED,PARTIALLY_PAID", "CONFIRMED,PAID", "CONFIRMED,REFUNDED",
        "COMPLETED,UNPAID", "COMPLETED,PARTIALLY_PAID", "COMPLETED,PAID", "COMPLETED,REFUNDED",
        "CANCELLED,UNPAID", "CANCELLED,PARTIALLY_PAID", "CANCELLED,PAID", "CANCELLED,REFUNDED"
    })
    @org.springframework.transaction.annotation.Transactional
    void legacyPublicReviewMatrix(BookingStatus state, PaymentStatus payment) {
        Booking b = fixture(state, payment);
        long serviceBefore = catalog.serviceReviews(b.getService().getId(), 0, 100).totalElements();
        long supplierBefore = catalog.supplierReviews(b.getSupplier().getId(), 0, 100).totalElements();
        for (ReviewTargetType target : ReviewTargetType.values()) {
            BookingReview r = new BookingReview(); r.setBooking(b); r.setCustomer(b.getCustomer());
            r.setSupplier(b.getSupplier()); r.setService(b.getService()); r.setTargetType(target); r.setRating(4);
            reviews.saveAndFlush(r);
        }
        boolean eligible = state == BookingStatus.COMPLETED && (payment == PaymentStatus.PAID || payment == PaymentStatus.PARTIALLY_PAID);
        assertEquals(serviceBefore + (eligible ? 1 : 0), catalog.serviceReviews(b.getService().getId(), 0, 100).totalElements());
        assertEquals(supplierBefore + (eligible ? 1 : 0), catalog.supplierReviews(b.getSupplier().getId(), 0, 100).totalElements());
    }
    @Test void commentsRolesOwnershipMissingBookingAndInvalidTarget() throws Exception {
        Booking b = fixture(BookingStatus.COMPLETED, PaymentStatus.PAID); String token = jwt.createToken(customer());
        String url = "/api/v1/bookings/" + b.getId() + "/reviews/SERVICE";
        for (String comment : List.of("", "   ", "x".repeat(1500), "x".repeat(1501))) {
            mvc.perform(put(url).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"rating\":5,\"comment\":\"" + comment + "\"}")).andExpect(status().is(comment.length() > 1500 ? 400 : 200));
        }
        mvc.perform(put(url).contentType(MediaType.APPLICATION_JSON).content("{\"rating\":5}")).andExpect(status().isUnauthorized());
        for (UserAccount user : users.findAll()) if (user.getRole() != Role.CUSTOMER) {
            String other = jwt.createToken(user);
            mvc.perform(patch("/api/v1/bookings/" + b.getId() + "/complete").header("Authorization", "Bearer " + other)).andExpect(status().isForbidden());
            mvc.perform(put(url).header("Authorization", "Bearer " + other).contentType(MediaType.APPLICATION_JSON).content("{\"rating\":5}")).andExpect(status().isForbidden());
        }
        mvc.perform(put(url.replace("SERVICE", "WRONG")).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content("{\"rating\":5}")).andExpect(status().isBadRequest());
        mvc.perform(patch("/api/v1/bookings/999999999/complete").header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
        mvc.perform(put("/api/v1/bookings/999999999/reviews/SERVICE").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content("{\"rating\":5}")).andExpect(status().isNotFound());
        UserAccount other = new UserAccount(); other.setId(-1L);
        assertEquals("REVIEW_FORBIDDEN", assertThrows(ApiException.class, () -> reviewService.upsert(other, b.getId(), ReviewTargetType.SERVICE, new UpsertBookingReviewRequest(5, null))).getCode());
        mvc.perform(get("/api/v1/services/" + b.getService().getId() + "/reviews").param("size", "500")).andExpect(status().isOk()).andExpect(jsonPath("$.size").value(100));
    }
    @Test void staleFrontendFlagsAndLegacyZeroRatingCannotUnlockPublicReviews() throws Exception {
        Booking b = fixture(BookingStatus.CONFIRMED, PaymentStatus.PAID);
        mvc.perform(put("/api/v1/bookings/" + b.getId() + "/reviews/SERVICE")
                .header("Authorization", "Bearer " + jwt.createToken(customer())).contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":5,\"reviewEligible\":true,\"status\":\"COMPLETED\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("REVIEW_NOT_ELIGIBLE"));
        tx(() -> { var row = bookings.findByIdForUpdate(b.getId()).orElseThrow(); row.setStatus(BookingStatus.COMPLETED); return null; });
        long count = catalog.serviceReviews(b.getService().getId(), 0, 100).totalElements();
        BookingReview legacy = new BookingReview(); legacy.setBooking(b); legacy.setCustomer(customer()); legacy.setSupplier(b.getSupplier());
        legacy.setService(b.getService()); legacy.setTargetType(ReviewTargetType.SERVICE); legacy.setRating(0); reviews.saveAndFlush(legacy);
        assertEquals(count, catalog.serviceReviews(b.getService().getId(), 0, 100).totalElements());
    }
}
