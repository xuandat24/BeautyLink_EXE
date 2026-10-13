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
    @Autowired ReviewService reviewService;
    @Autowired CatalogService catalog;
    @Autowired PlatformTransactionManager manager;
    @Autowired BookingReviewRepository reviews;
    @MockitoBean PayOSGateway gateway;
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
    private ApiException timeout() { return new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY, "PAYOS_RECONCILIATION_FAILED", "test network timeout"); }

    @Test void customerCancelledPendingCheckoutMustNotBeReturned() {
        var b = booking(BookingStatus.CANCELLED, PaymentStatus.UNPAID); attempt(b, PaymentTransactionStatus.PENDING);
        assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), request()));
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
        assertEquals("PAYMENT_REVIEW_REQUIRED", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), request())).getCode());
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
        assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), request()));
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
        assertEquals("PAYMENT_REVIEW_REQUIRED", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), request())).getCode());
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
        assertNull(payments.findById(secondary.getId()).orElseThrow().getPaidAt());
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
        assertEquals("PAYMENT_REVIEW_REQUIRED", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), request())).getCode());
        assertEquals(PaymentTransactionStatus.REVIEW_REQUIRED, payments.findFirstByBookingIdOrderByCreatedAtDesc(b.getId()).orElseThrow().getStatus());
        assertEquals(1, payments.count());
    }
    @Test void timeoutCannotIssueSecondCheckoutAndVerifiedPendingCanBeReusedOnlyWhenSafe() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); when(gateway.create(any())).thenThrow(timeout());
        assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), request()));
        assertEquals("PAYMENT_RECONCILING", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), request())).getCode());
        verify(gateway, times(1)).create(any()); assertEquals(1, payments.count());
    }
    @Test void pendingReuseIsIdempotentButExpiredLinksFailClosed() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.PENDING);
        assertEquals(p.getCheckoutUrl(), paymentService.create(customer(), b.getId(), request()).checkoutUrl());
        assertEquals(1, payments.count()); verify(gateway, never()).create(any());
        tx(() -> { payments.findByIdForUpdate(p.getId()).orElseThrow().setExpiresAt(Instant.now().minusSeconds(1)); return null; });
        assertEquals("PAYMENT_RECONCILING", assertThrows(ApiException.class, () -> paymentService.create(customer(), b.getId(), request())).getCode());
    }
    @Test void verifiedExpiryAllowsNewAttemptWithoutOverwritingHistory() {
        var b = booking(BookingStatus.PENDING, PaymentStatus.UNPAID); var p = attempt(b, PaymentTransactionStatus.PENDING);
        var expired = provider(p, PaymentLinkStatus.EXPIRED); when(gateway.get(p.getOrderCode())).thenReturn(expired);
        paymentService.reconcileById(p.getId()); assertTrue(bookings.findById(b.getId()).orElseThrow().isPaymentRetryAllowed());
        when(gateway.create(any())).thenAnswer(i -> created(i.getArgument(0)));
        var response = paymentService.create(customer(), b.getId(), request());
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
        assertNull(paymentService.create(customer(), b.getId(), request()).checkoutUrl());
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
            var retry = pool.submit(() -> { gate.await(5, java.util.concurrent.TimeUnit.SECONDS); return outcome(() -> paymentService.create(c, b.getId(), request())); });
            var create = pool.submit(() -> { gate.await(5, java.util.concurrent.TimeUnit.SECONDS); return outcome(() -> bookingService.create(c,
                    new CreateBookingRequest(b.getService().getId(), b.getPractitioner().getId(), b.getAppointmentDate(), LocalTime.parse(newStart), null))); });
            var results = List.of(retry.get(10, java.util.concurrent.TimeUnit.SECONDS), create.get(10, java.util.concurrent.TimeUnit.SECONDS));
            assertEquals(1, results.stream().filter("OK"::equals).count()); assertEquals(1, results.stream().filter("SLOT_UNAVAILABLE"::equals).count());
            assertEquals(1, bookings.findAll().stream().filter(x -> x.getStatus() != BookingStatus.CANCELLED).count());
        }
    }
    private String outcome(Runnable action) { try { action.run(); return "OK"; } catch (ApiException e) { return e.getCode(); } }
}
