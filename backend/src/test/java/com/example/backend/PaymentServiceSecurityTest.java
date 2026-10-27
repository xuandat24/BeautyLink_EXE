package com.example.backend;

import com.example.backend.model.Booking;
import com.example.backend.model.PaymentTransaction;
import com.example.backend.model.UserAccount;
import com.example.backend.model.Practitioner;
import com.example.backend.dto.ApiDtos.CreatePayOSPaymentRequest;
import com.example.backend.dto.ApiDtos.PayOSPaymentResponse;
import com.example.backend.exception.ApiException;
import com.example.backend.repository.BookingRepository;
import com.example.backend.repository.PaymentTransactionRepository;
import com.example.backend.repository.PractitionerRepository;
import com.example.backend.service.PayOSGateway;
import com.example.backend.service.PaymentService;
import com.example.backend.service.PaymentQuoteService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.payos.model.v2.paymentRequests.PaymentLink;
import vn.payos.model.v2.paymentRequests.PaymentLinkStatus;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkRequest;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkResponse;
import vn.payos.model.webhooks.Webhook;
import vn.payos.model.webhooks.WebhookData;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;
import java.util.List;

import static com.example.backend.model.DomainEnums.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentServiceSecurityTest {
    @Mock PaymentTransactionRepository payments;
    @Mock BookingRepository bookings;
    @Mock PayOSGateway gateway;
    @Mock PractitionerRepository practitioners;
    @Mock com.example.backend.service.BookingConfirmationNotificationService bookingNotifications;
    PaymentService service;

    @BeforeEach
    void setUp() {
        service = new PaymentService(payments, bookings, practitioners, gateway, mock(com.example.backend.service.AvailabilityService.class), mock(org.springframework.transaction.PlatformTransactionManager.class), new com.example.backend.service.BookingCompletionPolicy(),
                new PaymentQuoteService(mock(com.example.backend.repository.ServiceOfferingRepository.class)), bookingNotifications,
                "https://frontend/success", "https://frontend/cancel", 60, 120);
    }

    @Test
    void providerExpiredPaymentReleasesBookingSlot() {
        PaymentTransaction payment = pendingPayment();
        PaymentLink provider = provider(payment, PaymentLinkStatus.EXPIRED);
        lockPayment(payment);
        when(gateway.get(payment.getOrderCode())).thenReturn(provider);

        service.status(payment.getBooking().getCustomer(), payment.getOrderCode());

        assertEquals(PaymentTransactionStatus.EXPIRED, payment.getStatus());
        assertEquals(BookingStatus.CANCELLED, payment.getBooking().getStatus());
        assertEquals(PaymentStatus.UNPAID, payment.getBooking().getPaymentStatus());
        assertEquals(true, payment.getBooking().isPaymentRetryAllowed());
        verify(bookingNotifications, never()).enqueueVerifiedPayment(any());
    }

    @Test
    void providerCancelledPaymentAlsoReleasesBookingSlot() {
        PaymentTransaction payment = pendingPayment();
        PaymentLink provider = provider(payment, PaymentLinkStatus.CANCELLED);
        lockPayment(payment);
        when(gateway.get(payment.getOrderCode())).thenReturn(provider);

        service.status(payment.getBooking().getCustomer(), payment.getOrderCode());

        assertEquals(PaymentTransactionStatus.CANCELLED, payment.getStatus());
        assertEquals(BookingStatus.CANCELLED, payment.getBooking().getStatus());
        verify(bookingNotifications, never()).enqueueVerifiedPayment(any());
    }

    @Test
    void signedLatePaymentIsRecordedWithoutReallocatingReleasedSlot() {
        PaymentTransaction payment = pendingPayment();
        payment.setStatus(PaymentTransactionStatus.EXPIRED);
        payment.getBooking().setStatus(BookingStatus.CANCELLED);
        Webhook webhook = mock(Webhook.class);
        WebhookData data = mock(WebhookData.class);
        when(webhook.getSuccess()).thenReturn(true);
        when(data.getOrderCode()).thenReturn(payment.getOrderCode());
        when(data.getAmount()).thenReturn(payment.getAmount().longValueExact());
        when(data.getPaymentLinkId()).thenReturn(payment.getPaymentLinkId());
        when(data.getReference()).thenReturn("LATE-BANK-REFERENCE");
        when(data.getCode()).thenReturn("00");
        when(gateway.verify(webhook)).thenReturn(data);
        lockPayment(payment);

        service.handleWebhook(webhook);

        assertEquals(PaymentTransactionStatus.REVIEW_REQUIRED, payment.getStatus());
        assertEquals(PaymentStatus.UNPAID, payment.getBooking().getPaymentStatus());
        assertEquals(BookingStatus.CANCELLED, payment.getBooking().getStatus());
        verify(bookingNotifications, never()).enqueueVerifiedPayment(any());
    }

    @ParameterizedTest
    @EnumSource(value = PaymentOption.class, names = {"DEPOSIT_05", "FULL_100"})
    void everyCurrentVerifiedPaymentOptionQueuesBothLogicalRecipients(PaymentOption option) {
        PaymentTransaction payment = pendingPayment();
        payment.setPaymentOption(option);
        if (option == PaymentOption.DEPOSIT_05) {
            payment.setAmount(new BigDecimal("25000"));
            payment.setRemainingAmount(new BigDecimal("475000"));
        } else {
            payment.setAmount(new BigDecimal("500000"));
            payment.setRemainingAmount(BigDecimal.ZERO);
        }
        Webhook webhook = successfulWebhook(payment, payment.getAmount().longValueExact(), payment.getPaymentLinkId());
        lockPayment(payment);
        when(payments.findAllByBookingIdForUpdate(payment.getBooking().getId())).thenReturn(List.of(payment));

        assertTrue(service.handleWebhook(webhook));

        assertEquals(PaymentTransactionStatus.PAID, payment.getStatus());
        assertEquals(BookingStatus.CONFIRMED, payment.getBooking().getStatus());
        assertEquals(option == PaymentOption.FULL_100 ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID,
                payment.getBooking().getPaymentStatus());
        verify(bookingNotifications).enqueueVerifiedPayment(payment);
    }

    @Test
    void oldAttemptPaidAfterRetryConfirmsBookingAndClosesNewerPendingAttempt() {
        PaymentTransaction oldAttempt = pendingPayment();
        oldAttempt.setStatus(PaymentTransactionStatus.EXPIRED);
        oldAttempt.getBooking().setStatus(BookingStatus.PENDING);
        PaymentTransaction newerAttempt = new PaymentTransaction();
        newerAttempt.setBooking(oldAttempt.getBooking());
        newerAttempt.setOrderCode(610000052L);
        newerAttempt.setStatus(PaymentTransactionStatus.PENDING);
        Webhook webhook = mock(Webhook.class);
        WebhookData data = mock(WebhookData.class);
        when(webhook.getSuccess()).thenReturn(true);
        when(data.getOrderCode()).thenReturn(oldAttempt.getOrderCode());
        when(data.getAmount()).thenReturn(oldAttempt.getAmount().longValueExact());
        when(data.getPaymentLinkId()).thenReturn(oldAttempt.getPaymentLinkId());
        when(data.getCode()).thenReturn("00");
        when(gateway.verify(webhook)).thenReturn(data);
        lockPayment(oldAttempt);
        when(payments.findAllByBookingIdForUpdate(oldAttempt.getBooking().getId()))
                .thenReturn(List.of(newerAttempt, oldAttempt));
        var closed = new PaymentLink(); closed.setId("test"); closed.setOrderCode(newerAttempt.getOrderCode());
        closed.setAmount(250000L); closed.setAmountPaid(0L); closed.setStatus(PaymentLinkStatus.CANCELLED);
        newerAttempt.setAmount(new BigDecimal("250000")); newerAttempt.setPaymentLinkId(closed.getId());
        when(gateway.cancel(newerAttempt.getOrderCode(), "Another payment attempt was completed")).thenReturn(closed);

        service.handleWebhook(webhook);

        assertEquals(PaymentTransactionStatus.PAID, oldAttempt.getStatus());
        assertEquals(PaymentTransactionStatus.CANCELLED, newerAttempt.getStatus());
        assertEquals(BookingStatus.CONFIRMED, oldAttempt.getBooking().getStatus());
        assertEquals(PaymentStatus.PARTIALLY_PAID, oldAttempt.getBooking().getPaymentStatus());
    }

    @Test
    void createDepositAndFullPaymentsUseCorrectAmountsAndPreserveVoucherMath() {
        Booking depositBooking = payableBooking(51L, 500_000L);
        prepareCreate(depositBooking, "deposit-link");
        PayOSPaymentResponse deposit = service.create(depositBooking.getCustomer(), depositBooking.getId(),
                new CreatePayOSPaymentRequest(PaymentOption.DEPOSIT_05, "BEAUTY50"));
        assertEquals(new BigDecimal("22500"), deposit.amount());
        assertEquals(new BigDecimal("427500"), deposit.remainingAmount());
        assertEquals(TestPayOSQr.payload(22500), deposit.qrCode());
        assertEquals("TEST ACCOUNT", deposit.bankAccountName());
        assertEquals("TEST-ACCOUNT", deposit.bankAccountNumber());

        Booking fullBooking = payableBooking(52L, 500_000L);
        prepareCreate(fullBooking, "full-link");
        PayOSPaymentResponse full = service.create(fullBooking.getCustomer(), fullBooking.getId(),
                new CreatePayOSPaymentRequest(PaymentOption.FULL_100, null));
        assertEquals(new BigDecimal("500000"), full.amount());
        assertEquals(BigDecimal.ZERO, full.remainingAmount());
    }

    @Test
    void createRejectsAmountsBelowPayOSMinimum() {
        Booking booking = payableBooking(53L, 3_000L);
        when(bookings.findByIdForUpdate(booking.getId())).thenReturn(Optional.of(booking));
        when(payments.findAllByBookingIdForUpdate(booking.getId())).thenReturn(List.of());
        ApiException error = assertThrows(ApiException.class, () -> service.create(booking.getCustomer(), booking.getId(),
                new CreatePayOSPaymentRequest(PaymentOption.DEPOSIT_05, null)));
        assertEquals("DEPOSIT_TOO_LOW_USE_FULL_PAYMENT", error.getCode());
    }

    @Test
    void newLegacyDepositRequestGetsExplicitPolicyChangedResponse() {
        Booking booking = payableBooking(531L, 500_000L);
        when(bookings.findByIdForUpdate(booking.getId())).thenReturn(Optional.of(booking));
        when(payments.findAllByBookingIdForUpdate(booking.getId())).thenReturn(List.of());

        ApiException error = assertThrows(ApiException.class, () -> service.create(booking.getCustomer(), booking.getId(),
                new CreatePayOSPaymentRequest(PaymentOption.DEPOSIT_50, null)));

        assertEquals("POLICY_CHANGED", error.getCode());
    }

    @Test
    void existingLegacyPendingAttemptKeepsItsOriginalAmountsAndCanBeResumed() {
        Booking booking = payableBooking(532L, 500_000L);
        PaymentTransaction legacy = pendingPayment();
        legacy.setBooking(booking);
        legacy.setAmount(new BigDecimal("250000"));
        legacy.setRemainingAmount(new BigDecimal("250000"));
        legacy.setPaymentOption(PaymentOption.DEPOSIT_50);
        legacy.setCheckoutUrl("https://pay.payos.vn/web/legacy-payment");
        legacy.setExpiresAt(Instant.now().plusSeconds(600));
        when(bookings.findByIdForUpdate(booking.getId())).thenReturn(Optional.of(booking));
        when(payments.findAllByBookingIdForUpdate(booking.getId())).thenReturn(List.of(legacy));
        when(payments.findAllByBookingIdOrderByCreatedAtDesc(booking.getId())).thenReturn(List.of(legacy));
        var observed = provider(legacy, PaymentLinkStatus.PENDING);
        when(gateway.get(legacy.getOrderCode())).thenReturn(observed);

        PayOSPaymentResponse response = service.create(booking.getCustomer(), booking.getId(),
                new CreatePayOSPaymentRequest(PaymentOption.DEPOSIT_50, null));

        assertEquals(PaymentOption.DEPOSIT_50, response.paymentOption());
        assertEquals(new BigDecimal("250000"), response.amount());
        assertEquals(new BigDecimal("250000"), response.remainingAmount());
    }

    @Test
    void anotherCustomerCannotCreateOrReadPayment() {
        Booking booking = payableBooking(54L, 100_000L);
        UserAccount other = new UserAccount();
        other.setId(999L);
        when(bookings.findByIdForUpdate(booking.getId())).thenReturn(Optional.of(booking));
        assertEquals("BOOKING_FORBIDDEN", assertThrows(ApiException.class, () -> service.create(other, booking.getId(),
                new CreatePayOSPaymentRequest(PaymentOption.FULL_100, null))).getCode());

        PaymentTransaction payment = pendingPayment();
        lockPayment(payment);
        assertEquals("PAYMENT_FORBIDDEN", assertThrows(ApiException.class,
                () -> service.status(other, payment.getOrderCode())).getCode());
    }

    @Test
    void webhookAmountAndLinkMismatchesRequireManualReview() {
        PaymentTransaction amountMismatch = pendingPayment();
        Webhook amountWebhook = successfulWebhook(amountMismatch, amountMismatch.getAmount().longValueExact() - 1,
                amountMismatch.getPaymentLinkId());
        lockPayment(amountMismatch);
        assertEquals(false, service.handleWebhook(amountWebhook));
        assertEquals(PaymentTransactionStatus.REVIEW_REQUIRED, amountMismatch.getStatus());
        assertTrue(amountMismatch.isRequiresManualReview());
        org.junit.jupiter.api.Assertions.assertNull(amountMismatch.getPaymentReference());
        org.junit.jupiter.api.Assertions.assertNull(amountMismatch.getPaidAt());

        PaymentTransaction linkMismatch = pendingPayment();
        linkMismatch.setOrderCode(610000052L);
        Webhook linkWebhook = successfulWebhook(linkMismatch, linkMismatch.getAmount().longValueExact(), "wrong-link");
        lockPayment(linkMismatch);
        assertEquals(false, service.handleWebhook(linkWebhook));
        assertEquals(PaymentTransactionStatus.REVIEW_REQUIRED, linkMismatch.getStatus());
        org.junit.jupiter.api.Assertions.assertNull(linkMismatch.getPaymentReference());
        org.junit.jupiter.api.Assertions.assertNull(linkMismatch.getPaidAt());
        verify(bookingNotifications, never()).enqueueVerifiedPayment(any());
    }

    @Test
    void duplicatePaidWebhookIsIdempotent() {
        PaymentTransaction payment = pendingPayment();
        Webhook webhook = successfulWebhook(payment, payment.getAmount().longValueExact(), payment.getPaymentLinkId());
        when(gateway.verify(webhook).getReference()).thenReturn("BANK-REF");
        lockPayment(payment);
        when(payments.findAllByBookingIdForUpdate(payment.getBooking().getId())).thenReturn(List.of(payment));
        assertTrue(service.handleWebhook(webhook));
        var locks = org.mockito.Mockito.inOrder(payments, bookings);
        locks.verify(payments).findBookingIdByOrderCode(payment.getOrderCode());
        locks.verify(bookings).findByIdForUpdate(payment.getBooking().getId());
        locks.verify(payments).findByOrderCodeForUpdate(payment.getOrderCode());
        Instant firstPaidAt = payment.getPaidAt();
        assertTrue(service.handleWebhook(webhook));
        assertEquals(firstPaidAt, payment.getPaidAt());
        assertEquals("BANK-REF", payment.getPaymentReference());
        assertEquals(PaymentTransactionStatus.PAID, payment.getStatus());
        verify(bookingNotifications, times(1)).enqueueVerifiedPayment(payment);
    }

    @Test
    void reconciliationPaidConfirmsButNetworkFailureLeavesPending() {
        PaymentTransaction paid = pendingPayment();
        PaymentLink provider = provider(paid, PaymentLinkStatus.PAID);
        when(provider.getAmountPaid()).thenReturn(paid.getAmount().longValueExact());
        when(payments.findBookingIdByPaymentId(71L)).thenReturn(Optional.of(paid.getBooking().getId()));
        when(bookings.findByIdForUpdate(paid.getBooking().getId())).thenReturn(Optional.of(paid.getBooking()));
        when(payments.findByIdForUpdate(71L)).thenReturn(Optional.of(paid));
        when(payments.findAllByBookingIdForUpdate(paid.getBooking().getId())).thenReturn(List.of(paid));
        when(gateway.get(paid.getOrderCode())).thenReturn(provider);
        service.reconcileById(71L);
        assertEquals(PaymentTransactionStatus.PAID, paid.getStatus());
        assertEquals(BookingStatus.CONFIRMED, paid.getBooking().getStatus());
        verify(bookingNotifications, times(1)).enqueueVerifiedPayment(paid);

        PaymentTransaction pending = pendingPayment();
        pending.setOrderCode(610000053L);
        when(payments.findBookingIdByPaymentId(72L)).thenReturn(Optional.of(pending.getBooking().getId()));
        when(bookings.findByIdForUpdate(pending.getBooking().getId())).thenReturn(Optional.of(pending.getBooking()));
        when(payments.findByIdForUpdate(72L)).thenReturn(Optional.of(pending));
        when(gateway.get(pending.getOrderCode())).thenThrow(new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                "PAYOS_RECONCILIATION_FAILED", "temporary"));
        service.reconcileById(72L);
        assertEquals(PaymentTransactionStatus.PENDING, pending.getStatus());
        org.junit.jupiter.api.Assertions.assertNull(pending.getLastReconciledAt(), "A timeout must not become a successful verification timestamp");
    }

    private void lockPayment(PaymentTransaction payment) {
        when(payments.findBookingIdByOrderCode(payment.getOrderCode())).thenReturn(Optional.of(payment.getBooking().getId()));
        when(bookings.findByIdForUpdate(payment.getBooking().getId())).thenReturn(Optional.of(payment.getBooking()));
        when(payments.findByOrderCodeForUpdate(payment.getOrderCode())).thenReturn(Optional.of(payment));
    }

    private PaymentTransaction pendingPayment() {
        UserAccount customer = new UserAccount();
        customer.setId(41L);
        Booking booking = new Booking();
        booking.setId(51L);
        booking.setBookingCode("BL-SECURITY-51");
        booking.setCustomer(customer);
        booking.setStatus(BookingStatus.PENDING);
        booking.setPaymentStatus(PaymentStatus.UNPAID);
        booking.setAppointmentDate(LocalDate.now().plusDays(1));
        booking.setStartTime(LocalTime.of(10,0));

        PaymentTransaction payment = new PaymentTransaction();
        payment.setBooking(booking);
        payment.setOrderCode(610000051L);
        payment.setPaymentLinkId("payos-security-51");
        payment.setAmount(new BigDecimal("250000"));
        payment.setRemainingAmount(new BigDecimal("250000"));
        payment.setPaymentOption(PaymentOption.DEPOSIT_50);
        payment.setStatus(PaymentTransactionStatus.PENDING);
        payment.setExpiresAt(Instant.now().minusSeconds(1));
        return payment;
    }

    private Booking payableBooking(Long id, long total) {
        UserAccount customer = new UserAccount();
        customer.setId(41L);
        customer.setFullName("Customer Test");
        customer.setEmail("customer@example.com");
        customer.setPhone("0900000001");
        Practitioner practitioner = new Practitioner();
        practitioner.setId(id + 1000);
        Booking booking = new Booking();
        booking.setId(id);
        booking.setBookingCode("BL-" + id);
        booking.setCustomer(customer);
        booking.setPractitioner(practitioner);
        booking.setAppointmentDate(LocalDate.now().plusDays(1));
        booking.setStartTime(LocalTime.of(10, 0));
        booking.setTotalAmount(BigDecimal.valueOf(total));
        var offering = new com.example.backend.model.ServiceOffering(); offering.setId(id); booking.setService(offering);
        booking.setStatus(BookingStatus.PENDING);
        booking.setPaymentStatus(PaymentStatus.UNPAID);
        return booking;
    }

    @Test void existingAttemptWithoutQrIsVerifiedWithoutCreatingAnotherPayment() {
        var p = pendingPayment(); p.setQrCode(null);
        p.setCheckoutUrl("https://pay.payos.vn/web/legacy");
        p.setExpiresAt(Instant.now().plusSeconds(600));
        lockPayment(p);
        when(payments.findAllByBookingIdOrderByCreatedAtDesc(p.getBooking().getId())).thenReturn(List.of(p));
        var observed = provider(p, PaymentLinkStatus.PENDING);
        when(gateway.get(p.getOrderCode())).thenReturn(observed);
        var response = service.status(p.getBooking().getCustomer(), p.getOrderCode());
        assertTrue(response.checkoutAllowed());
        org.junit.jupiter.api.Assertions.assertNull(response.qrCode());
        assertEquals(p.getOrderCode(), response.orderCode());
        assertEquals(PaymentTransactionStatus.PENDING, p.getStatus());
        verify(gateway, never()).create(any());
    }

    @Test void providerTimeoutLocksInstructionsUntilVerifiedRetryAndThenAcceptsPaid() {
        var p = pendingPayment(); p.setExpiresAt(Instant.now().plusSeconds(600));
        p.setCheckoutUrl("https://pay.payos.vn/web/pending"); p.setQrCode(TestPayOSQr.payload(p.getAmount().longValueExact()));
        lockPayment(p);
        when(payments.findAllByBookingIdOrderByCreatedAtDesc(p.getBooking().getId())).thenReturn(List.of(p));
        when(payments.findAllByBookingIdForUpdate(p.getBooking().getId())).thenReturn(List.of(p));
        when(gateway.get(p.getOrderCode())).thenThrow(new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY,"PAYOS_RECONCILIATION_FAILED","Test network outage"));
        var locked = service.status(p.getBooking().getCustomer(),p.getOrderCode());
        assertTrue(locked.verificationPending());
        org.junit.jupiter.api.Assertions.assertFalse(locked.checkoutAllowed());
        org.junit.jupiter.api.Assertions.assertNull(locked.qrCode());
        org.junit.jupiter.api.Assertions.assertNull(p.getLastReconciledAt());
        assertEquals(BookingStatus.PENDING,p.getBooking().getStatus());
        var paid = new PaymentLink(); paid.setId(p.getPaymentLinkId());paid.setOrderCode(p.getOrderCode());paid.setAmount(p.getAmount().longValueExact());paid.setAmountPaid(p.getAmount().longValueExact());paid.setStatus(PaymentLinkStatus.PAID);
        org.mockito.Mockito.doReturn(paid).when(gateway).get(p.getOrderCode());
        assertEquals(PaymentTransactionStatus.PAID,service.status(p.getBooking().getCustomer(),p.getOrderCode()).status());
        assertEquals(BookingStatus.CONFIRMED,p.getBooking().getStatus());
        org.junit.jupiter.api.Assertions.assertNull(service.status(p.getBooking().getCustomer(),p.getOrderCode()).qrCode());
        verify(gateway,times(2)).get(p.getOrderCode());
    }

    @Test void unknownProviderAmountCannotReenableInstructionsOnTheNextPoll() {
        var p=pendingPayment();lockPayment(p);
        var unknown=provider(p,PaymentLinkStatus.PENDING);when(unknown.getAmountPaid()).thenReturn(null);
        when(gateway.get(p.getOrderCode())).thenReturn(unknown);
        assertTrue(service.status(p.getBooking().getCustomer(),p.getOrderCode()).verificationPending());
        assertTrue(service.status(p.getBooking().getCustomer(),p.getOrderCode()).verificationPending());
        org.junit.jupiter.api.Assertions.assertNull(p.getLastReconciledAt());
        assertEquals(PaymentTransactionStatus.PENDING,p.getStatus());
    }

    @Test void freshQrDoesNotRequireHostedUrlOrOptionalBankMetadata() {
        var b=payableBooking(881L,500_000L);prepareCreate(b,"qr-only",true);
        var result=service.create(b.getCustomer(),b.getId(),new CreatePayOSPaymentRequest(PaymentOption.DEPOSIT_05,null));
        assertTrue(result.checkoutAllowed());assertEquals(TestPayOSQr.payload(25000),result.qrCode());
        org.junit.jupiter.api.Assertions.assertNull(result.checkoutUrl());org.junit.jupiter.api.Assertions.assertNull(result.bankAccountName());
        verify(gateway,times(1)).create(any());
    }

    @Test void finalizationDoesNotMutateReceiptWhenVerifiedWebhookWon() {
        var b=payableBooking(882L,500000L);
        when(bookings.findByIdForUpdate(b.getId())).thenReturn(Optional.of(b));
        when(payments.findAllByBookingIdForUpdate(b.getId())).thenReturn(List.of());
        var captured=new java.util.concurrent.atomic.AtomicReference<PaymentTransaction>();
        org.mockito.Mockito.doAnswer(call->{PaymentTransaction p=call.getArgument(0);captured.set(p);when(payments.findByOrderCodeForUpdate(p.getOrderCode())).thenReturn(Optional.of(p));return p;}).when(payments).saveAndFlush(any());
        Instant paidAt=Instant.parse("2026-01-01T00:00:00Z");
        when(gateway.create(any())).thenAnswer(call->{
            CreatePaymentLinkRequest r=call.getArgument(0);var p=captured.get();p.setPaymentLinkId("webhook-first");p.setStatus(PaymentTransactionStatus.PAID);p.setPaidAt(paidAt);b.setStatus(BookingStatus.CONFIRMED);b.setPaymentStatus(PaymentStatus.PARTIALLY_PAID);
            var result=new CreatePaymentLinkResponse();result.setOrderCode(r.getOrderCode());result.setAmount(r.getAmount());result.setPaymentLinkId("webhook-first");result.setStatus(PaymentLinkStatus.PENDING);result.setQrCode(TestPayOSQr.payload(r.getAmount()));return result;
        });
        var result=service.create(b.getCustomer(),b.getId(),new CreatePayOSPaymentRequest(PaymentOption.DEPOSIT_05,null));
        assertEquals(PaymentTransactionStatus.PAID,result.status());assertEquals(paidAt,captured.get().getPaidAt());
        org.junit.jupiter.api.Assertions.assertNull(captured.get().getProviderCreatedAt());org.junit.jupiter.api.Assertions.assertNull(captured.get().getQrCode());
        assertEquals(new BigDecimal("25000"),captured.get().getAmount());assertEquals(BookingStatus.CONFIRMED,b.getStatus());
    }

    @Test void reuseCannotBypassFailedProviderVerificationAndNeverCreatesAReplacement() {
        var p=pendingPayment();p.setExpiresAt(Instant.now().plusSeconds(600));p.setCheckoutUrl("https://pay.payos.vn/web/existing");
        when(bookings.findByIdForUpdate(p.getBooking().getId())).thenReturn(Optional.of(p.getBooking()));
        when(payments.findAllByBookingIdForUpdate(p.getBooking().getId())).thenReturn(List.of(p));
        when(gateway.get(p.getOrderCode())).thenThrow(new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY,"PAYOS_RECONCILIATION_FAILED","Synthetic timeout"));
        var error=assertThrows(ApiException.class,()->service.create(p.getBooking().getCustomer(),p.getBooking().getId(),new CreatePayOSPaymentRequest(PaymentOption.DEPOSIT_50,null)));
        assertEquals("PAYMENT_RECONCILING",error.getCode());assertEquals(PaymentTransactionStatus.PENDING,p.getStatus());
        org.junit.jupiter.api.Assertions.assertNull(p.getLastReconciledAt());verify(gateway,never()).create(any());verify(payments,never()).saveAndFlush(any());
    }

    private void prepareCreate(Booking booking, String paymentLinkId) {
        prepareCreate(booking,paymentLinkId,false);
    }
    private void prepareCreate(Booking booking, String paymentLinkId, boolean qrOnly) {
        when(bookings.findByIdForUpdate(booking.getId())).thenReturn(Optional.of(booking));
        when(payments.findAllByBookingIdForUpdate(booking.getId())).thenReturn(List.of());
        org.mockito.Mockito.doAnswer(invocation -> {
            PaymentTransaction saved = invocation.getArgument(0);
            when(payments.findByOrderCodeForUpdate(saved.getOrderCode())).thenReturn(Optional.of(saved));
            return saved;
        }).when(payments).saveAndFlush(any());
        when(gateway.create(any(CreatePaymentLinkRequest.class))).thenAnswer(invocation -> {
            CreatePaymentLinkRequest r = invocation.getArgument(0);
            var response = new CreatePaymentLinkResponse(); response.setOrderCode(r.getOrderCode()); response.setAmount(r.getAmount());
            response.setQrCode(TestPayOSQr.payload(r.getAmount()));
            if(!qrOnly){response.setBin("970422");response.setAccountNumber("TEST-ACCOUNT"); response.setAccountName("TEST ACCOUNT"); response.setDescription("TEST ONLY");response.setCheckoutUrl("https://pay.payos.vn/web/" + paymentLinkId);}
            response.setStatus(PaymentLinkStatus.PENDING); response.setPaymentLinkId(paymentLinkId);
            return response;
        });
    }

    private Webhook successfulWebhook(PaymentTransaction payment, long amount, String paymentLinkId) {
        Webhook webhook = mock(Webhook.class);
        WebhookData data = mock(WebhookData.class);
        when(webhook.getSuccess()).thenReturn(true);
        when(data.getOrderCode()).thenReturn(payment.getOrderCode());
        when(data.getAmount()).thenReturn(amount);
        org.mockito.Mockito.lenient().when(data.getPaymentLinkId()).thenReturn(paymentLinkId);
        when(data.getCode()).thenReturn("00");
        when(gateway.verify(webhook)).thenReturn(data);
        return webhook;
    }

    private PaymentLink provider(PaymentTransaction payment, PaymentLinkStatus status) {
        PaymentLink provider = mock(PaymentLink.class);
        when(provider.getOrderCode()).thenReturn(payment.getOrderCode());
        when(provider.getId()).thenReturn(payment.getPaymentLinkId());
        when(provider.getAmount()).thenReturn(payment.getAmount().longValueExact());
        when(provider.getStatus()).thenReturn(status);
        when(provider.getAmountPaid()).thenReturn(0L);
        return provider;
    }
}
