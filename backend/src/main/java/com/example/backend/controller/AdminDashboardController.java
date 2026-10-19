package com.example.backend.controller;

import com.example.backend.dto.AdminDashboardDtos.AdminDashboardSummary;
import com.example.backend.dto.AdminDashboardDtos.AdminPaymentSummary;
import com.example.backend.dto.AdminDashboardDtos.AdminPageResponse;
import com.example.backend.dto.AdminDashboardDtos.AdminRevenueRow;
import com.example.backend.service.AdminDashboardService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import jakarta.servlet.http.HttpServletResponse;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/v1/admin/dashboard")
@PreAuthorize("hasRole('ADMIN')")
public class AdminDashboardController {
    private final AdminDashboardService dashboard;

    public AdminDashboardController(AdminDashboardService dashboard) {
        this.dashboard = dashboard;
    }

    @GetMapping("/summary")
    public AdminDashboardSummary summary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "false") boolean includeDemo) {
        return dashboard.summary(from, to, includeDemo);
    }

    @GetMapping("/payments")
    public AdminPaymentSummary payments(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "false") boolean includeDemo) {
        return dashboard.paymentSummary(from, to, includeDemo);
    }

    @GetMapping("/revenue")
    public AdminPageResponse<AdminRevenueRow> revenue(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "false") boolean includeDemo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return dashboard.revenue(from, to, includeDemo, page, size);
    }

    @GetMapping(value = "/revenue.csv", produces = "text/csv; charset=UTF-8")
    public void revenueCsv(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "false") boolean includeDemo,
            HttpServletResponse response) throws IOException {
        AdminDashboardService.Range range = dashboard.range(from, to, includeDemo);
        String filename = "beautylink-revenue-" + range.fromDate() + "-to-" + range.toDate() + ".csv";
        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"");
        // Keep export work on the authenticated servlet request; async dispatch loses the
        // security context here and can fail after a 200 response has already begun.
        BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(response.getOutputStream(),
                StandardCharsets.UTF_8));
        writer.write('\uFEFF'); // Excel recognizes Vietnamese text as UTF-8.
        writer.write("paid_at_vietnam,booking_code,partner,service,payment_option,online_amount_vnd,remaining_at_salon_vnd,payment_id\r\n");
        int page = 0;
        while (true) {
            AdminPageResponse<AdminRevenueRow> batch = dashboard.revenue(range.fromDate(),
                    range.toDate(), includeDemo, page, 500);
            for (AdminRevenueRow row : batch.content()) {
                String paidAt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
                        .withZone(AdminDashboardService.BUSINESS_ZONE).format(row.paidAt());
                writer.write(String.join(",", csvCell(paidAt), csvCell(row.bookingCode()),
                        csvCell(row.supplierName()), csvCell(row.serviceName()),
                        csvCell(row.paymentOption().name()), csvCell(row.amount().toPlainString()),
                        csvCell(row.remainingAtSalon().toPlainString()), csvCell(row.paymentId().toString())));
                writer.write("\r\n");
            }
            writer.flush();
            if (page + 1 >= batch.totalPages()) break;
            page++;
        }
    }

    static String csvCell(String value) {
        String safe = value == null ? "" : value;
        // Quoting alone does not stop spreadsheet formula execution.
        String trimmed = safe.stripLeading();
        if ((!trimmed.isEmpty() && "=+-@".indexOf(trimmed.charAt(0)) >= 0)
                || (!safe.isEmpty() && "\t\r\n".indexOf(safe.charAt(0)) >= 0)) safe = "'" + safe;
        return "\"" + safe.replace("\"", "\"\"") + "\"";
    }
}
