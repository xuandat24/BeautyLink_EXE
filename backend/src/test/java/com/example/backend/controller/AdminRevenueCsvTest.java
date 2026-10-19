package com.example.backend.controller;

import com.example.backend.dto.AdminDashboardDtos.AdminPageResponse;
import com.example.backend.dto.AdminDashboardDtos.AdminRevenueRow;
import com.example.backend.service.AdminDashboardService;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static com.example.backend.model.DomainEnums.PaymentOption.DEPOSIT_05;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminRevenueCsvTest {
    @Test
    void csvExportsEveryPageAndEscapesSpreadsheetFormulas() throws Exception {
        AdminDashboardService dashboard = mock(AdminDashboardService.class);
        LocalDate day = LocalDate.of(2026, 10, 19);
        when(dashboard.range(day, day, false)).thenReturn(new AdminDashboardService.Range(day, day,
                Instant.parse("2026-10-18T17:00:00Z"), Instant.parse("2026-10-19T17:00:00Z"), false));
        AdminRevenueRow first = new AdminRevenueRow(1L, Instant.parse("2026-10-19T01:00:00Z"),
                "BL-1", "=HYPERLINK(\"evil\")", "Nails", DEPOSIT_05,
                new BigDecimal("25000.00"), new BigDecimal("475000.00"));
        AdminRevenueRow second = new AdminRevenueRow(2L, Instant.parse("2026-10-19T02:00:00Z"),
                "BL-2", "Real Salon", "Hair", DEPOSIT_05,
                new BigDecimal("10000.00"), new BigDecimal("190000.00"));
        when(dashboard.revenue(day, day, false, 0, 500)).thenReturn(
                new AdminPageResponse<>(List.of(first), 2, 2, 0, 500));
        when(dashboard.revenue(day, day, false, 1, 500)).thenReturn(
                new AdminPageResponse<>(List.of(second), 2, 2, 1, 500));
        var response = new AdminDashboardController(dashboard).revenueCsv(day, day, false);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        response.getBody().writeTo(output);
        String csv = output.toString(StandardCharsets.UTF_8);
        assertTrue(csv.startsWith("\uFEFFpaid_at_vietnam,"));
        assertTrue(csv.contains("\"BL-1\""));
        assertTrue(csv.contains("\"BL-2\""));
        assertTrue(csv.contains("\"'=HYPERLINK(\"\"evil\"\")\""));
        assertTrue(csv.contains("\"2026-10-19 08:00:00\""));
        assertTrue(csv.contains("\"25000.00\""));
        assertEquals("\"' =SUM(1,2)\"", AdminDashboardController.csvCell(" =SUM(1,2)"));
    }
}
