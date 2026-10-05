package com.example.backend;

import com.example.backend.model.Booking;
import com.example.backend.model.PaymentTransaction;
import com.example.backend.model.UserAccount;
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
import vn.payos.model.webhooks.Webhook;
import vn.payos.model.webhooks.WebhookData;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.List;

import static com.example.backend.model.DomainEnums.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentServiceSecurityTest {
    @Mock PaymentTransactionRepository payments;
    @Mock BookingRepository bookings;
    @Mock PayOSGateway gateway;
    @Mock PractitionerRepository practitioners;
    PaymentService service;

    @BeforeEach
    void setUp() {
        service = new PaymentService(payments, bookings, practitioners, gateway, "https://frontend/success", "https://frontend/cancel");
    }

    @Test
    void providerExpiredPaymentReleasesBookingSlot() {
        PaymentTransaction payment = pendingPayment();
        PaymentLink provider = provider(payment, PaymentLinkStatus.EXPIRED);
        when(payments.findByOrderCode(payment.getOrderCode())).thenReturn(Optional.of(payment));
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
        when(payments.findByOrderCode(payment.getOrderCode())).thenReturn(Optional.of(payment));
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
        when(payments.findByOrderCode(payment.getOrderCode())).thenReturn(Optional.of(payment));

        service.handleWebhook(webhook);

        assertEquals(PaymentTransactionStatus.PAID, payment.getStatus());
        assertEquals(PaymentStatus.PAID, payment.getBooking().getPaymentStatus());
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
        when(payments.findByOrderCode(oldAttempt.getOrderCode())).thenReturn(Optional.of(oldAttempt));
        when(payments.findAllByBookingIdOrderByCreatedAtDesc(oldAttempt.getBooking().getId()))
                .thenReturn(List.of(newerAttempt, oldAttempt));

        service.handleWebhook(webhook);

        assertEquals(PaymentTransactionStatus.PAID, oldAttempt.getStatus());
        assertEquals(PaymentTransactionStatus.CANCELLED, newerAttempt.getStatus());
        assertEquals(BookingStatus.CONFIRMED, oldAttempt.getBooking().getStatus());
        assertEquals(PaymentStatus.PAID, oldAttempt.getBooking().getPaymentStatus());
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

    private PaymentLink provider(PaymentTransaction payment, PaymentLinkStatus status) {
        PaymentLink provider = mock(PaymentLink.class);
        when(provider.getOrderCode()).thenReturn(payment.getOrderCode());
        when(provider.getId()).thenReturn(payment.getPaymentLinkId());
        when(provider.getAmount()).thenReturn(payment.getAmount().longValueExact());
        when(provider.getStatus()).thenReturn(status);
        return provider;
    }
}
