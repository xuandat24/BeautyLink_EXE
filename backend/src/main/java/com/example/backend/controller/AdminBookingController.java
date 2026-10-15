package com.example.backend.controller;

import com.example.backend.dto.AdminDashboardDtos.AdminBookingResponse;
import com.example.backend.dto.AdminDashboardDtos.AdminPageResponse;
import com.example.backend.model.DomainEnums.BookingStatus;
import com.example.backend.model.DomainEnums.PaymentStatus;
import com.example.backend.service.AdminDashboardService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/admin/bookings")
@PreAuthorize("hasRole('ADMIN')")
public class AdminBookingController {
    private final AdminDashboardService dashboard;

    public AdminBookingController(AdminDashboardService dashboard) {
        this.dashboard = dashboard;
    }

    @GetMapping
    public AdminPageResponse<AdminBookingResponse> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "false") boolean includeDemo,
            @RequestParam(required = false) BookingStatus status,
            @RequestParam(required = false) PaymentStatus paymentStatus,
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return dashboard.searchBookings(from, to, includeDemo, status, paymentStatus, query, page, size);
    }

    @GetMapping("/{id}")
    public AdminBookingResponse one(@PathVariable Long id) {
        return dashboard.booking(id);
    }
}
