package com.example.backend;

import com.example.backend.model.*;
import com.example.backend.repository.*;
import com.example.backend.service.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static com.example.backend.model.DomainEnums.*;
import static com.example.backend.service.PaymentProviderAdapter.OutcomeStatus.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentAttemptServiceTest {
    @Mock PaymentTransactionRepository payments;
    @Mock BookingRepository bookings;
    @Mock PractitionerRepository practitioners;
    @Mock PaymentProviderAdapter vnPay;
    PaymentAttemptService service;

    @BeforeEach
    void setUp() {
        when(vnPay.provider()).thenReturn(PaymentProvider.VNPAY);
        service = new PaymentAttemptService(payments, bookings, practitioners, List.of(vnPay));
    }

    @Test
    void depositSuccessIsPartialAndRepeatedIpnIsIdempotent() {
        PaymentTransaction payment = pending(PaymentOption.DEPOSIT_50);
        when(payments.findByProviderAndMerchantReferenceForUpdate(PaymentProvider.VNPAY, "REF-51"))
                .thenReturn(Optional.of(payment));
        when(payments.findAllByBookingIdOrderByCreatedAtDesc(51L)).thenReturn(List.of(payment));
        PaymentProviderAdapter.ProviderOutcome paid = outcome(PAID, new BigDecimal("250000"));

        assertEquals(PaymentAttemptService.ApplyResult.UPDATED,
                service.applyProviderOutcome(PaymentProvider.VNPAY, "REF-51", paid, "test-ipn"));
        assertEquals(PaymentStatus.PARTIALLY_PAID, payment.getBooking().getPaymentStatus());
        assertEquals(BookingStatus.CONFIRMED, payment.getBooking().getStatus());
        assertEquals(PaymentAttemptService.ApplyResult.DUPLICATE,
                service.applyProviderOutcome(PaymentProvider.VNPAY, "REF-51", paid, "test-ipn-retry"));
        assertEquals(PaymentTransactionStatus.PAID, payment.getStatus());
    }

    @Test
    void signedCallbackWithWrongAmountCannotChangeBooking() {
        PaymentTransaction payment = pending(PaymentOption.FULL_100);
        when(payments.findByProviderAndMerchantReferenceForUpdate(PaymentProvider.VNPAY, "REF-51"))
                .thenReturn(Optional.of(payment));

        assertEquals(PaymentAttemptService.ApplyResult.AMOUNT_MISMATCH,
                service.applyProviderOutcome(PaymentProvider.VNPAY, "REF-51",
                        outcome(PAID, new BigDecimal("249999")), "test-ipn"));
        assertEquals(PaymentTransactionStatus.PENDING, payment.getStatus());
        assertEquals(PaymentStatus.UNPAID, payment.getBooking().getPaymentStatus());
    }

    @Test
    void expiredAttemptIsReleasedOnlyAfterProviderQueryDrConfirmsExpiry() {
        PaymentTransaction payment = pending(PaymentOption.FULL_100);
        when(payments.findByIdForUpdate(71L)).thenReturn(Optional.of(payment));
        when(vnPay.isConfigured()).thenReturn(true);
        when(vnPay.query(payment)).thenReturn(outcome(EXPIRED, new BigDecimal("250000")));

        service.reconcileById(71L);

        verify(vnPay).query(payment);
        assertEquals(PaymentTransactionStatus.EXPIRED, payment.getStatus());
        assertEquals(BookingStatus.CANCELLED, payment.getBooking().getStatus());
        assertTrue(payment.getBooking().isPaymentRetryAllowed());
    }

    private PaymentTransaction pending(PaymentOption option) {
        UserAccount customer = new UserAccount();
        customer.setId(41L);
        Booking booking = new Booking();
        booking.setId(51L);
        booking.setBookingCode("BL-51");
        booking.setCustomer(customer);
        booking.setStatus(BookingStatus.PENDING);
        booking.setPaymentStatus(PaymentStatus.UNPAID);
        PaymentTransaction payment = new PaymentTransaction();
        payment.setBooking(booking);
        payment.setProvider(PaymentProvider.VNPAY);
        payment.setOrderCode(610000051L);
        payment.setMerchantReference("REF-51");
        payment.setAmount(new BigDecimal("250000"));
        payment.setRemainingAmount(option == PaymentOption.DEPOSIT_50 ? new BigDecimal("250000") : BigDecimal.ZERO);
        payment.setPaymentOption(option);
        payment.setStatus(PaymentTransactionStatus.PENDING);
        payment.setExpiresAt(Instant.now().minusSeconds(1));
        return payment;
    }

    private PaymentProviderAdapter.ProviderOutcome outcome(PaymentProviderAdapter.OutcomeStatus status, BigDecimal amount) {
        return new PaymentProviderAdapter.ProviderOutcome(status, amount, "VNP-TXN", "BANK-REF",
                "00", status == PAID ? "00" : "02", "NCB", "ATM", Instant.now());
    }
}
