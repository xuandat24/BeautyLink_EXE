package com.example.backend.service;

import com.example.backend.dto.AdminV2Dtos.*;
import com.example.backend.dto.AdminV2Dtos.Period;
import java.math.*;
import java.time.*;
import static com.example.backend.dto.AdminV2Dtos.ComparisonStatus.*;

/** Pure reporting rules, shared by every KPI and both periods. Never changes business records. */
public final class DashboardComparison {
    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private DashboardComparison() {}
    public record Periods(Period current, Period previous, Instant asOf) {}

    public static Periods periods(LocalDate from, LocalDate to, Instant asOf) {
        long days = to.toEpochDay() - from.toEpochDay() + 1;
        Instant start = from.atStartOfDay(ZONE).toInstant();
        Instant requestedEnd = to.plusDays(1).atStartOfDay(ZONE).toInstant();
        Instant end = requestedEnd.isAfter(asOf) ? (asOf.isBefore(start) ? start : asOf) : requestedEnd;
        Instant previousStart = from.minusDays(days).atStartOfDay(ZONE).toInstant();
        // Shift the actual cutoff, not the full final day, for like-for-like elapsed time.
        Instant previousEnd = end.atZone(ZONE).minusDays(days).toInstant();
        return new Periods(new Period(start, end), new Period(previousStart, previousEnd), asOf);
    }

    public static Metric metric(BigDecimal current, BigDecimal previous, MetricUnit unit, String definition, int lowBase) {
        if (current == null || previous == null) return new Metric(current, previous, null, null, null, INSUFFICIENT_HISTORY, unit, definition, null, null, null, null, false);
        BigDecimal delta = current.subtract(previous);
        ComparisonStatus status;
        BigDecimal percent = null;
        if (current.signum() < 0 || previous.signum() < 0) status = NEGATIVE_VALUE;
        else if (previous.signum() > 0 && unit != MetricUnit.VND && previous.compareTo(BigDecimal.valueOf(lowBase)) <= 0) status = LOW_BASE;
        else if (delta.signum() == 0) status = UNCHANGED;
        else if (previous.signum() == 0) status = NEW_ACTIVITY;
        else status = COMPARABLE;
        if (previous.signum() > 0 && current.signum() >= 0) percent = delta.multiply(HUNDRED).divide(previous, MathContext.DECIMAL128);
        return new Metric(current, previous, delta, percent, null, status, unit, definition, null, null, null, null, false);
    }

    public static Metric rate(long currentNumerator, long currentDenominator, long previousNumerator, long previousDenominator, String definition, int smallDenominator) {
        BigDecimal current = percentage(currentNumerator, currentDenominator), previous = percentage(previousNumerator, previousDenominator);
        BigDecimal points = current == null || previous == null ? null : current.subtract(previous);
        return new Metric(current, previous, points, null, points,
                points == null ? NO_DENOMINATOR : points.signum() == 0 ? UNCHANGED : COMPARABLE,
                MetricUnit.PERCENT, definition, currentNumerator, currentDenominator, previousNumerator, previousDenominator,
                (currentDenominator > 0 && currentDenominator < smallDenominator) || (previousDenominator > 0 && previousDenominator < smallDenominator));
    }

    public static Metric unavailable(BigDecimal current, MetricUnit unit, String definition, ComparisonStatus status) {
        return new Metric(current, null, null, null, null, status, unit, definition, null, null, null, null, false);
    }
    public static BigDecimal percentage(long numerator, long denominator) {
        return denominator == 0 ? null : BigDecimal.valueOf(numerator).multiply(HUNDRED).divide(BigDecimal.valueOf(denominator), MathContext.DECIMAL128);
    }
}
