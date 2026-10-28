package com.example.backend;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import com.example.backend.service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import vn.payos.model.webhooks.*;
import vn.payos.model.v2.paymentRequests.*;
import static com.example.backend.model.DomainEnums.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest(properties = {
    "spring.datasource.url=${REVIEW_TEST_JDBC_URL:jdbc:h2:mem:cancel-safety;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000}",
    "spring.datasource.driver-class-name=${REVIEW_TEST_DRIVER:org.h2.Driver}",
    "spring.datasource.username=${REVIEW_TEST_USERNAME:sa}", "spring.datasource.password=${REVIEW_TEST_PASSWORD:}"
})
@ActiveProfiles("test")
@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
class PaymentCancellationSafetyTest {
    @org.junit.jupiter.api.BeforeAll static void protectProduction() {
        String url = System.getenv("REVIEW_TEST_JDBC_URL");
        if (url != null && !url.equals("jdbc:mysql://127.0.0.1:3306/beautylink_review_test")) throw new IllegalStateException("Only isolated loopback test DB allowed");
    }
    @Autowired BookingRepository bookings;
    @Autowired PaymentTransactionRepository payments;
    @Autowired ServiceOfferingRepository offerings;
    @Autowired PractitionerRepository practitioners;
    @Autowired UserAccountRepository users;
    @Autowired BookingService bookingService;
    @Autowired PaymentService paymentService;
    @Autowired BookingHoldExpiryService holdExpiry;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired ReviewService reviewService;
    @Autowired CatalogService catalog;
    @Autowired PlatformTransactionManager manager;
    @Autowired BookingReviewRepository reviews;
    @Autowired PaymentReviewService operatorReview;
    @Autowired SupportReportRepository reports;
    @Autowired SupportService support;
    @Autowired com.example.backend.auth.JwtService jwt;
    @Autowired org.springframework.test.web.servlet.MockMvc mvc;
    @MockitoBean PayOSGateway gateway;
    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean BookingCompletionPolicy time;
    @org.junit.jupiter.api.BeforeEach void isolateFixtures() {
        tx(() -> { reviews.deleteAllInBatch(); payments.deleteAllInBatch(); bookings.deleteAllInBatch(); return null; });
    }
    private <T> T tx(java.util.function.Supplier<T> action) { return new TransactionTemplate(manager).execute(s -> action.get()); }
    private UserAccount customer() { return users.findByPhone("0900000001").orElseThrow(); }
    private Booking booking(BookingStatus state, PaymentStatus payment) {
        return tx(() -> {
            var service = offerings.findAll().stream().sorted(Comparator.comparing(ServiceOffering::getId))
                    .filter(s -> !practitioners.findBySupplierIdAndActiveTrue(s.getSupplier().getId()).isEmpty()).findFirst().orElseThrow();
            Booking b = new Booking(); b.setBookingCode("SAFE-" + UUID.randomUUID().toString().substring(0, 12));
            b.setCustomer(customer()); b.setService(service); b.setSupplier(service.getSupplier());
            b.setPractitioner(practitioners.findBySupplierIdAndActiveTrue(service.getSupplier().getId()).get(0));
            b.setAppointmentDate(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(7).with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY)));
            b.setStartTime(LocalTime.of(10, 0)); b.setEndTime(LocalTime.of(11, 0)); b.setTotalAmount(new BigDecimal("500000"));
            b.setStatus(state); b.setPaymentStatus(payment); return bookings.saveAndFlush(b);
        });
    }
    private PaymentTransaction attempt(Booking b, PaymentTransactionStatus state) {
        PaymentTransaction p = new PaymentTransaction(); p.setBooking(b); p.setOrderCode(10_000_000L + payments.count());
        p.setMerchantReference(p.getOrderCode().toString()); p.setPaymentLinkId("safe-" + p.getOrderCode());
        p.setCheckoutUrl("https://pay.payos.vn/web/" + p.getPaymentLinkId()); p.setProviderCreatedAt(Instant.now());
        p.setAmount(new BigDecimal("250000")); p.setRemainingAmount(new BigDecimal("250000"));
        p.setExpiresAt(Instant.now().plusSeconds(900)); p.setPaymentOption(PaymentOption.DEPOSIT_50); p.setStatus(state);
        return payments.saveAndFlush(p);
    }
    private PaymentLink provider(PaymentTransaction p, PaymentLinkStatus status) {
        var result = mock(PaymentLink.class);
        when(result.getId()).thenReturn(p.getPaymentLinkId()); when(result.getOrderCode()).thenReturn(p.getOrderCode());
        when(result.getAmount()).thenReturn(p.getAmount().longValueExact()); when(result.getStatus()).thenReturn(status);
        when(result.getAmountPaid()).thenReturn(status == PaymentLinkStatus.PAID ? p.getAmount().longValueExact() : 0L);
        return result;
    }
    private Webhook paidWebhook(PaymentTransaction p) {
        var w = mock(Webhook.class); var data = mock(WebhookData.class);
        when(w.getSuccess()).thenReturn(true); when(data.getOrderCode()).thenReturn(p.getOrderCode());
        when(data.getAmount()).thenReturn(p.getAmount().longValueExact()); when(data.getCode()).thenReturn("00");
        when(data.getPaymentLinkId()).thenReturn(p.getPaymentLinkId()); when(gateway.verify(w)).thenReturn(data);
        return w;
    }
    private CreatePayOSPaymentRequest request() { return new CreatePayOSPaymentRequest(PaymentOption.DEPOSIT_50, null); }
    private CreatePayOSPaymentRequest newRequest() { return new CreatePayOSPaymentRequest(PaymentOption.DEPOSIT_05, null); }
    private UserAccount admin() { return users.findAll().stream().filter(u -> u.getRole() == Role.ADMIN).findFirst().orElseThrow(); }
    private void proof(PaymentTransaction p, PaymentLinkStatus state) { var result = provider(p, state); when(gateway.get(p.getOrderCode())).thenReturn(result); }
    private CloseZeroMoneyRequest resolution(Booking b) { return new CloseZeroMoneyRequest(operatorReview.preview(admin(), b.getId()).fingerprint(), "TEST-CASE-1"); }
    private void observePayment(String path, PaymentTransaction p, Webhook webhook) {
        // Make both scheduler age and status throttle eligible without sleeps.
        doReturn(time.now().plusSeconds(181)).when(time).now();
        switch (path) {
            case "WEBHOOK" -> assertTrue(paymentService.handleWebhook(webhook));
            case "STATUS" -> assertTrue(paymentService.status(customer(), p.getOrderCode()).requiresManualReview());
            case "SCHEDULER" -> new PaymentReconciliationScheduler(paymentService).reconcilePendingAttempts();
            default -> throw new IllegalArgumentException(path);
        }
    }
    private void assertManualReceipt(Booking b, PaymentTransaction p, BookingStatus expected, boolean received) {
        var saved = payments.findById(p.getId()).orElseThrow();
        assertEquals(PaymentTransactionStatus.REVIEW_REQUIRED, saved.getStatus()); assertTrue(saved.isRequiresManualReview());
        assertEquals(received, saved.getPaidAt() != null); assertNotNull(saved.getLastReconciledAt());
        assertEquals(p.getOrderCode(), saved.getOrderCode()); assertEquals(p.getPaymentLinkId(), saved.getPaymentLinkId());
        assertEquals(0, p.getAmount().compareTo(saved.getAmount()));
        var booking = bookings.findById(b.getId()).orElseThrow(); assertEquals(expected, booking.getStatus());
        assertEquals(b.getPaymentStatus(), booking.getPaymentStatus()); assertFalse(booking.isPaymentRetryAllowed());
        var dto = bookingService.customerBooking(customer(), b.getId());
        assertFalse(dto.completionEligible()); assertFalse(dto.reviewEligible()); assertFalse(dto.paymentEligible()); assertFalse(dto.cancelEligible());
        assertEquals("PAYMENT_REVIEW_REQUIRED", dto.paymentBlockerReason());
        assertEquals("PAYMENT_REVIEW_REQUIRED", assertThrows(ApiException.class, () -> bookingService.complete(customer(), b.getId())).getCode());
        for (var target : ReviewTargetType.values()) assertThrows(ApiException.class,
                () -> reviewService.upsert(customer(), b.getId(), target, new UpsertBookingReviewRequest(5, "must remain blocked")));
        assertNull(paymentService.status(customer(), p.getOrderCode()).checkoutUrl());
    }
    @ParameterizedTest @CsvSource({
        "WEBHOOK,SCHEDULER,PENDING", "WEBHOOK,STATUS,PENDING", "SCHEDULER,WEBHOOK,PENDING", "STATUS,WEBHOOK,PENDING",
        "WEBHOOK,SCHEDULER,CANCELLED", "SCHEDULER,WEBHOOK,CANCELLED", "STATUS,WEBHOOK,CANCELLED"
    })
    void uncertainCancellationPaidEvidenceConvergesRegardlessOfDeliveryOrder(String first, String second, BookingStatus state) {
        var b = booking(state, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.PENDING);
        tx(() -> { payments.findByIdForUpdate(p.getId()).orElseThrow().setRequiresManualReview(true); return null; });
        doReturn(BookingCompletionPolicy.startsAt(b).plusSeconds(7200)).when(time).now();
        proof(p, PaymentLinkStatus.PAID); var webhook = paidWebhook(p);
        when(gateway.verify(webhook).getReference()).thenReturn("verified-reference"); long auditBefore = reports.count();
        observePayment(first, p, webhook); assertManualReceipt(b, p, state, true);
        Instant receipt = payments.findById(p.getId()).orElseThrow().getPaidAt();
        observePayment(second, p, webhook); observePayment(first, p, webhook); observePayment(second, p, webhook);
        assertManualReceipt(b, p, state, true);
        assertEquals(receipt, payments.findById(p.getId()).orElseThrow().getPaidAt());
        assertEquals("verified-reference", payments.findById(p.getId()).orElseThrow().getPaymentReference());
        var preview = operatorReview.preview(admin(), b.getId()); assertFalse(preview.canCloseZeroMoney());
        assertFalse(preview.canCloseZeroSecondary()); assertTrue(preview.attempts().getFirst().identityMatches());
        assertEquals(p.getAmount().longValueExact(), preview.attempts().getFirst().amountPaid());
        assertEquals(auditBefore, reports.count(), "Automatic observations must not fabricate operator resolution/audit");
    }
    @ParameterizedTest @CsvSource({"CANCELLED", "EXPIRED", "FAILED", "PENDING"})
    void manualZeroMoneyObservationNeverClosesOrResetsAttempt(PaymentLinkStatus state) {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.REVIEW_REQUIRED);
        doReturn(BookingCompletionPolicy.startsAt(b).plusSeconds(7200)).when(time).now(); proof(p, state);
        long before = reports.count(); observePayment("SCHEDULER", p, null); observePayment("STATUS", p, null);
        assertManualReceipt(b, p, BookingStatus.PENDING, false); assertEquals(before, reports.count());
        if (state != PaymentLinkStatus.PENDING) {
            var input = resolution(b); var result = operatorReview.closeZeroMoney(admin(), b.getId(), input);
            assertEquals(BookingStatus.CANCELLED, result.bookingStatus()); assertFalse(result.retryAllowed());
            assertEquals(before + 2, reports.count()); assertTrue(operatorReview.closeZeroMoney(admin(), b.getId(), input).alreadyApplied());
        }
    }
    @ParameterizedTest @CsvSource({"ORDER", "LINK", "AMOUNT", "NULL_PAID", "WRONG_PAID", "NULL_STATUS", "NULL_RESPONSE", "TIMEOUT"})
    void manualReconciliationRejectsUnverifiedProofThenStillCapturesLaterPaid(String fault) {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.REVIEW_REQUIRED);
        doReturn(BookingCompletionPolicy.startsAt(b).plusSeconds(7200)).when(time).now(); var result = provider(p, PaymentLinkStatus.PAID);
        switch (fault) {
            case "ORDER" -> when(result.getOrderCode()).thenReturn(p.getOrderCode() + 1);
            case "LINK" -> when(result.getId()).thenReturn("wrong-link");
            case "AMOUNT" -> when(result.getAmount()).thenReturn(1L);
            case "NULL_PAID" -> when(result.getAmountPaid()).thenReturn(null);
            case "WRONG_PAID" -> when(result.getAmountPaid()).thenReturn(1L);
            case "NULL_STATUS" -> when(result.getStatus()).thenReturn(null);
        }
        when(gateway.get(p.getOrderCode())).thenReturn(fault.equals("NULL_RESPONSE") ? null : result);
        if (fault.equals("TIMEOUT")) when(gateway.get(p.getOrderCode())).thenThrow(timeout());
        observePayment("SCHEDULER", p, null); assertManualReceipt(b, p, BookingStatus.PENDING, false);
        var valid = provider(p, PaymentLinkStatus.PAID); doReturn(valid).when(gateway).get(p.getOrderCode());
        observePayment("STATUS", p, null); assertManualReceipt(b, p, BookingStatus.PENDING, true);
    }
    @Test void mismatchedWebhookCannotOverwritePreviouslyVerifiedReference() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.REVIEW_REQUIRED);
        var good = paidWebhook(p); when(gateway.verify(good).getReference()).thenReturn("verified-reference");
        paymentService.handleWebhook(good); Instant receipt = payments.findById(p.getId()).orElseThrow().getPaidAt();
        var wrong = paidWebhook(p); when(gateway.verify(wrong).getAmount()).thenReturn(1L);
        when(gateway.verify(wrong).getReference()).thenReturn("unverified-reference");
        assertFalse(paymentService.handleWebhook(wrong));
        assertEquals(receipt, payments.findById(p.getId()).orElseThrow().getPaidAt());
        assertEquals("verified-reference", payments.findById(p.getId()).orElseThrow().getPaymentReference());
    }
    @Test void manualSchedulerAndWebhookRacePreservesBlockerAndBothEvidenceSources() throws Exception {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.PENDING);
        tx(() -> { payments.findByIdForUpdate(p.getId()).orElseThrow().setRequiresManualReview(true); return null; });
        proof(p, PaymentLinkStatus.PAID); var webhook = paidWebhook(p); when(gateway.verify(webhook).getReference()).thenReturn("race-reference");
        var gate = new java.util.concurrent.CyclicBarrier(2); long before = reports.count();
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var get = pool.submit(() -> { gate.await(); paymentService.reconcileById(p.getId()); return true; });
            var callback = pool.submit(() -> { gate.await(); return paymentService.handleWebhook(webhook); });
            assertTrue(get.get(10, java.util.concurrent.TimeUnit.SECONDS)); assertTrue(callback.get(10, java.util.concurrent.TimeUnit.SECONDS));
        }
        assertManualReceipt(b, p, BookingStatus.PENDING, true);
        assertEquals("race-reference", payments.findById(p.getId()).orElseThrow().getPaymentReference()); assertEquals(before, reports.count());
    }
    @ParameterizedTest @CsvSource({"WEBHOOK", "STATUS", "SCHEDULER"})
    void actualCancelTimeoutThenPaidNeverConfirmsBooking(String path) {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.PENDING);
        proof(p, PaymentLinkStatus.PENDING); when(gateway.cancel(eq(p.getOrderCode()), any())).thenThrow(timeout());
        assertEquals("PAYMENT_RECONCILING", assertThrows(ApiException.class, () -> bookingService.cancel(customer(), b.getId())).getCode());
        assertTrue(payments.findById(p.getId()).orElseThrow().isRequiresManualReview());
        proof(p, PaymentLinkStatus.PAID); observePayment(path, p, paidWebhook(p));
        assertManualReceipt(b, p, BookingStatus.PENDING, true);
        // A later contradictory zero response must never erase an already observed receipt.
        var receipt = payments.findById(p.getId()).orElseThrow().getPaidAt(); proof(p, PaymentLinkStatus.CANCELLED);
        observePayment("SCHEDULER", p, null); assertManualReceipt(b, p, BookingStatus.PENDING, true);
        assertEquals(receipt, payments.findById(p.getId()).orElseThrow().getPaidAt());
        var preview = operatorReview.preview(admin(), b.getId()); assertFalse(preview.canCloseZeroMoney());
        assertThrows(ApiException.class, () -> operatorReview.closeZeroMoney(admin(), b.getId(), new CloseZeroMoneyRequest(preview.fingerprint(), "CONTRADICTORY-PROOF")));
    }
    @ParameterizedTest @CsvSource({"WEBHOOK,FULL_100,PAID", "STATUS,FULL_100,PAID", "SCHEDULER,FULL_100,PAID",
            "WEBHOOK,DEPOSIT_50,PARTIALLY_PAID", "STATUS,DEPOSIT_50,PARTIALLY_PAID", "SCHEDULER,DEPOSIT_50,PARTIALLY_PAID",
            "WEBHOOK,DEPOSIT_05,PARTIALLY_PAID", "STATUS,DEPOSIT_05,PARTIALLY_PAID", "SCHEDULER,DEPOSIT_05,PARTIALLY_PAID"})
    void normalPaidStillConfirmsThroughEverySource(String path, PaymentOption option, PaymentStatus paid) {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.PENDING);
        p.setPaymentOption(option); payments.saveAndFlush(p); proof(p, PaymentLinkStatus.PAID); var webhook = paidWebhook(p);
        doReturn(BookingCompletionPolicy.startsAt(b).plusSeconds(7200)).when(time).now();
        if (path.equals("WEBHOOK")) assertTrue(paymentService.handleWebhook(webhook));
        else if (path.equals("STATUS")) assertFalse(paymentService.status(customer(), p.getOrderCode()).requiresManualReview());
        else new PaymentReconciliationScheduler(paymentService).reconcilePendingAttempts();
        var saved = payments.findById(p.getId()).orElseThrow(); assertEquals(PaymentTransactionStatus.PAID, saved.getStatus());
        assertFalse(saved.isRequiresManualReview()); assertNotNull(saved.getPaidAt());
        assertTrue(paymentService.handleWebhook(webhook)); paymentService.reconcileById(p.getId());
        var dto = bookingService.customerBooking(customer(), b.getId()); assertEquals(BookingStatus.CONFIRMED, dto.status());
        assertEquals(paid, dto.paymentStatus()); assertTrue(dto.completionEligible()); assertTrue(dto.reviewEligible());
        assertEquals(BookingStatus.COMPLETED, bookingService.complete(customer(), b.getId()).status());
        assertEquals(saved.getPaidAt(), payments.findById(p.getId()).orElseThrow().getPaidAt());
    }
    @ParameterizedTest @CsvSource({"PAID", "CANCELLED"})
    void secondaryObservationPreservesPrimaryAndRequiresAdminForZero(PaymentLinkStatus providerState) {
        var b = booking(BookingStatus.CONFIRMED, PaymentStatus.PARTIALLY_PAID); var primary = attempt(b, PaymentTransactionStatus.PAID);
        primary.setPaidAt(Instant.parse("2026-01-01T00:00:00Z")); payments.saveAndFlush(primary);
        var secondary = attempt(b, PaymentTransactionStatus.PENDING);
        tx(() -> { payments.findByIdForUpdate(secondary.getId()).orElseThrow().setRequiresManualReview(true); return null; });
        proof(primary, PaymentLinkStatus.PAID); proof(secondary, providerState);
        doReturn(BookingCompletionPolicy.startsAt(b).plusSeconds(7200)).when(time).now();
        var before = payments.findById(primary.getId()).orElseThrow(); long auditBefore = reports.count();
        observePayment("SCHEDULER", secondary, null); observePayment("STATUS", secondary, null);
        assertManualReceipt(b, secondary, BookingStatus.CONFIRMED, providerState == PaymentLinkStatus.PAID);
        var after = payments.findById(primary.getId()).orElseThrow(); assertEquals(before.getUpdatedAt(), after.getUpdatedAt());
        assertEquals(before.getPaidAt(), after.getPaidAt()); assertEquals(before.getStatus(), after.getStatus());
        assertEquals(auditBefore, reports.count()); var preview = operatorReview.preview(admin(), b.getId());
        assertEquals(providerState == PaymentLinkStatus.CANCELLED, preview.canCloseZeroSecondary());
        if (providerState == PaymentLinkStatus.CANCELLED) {
            operatorReview.closeZeroSecondary(admin(), b.getId(), new CloseZeroMoneyRequest(preview.fingerprint(), "SECONDARY-ZERO"));
            assertEquals(auditBefore + 3, reports.count()); assertTrue(bookingService.customerBooking(customer(), b.getId()).completionEligible());
            assertEquals(PaymentStatus.PARTIALLY_PAID, bookingService.complete(customer(), b.getId()).paymentStatus());
        }
    }
    @Test void validReceiptOnDifferentAttemptCannotBypassExistingManualBlocker() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var blocked = attempt(b, PaymentTransactionStatus.REVIEW_REQUIRED);
        var other = attempt(b, PaymentTransactionStatus.PENDING); proof(other, PaymentLinkStatus.PAID);
        paymentService.handleWebhook(paidWebhook(other)); paymentService.reconcileById(other.getId());
        assertManualReceipt(b, other, BookingStatus.PENDING, true);
        assertEquals(PaymentTransactionStatus.REVIEW_REQUIRED, payments.findById(blocked.getId()).orElseThrow().getStatus());
        verify(gateway, never()).cancel(any(), any());
    }
    @ParameterizedTest @CsvSource({"-1,UTC", "0,UTC", "1,UTC", "-1,Asia/Ho_Chi_Minh", "0,Asia/Ho_Chi_Minh", "1,Asia/Ho_Chi_Minh"})
    void bookingCapabilitiesReuseAndStatusAgreeAtExactStart(long offset, String zone) {
        {
            // Do not change JVM timezone after JDBC initializes its date conversion calendar.
            // The full suite also runs in a separate UTC JVM; clock zones must yield the same Instant.
            var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID);
            Instant start = Instant.parse("2030-05-01T03:00:00Z");
            jdbc.update("update bookings set created_at=? where id=?", java.sql.Timestamp.from(start.minusSeconds(300)), b.getId());
            doReturn(Clock.fixed(start.plusMillis(offset), ZoneId.of(zone)).instant()).when(time).now();
            tx(() -> { bookings.findByIdForUpdate(b.getId()).orElseThrow().setAppointmentDate(LocalDate.of(2030, 5, 1)); return null; });
            var p = attempt(b, PaymentTransactionStatus.PENDING); p.setExpiresAt(start.plusSeconds(300)); p.setProviderCreatedAt(start.minusSeconds(1)); p.setLastReconciledAt(start.minusSeconds(1)); payments.saveAndFlush(p);
            var dto = bookingService.customerBooking(customer(), b.getId()); assertEquals(offset < 0, dto.paymentEligible(), zone + " " + offset + " " + dto.appointmentDate() + " " + dto.startTime() + " " + dto.paymentBlockerReason());
            assertEquals(offset < 0, paymentService.status(customer(), p.getOrderCode()).checkoutUrl() != null);
            if (offset < 0) assertEquals(p.getOrderCode(), paymentService.create(customer(), b.getId(), request()).orderCode());
            else assertEquals("SLOT_UNAVAILABLE", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), request())).getCode());
            assertEquals(PaymentTransactionStatus.PENDING, payments.findById(p.getId()).orElseThrow().getStatus());
            assertEquals(BookingStatus.PENDING, bookings.findById(b.getId()).orElseThrow().getStatus()); verify(gateway, never()).cancel(any(), any());
        }
    }
    @Test void newLinkExpiryIsCappedAtStartAndLateCreateResponseNeverExposesUrl() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var start = BookingCompletionPolicy.startsAt(b);
        jdbc.update("update bookings set created_at=? where id=?", java.sql.Timestamp.from(start.minusSeconds(300)), b.getId());
        doReturn(start.minusSeconds(60)).when(time).now();
        when(gateway.create(any())).thenAnswer(invocation -> {
            CreatePaymentLinkRequest input = invocation.getArgument(0); assertEquals(start.getEpochSecond(), input.getExpiredAt());
            assertEquals(1, payments.count(), "ledger committed before provider"); doReturn(start).when(time).now(); return created(input);
        });
        var response = paymentService.create(customer(), b.getId(), newRequest()); assertNull(response.checkoutUrl());
        assertEquals(start, payments.findByOrderCode(response.orderCode()).orElseThrow().getExpiresAt());
        assertEquals(PaymentTransactionStatus.PENDING, payments.findByOrderCode(response.orderCode()).orElseThrow().getStatus());
        verify(gateway, never()).cancel(any(), any());
    }
    @Test void verifiedMoneyAfterStartStillPersistsWithoutAutoCompletion() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.PENDING);
        doReturn(BookingCompletionPolicy.startsAt(b).plusSeconds(1)).when(time).now();
        assertTrue(paymentService.handleWebhook(paidWebhook(p)));
        assertEquals(PaymentTransactionStatus.PAID, payments.findById(p.getId()).orElseThrow().getStatus());
        assertEquals(PaymentStatus.PARTIALLY_PAID, bookings.findById(b.getId()).orElseThrow().getPaymentStatus());
        assertEquals(BookingStatus.CONFIRMED, bookings.findById(b.getId()).orElseThrow().getStatus());
    }
    @Test void operatorPreviewIsReadOnlyAndClosureIsAuditedIdempotent() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.REVIEW_REQUIRED);
        proof(p, PaymentLinkStatus.CANCELLED); long before = reports.count();
        var preview = operatorReview.preview(admin(), b.getId());
        assertTrue(preview.canCloseZeroMoney()); assertFalse(preview.canCloseZeroSecondary());
        assertEquals(preview, operatorReview.preview(admin(), b.getId()));
        assertEquals(before, reports.count()); assertEquals(PaymentTransactionStatus.REVIEW_REQUIRED, payments.findById(p.getId()).orElseThrow().getStatus());
        var input = new CloseZeroMoneyRequest(preview.fingerprint(), "TEST-CASE-1");
        var result = operatorReview.closeZeroMoney(admin(), b.getId(), input);
        assertFalse(result.alreadyApplied()); assertEquals(BookingStatus.CANCELLED, result.bookingStatus()); assertFalse(result.retryAllowed());
        assertEquals(PaymentTransactionStatus.CANCELLED, payments.findById(p.getId()).orElseThrow().getStatus());
        assertNull(payments.findById(p.getId()).orElseThrow().getCheckoutUrl()); assertEquals(before + 2, reports.count());
        assertTrue(operatorReview.closeZeroMoney(admin(), b.getId(), input).alreadyApplied()); assertEquals(before + 2, reports.count());
        assertEquals("PAYMENT_AUDIT_IMMUTABLE", assertThrows(ApiException.class, () -> support.update(admin(), result.auditId(), new UpdateReportRequest(ReportStatus.REJECTED, "tamper"))).getCode());
        verify(gateway, never()).cancel(any(), any()); verify(gateway, never()).create(any());
    }
    @ParameterizedTest @CsvSource({"ORDER", "LINK", "AMOUNT", "NULL_PAID", "MONEY", "PENDING", "TIMEOUT", "PAID"})
    void operatorMustNotCloseUnknownMismatchedOrMoneyAttempts(String fault) {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.REVIEW_REQUIRED);
        var result = provider(p, fault.equals("PAID") ? PaymentLinkStatus.PAID : fault.equals("PENDING") ? PaymentLinkStatus.PENDING : PaymentLinkStatus.CANCELLED);
        switch (fault) {
            case "ORDER" -> when(result.getOrderCode()).thenReturn(p.getOrderCode() + 1);
            case "LINK" -> when(result.getId()).thenReturn("wrong");
            case "AMOUNT" -> when(result.getAmount()).thenReturn(1L);
            case "NULL_PAID" -> when(result.getAmountPaid()).thenReturn(null);
            case "MONEY" -> when(result.getAmountPaid()).thenReturn(1L);
        }
        when(gateway.get(p.getOrderCode())).thenReturn(result);
        if (fault.equals("TIMEOUT")) when(gateway.get(p.getOrderCode())).thenThrow(timeout());
        var preview = operatorReview.preview(admin(), b.getId()); assertFalse(preview.canCloseZeroMoney()); assertFalse(preview.canCloseZeroSecondary());
        long before = reports.count(); assertThrows(ApiException.class, () -> operatorReview.closeZeroMoney(admin(), b.getId(), new CloseZeroMoneyRequest(preview.fingerprint(), "TEST-CASE-1")));
        assertEquals(before, reports.count()); assertEquals(BookingStatus.PENDING, bookings.findById(b.getId()).orElseThrow().getStatus());
        assertEquals(PaymentTransactionStatus.REVIEW_REQUIRED, payments.findById(p.getId()).orElseThrow().getStatus());
    }
    @Test void oneSafeAttemptDoesNotHideAnotherAndStalePreviewIsRejected() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.REVIEW_REQUIRED);
        proof(p, PaymentLinkStatus.CANCELLED); var input = resolution(b);
        var second = attempt(b, PaymentTransactionStatus.PENDING); proof(second, PaymentLinkStatus.PENDING);
        assertThrows(ApiException.class, () -> operatorReview.closeZeroMoney(admin(), b.getId(), input));
        proof(second, PaymentLinkStatus.CANCELLED);
        assertEquals("PAYMENT_REVIEW_STALE", assertThrows(ApiException.class, () -> operatorReview.closeZeroMoney(admin(), b.getId(), input)).getCode());
        assertEquals(PaymentTransactionStatus.REVIEW_REQUIRED, payments.findById(p.getId()).orElseThrow().getStatus());
    }
    @Test void expiryResolutionPermitsRetryOnlyWithValidFullIntervalAndRechecksChangedProof() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.REVIEW_REQUIRED);
        proof(p, PaymentLinkStatus.EXPIRED); var preview = operatorReview.preview(admin(), b.getId()); assertTrue(preview.proposedRetryAllowed());
        var input = new CloseZeroMoneyRequest(preview.fingerprint(), "TEST-CASE-1"); proof(p, PaymentLinkStatus.PAID);
        assertThrows(ApiException.class, () -> operatorReview.closeZeroMoney(admin(), b.getId(), input));
        assertEquals(BookingStatus.PENDING, bookings.findById(b.getId()).orElseThrow().getStatus());
        proof(p, PaymentLinkStatus.EXPIRED); assertTrue(operatorReview.closeZeroMoney(admin(), b.getId(), input).retryAllowed());
        assertTrue(operatorReview.closeZeroMoney(admin(), b.getId(), input).alreadyApplied());
        assertTrue(bookingService.customerBooking(customer(), b.getId()).paymentEligible());
        var occupied = booking(BookingStatus.CONFIRMED, PaymentStatus.PAID);
        tx(() -> { var row = bookings.findByIdForUpdate(occupied.getId()).orElseThrow(); row.setStartTime(LocalTime.of(9, 30)); row.setEndTime(LocalTime.of(10, 30)); return null; });
        assertFalse(bookingService.customerBooking(customer(), b.getId()).paymentEligible());
        assertEquals("SLOT_UNAVAILABLE", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), request())).getCode());
    }
    @Test void zeroClosureDoesNotPermitRetryInsideThirtyMinuteLead() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.REVIEW_REQUIRED);
        proof(p, PaymentLinkStatus.EXPIRED); doReturn(BookingCompletionPolicy.startsAt(b).minusSeconds(1799)).when(time).now();
        assertFalse(operatorReview.preview(admin(), b.getId()).proposedRetryAllowed());
        assertFalse(operatorReview.closeZeroMoney(admin(), b.getId(), resolution(b)).retryAllowed());
    }
    @Test void zeroMoneyClosureDoesNotReopenCustomerCancelledBookingAndCanBindOrphanIdentity() {
        var b = booking(BookingStatus.CANCELLED, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.REVIEW_REQUIRED);
        var closed = provider(p, PaymentLinkStatus.EXPIRED); when(gateway.get(p.getOrderCode())).thenReturn(closed);
        tx(() -> { payments.findById(p.getId()).orElseThrow().setPaymentLinkId(null); return null; });
        assertFalse(operatorReview.closeZeroMoney(admin(), b.getId(), resolution(b)).retryAllowed());
        assertEquals(p.getPaymentLinkId(), payments.findById(p.getId()).orElseThrow().getPaymentLinkId());
        assertFalse(bookings.findById(b.getId()).orElseThrow().isPaymentRetryAllowed());
    }
    @Test void currentAttemptRecoveryIsCustomerOwnedAndNeverCreatesReplacement() throws Exception {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID);
        var p = attempt(b, PaymentTransactionStatus.PENDING); proof(p, PaymentLinkStatus.PENDING);
        long before = payments.count();
        var result = paymentService.statusForBooking(customer(), b.getId());
        assertEquals(p.getOrderCode(), result.orderCode()); assertTrue(result.checkoutAllowed());
        assertEquals(before, payments.count()); verify(gateway, never()).create(any());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/payments/payos/bookings/{id}/current", b.getId()))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isUnauthorized());
        for (Role role : List.of(Role.SUPPLIER, Role.STAFF, Role.ADMIN)) {
            var account = new UserAccount(); account.setFullName("Recovery authorization fixture");
            account.setEmail("recovery-" + b.getId() + "-" + role + "@example.com");
            account.setPhone(String.format("09887%05d", b.getId() * 4 + role.ordinal()));
            account.setPasswordHash("not-used-by-this-token-test"); account.setRole(role); users.saveAndFlush(account);
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/payments/payos/bookings/{id}/current", b.getId())
                    .header("Authorization", "Bearer " + jwt.createToken(account)))
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isForbidden());
        }
        var wrong = new UserAccount(); wrong.setId(-100L);
        assertEquals("BOOKING_FORBIDDEN", assertThrows(ApiException.class, () -> paymentService.statusForBooking(wrong, b.getId())).getCode());
    }

    @ParameterizedTest @CsvSource({"PAID,FULL_100", "PARTIALLY_PAID,DEPOSIT_50"})
    void adminCanCloseZeroSecondaryPreservingPrimaryAndReopeningReview(PaymentStatus payment, PaymentOption option) {
        var b = booking(BookingStatus.COMPLETED, payment); var primary = attempt(b, PaymentTransactionStatus.PAID);
        primary.setPaymentOption(option); primary.setPaidAt(Instant.parse("2026-01-01T00:00:00Z")); payments.saveAndFlush(primary);
        var secondary = attempt(b, PaymentTransactionStatus.REVIEW_REQUIRED); proof(primary, PaymentLinkStatus.PAID); proof(secondary, PaymentLinkStatus.CANCELLED);
        assertFalse(bookingService.customerBooking(customer(), b.getId()).reviewEligible());
        var preview = operatorReview.preview(admin(), b.getId()); assertTrue(preview.canCloseZeroSecondary()); assertFalse(preview.canCloseZeroMoney());
        var original = payments.findById(primary.getId()).orElseThrow(); var input = new CloseZeroMoneyRequest(preview.fingerprint(), "TEST-CASE-1");
        assertEquals(BookingStatus.COMPLETED, operatorReview.closeZeroSecondary(admin(), b.getId(), input).bookingStatus());
        assertTrue(operatorReview.closeZeroSecondary(admin(), b.getId(), input).alreadyApplied());
        var saved = payments.findById(primary.getId()).orElseThrow();
        assertEquals(original.getUpdatedAt(), saved.getUpdatedAt()); assertEquals(original.getPaidAt(), saved.getPaidAt());
        assertEquals(original.getAmount(), saved.getAmount()); assertEquals(PaymentTransactionStatus.PAID, saved.getStatus());
        assertEquals(payment, bookings.findById(b.getId()).orElseThrow().getPaymentStatus());
        assertTrue(bookingService.customerBooking(customer(), b.getId()).reviewEligible());
        reviewService.upsert(customer(), b.getId(), ReviewTargetType.SERVICE, new UpsertBookingReviewRequest(5, "verified secondary closure"));
        reviewService.upsert(customer(), b.getId(), ReviewTargetType.SUPPLIER, new UpsertBookingReviewRequest(4, "verified secondary closure"));
        proof(secondary, PaymentLinkStatus.PAID);
        assertThrows(ApiException.class, () -> operatorReview.closeZeroSecondary(admin(), b.getId(), input));
    }
    @ParameterizedTest @CsvSource({"PRIMARY_MISMATCH", "SECONDARY_MONEY", "SECONDARY_NULL", "PRIMARY_MANUAL", "PRIMARY_MISSING_LINK", "CANCELLED", "REFUNDED", "TWO_PAID"})
    void secondaryClosureNeverClearsFinancialConflict(String fault) {
        var b = booking(fault.equals("CANCELLED") ? BookingStatus.CANCELLED : BookingStatus.CONFIRMED, fault.equals("REFUNDED") ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_PAID);
        var primary = attempt(b, PaymentTransactionStatus.PAID); primary.setPaidAt(Instant.now()); primary.setRequiresManualReview(fault.equals("PRIMARY_MANUAL")); payments.saveAndFlush(primary);
        var secondary = attempt(b, fault.equals("TWO_PAID") ? PaymentTransactionStatus.PAID : PaymentTransactionStatus.REVIEW_REQUIRED);
        var mainProof = provider(primary, PaymentLinkStatus.PAID); var otherProof = provider(secondary, PaymentLinkStatus.CANCELLED);
        if (fault.equals("PRIMARY_MISSING_LINK")) tx(() -> { payments.findByIdForUpdate(primary.getId()).orElseThrow().setPaymentLinkId(null); return null; });
        if (fault.equals("PRIMARY_MISMATCH")) when(mainProof.getAmountPaid()).thenReturn(1L);
        if (fault.equals("SECONDARY_MONEY")) when(otherProof.getAmountPaid()).thenReturn(1L);
        if (fault.equals("SECONDARY_NULL")) when(otherProof.getAmountPaid()).thenReturn(null);
        when(gateway.get(primary.getOrderCode())).thenReturn(mainProof); when(gateway.get(secondary.getOrderCode())).thenReturn(otherProof);
        var preview = operatorReview.preview(admin(), b.getId()); assertFalse(preview.canCloseZeroSecondary());
        assertThrows(ApiException.class, () -> operatorReview.closeZeroSecondary(admin(), b.getId(), new CloseZeroMoneyRequest(preview.fingerprint(), "TEST-CASE-1")));
    }
    @Test void operatorEndpointRequiresAdminAndAuditCannotBeForged() throws Exception {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.REVIEW_REQUIRED); proof(p, PaymentLinkStatus.CANCELLED);
        String url = "/api/v1/payments/payos/review/bookings/" + b.getId();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(url)).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isUnauthorized());
        for (Role role : List.of(Role.CUSTOMER, Role.SUPPLIER, Role.STAFF)) {
            var account = customer(); account.setRole(role);
            assertThrows(ApiException.class, () -> operatorReview.preview(account, b.getId()));
        }
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(url).header("Authorization", "Bearer " + jwt.createToken(customer())))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isForbidden());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(url).header("Authorization", "Bearer " + jwt.createToken(admin())))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
        for (String reason : List.of("PMT-AUDIT:ZERO-MONEY", "  pmt-audit:fake"))
            assertEquals("RESERVED_REPORT_REASON", assertThrows(ApiException.class, () -> support.create(customer(), new CreateReportRequest(ReportTargetType.BOOKING, b.getId(), reason, "fake"))).getCode());
    }
    @Test void operatorAndPaidWebhookSerializeWithoutLosingMoney() throws Exception {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.REVIEW_REQUIRED); proof(p, PaymentLinkStatus.CANCELLED);
        var input = resolution(b); var webhook = paidWebhook(p); var gate = new java.util.concurrent.CyclicBarrier(2);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var close = pool.submit(() -> { gate.await(); return outcome(() -> operatorReview.closeZeroMoney(admin(), b.getId(), input)); });
            var paid = pool.submit(() -> { gate.await(); return paymentService.handleWebhook(webhook); });
            close.get(10, java.util.concurrent.TimeUnit.SECONDS); assertTrue(paid.get(10, java.util.concurrent.TimeUnit.SECONDS));
        }
        var saved = payments.findById(p.getId()).orElseThrow(); assertTrue(saved.isRequiresManualReview());
        assertEquals(PaymentTransactionStatus.REVIEW_REQUIRED, saved.getStatus()); assertNotNull(saved.getPaidAt());
        assertFalse(bookingService.customerBooking(customer(), b.getId()).reviewEligible());
    }
    @Test void pastPendingCheckoutCannotBeReusedEvenWhenLinkHasNotExpired() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); attempt(b, PaymentTransactionStatus.PENDING);
        tx(() -> { bookings.findByIdForUpdate(b.getId()).orElseThrow().setAppointmentDate(LocalDate.of(2000, 1, 1)); return null; });
        var dto = bookingService.customerBookings(customer()).stream().filter(x -> x.id().equals(b.getId())).findFirst().orElseThrow();
        assertFalse(dto.paymentEligible()); assertEquals("SLOT_UNAVAILABLE", dto.paymentBlockerReason());
        assertEquals("SLOT_UNAVAILABLE", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), request())).getCode());
    }
    @Test void pastPendingCheckoutStatusDoesNotExposeStillLiveProviderUrl() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.PENDING);
        tx(() -> { bookings.findByIdForUpdate(b.getId()).orElseThrow().setAppointmentDate(LocalDate.of(2000, 1, 1)); return null; });
        var stillLive = provider(p, PaymentLinkStatus.PENDING);
        when(gateway.get(p.getOrderCode())).thenReturn(stillLive);
        var response = paymentService.status(customer(), p.getOrderCode());
        assertNull(response.checkoutUrl()); assertNull(response.qrCode()); assertFalse(response.checkoutAllowed());
        assertEquals(PaymentTransactionStatus.PENDING, payments.findById(p.getId()).orElseThrow().getStatus());
        verify(gateway).get(p.getOrderCode());
        verify(gateway, never()).cancel(any(), any());
    }
    private ApiException timeout() { return new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY, "PAYOS_RECONCILIATION_FAILED", "test network timeout"); }

    @Test void customerCancelledPendingCheckoutMustNotBeReturned() {
        var b = booking(BookingStatus.CANCELLED, PaymentStatus.UNPAID); attempt(b, PaymentTransactionStatus.PENDING);
        assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), newRequest()));
        verify(gateway, never()).create(any()); verify(gateway, never()).get(any()); verify(gateway, never()).cancel(any(), any());
    }
    @Test void paidAndDepositPaidCannotBeSelfCancelled() {
        for (var status : List.of(PaymentStatus.PAID, PaymentStatus.PARTIALLY_PAID)) {
            var b = booking(BookingStatus.CONFIRMED, status);
            assertEquals("PAYMENT_ALREADY_PAID", assertThrows(ApiException.class, () -> bookingService.cancel(customer(), b.getId())).getCode());
            assertEquals(status, bookings.findById(b.getId()).orElseThrow().getPaymentStatus());
            assertEquals(BookingStatus.CONFIRMED, bookings.findById(b.getId()).orElseThrow().getStatus());
        }
    }
    @Test void manualReviewBlocksNewCheckoutEvenWithAnotherPendingAttempt() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); attempt(b, PaymentTransactionStatus.REVIEW_REQUIRED);
        attempt(b, PaymentTransactionStatus.PENDING);
        assertEquals("PAYMENT_REVIEW_REQUIRED", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), newRequest())).getCode());
    }
    @Test void supersededCancelFailureMustRemainReconcileableAndPreserveMainPaid() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID);
        var old = attempt(b, PaymentTransactionStatus.EXPIRED); var newer = attempt(b, PaymentTransactionStatus.PENDING);
        when(gateway.cancel(newer.getOrderCode(), "Another payment attempt was completed")).thenThrow(timeout());
        assertTrue(paymentService.handleWebhook(paidWebhook(old)));
        assertEquals(PaymentTransactionStatus.PAID, payments.findById(old.getId()).orElseThrow().getStatus());
        assertEquals(PaymentTransactionStatus.PENDING, payments.findById(newer.getId()).orElseThrow().getStatus());
    }
    @Test void retryMustRejectDifferentStartTimeOverlap() {
        var b = booking(BookingStatus.CANCELLED, PaymentStatus.UNPAID);
        tx(() -> { bookings.findByIdForUpdate(b.getId()).orElseThrow().setPaymentRetryAllowed(true); return null; });
        var occupied = booking(BookingStatus.CONFIRMED, PaymentStatus.PAID);
        tx(() -> { var row = bookings.findByIdForUpdate(occupied.getId()).orElseThrow(); row.setStartTime(LocalTime.of(9, 30)); row.setEndTime(LocalTime.of(10, 30)); return null; });
        var response = mock(CreatePaymentLinkResponse.class); when(response.getPaymentLinkId()).thenReturn("overlap");
        when(response.getCheckoutUrl()).thenReturn("https://pay.payos.vn/web/overlap"); when(gateway.create(any())).thenReturn(response);
        assertEquals("SLOT_UNAVAILABLE", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), request())).getCode());
    }
    @Test void supplierShopArrayMustContainOnlySupplierReviews() {
        var b = booking(BookingStatus.COMPLETED, PaymentStatus.PAID);
        reviewService.upsert(customer(), b.getId(), ReviewTargetType.SERVICE, new UpsertBookingReviewRequest(1, "service"));
        reviewService.upsert(customer(), b.getId(), ReviewTargetType.SUPPLIER, new UpsertBookingReviewRequest(5, "supplier"));
        assertTrue(catalog.supplierShop(b.getSupplier().getId()).reviews().stream().allMatch(r -> r.targetType() == ReviewTargetType.SUPPLIER));
    }
    @Test void verifiedProviderPaidMustCommitEvenWhenCancelReturnsConflict() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.PENDING);
        var paid = provider(p, PaymentLinkStatus.PAID);
        when(gateway.get(p.getOrderCode())).thenReturn(paid);
        assertEquals("PAYMENT_ALREADY_PAID", assertThrows(ApiException.class, () -> bookingService.cancel(customer(), b.getId())).getCode());
        assertEquals(PaymentTransactionStatus.PAID, payments.findById(p.getId()).orElseThrow().getStatus());
        assertEquals(BookingStatus.CONFIRMED, bookings.findById(b.getId()).orElseThrow().getStatus());
    }
    @Test void uncertainCreateMustRetainOrderForReconciliation() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); long before = payments.count();
        when(gateway.create(any())).thenThrow(new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY, "PAYOS_CREATE_FAILED", "test timeout"));
        var observing = paymentService.create(customer(), b.getId(), newRequest());
        assertTrue(observing.verificationPending()); assertFalse(observing.checkoutAllowed()); assertNull(observing.qrCode());
        assertEquals(before + 1, payments.count());
        assertEquals(PaymentTransactionStatus.PENDING, payments.findFirstByBookingIdOrderByCreatedAtDesc(b.getId()).orElseThrow().getStatus());
    }

    private CreatePaymentLinkResponse created(CreatePaymentLinkRequest request) {
        var result = new CreatePaymentLinkResponse(); result.setOrderCode(request.getOrderCode()); result.setAmount(request.getAmount());
        result.setPaymentLinkId("created-" + request.getOrderCode()); result.setStatus(PaymentLinkStatus.PENDING);
        result.setCheckoutUrl("https://pay.payos.vn/web/" + result.getPaymentLinkId()); return result;
    }
    @Test void unpaidWithoutPaymentCancelsIdempotently() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID);
        assertEquals(BookingStatus.CANCELLED, bookingService.cancel(customer(), b.getId()).status());
        assertEquals(BookingStatus.CANCELLED, bookingService.cancel(customer(), b.getId()).status());
        assertFalse(bookings.findById(b.getId()).orElseThrow().isPaymentRetryAllowed());
        verify(gateway, never()).get(any()); verify(gateway, never()).cancel(any(), any()); verify(gateway, never()).create(any());
    }
    @Test void confirmedProviderClosureCancelsAndNeverReturnsCheckoutOrRetries() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.PENDING);
        var pending = provider(p, PaymentLinkStatus.PENDING); var closed = provider(p, PaymentLinkStatus.CANCELLED);
        when(gateway.get(p.getOrderCode())).thenReturn(pending); when(gateway.cancel(eq(p.getOrderCode()), any())).thenReturn(closed);
        assertEquals(BookingStatus.CANCELLED, bookingService.cancel(customer(), b.getId()).status());
        assertEquals(BookingStatus.CANCELLED, bookingService.cancel(customer(), b.getId()).status());
        verify(gateway, times(1)).get(p.getOrderCode()); verify(gateway, times(1)).cancel(eq(p.getOrderCode()), any());
        assertNull(paymentService.status(customer(), p.getOrderCode()).checkoutUrl());
        paymentService.reconcileById(p.getId());
        assertFalse(bookings.findById(b.getId()).orElseThrow().isPaymentRetryAllowed());
        assertEquals("BOOKING_NOT_PAYABLE", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), request())).getCode());
    }
    @ParameterizedTest @CsvSource({"GET_TIMEOUT", "CANCEL_TIMEOUT", "NULL_RESPONSE", "UNKNOWN_AMOUNT", "STILL_PENDING"})
    void uncertainCancellationNeverReleasesSlotOrFabricatesTerminalState(String failure) {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.PENDING);
        var pending = provider(p, PaymentLinkStatus.PENDING); var closed = provider(p, PaymentLinkStatus.CANCELLED);
        when(gateway.get(p.getOrderCode())).thenReturn(pending); when(gateway.cancel(eq(p.getOrderCode()), any())).thenReturn(closed);
        switch (failure) {
            case "GET_TIMEOUT" -> when(gateway.get(p.getOrderCode())).thenThrow(timeout());
            case "CANCEL_TIMEOUT" -> when(gateway.cancel(eq(p.getOrderCode()), any())).thenThrow(timeout());
            case "NULL_RESPONSE" -> when(gateway.cancel(eq(p.getOrderCode()), any())).thenReturn(null);
            case "UNKNOWN_AMOUNT" -> when(closed.getAmountPaid()).thenReturn(null);
            case "STILL_PENDING" -> when(gateway.cancel(eq(p.getOrderCode()), any())).thenReturn(pending);
        }
        assertEquals("PAYMENT_RECONCILING", assertThrows(ApiException.class, () -> bookingService.cancel(customer(), b.getId())).getCode());
        assertEquals(BookingStatus.PENDING, bookings.findById(b.getId()).orElseThrow().getStatus());
        assertEquals(PaymentTransactionStatus.PENDING, payments.findById(p.getId()).orElseThrow().getStatus());
        assertNotNull(payments.findById(p.getId()).orElseThrow().getLastReconciledAt());
        assertTrue(payments.findById(p.getId()).orElseThrow().isRequiresManualReview());
        assertNull(payments.findById(p.getId()).orElseThrow().getCheckoutUrl());
        assertEquals("PAYMENT_REVIEW_REQUIRED", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), newRequest())).getCode());
        if (failure.equals("GET_TIMEOUT")) verify(gateway, never()).cancel(any(), any());
    }
    @Test void cancelResponsePaidAlsoCommitsMoneyAndRejectsCancel() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.PENDING);
        var pending = provider(p, PaymentLinkStatus.PENDING); var paid = provider(p, PaymentLinkStatus.PAID);
        when(gateway.get(p.getOrderCode())).thenReturn(pending); when(gateway.cancel(eq(p.getOrderCode()), any())).thenReturn(paid);
        assertEquals("PAYMENT_ALREADY_PAID", assertThrows(ApiException.class, () -> bookingService.cancel(customer(), b.getId())).getCode());
        assertEquals(PaymentTransactionStatus.PAID, payments.findById(p.getId()).orElseThrow().getStatus());
        assertEquals(PaymentStatus.PARTIALLY_PAID, bookings.findById(b.getId()).orElseThrow().getPaymentStatus());
    }
    @ParameterizedTest @CsvSource({"PENDING,UNPAID", "CONFIRMED,PAID", "CANCELLED,UNPAID", "COMPLETED,PARTIALLY_PAID"})
    void manualBlockerDisablesAllCapabilitiesAndPublicReviews(BookingStatus state, PaymentStatus paid) {
        var b = booking(state, paid); var p = attempt(b, PaymentTransactionStatus.REVIEW_REQUIRED);
        tx(() -> { var row = bookings.findByIdForUpdate(b.getId()).orElseThrow(); row.setAppointmentDate(LocalDate.now().minusDays(2));
            row.setPaymentRetryAllowed(true); return null; });
        var legacy = new BookingReview(); legacy.setBooking(b); legacy.setCustomer(customer()); legacy.setSupplier(b.getSupplier());
        legacy.setService(b.getService()); legacy.setTargetType(ReviewTargetType.SERVICE); legacy.setRating(5); legacy.setComment("legacy"); reviews.saveAndFlush(legacy);
        var dto = bookingService.customerBookings(customer()).stream().filter(x -> x.id().equals(b.getId())).findFirst().orElseThrow();
        assertFalse(dto.completionEligible()); assertFalse(dto.reviewEligible()); assertFalse(dto.paymentEligible()); assertFalse(dto.cancelEligible());
        assertEquals("PAYMENT_REVIEW_REQUIRED", dto.paymentBlockerReason());
        assertEquals("PAYMENT_REVIEW_REQUIRED", assertThrows(ApiException.class, () -> bookingService.complete(customer(), b.getId())).getCode());
        assertThrows(ApiException.class, () -> reviewService.upsert(customer(), b.getId(), ReviewTargetType.SERVICE, new UpsertBookingReviewRequest(5, "blocked")));
        assertEquals("PAYMENT_REVIEW_REQUIRED", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), request())).getCode());
        assertEquals(0, catalog.serviceReviews(b.getService().getId(), 0, 100).totalElements()); assertNull(p.getPaidAt());
    }
    @Test void paidFlagAndUnresolvedSecondaryAttemptBlockCompletionThenEscalateLateMoney() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var main = attempt(b, PaymentTransactionStatus.EXPIRED);
        var secondary = attempt(b, PaymentTransactionStatus.PENDING);
        when(gateway.cancel(eq(secondary.getOrderCode()), any())).thenThrow(timeout()); paymentService.handleWebhook(paidWebhook(main));
        assertEquals("PAYMENT_REVIEW_REQUIRED", assertThrows(ApiException.class, () -> bookingService.complete(customer(), b.getId())).getCode());
        var paid = provider(secondary, PaymentLinkStatus.PAID); when(gateway.get(secondary.getOrderCode())).thenReturn(paid);
        paymentService.reconcileById(secondary.getId());
        assertEquals(PaymentTransactionStatus.PAID, payments.findById(main.getId()).orElseThrow().getStatus());
        assertNotNull(payments.findById(main.getId()).orElseThrow().getPaidAt());
        assertEquals(PaymentTransactionStatus.REVIEW_REQUIRED, payments.findById(secondary.getId()).orElseThrow().getStatus());
        assertNotNull(payments.findById(secondary.getId()).orElseThrow().getPaidAt(), "exact provider PAID evidence must survive escalation; mismatch/manual flag alone is not receipt proof");
        assertEquals(BookingStatus.CONFIRMED, bookings.findById(b.getId()).orElseThrow().getStatus());
        assertEquals("PAYMENT_REVIEW_REQUIRED", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), request())).getCode());
    }
    @Test void ledgerIsCommittedBeforeProviderCreateAndBadResponseEvidenceIsNotRolledBack() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID);
        when(gateway.create(any())).thenAnswer(i -> {
            CreatePaymentLinkRequest r = i.getArgument(0);
            assertTrue(tx(() -> payments.existsByOrderCode(r.getOrderCode())));
            var result = created(r); result.setAmount(r.getAmount() + 1); return result;
        });
        assertEquals("PAYMENT_REVIEW_REQUIRED", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), newRequest())).getCode());
        assertEquals(PaymentTransactionStatus.REVIEW_REQUIRED, payments.findFirstByBookingIdOrderByCreatedAtDesc(b.getId()).orElseThrow().getStatus());
        assertEquals(1, payments.count());
    }
    @Test void timeoutCannotIssueSecondCheckoutAndVerifiedPendingCanBeReusedOnlyWhenSafe() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); when(gateway.create(any())).thenThrow(timeout());
        assertTrue(paymentService.create(customer(), b.getId(), newRequest()).verificationPending());
        assertEquals("PAYMENT_RECONCILING", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), newRequest())).getCode());
        verify(gateway, times(1)).create(any()); assertEquals(1, payments.count());
    }
    @ParameterizedTest @CsvSource({"PENDING", "PAID", "CANCELLED", "TIMEOUT", "WRONG_ORDER", "WRONG_AMOUNT"})
    void missingCreateResponseIsObservedWithoutAnotherProviderPost(String outcome) {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID);
        when(gateway.create(any())).thenThrow(timeout());
        var initial = paymentService.create(customer(), b.getId(), newRequest());
        assertTrue(initial.verificationPending()); assertFalse(initial.checkoutAllowed()); assertNull(initial.paymentLinkId());
        var p = payments.findFirstByBookingIdOrderByCreatedAtDesc(b.getId()).orElseThrow();
        // No sleeps; the same order remains reserved while the single provider POST could be in flight.
        assertTrue(paymentService.statusForBooking(customer(), b.getId()).verificationPending());
        verify(gateway, never()).get(any());
        doReturn(p.getCreatedAt().plusSeconds(16)).when(time).now();
        if (outcome.equals("TIMEOUT")) when(gateway.get(p.getOrderCode())).thenThrow(timeout());
        else {
            var state = outcome.equals("PAID") ? PaymentLinkStatus.PAID : outcome.equals("CANCELLED") ? PaymentLinkStatus.CANCELLED : PaymentLinkStatus.PENDING;
            var proof = provider(p, state); when(proof.getId()).thenReturn("recovered-" + p.getOrderCode());
            if (outcome.equals("WRONG_ORDER")) when(proof.getOrderCode()).thenReturn(p.getOrderCode() + 1);
            if (outcome.equals("WRONG_AMOUNT")) when(proof.getAmount()).thenReturn(p.getAmount().longValueExact() + 1);
            when(gateway.get(p.getOrderCode())).thenReturn(proof);
        }
        var result = paymentService.statusForBooking(customer(), b.getId());
        assertEquals(initial.orderCode(), result.orderCode()); assertEquals(1, payments.count());
        var saved = bookings.findById(b.getId()).orElseThrow();
        if (outcome.equals("PAID")) { assertEquals(BookingStatus.CONFIRMED, saved.getStatus()); assertEquals(PaymentStatus.PARTIALLY_PAID, saved.getPaymentStatus()); }
        else if (outcome.equals("CANCELLED")) assertEquals(BookingStatus.CANCELLED, saved.getStatus());
        else { assertEquals(BookingStatus.PENDING, saved.getStatus()); assertEquals(PaymentStatus.UNPAID, saved.getPaymentStatus()); }
        if (outcome.startsWith("WRONG")) { assertTrue(result.requiresManualReview()); assertFalse(result.checkoutAllowed()); }
        if (outcome.equals("TIMEOUT")) { assertTrue(result.verificationPending()); assertFalse(result.checkoutAllowed()); }
        assertNull(result.qrCode(), "GET cannot invent a QR lost with the provider create response");
        verify(gateway, times(1)).create(any()); verify(gateway, times(1)).get(p.getOrderCode());
    }

    @Test void pendingReuseIsIdempotentButExpiredLinksFailClosed() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.PENDING);
        var observed = provider(p, PaymentLinkStatus.PENDING);
        when(gateway.get(p.getOrderCode())).thenReturn(observed);
        assertEquals(p.getCheckoutUrl(), paymentService.create(customer(), b.getId(), request()).checkoutUrl());
        assertEquals(1, payments.count()); verify(gateway, never()).create(any());
        verify(gateway).get(p.getOrderCode());
        tx(() -> { payments.findByIdForUpdate(p.getId()).orElseThrow().setExpiresAt(Instant.now().minusSeconds(1)); return null; });
        assertEquals("PAYMENT_RECONCILING", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), request())).getCode());
    }
    @Test void verifiedExpiryAllowsNewAttemptWithoutOverwritingHistory() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.PENDING);
        var expired = provider(p, PaymentLinkStatus.EXPIRED); when(gateway.get(p.getOrderCode())).thenReturn(expired);
        paymentService.reconcileById(p.getId()); assertTrue(bookings.findById(b.getId()).orElseThrow().isPaymentRetryAllowed());
        when(gateway.create(any())).thenAnswer(i -> created(i.getArgument(0)));
        var response = paymentService.create(customer(), b.getId(), newRequest());
        assertNotEquals(p.getOrderCode(), response.orderCode()); assertNotNull(response.checkoutUrl());
        assertEquals(2, payments.count()); assertEquals(PaymentTransactionStatus.EXPIRED, payments.findById(p.getId()).orElseThrow().getStatus());
    }
    @ParameterizedTest @CsvSource({"10:00,11:00,0", "09:30,10:30,0", "23:30,10:30,-1"})
    void retryRejectsSameStartDifferentStartAndOvernightOverlap(String start, String end, int offset) {
        var b = booking(BookingStatus.CANCELLED, PaymentStatus.UNPAID);
        tx(() -> { bookings.findByIdForUpdate(b.getId()).orElseThrow().setPaymentRetryAllowed(true); return null; });
        var occupied = booking(BookingStatus.CONFIRMED, PaymentStatus.PAID);
        tx(() -> { var row = bookings.findByIdForUpdate(occupied.getId()).orElseThrow(); row.setAppointmentDate(b.getAppointmentDate().plusDays(offset));
            row.setStartTime(LocalTime.parse(start)); row.setEndTime(LocalTime.parse(end)); return null; });
        assertEquals("SLOT_UNAVAILABLE", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), request())).getCode());
        verify(gateway, never()).create(any()); assertEquals(0, payments.count());
    }
    @ParameterizedTest @CsvSource({"COMPLETED,PAID", "CANCELLED,UNPAID", "CONFIRMED,REFUNDED"})
    void latePaymentNeverResurrectsTerminalOrRefundedBooking(BookingStatus state, PaymentStatus paid) {
        var b = booking(state, paid); var p = attempt(b, PaymentTransactionStatus.PENDING);
        paymentService.handleWebhook(paidWebhook(p)); paymentService.handleWebhook(paidWebhook(p));
        assertEquals(state, bookings.findById(b.getId()).orElseThrow().getStatus());
        assertEquals(paid, bookings.findById(b.getId()).orElseThrow().getPaymentStatus());
        assertEquals(PaymentTransactionStatus.REVIEW_REQUIRED, payments.findById(p.getId()).orElseThrow().getStatus());
        assertFalse(bookings.findById(b.getId()).orElseThrow().isPaymentRetryAllowed()); assertNull(paymentService.status(customer(), p.getOrderCode()).checkoutUrl());
    }
    @Test void invalidSignatureNeverChangesRows() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.PENDING);
        var w = mock(Webhook.class); when(gateway.verify(w)).thenThrow(new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "PAYOS_INVALID_SIGNATURE", "Invalid test signature"));
        assertEquals("PAYOS_INVALID_SIGNATURE", assertThrows(ApiException.class, () -> paymentService.handleWebhook(w)).getCode());
        assertEquals(PaymentTransactionStatus.PENDING, payments.findById(p.getId()).orElseThrow().getStatus());
        assertEquals(BookingStatus.PENDING, bookings.findById(b.getId()).orElseThrow().getStatus());
    }
    @Test void cancellationDuringProviderCreateWithdrawsTheReturnedLink() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID);
        when(gateway.create(any())).thenAnswer(i -> {
            CreatePaymentLinkRequest request = i.getArgument(0); var created = created(request);
            var pending = new PaymentLink(); pending.setId(created.getPaymentLinkId()); pending.setOrderCode(request.getOrderCode());
            pending.setAmount(request.getAmount()); pending.setAmountPaid(0L); pending.setStatus(PaymentLinkStatus.PENDING);
            var closed = new PaymentLink(); closed.setId(created.getPaymentLinkId()); closed.setOrderCode(request.getOrderCode());
            closed.setAmount(request.getAmount()); closed.setAmountPaid(0L); closed.setStatus(PaymentLinkStatus.CANCELLED);
            when(gateway.get(request.getOrderCode())).thenReturn(pending); when(gateway.cancel(eq(request.getOrderCode()), any())).thenReturn(closed);
            bookingService.cancel(customer(), b.getId()); return created;
        });
        assertNull(paymentService.create(customer(), b.getId(), newRequest()).checkoutUrl());
        assertEquals(BookingStatus.CANCELLED, bookings.findById(b.getId()).orElseThrow().getStatus());
        assertEquals(PaymentTransactionStatus.CANCELLED, payments.findFirstByBookingIdOrderByCreatedAtDesc(b.getId()).orElseThrow().getStatus());
    }
    @ParameterizedTest @CsvSource({"true", "false"})
    void webhookBeforeAndAfterConfirmedCancellationHasDeterministicOutcome(boolean paidFirst) {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.PENDING);
        var pending = provider(p, PaymentLinkStatus.PENDING); var closed = provider(p, PaymentLinkStatus.CANCELLED);
        when(gateway.get(p.getOrderCode())).thenReturn(pending); when(gateway.cancel(eq(p.getOrderCode()), any())).thenReturn(closed);
        var w = paidWebhook(p);
        if (paidFirst) {
            paymentService.handleWebhook(w);
            assertEquals("PAYMENT_ALREADY_PAID", assertThrows(ApiException.class, () -> bookingService.cancel(customer(), b.getId())).getCode());
        } else { bookingService.cancel(customer(), b.getId()); paymentService.handleWebhook(w); }
        assertEquals(paidFirst ? BookingStatus.CONFIRMED : BookingStatus.CANCELLED, bookings.findById(b.getId()).orElseThrow().getStatus());
        assertEquals(paidFirst ? PaymentTransactionStatus.PAID : PaymentTransactionStatus.REVIEW_REQUIRED, payments.findById(p.getId()).orElseThrow().getStatus());
        assertFalse(bookings.findById(b.getId()).orElseThrow().isPaymentRetryAllowed());
    }
    @Test void legacyClosedLinkActuallyStillPendingBlocksRetryAndPersistsReread() {
        var b = booking(BookingStatus.CANCELLED, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.CANCELLED);
        tx(() -> { bookings.findByIdForUpdate(b.getId()).orElseThrow().setPaymentRetryAllowed(true); return null; });
        var pending = provider(p, PaymentLinkStatus.PENDING); when(gateway.get(p.getOrderCode())).thenReturn(pending);
        assertEquals("PAYMENT_RECONCILING", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), request())).getCode());
        assertEquals(PaymentTransactionStatus.PENDING, payments.findById(p.getId()).orElseThrow().getStatus());
        assertNull(paymentService.status(customer(), p.getOrderCode()).checkoutUrl()); verify(gateway, never()).create(any());
    }
    @ParameterizedTest @CsvSource({"09:30", "10:00"})
    void concurrentRetryAndNewBookingSharePractitionerMutex(String newStart) throws Exception {
        var b = booking(BookingStatus.CANCELLED, PaymentStatus.UNPAID); var c = customer();
        tx(() -> { bookings.findByIdForUpdate(b.getId()).orElseThrow().setPaymentRetryAllowed(true); return null; });
        when(gateway.create(any())).thenAnswer(i -> created(i.getArgument(0)));
        var gate = new java.util.concurrent.CyclicBarrier(2);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var retry = pool.submit(() -> { gate.await(5, java.util.concurrent.TimeUnit.SECONDS); return outcome(() -> paymentService.create(c, b.getId(), newRequest())); });
            var create = pool.submit(() -> { gate.await(5, java.util.concurrent.TimeUnit.SECONDS); return outcome(() -> bookingService.create(c,
                    new CreateBookingRequest(b.getService().getId(), b.getPractitioner().getId(), b.getAppointmentDate(), LocalTime.parse(newStart), null))); });
            var results = List.of(retry.get(10, java.util.concurrent.TimeUnit.SECONDS), create.get(10, java.util.concurrent.TimeUnit.SECONDS));
            assertEquals(1, results.stream().filter("OK"::equals).count()); assertEquals(1, results.stream().filter("SLOT_UNAVAILABLE"::equals).count());
            assertEquals(1, bookings.findAll().stream().filter(x -> x.getStatus() != BookingStatus.CANCELLED).count());
        }
    }
    @Test void simultaneousNewBookingsCannotExceedOnePractitionerCapacity() throws Exception {
        var cancelledFixture = booking(BookingStatus.CANCELLED, PaymentStatus.UNPAID);
        var request = new CreateBookingRequest(cancelledFixture.getService().getId(),
                cancelledFixture.getPractitioner().getId(), cancelledFixture.getAppointmentDate(), LocalTime.of(10, 0), null);
        var gate = new java.util.concurrent.CyclicBarrier(2);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> { gate.await(5, java.util.concurrent.TimeUnit.SECONDS); return outcome(() -> bookingService.create(customer(), request)); });
            var second = pool.submit(() -> { gate.await(5, java.util.concurrent.TimeUnit.SECONDS); return outcome(() -> bookingService.create(customer(), request)); });
            var results = List.of(first.get(10, java.util.concurrent.TimeUnit.SECONDS), second.get(10, java.util.concurrent.TimeUnit.SECONDS));
            assertEquals(1, results.stream().filter("OK"::equals).count());
            assertEquals(1, results.stream().filter("SLOT_UNAVAILABLE"::equals).count());
            assertEquals(1, bookings.findAll().stream().filter(b -> b.getStatus() != BookingStatus.CANCELLED).count());
        }
    }
    private String outcome(Runnable action) { try { action.run(); return "OK"; } catch (ApiException e) { return e.getCode(); } }

    @Test void unpaidWithoutAttemptExpiresExactlyAtTwelveMinutesAndCannotPayAgain() {
        Booking b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID);
        doReturn(BookingCompletionPolicy.holdUntil(bookings.findById(b.getId()).orElseThrow()).minusSeconds(1)).when(time).now();
        holdExpiry.expire(b.getId()); assertEquals(BookingStatus.PENDING, bookings.findById(b.getId()).orElseThrow().getStatus());
        doReturn(BookingCompletionPolicy.holdUntil(bookings.findById(b.getId()).orElseThrow())).when(time).now(); holdExpiry.expire(b.getId());
        var result = bookingService.customerBooking(customer(), b.getId());
        assertEquals(BookingStatus.CANCELLED, result.status()); assertFalse(result.paymentEligible());
        assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), newRequest())); verify(gateway, never()).create(any());
    }
    @Test void holdExpiryCancelsOnlyAfterVerifiedZeroMoneyAndRetainsLatePaidEvidence() {
        Booking b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); PaymentTransaction p = attempt(b, PaymentTransactionStatus.PENDING);
        doReturn(BookingCompletionPolicy.holdUntil(bookings.findById(b.getId()).orElseThrow())).when(time).now();
        proof(p, PaymentLinkStatus.PENDING);
        var closed = provider(p, PaymentLinkStatus.CANCELLED); when(gateway.cancel(eq(p.getOrderCode()), any())).thenReturn(closed);
        paymentService.statusForBooking(customer(), b.getId()); var result = bookingService.customerBooking(customer(), b.getId());
        assertEquals(BookingStatus.CANCELLED, result.status()); assertFalse(result.paymentEligible()); assertFalse(bookings.findById(b.getId()).orElseThrow().isPaymentRetryAllowed());
        paymentService.handleWebhook(paidWebhook(p)); var saved = payments.findById(p.getId()).orElseThrow();
        assertEquals(PaymentTransactionStatus.REVIEW_REQUIRED, saved.getStatus()); assertNotNull(saved.getPaidAt());
        assertEquals(BookingStatus.CANCELLED, bookings.findById(b.getId()).orElseThrow().getStatus());
    }
    @Test void holdExpiryTimeoutKeepsSlotAndManualBlockerButVerifiedPaidAtDeadlineConfirmsNormally() {
        Booking b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); PaymentTransaction p = attempt(b, PaymentTransactionStatus.PENDING);
        doReturn(b.getCreatedAt().plusSeconds(721)).when(time).now(); proof(p, PaymentLinkStatus.PENDING);
        when(gateway.cancel(eq(p.getOrderCode()), any())).thenThrow(new ApiException(org.springframework.http.HttpStatus.GATEWAY_TIMEOUT, "PROVIDER_TIMEOUT", "test"));
        paymentService.reconcileById(p.getId()); assertEquals(BookingStatus.PENDING, bookings.findById(b.getId()).orElseThrow().getStatus());
        assertTrue(payments.findById(p.getId()).orElseThrow().isRequiresManualReview()); assertFalse(bookingService.customerBooking(customer(), b.getId()).paymentEligible());
        paymentService.handleWebhook(paidWebhook(p)); assertTrue(payments.findById(p.getId()).orElseThrow().isRequiresManualReview());
        Booking second = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); PaymentTransaction paid = attempt(second, PaymentTransactionStatus.PENDING);
        doReturn(BookingCompletionPolicy.holdUntil(bookings.findById(second.getId()).orElseThrow())).when(time).now(); proof(paid, PaymentLinkStatus.PAID); paymentService.reconcileById(paid.getId());
        var status = bookingService.customerBooking(customer(), second.getId());
        assertEquals(BookingStatus.CONFIRMED, status.status()); assertEquals(PaymentStatus.PARTIALLY_PAID, status.paymentStatus()); assertFalse(status.paymentEligible());
    }

    @Test void legacyFifteenMinuteLinkCannotExposeInstructionsOrFreshLeaseBeyondBookingHold() {
        Booking b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); PaymentTransaction p = attempt(b, PaymentTransactionStatus.PENDING);
        Instant deadline = BookingCompletionPolicy.holdUntil(bookings.findById(b.getId()).orElseThrow());
        doReturn(deadline.minusMillis(500)).when(time).now(); proof(p, PaymentLinkStatus.PENDING);
        var active = paymentService.statusForBooking(customer(), b.getId());
        assertTrue(active.checkoutAllowed()); assertEquals(deadline, active.expiresAt());
        assertTrue(active.instructionsFreshForMs() <= 500);
        doReturn(deadline).when(time).now();
        var elapsed = paymentService.statusForBooking(customer(), b.getId());
        assertFalse(elapsed.checkoutAllowed()); assertNull(elapsed.checkoutUrl()); assertNull(elapsed.qrCode());
        assertEquals(0, elapsed.instructionsFreshForMs());
        assertEquals(BookingStatus.PENDING, bookings.findById(b.getId()).orElseThrow().getStatus()); // timer is not closure proof
    }

    @Test void expiryBatchSeesAnAttemptCommittedWhileWaitingForBookingLock() throws Exception {
        Booking b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID);
        doReturn(BookingCompletionPolicy.holdUntil(bookings.findById(b.getId()).orElseThrow())).when(time).now();
        var locked = new java.util.concurrent.CountDownLatch(1);
        var release = new java.util.concurrent.CountDownLatch(1);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var reservation = pool.submit(() -> tx(() -> {
                bookings.findByIdForUpdate(b.getId()).orElseThrow(); attempt(b, PaymentTransactionStatus.PENDING); locked.countDown();
                try { assertTrue(release.await(5, java.util.concurrent.TimeUnit.SECONDS)); } catch (InterruptedException e) { throw new IllegalStateException(e); }
                return null;
            }));
            assertTrue(locked.await(5, java.util.concurrent.TimeUnit.SECONDS));
            var expiry = pool.submit(() -> holdExpiry.expireCandidates());
            try { assertThrows(java.util.concurrent.TimeoutException.class, () -> expiry.get(200, java.util.concurrent.TimeUnit.MILLISECONDS)); }
            finally { release.countDown(); }
            reservation.get(10, java.util.concurrent.TimeUnit.SECONDS); expiry.get(10, java.util.concurrent.TimeUnit.SECONDS);
        }
        assertEquals(BookingStatus.PENDING, bookings.findById(b.getId()).orElseThrow().getStatus());
        assertEquals(1, payments.findAllByBookingIdOrderByCreatedAtDesc(b.getId()).size());
        verify(gateway, never()).cancel(any(), any());
    }
}
