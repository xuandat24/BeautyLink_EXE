package com.example.backend.service;

import com.example.backend.exception.ApiException;
import com.example.backend.repository.ServiceOfferingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static com.example.backend.model.DomainEnums.PaymentOption.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class PaymentQuoteServiceTest {
    private PaymentQuoteService quotes;

    @BeforeEach
    void setUp() {
        quotes = new PaymentQuoteService(mock(ServiceOfferingRepository.class));
    }

    @Test
    void requiredExactMonetaryExamplesStayInBalance() {
        var noVoucher = quotes.calculate(new BigDecimal("500000"), DEPOSIT_05, null);
        assertQuote(noVoucher, "500000", "0", "500000", "25000", "475000");

        var fixedVoucher = quotes.calculate(new BigDecimal("500000"), DEPOSIT_05, "beauty50");
        assertQuote(fixedVoucher, "500000", "50000", "450000", "22500", "427500");

        var full = quotes.calculate(new BigDecimal("500000"), FULL_100, "BEAUTY50");
        assertQuote(full, "500000", "50000", "450000", "450000", "0");
    }

    @Test
    void percentageVoucherCapAndHalfUpRoundingAreDeterministic() {
        var capped = quotes.calculate(new BigDecimal("2000000"), DEPOSIT_05, "PINK15");
        assertQuote(capped, "2000000", "150000", "1850000", "92500", "1757500");

        var boundary = quotes.calculate(new BigDecimal("40010"), DEPOSIT_05, null);
        assertEquals(new BigDecimal("2001"), boundary.amount());
        assertEquals(boundary.payableAmount(), boundary.amount().add(boundary.remainingAmount()));
    }

    @Test
    void minimumAndZeroPayableReturnExplicitSafeStates() {
        var depositTooLow = quotes.calculate(new BigDecimal("39989"), DEPOSIT_05, null);
        assertFalse(depositTooLow.paymentAvailable());
        assertEquals("DEPOSIT_TOO_LOW_USE_FULL_PAYMENT", depositTooLow.unavailableReason());
        assertTrue(quotes.calculate(new BigDecimal("39989"), FULL_100, null).paymentAvailable());

        var fullTooLow = quotes.calculate(new BigDecimal("1999"), FULL_100, null);
        assertFalse(fullTooLow.paymentAvailable());
        assertEquals("PAYMENT_UNAVAILABLE_AMOUNT_TOO_LOW", fullTooLow.unavailableReason());

        var zero = quotes.calculate(new BigDecimal("0"), FULL_100, null);
        assertFalse(zero.paymentAvailable());
        assertEquals("PAYMENT_UNAVAILABLE_ZERO", zero.unavailableReason());
    }

    @Test
    void legacyOptionIsNeverReinterpretedAsFivePercent() {
        ApiException error = assertThrows(ApiException.class,
                () -> quotes.calculate(new BigDecimal("500000"), DEPOSIT_50, null));
        assertEquals("POLICY_CHANGED", error.getCode());
    }

    private void assertQuote(com.example.backend.dto.ApiDtos.PaymentQuoteResponse quote,
                             String original, String discount, String payable, String now, String remaining) {
        assertEquals(new BigDecimal(original), quote.originalAmount());
        assertEquals(new BigDecimal(discount), quote.discountAmount());
        assertEquals(new BigDecimal(payable), quote.payableAmount());
        assertEquals(new BigDecimal(now), quote.amount());
        assertEquals(new BigDecimal(remaining), quote.remainingAmount());
        assertEquals(quote.payableAmount(), quote.amount().add(quote.remainingAmount()));
        assertTrue(quote.paymentAvailable());
    }
}
