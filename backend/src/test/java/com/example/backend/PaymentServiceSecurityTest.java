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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import org.mockito.ArgumentCaptor;

@ExtendWith(MockitoExtension.class)
class PaymentServiceSecurityTest {
    @Mock PaymentTransactionRepository payments;
    @Mock BookingRepository bookings;
    @Mock PayOSGateway gateway;
    @Mock PractitionerRepository practitioners;
    PaymentService service;

    @BeforeEach
    void setUp() {
        service = new PaymentService(payments, bookings, practitioners, gateway,
                "https://frontend/success", "https://frontend/cancel", 60, 120);
    }

    @Test
    void providerExpiredPaymentReleasesBookingSlot() {
        PaymentTransaction payment = pendingPayment();
        PaymentLink provider = provider(payment, PaymentLinkStatus.EXPIRED);
        when(payments.findByOrderCodeForUpdate(payment.getOrderCode())).thenReturn(Optional.of(payment));
        when(gateway.get(payment.getOrderCode())).thenReturn(provider);

        service.status(payment.getBooking().getCustomer(), payment.getOrderCode());

        assertEquals(PaymentTransactionStatus.EXPIRED, payment.getStatus());
        assertEquals(BookingStatus.CANCELLED, payment.getBooking().getStatus());
        assertEquals(PaymentStatus.UNPAID, payment.getBooking().getPaymentStatus());
        assertEquals(true, payment.getBooking().isPaymentRetryAllowed());
    }

