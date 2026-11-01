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
        quotes = new PaymentQuoteService(mock(ServiceOfferingRepository.class), new com.example.backend.service.PromotionService(mock(com.example.backend.repository.PromotionRepository.class), mock(com.example.backend.repository.PromotionAuditRepository.class), new com.fasterxml.jackson.databind.ObjectMapper()));
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

    @Test
    void restoredReportingValuationsOnlyAllowFullPaymentAtTheCurrentMinimum() {
        for (int value = 15000; value <= 30000; value += 1000) {
            BigDecimal total = BigDecimal.valueOf(value);
            var deposit = quotes.calculate(total, DEPOSIT_05, null);
            assertFalse(deposit.paymentAvailable());
            assertEquals("DEPOSIT_TOO_LOW_USE_FULL_PAYMENT", deposit.unavailableReason());
            assertEquals(total, deposit.amount().add(deposit.remainingAmount()));
            var full = quotes.calculate(total, FULL_100, null);
            assertTrue(full.paymentAvailable());
            assertEquals(total, full.amount());
            assertEquals(BigDecimal.ZERO, full.remainingAmount());
        }
    }

    @Test
    void thousandVndPricesCannotSupplyTheRequestedOddResidualWithoutChangingPricing() {
        // Even the broader catalog cannot make a residual ending in 542 VND:
        // full payments are multiples of 1,000; no-voucher 5% quotes are multiples of 50.
        for (int value = 1000; value <= 8000000; value += 1000) {
            for (var option : new com.example.backend.model.DomainEnums.PaymentOption[]{DEPOSIT_05, FULL_100}) {
                var quote = quotes.calculate(BigDecimal.valueOf(value), option, null);
                if (quote.paymentAvailable()) {
                    assertEquals(BigDecimal.ZERO, quote.amount().remainder(BigDecimal.valueOf(50)));
                }
            }
        }
        BigDecimal required = new BigDecimal("3045000").subtract(new BigDecimal("1215458"));
        assertEquals(new BigDecimal("1829542"), required);
        assertEquals(new BigDecimal("42"), required.remainder(BigDecimal.valueOf(50)));
        assertEquals(new BigDecimal("154542"), required.subtract(new BigDecimal("1675000")));
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
