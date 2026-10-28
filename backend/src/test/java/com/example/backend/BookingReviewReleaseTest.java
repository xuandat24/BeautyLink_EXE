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
    "spring.datasource.password=${REVIEW_TEST_PASSWORD:}",
    "app.booking-email.enabled=true", "app.booking-email.dispatch-initial-delay-ms=36000000"
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
    @MockitoBean PublicImageStorage imageStorage;
    @MockitoBean TransactionalEmailSender emailSender;
    @Autowired EmailNotificationOutboxRepository emailJobs;
    @Autowired BookingCompletionPolicy clockPolicy;
    @Autowired FeedbackReminderService reminderDispatcher;

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
    @Test void publicCatalogActivityCountsOnlyConfirmedAndCompletedBookings() {
        Booking pending = fixture(BookingStatus.PENDING, PaymentStatus.UNPAID);
        Long serviceId = pending.getService().getId();
        long before = catalog.service(serviceId).bookedOrCompletedCount();
        assertEquals(before, catalog.service(serviceId).bookedOrCompletedCount());
        assertEquals(before, catalog.publicServices().stream().filter(s -> s.id().equals(serviceId)).findFirst().orElseThrow().bookedOrCompletedCount());
        tx(() -> { bookings.findByIdForUpdate(pending.getId()).orElseThrow().setStatus(BookingStatus.CONFIRMED); return null; });
        assertEquals(before + 1, catalog.service(serviceId).bookedOrCompletedCount());
        assertEquals(before + 1, catalog.publicServices().stream().filter(s -> s.id().equals(serviceId)).findFirst().orElseThrow().bookedOrCompletedCount());
        tx(() -> { bookings.findByIdForUpdate(pending.getId()).orElseThrow().setStatus(BookingStatus.COMPLETED); return null; });
        assertEquals(before + 1, catalog.service(serviceId).bookedOrCompletedCount());
        tx(() -> { bookings.findByIdForUpdate(pending.getId()).orElseThrow().setStatus(BookingStatus.CANCELLED); return null; });
        assertEquals(before, catalog.service(serviceId).bookedOrCompletedCount());
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

    private List<String> parallel(Runnable cancel, Runnable other, boolean cancelFirst) throws Exception {
        CyclicBarrier start = new CyclicBarrier(2);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<String> a = () -> { Thread.currentThread().setName("cancel-worker"); start.await(5, TimeUnit.SECONDS); return outcome(cancel); };
            java.util.concurrent.Callable<String> b = () -> { Thread.currentThread().setName("other-worker"); start.await(5, TimeUnit.SECONDS); return outcome(other); };
            Future<String> first = pool.submit(cancelFirst ? a : b), second = pool.submit(cancelFirst ? b : a);
            String x = first.get(10, TimeUnit.SECONDS), y = second.get(10, TimeUnit.SECONDS);
            return cancelFirst ? List.of(x, y) : List.of(y, x);
        }
    }

    @ParameterizedTest @CsvSource({"true,true", "true,false", "false,true", "false,false"})
    void cancelAndPaidProviderNeverLoseBookingState(boolean cancelFirst, boolean useWebhook) throws Exception {
        Booking b = fixture(BookingStatus.PENDING, PaymentStatus.UNPAID); PaymentTransaction p = payment(b);
        Webhook w = webhook(p); UserAccount c = customer();
        var paidLink = new PaymentLink(); paidLink.setId(p.getPaymentLinkId()); paidLink.setOrderCode(p.getOrderCode());
        paidLink.setAmount(p.getAmount().longValueExact()); paidLink.setAmountPaid(p.getAmount().longValueExact()); paidLink.setStatus(PaymentLinkStatus.PAID);
        var pendingLink = new PaymentLink(); pendingLink.setId(p.getPaymentLinkId()); pendingLink.setOrderCode(p.getOrderCode());
        pendingLink.setAmount(p.getAmount().longValueExact()); pendingLink.setAmountPaid(0L); pendingLink.setStatus(PaymentLinkStatus.PENDING);
        var closedLink = new PaymentLink(); closedLink.setId(p.getPaymentLinkId()); closedLink.setOrderCode(p.getOrderCode());
        closedLink.setAmount(p.getAmount().longValueExact()); closedLink.setAmountPaid(0L); closedLink.setStatus(PaymentLinkStatus.CANCELLED);
        when(gateway.get(p.getOrderCode())).thenAnswer(i -> Thread.currentThread().getName().equals("cancel-worker") ? pendingLink : paidLink);
        when(gateway.cancel(eq(p.getOrderCode()), any())).thenReturn(closedLink);
        List<String> results = parallel(() -> bookingService.cancel(c, b.getId()),
                () -> { if (useWebhook) paymentService.handleWebhook(w); else paymentService.reconcileById(p.getId()); }, cancelFirst);
        assertEquals("OK", results.get(1));
        boolean cancelled = results.getFirst().equals("OK");
        if (!cancelled) assertEquals("PAYMENT_ALREADY_PAID", results.getFirst());
        Booking finalBooking = bookings.findById(b.getId()).orElseThrow(); PaymentTransaction finalPayment = payments.findById(p.getId()).orElseThrow();
        assertEquals(cancelled ? BookingStatus.CANCELLED : BookingStatus.CONFIRMED, finalBooking.getStatus());
        assertFalse(finalBooking.isPaymentRetryAllowed());
        // Reconciliation skips a terminal link whose closure was verified. A later signed
        // webhook is independent evidence and must escalate rather than resurrect it.
        assertEquals(cancelled ? (useWebhook ? PaymentTransactionStatus.REVIEW_REQUIRED : PaymentTransactionStatus.CANCELLED)
                : PaymentTransactionStatus.PAID, finalPayment.getStatus());
        assertEquals(cancelled ? PaymentStatus.UNPAID : PaymentStatus.PARTIALLY_PAID, finalBooking.getPaymentStatus());
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
        // Policy changed: paid bookings cannot self-cancel, regardless of which transaction wins.
        List<String> results = parallel(cancel, complete, !completeFirst);
        assertEquals("OK", results.get(1));
        assertTrue(Set.of("BOOKING_COMPLETED", "PAYMENT_ALREADY_PAID").contains(results.getFirst()));
        assertEquals(BookingStatus.COMPLETED, bookings.findById(b.getId()).orElseThrow().getStatus());
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
        tx(() -> { var current = bookings.findByIdForUpdate(b.getId()).orElseThrow(); current.setAppointmentDate(clockPolicy.today().plusDays(1)); return null; });
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

    @Test void midpointReviewPhotosSurviveReloadAndBothPublicTargetsWithoutCompletingBooking() throws Exception {
        Booking b = fixture(BookingStatus.CONFIRMED, PaymentStatus.PARTIALLY_PAID);
        java.io.ByteArrayOutputStream png = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(2, 2, java.awt.image.BufferedImage.TYPE_INT_RGB), "png", png);
        String image = "data:image/png;base64," + Base64.getEncoder().encodeToString(png.toByteArray());
        String stored = "https://res.cloudinary.com/test/image/upload/v1/review-test.webp";
        when(imageStorage.storeValidatedImage(eq(image), eq(customer().getId()))).thenReturn(stored);
        long before = catalog.serviceReviews(b.getService().getId(), 0, 100).totalElements();
        var saved = reviewService.upsert(customer(), b.getId(), ReviewTargetType.SERVICE, new UpsertBookingReviewRequest(4, "Trải nghiệm", List.of(image)));
        assertEquals(List.of(stored), saved.images());
        assertEquals(BookingStatus.CONFIRMED, bookings.findById(b.getId()).orElseThrow().getStatus());
        var reloaded = bookingService.customerBooking(customer(), b.getId());
        assertEquals(List.of(stored), reloaded.serviceReview().images()); assertTrue(reloaded.reviewEligible());
        assertEquals(before + 1, catalog.serviceReviews(b.getService().getId(), 0, 100).totalElements());
        assertEquals(List.of(stored), catalog.serviceReviews(b.getService().getId(), 0, 100).content().stream().filter(r -> r.id().equals(saved.id())).findFirst().orElseThrow().images());
        var edited = reviewService.upsert(customer(), b.getId(), ReviewTargetType.SERVICE, new UpsertBookingReviewRequest(5, "Cập nhật", List.of(stored)));
        assertEquals(saved.id(), edited.id()); assertEquals(5, edited.rating());
        verify(imageStorage, times(1)).storeValidatedImage(anyString(), anyLong());
        reviewService.upsert(customer(), b.getId(), ReviewTargetType.SUPPLIER, new UpsertBookingReviewRequest(5, null, List.of()));
        assertTrue(catalog.supplierReviews(b.getSupplier().getId(), 0, 100).content().stream().anyMatch(r -> r.serviceId().equals(b.getService().getId())));
        assertEquals("REVIEW_IMAGE_INVALID", assertThrows(ApiException.class, () -> reviewService.upsert(customer(), b.getId(), ReviewTargetType.SERVICE,
                new UpsertBookingReviewRequest(5, null, List.of("https://evil.test/image.png")))).getCode());
        assertEquals("REVIEW_IMAGE_INVALID", assertThrows(ApiException.class, () -> reviewService.upsert(customer(), b.getId(), ReviewTargetType.SERVICE,
                new UpsertBookingReviewRequest(5, null, List.of("data:image/png;base64,aGVsbG8=")))).getCode());
        assertEquals(List.of(stored), bookingService.customerBooking(customer(), b.getId()).serviceReview().images());
    }

    private FeedbackReminderService reminders(java.time.Instant now) {
        return new FeedbackReminderService(emailJobs, bookings, reviews, payments,
                new BookingCompletionPolicy(Clock.fixed(now, ZoneOffset.UTC)), true, true, "https://beautylink.test");
    }
    private EmailNotificationOutbox reminderJob(Long bookingId, EmailNotificationType type) {
        return emailJobs.findAll().stream().filter(j -> j.getBooking().getId().equals(bookingId) && j.getNotificationType() == type).findFirst().orElseThrow();
    }
    @Test void twoDurableReminderMilestonesAreIdempotentAndReviewSuppressesSecondEmail() {
        Booking b = fixture(BookingStatus.CONFIRMED, PaymentStatus.PAID);
        PaymentTransaction p = payment(b);
        tx(() -> { payments.findById(p.getId()).orElseThrow().setStatus(PaymentTransactionStatus.PAID); return null; });
        Instant half = BookingCompletionPolicy.reviewOpensAt(b);
        var reminder = reminders(half);
        tx(() -> { var paid = payments.findById(p.getId()).orElseThrow(); reminder.enqueueMidpoint(paid); reminder.enqueueMidpoint(paid); return null; });
        var first = reminderJob(b.getId(), EmailNotificationType.REVIEW_MIDPOINT);
        assertEquals(half, first.getNextAttemptAt());
        assertEquals(1, emailJobs.findAll().stream().filter(j -> j.getBooking().getId().equals(b.getId())).count());
        TransactionalEmailSender sender = mock(TransactionalEmailSender.class);
        when(sender.send(any())).thenReturn(new TransactionalEmailSender.DeliveryReceipt("test-only"));
        var firstClaim = claimReminder(first);
        tx(() -> reminder.deliverIfReminder(firstClaim, sender, "test@example.com", ""));
        verify(sender, times(1)).send(any());
        reviewService.upsert(customer(), b.getId(), ReviewTargetType.SERVICE, new UpsertBookingReviewRequest(5, "Déjà évalué"));
        tx(() -> { var row = bookings.findByIdForUpdate(b.getId()).orElseThrow(); row.setStatus(BookingStatus.COMPLETED); reminder.enqueueCompleted(row); return null; });
        assertEquals(1, emailJobs.findAll().stream().filter(j -> j.getBooking().getId().equals(b.getId())).count());
        assertEquals(EmailNotificationStatus.SENT, emailJobs.findById(first.getId()).orElseThrow().getStatus());
    }
    private BookingConfirmationNotificationService.ClaimedEmail claimReminder(EmailNotificationOutbox row) {
        return tx(() -> { var j = emailJobs.findById(row.getId()).orElseThrow(); j.setStatus(EmailNotificationStatus.PROCESSING); j.setClaimToken("fixture-claim"); j.setLeaseUntil(Instant.now().plusSeconds(120));
            return new BookingConfirmationNotificationService.ClaimedEmail(j.getId(), "fixture-claim", j.getRecipientEmail(), j.getSubject(), j.getTextBody(), j.getHtmlBody(), j.getIdempotencyKey()); });
    }
    @Test void completedReminderIsCreatedOnlyOnCompletedAndQueuedMidpointIsSuppressedAfterFeedback() {
        Booking b = fixture(BookingStatus.CONFIRMED, PaymentStatus.PAID); PaymentTransaction p = payment(b);
        tx(() -> { payments.findById(p.getId()).orElseThrow().setStatus(PaymentTransactionStatus.PAID); return null; });
        var reminder = reminders(BookingCompletionPolicy.reviewOpensAt(b));
        tx(() -> { reminder.enqueueCompleted(bookings.findById(b.getId()).orElseThrow()); reminder.enqueueMidpoint(payments.findById(p.getId()).orElseThrow()); return null; });
        assertFalse(emailJobs.existsByBookingIdAndNotificationTypeAndRecipientRole(b.getId(), EmailNotificationType.REVIEW_COMPLETED, EmailRecipientRole.CUSTOMER));
        var claim = claimReminder(reminderJob(b.getId(), EmailNotificationType.REVIEW_MIDPOINT));
        reviewService.upsert(customer(), b.getId(), ReviewTargetType.SUPPLIER, new UpsertBookingReviewRequest(4, "Feedback"));
        TransactionalEmailSender sender = mock(TransactionalEmailSender.class);
        tx(() -> reminder.deliverIfReminder(claim, sender, "test@example.com", "")); verifyNoInteractions(sender);
        assertEquals(EmailNotificationStatus.SKIPPED, emailJobs.findById(claim.id()).orElseThrow().getStatus());
        // A distinct customer booking with no feedback gets one completion reminder.
        Booking second = fixture(BookingStatus.COMPLETED, PaymentStatus.PARTIALLY_PAID); PaymentTransaction secondPayment = payment(second);
        tx(() -> { payments.findById(secondPayment.getId()).orElseThrow().setStatus(PaymentTransactionStatus.PAID); return null; });
        tx(() -> { reminder.enqueueCompleted(bookings.findById(second.getId()).orElseThrow()); reminder.enqueueCompleted(bookings.findById(second.getId()).orElseThrow()); return null; });
        assertEquals(1, emailJobs.findAll().stream().filter(j -> j.getBooking().getId().equals(second.getId())).count());
    }

    @Test void realPaymentAndCompletionEntrypointsEnqueueMilestonesAndDuplicateWebhookCannotDuplicateJobs() {
        Booking future = fixture(BookingStatus.PENDING, PaymentStatus.UNPAID);
        tx(() -> { bookings.findByIdForUpdate(future.getId()).orElseThrow().setAppointmentDate(clockPolicy.today().plusDays(1)); return null; });
        PaymentTransaction pending = payment(future); Webhook paid = webhook(pending);
        assertTrue(paymentService.handleWebhook(paid)); assertTrue(paymentService.handleWebhook(paid));
        assertEquals(1, emailJobs.findAll().stream().filter(j -> j.getBooking().getId().equals(future.getId()) && j.getNotificationType() == EmailNotificationType.REVIEW_MIDPOINT).count());
        assertEquals(BookingCompletionPolicy.reviewOpensAt(bookings.findById(future.getId()).orElseThrow()), reminderJob(future.getId(), EmailNotificationType.REVIEW_MIDPOINT).getNextAttemptAt());
        assertThrows(ApiException.class, () -> bookingService.complete(customer(), future.getId()));
        assertFalse(emailJobs.existsByBookingIdAndNotificationTypeAndRecipientRole(future.getId(), EmailNotificationType.REVIEW_COMPLETED, EmailRecipientRole.CUSTOMER));
        Booking past = fixture(BookingStatus.PENDING, PaymentStatus.UNPAID); PaymentTransaction payment = payment(past);
        paymentService.handleWebhook(webhook(payment));
        assertFalse(emailJobs.existsByBookingIdAndNotificationTypeAndRecipientRole(past.getId(), EmailNotificationType.REVIEW_MIDPOINT, EmailRecipientRole.CUSTOMER));
        bookingService.complete(customer(), past.getId()); bookingService.complete(customer(), past.getId());
        assertEquals(1, emailJobs.findAll().stream().filter(j -> j.getBooking().getId().equals(past.getId()) && j.getNotificationType() == EmailNotificationType.REVIEW_COMPLETED).count());
        verifyNoInteractions(emailSender); // Outbox creation is never a synchronous email send.
    }

    @Test void committedFeedbackWinsAgainstWaitingReminderSenderOnRealDatabaseLock() throws Exception {
        Booking b = fixture(BookingStatus.COMPLETED, PaymentStatus.PAID); PaymentTransaction p = payment(b);
        tx(() -> { payments.findById(p.getId()).orElseThrow().setStatus(PaymentTransactionStatus.PAID); return null; });
        tx(() -> { reminderDispatcher.enqueueCompleted(bookings.findById(b.getId()).orElseThrow()); return null; });
        var claim = claimReminder(reminderJob(b.getId(), EmailNotificationType.REVIEW_COMPLETED));
        TransactionalEmailSender sender = mock(TransactionalEmailSender.class);
        UserAccount c = customer();
        assertEquals(List.of("OK", "OK"), serialize(b.getId(),
                () -> reviewService.upsert(c, b.getId(), ReviewTargetType.SERVICE, new UpsertBookingReviewRequest(5, "Already reviewed")),
                () -> reminderDispatcher.deliverIfReminder(claim, sender, "test@example.com", "")));
        verifyNoInteractions(sender);
        assertEquals(EmailNotificationStatus.SKIPPED, emailJobs.findById(claim.id()).orElseThrow().getStatus());
    }

    @Test
    @org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable(named="REVIEW_TEST_DRIVER", matches="com.mysql.cj.jdbc.Driver")
    void publicMidpointReviewDoesNotDependOnMysqlSessionTimezone() {
        Booking b = fixture(BookingStatus.CONFIRMED, PaymentStatus.PAID);
        var local = ZonedDateTime.now(BookingCompletionPolicy.ZONE);
        tx(() -> { var row = bookings.findByIdForUpdate(b.getId()).orElseThrow();
            row.setAppointmentDate(local.minusMinutes(31).toLocalDate()); row.setStartTime(local.minusMinutes(31).toLocalTime()); row.setEndTime(local.plusMinutes(29).toLocalTime()); return null; });
        var saved = reviewService.upsert(customer(), b.getId(), ReviewTargetType.SERVICE, new UpsertBookingReviewRequest(5, "Timezone-safe midpoint"));
        tx(() -> {
            // Only this disposable test connection changes; always restore before returning it to the pool.
            jdbc.execute("SET time_zone='-07:00'");
            try { assertTrue(catalog.serviceReviews(b.getService().getId(), 0, 100).content().stream().anyMatch(r -> r.id().equals(saved.id()))); }
            finally { jdbc.execute("SET time_zone='+00:00'"); }
            return null;
        });
    }
}
