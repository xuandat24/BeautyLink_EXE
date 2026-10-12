package com.example.backend.controller;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.model.UserAccount;
import com.example.backend.service.*;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/v1/bookings")
public class BookingController {
    private final BookingService bookings; private final CurrentAccountService current;
    public BookingController(BookingService bookings, CurrentAccountService current) { this.bookings = bookings; this.current = current; }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasRole('CUSTOMER')") public BookingResponse create(Authentication auth, @Valid @RequestBody CreateBookingRequest request) { return bookings.create(current.require(auth), request); }
    @GetMapping("/mine") @PreAuthorize("hasRole('CUSTOMER')") public List<BookingResponse> mine(Authentication auth) { return bookings.customerBookings(current.require(auth)); }
    @GetMapping("/mine/history-status") @PreAuthorize("hasRole('CUSTOMER')") public BookingHistoryStatusResponse historyStatus(Authentication auth) { return bookings.bookingHistoryStatus(current.require(auth)); }
    @PatchMapping("/{id}/cancel") @PreAuthorize("hasRole('CUSTOMER')") public BookingResponse cancel(Authentication auth, @PathVariable Long id) { return bookings.cancel(current.require(auth), id); }
    @GetMapping("/supplier") @PreAuthorize("hasRole('SUPPLIER')") public List<BookingResponse> supplier(Authentication auth) { return bookings.supplierBookings(current.require(auth)); }
}