    @Test
    void providerCancelledPaymentAlsoReleasesBookingSlot() {
        PaymentTransaction payment = pendingPayment();
        PaymentLink provider = provider(payment, PaymentLinkStatus.CANCELLED);
        when(payments.findByOrderCodeForUpdate(payment.getOrderCode())).thenReturn(Optional.of(payment));
        when(gateway.get(payment.getOrderCode())).thenReturn(provider);

        service.status(payment.getBooking().getCustomer(), payment.getOrderCode());

        assertEquals(PaymentTransactionStatus.CANCELLED, payment.getStatus());
        assertEquals(BookingStatus.CANCELLED, payment.getBooking().getStatus());
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
        when(payments.findByOrderCodeForUpdate(payment.getOrderCode())).thenReturn(Optional.of(payment));

        service.handleWebhook(webhook);

        assertEquals(PaymentTransactionStatus.REVIEW_REQUIRED, payment.getStatus());
        assertEquals(PaymentStatus.UNPAID, payment.getBooking().getPaymentStatus());
        assertEquals(BookingStatus.CANCELLED, payment.getBooking().getStatus());
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
        when(payments.findByOrderCodeForUpdate(oldAttempt.getOrderCode())).thenReturn(Optional.of(oldAttempt));
        when(payments.findAllByBookingIdOrderByCreatedAtDesc(oldAttempt.getBooking().getId()))
                .thenReturn(List.of(newerAttempt, oldAttempt));

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
                new CreatePayOSPaymentRequest(PaymentOption.DEPOSIT_50, "BEAUTY50"));
        assertEquals(new BigDecimal("225000"), deposit.amount());
        assertEquals(new BigDecimal("225000"), deposit.remainingAmount());

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
        when(payments.findFirstByBookingIdAndStatusOrderByCreatedAtDesc(booking.getId(), PaymentTransactionStatus.PENDING))
                .thenReturn(Optional.empty());
        ApiException error = assertThrows(ApiException.class, () -> service.create(booking.getCustomer(), booking.getId(),
                new CreatePayOSPaymentRequest(PaymentOption.DEPOSIT_50, null)));
        assertEquals("PAYMENT_AMOUNT_TOO_LOW", error.getCode());
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
        when(payments.findByOrderCodeForUpdate(payment.getOrderCode())).thenReturn(Optional.of(payment));
        assertEquals("PAYMENT_FORBIDDEN", assertThrows(ApiException.class,
                () -> service.status(other, payment.getOrderCode())).getCode());
    }

    @Test
    void webhookAmountAndLinkMismatchesRequireManualReview() {
        PaymentTransaction amountMismatch = pendingPayment();
        Webhook amountWebhook = successfulWebhook(amountMismatch, amountMismatch.getAmount().longValueExact() - 1,
                amountMismatch.getPaymentLinkId());
        when(payments.findByOrderCodeForUpdate(amountMismatch.getOrderCode())).thenReturn(Optional.of(amountMismatch));
        assertEquals(false, service.handleWebhook(amountWebhook));
        assertEquals(PaymentTransactionStatus.REVIEW_REQUIRED, amountMismatch.getStatus());
        assertTrue(amountMismatch.isRequiresManualReview());

        PaymentTransaction linkMismatch = pendingPayment();
        linkMismatch.setOrderCode(610000052L);
        Webhook linkWebhook = successfulWebhook(linkMismatch, linkMismatch.getAmount().longValueExact(), "wrong-link");
        when(payments.findByOrderCodeForUpdate(linkMismatch.getOrderCode())).thenReturn(Optional.of(linkMismatch));
        assertEquals(false, service.handleWebhook(linkWebhook));
        assertEquals(PaymentTransactionStatus.REVIEW_REQUIRED, linkMismatch.getStatus());
    }

    @Test
    void duplicatePaidWebhookIsIdempotent() {
        PaymentTransaction payment = pendingPayment();
        Webhook webhook = successfulWebhook(payment, payment.getAmount().longValueExact(), payment.getPaymentLinkId());
        when(payments.findByOrderCodeForUpdate(payment.getOrderCode())).thenReturn(Optional.of(payment));
        when(payments.findAllByBookingIdOrderByCreatedAtDesc(payment.getBooking().getId())).thenReturn(List.of(payment));
        assertTrue(service.handleWebhook(webhook));
        Instant firstPaidAt = payment.getPaidAt();
        assertTrue(service.handleWebhook(webhook));
        assertEquals(firstPaidAt, payment.getPaidAt());
        assertEquals(PaymentTransactionStatus.PAID, payment.getStatus());
    }

    @Test
    void retryCreatesNewAttemptAndRejectsAnOccupiedReleasedSlot() {
        Booking booking = payableBooking(55L, 100_000L);
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setPaymentRetryAllowed(true);
        PaymentTransaction old = pendingPayment();
        old.setBooking(booking);
        old.setStatus(PaymentTransactionStatus.EXPIRED);
        prepareCreate(booking, "retry-link");
        when(practitioners.findByIdForUpdate(booking.getPractitioner().getId())).thenReturn(Optional.of(booking.getPractitioner()));
        when(bookings.existsByPractitionerIdAndAppointmentDateAndStartTimeAndStatusNotAndIdNot(
                booking.getPractitioner().getId(), booking.getAppointmentDate(), booking.getStartTime(), BookingStatus.CANCELLED, booking.getId()))
                .thenReturn(false);
        service.create(booking.getCustomer(), booking.getId(), new CreatePayOSPaymentRequest(PaymentOption.FULL_100, null));
        ArgumentCaptor<PaymentTransaction> saved = ArgumentCaptor.forClass(PaymentTransaction.class);
        verify(payments).saveAndFlush(saved.capture());
        assertNotSame(old, saved.getValue());
        assertEquals(PaymentTransactionStatus.EXPIRED, old.getStatus());

        Booking occupied = payableBooking(56L, 100_000L);
        occupied.setStatus(BookingStatus.CANCELLED);
        occupied.setPaymentRetryAllowed(true);
        when(bookings.findByIdForUpdate(occupied.getId())).thenReturn(Optional.of(occupied));
        when(payments.findFirstByBookingIdAndStatusOrderByCreatedAtDesc(occupied.getId(), PaymentTransactionStatus.PENDING))
                .thenReturn(Optional.empty());
        when(practitioners.findByIdForUpdate(occupied.getPractitioner().getId())).thenReturn(Optional.of(occupied.getPractitioner()));
        when(bookings.existsByPractitionerIdAndAppointmentDateAndStartTimeAndStatusNotAndIdNot(
                occupied.getPractitioner().getId(), occupied.getAppointmentDate(), occupied.getStartTime(), BookingStatus.CANCELLED, occupied.getId()))
                .thenReturn(true);
        assertEquals("SLOT_UNAVAILABLE", assertThrows(ApiException.class, () -> service.create(occupied.getCustomer(), occupied.getId(),
                new CreatePayOSPaymentRequest(PaymentOption.FULL_100, null))).getCode());
    }

    @Test
    void reconciliationPaidConfirmsButNetworkFailureLeavesPending() {
        PaymentTransaction paid = pendingPayment();
        PaymentLink provider = provider(paid, PaymentLinkStatus.PAID);
        when(provider.getAmountPaid()).thenReturn(paid.getAmount().longValueExact());
        when(payments.findByIdForUpdate(71L)).thenReturn(Optional.of(paid));
        when(payments.findAllByBookingIdOrderByCreatedAtDesc(paid.getBooking().getId())).thenReturn(List.of(paid));
        when(gateway.get(paid.getOrderCode())).thenReturn(provider);
        service.reconcileById(71L);
        assertEquals(PaymentTransactionStatus.PAID, paid.getStatus());
        assertEquals(BookingStatus.CONFIRMED, paid.getBooking().getStatus());

        PaymentTransaction pending = pendingPayment();
        pending.setOrderCode(610000053L);
        when(payments.findByIdForUpdate(72L)).thenReturn(Optional.of(pending));
        when(gateway.get(pending.getOrderCode())).thenThrow(new ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                "PAYOS_RECONCILIATION_FAILED", "temporary"));
        service.reconcileById(72L);
        assertEquals(PaymentTransactionStatus.PENDING, pending.getStatus());
        assertTrue(pending.getLastReconciledAt() != null);
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
        booking.setStatus(BookingStatus.PENDING);
        booking.setPaymentStatus(PaymentStatus.UNPAID);
        return booking;
    }

    private void prepareCreate(Booking booking, String paymentLinkId) {
        when(bookings.findByIdForUpdate(booking.getId())).thenReturn(Optional.of(booking));
        when(payments.findFirstByBookingIdAndStatusOrderByCreatedAtDesc(booking.getId(), PaymentTransactionStatus.PENDING))
                .thenReturn(Optional.empty());
        CreatePaymentLinkResponse response = mock(CreatePaymentLinkResponse.class);
        when(response.getPaymentLinkId()).thenReturn(paymentLinkId);
        when(response.getCheckoutUrl()).thenReturn("https://pay.payos.vn/web/" + paymentLinkId);
        when(gateway.create(any(CreatePaymentLinkRequest.class))).thenReturn(response);
    }

    private Webhook successfulWebhook(PaymentTransaction payment, long amount, String paymentLinkId) {
        Webhook webhook = mock(Webhook.class);
        WebhookData data = mock(WebhookData.class);
        when(webhook.getSuccess()).thenReturn(true);
        when(data.getOrderCode()).thenReturn(payment.getOrderCode());
        when(data.getAmount()).thenReturn(amount);
        org.mockito.Mockito.lenient().when(data.getPaymentLinkId()).thenReturn(paymentLinkId);
        when(data.getReference()).thenReturn("BANK-REF");
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
        return provider;
    }
}
