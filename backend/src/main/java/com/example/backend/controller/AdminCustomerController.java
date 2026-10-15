package com.example.backend.controller;

import com.example.backend.dto.ApiDtos.AdminCustomerResponse;
import com.example.backend.service.AdminCustomerService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.format.annotation.DateTimeFormat;
import com.example.backend.dto.AdminDashboardDtos.AdminBookingResponse;
import com.example.backend.dto.AdminDashboardDtos.AdminPageResponse;
import com.example.backend.service.AdminDashboardService;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/customers")
@PreAuthorize("hasRole('ADMIN')")
public class AdminCustomerController {
    private final AdminCustomerService customers;
    private final AdminDashboardService dashboard;

    public AdminCustomerController(AdminCustomerService customers, AdminDashboardService dashboard) {
        this.customers = customers;
        this.dashboard = dashboard;
    }

    @GetMapping
    public List<AdminCustomerResponse> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "false") boolean bookedOnly,
            @RequestParam(defaultValue = "false") boolean includeDemo) {
        return customers.listCustomers(from, to, bookedOnly, includeDemo);
    }

    @GetMapping("/{customerId}/bookings")
    public AdminPageResponse<AdminBookingResponse> bookings(@PathVariable Long customerId,
            @RequestParam(defaultValue = "false") boolean includeDemo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return dashboard.customerBookings(customerId, includeDemo, page, size);
    }

    @GetMapping(value = "/export", produces = "text/csv;charset=UTF-8")
    public ResponseEntity<byte[]> export() {
        String filename = "beautylink-customers-" + LocalDate.now() + ".csv";
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build().toString())
                .body(customers.exportCustomersCsv());
    }
}
