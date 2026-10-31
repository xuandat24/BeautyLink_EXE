package com.example.backend.service;

import com.example.backend.dto.AdminV2Dtos.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.math.BigDecimal;
import java.time.*;
import static com.example.backend.service.DashboardComparison.*;
import static com.example.backend.dto.AdminV2Dtos.ComparisonStatus.*;
import static org.junit.jupiter.api.Assertions.*;

class DashboardComparisonTest {
    @ParameterizedTest @CsvSource({"1,76,75,7500,LOW_BASE", "100,120,20,20,COMPARABLE", "100,80,-20,-20,COMPARABLE", "10,0,-10,-100,COMPARABLE"})
    void exactChanges(int before, int now, int difference, int percent, ComparisonStatus status) {
        var metric = metric(BigDecimal.valueOf(now), BigDecimal.valueOf(before), MetricUnit.BOOKING, "Booking.createdAt", 4);
        assertEquals(0, metric.absoluteChange().compareTo(BigDecimal.valueOf(difference)));
        assertEquals(0, metric.relativeChangePercent().compareTo(BigDecimal.valueOf(percent)));
        assertEquals(status, metric.comparisonStatus());
    }
    @Test void zeroMissingAndNegativeAreDifferent() {
        var fresh = metric(BigDecimal.TEN, BigDecimal.ZERO, MetricUnit.BOOKING, "", 4);
        assertEquals(NEW_ACTIVITY, fresh.comparisonStatus()); assertNull(fresh.relativeChangePercent()); assertEquals(BigDecimal.TEN, fresh.absoluteChange());
        var empty = metric(BigDecimal.ZERO, BigDecimal.ZERO, MetricUnit.BOOKING, "", 4);
        assertEquals(UNCHANGED, empty.comparisonStatus()); assertNull(empty.relativeChangePercent());
        var missing = metric(BigDecimal.TEN, null, MetricUnit.BOOKING, "missing history", 4);
        assertEquals(INSUFFICIENT_HISTORY, missing.comparisonStatus()); assertNull(missing.previousValue()); assertNull(missing.absoluteChange());
        assertEquals(BigDecimal.TEN, metric(null,BigDecimal.TEN,MetricUnit.BOOKING,"missing current history",4).previousValue());
        for (var values : new int[][]{{-10,20},{10,-20},{-10,-20}}) {
            var refund = metric(BigDecimal.valueOf(values[0]), BigDecimal.valueOf(values[1]), MetricUnit.VND, "refund", 4);
            assertEquals(NEGATIVE_VALUE, refund.comparisonStatus()); assertNull(refund.relativeChangePercent());
        }
    }
    @Test void percentagesArePointsNotRelativeGrowthAndDoNotRoundInputs() {
        var change = rate(237,500,2,5,"unique booking cohort",20);
        assertEquals(0,change.percentagePointChange().compareTo(new BigDecimal("7.4")));
        assertEquals(new BigDecimal("47.4"),change.currentValue()); assertNull(change.relativeChangePercent()); assertTrue(change.lowSample());
        assertEquals(237,change.currentNumerator()); assertEquals(500,change.currentDenominator());
        var zero = rate(0,0,0,0,"",20);
        assertNull(zero.currentValue()); assertNull(zero.percentagePointChange()); assertEquals(NO_DENOMINATOR,zero.comparisonStatus());
        assertEquals(NO_DENOMINATOR,rate(1,10,0,0,"",20).comparisonStatus());
        var precise = rate(1,3,2,7,"",20);
        assertTrue(precise.currentValue().scale()>1); assertTrue(precise.percentagePointChange().scale()>1);
    }
    @Test void endedInclusiveCustomRangeAndVietnamMidnight() {
        var p=periods(LocalDate.of(2026,10,2),LocalDate.of(2026,10,31),Instant.parse("2026-11-01T00:00:00Z"));
        assertEquals(Instant.parse("2026-10-01T17:00:00Z"),p.current().startInclusive());
        assertEquals(Instant.parse("2026-10-31T17:00:00Z"),p.current().endExclusive());
        assertEquals(Instant.parse("2026-09-01T17:00:00Z"),p.previous().startInclusive());
        assertEquals(Instant.parse("2026-10-01T17:00:00Z"),p.previous().endExclusive());
        assertEquals(Duration.between(p.current().startInclusive(),p.current().endExclusive()),Duration.between(p.previous().startInclusive(),p.previous().endExclusive()));
    }
    @ParameterizedTest @CsvSource({"0,2026-10-30T08:00:00Z", "6,2026-10-24T08:00:00Z", "29,2026-10-01T08:00:00Z"})
    void partialTodayPresetsUseEqualElapsedTime(int daysAgo, String previousCutoff) {
        var today=LocalDate.of(2026,10,31); var asOf=Instant.parse("2026-10-31T08:00:00Z"); // 15:00 Vietnam
        var p=periods(today.minusDays(daysAgo),today,asOf);
        assertEquals(asOf,p.current().endExclusive()); assertEquals(Instant.parse(previousCutoff),p.previous().endExclusive());
        assertEquals(Duration.between(p.current().startInclusive(),p.current().endExclusive()),Duration.between(p.previous().startInclusive(),p.previous().endExclusive()));
    }
    @Test void vietnamNewDayHasEmptyCurrentNotInventedZeroPercent() {
        var p=periods(LocalDate.of(2026,11,1),LocalDate.of(2026,11,1),Instant.parse("2026-10-31T17:00:00Z"));
        assertEquals(p.current().startInclusive(),p.current().endExclusive()); assertEquals(p.previous().startInclusive(),p.previous().endExclusive());
    }
}
