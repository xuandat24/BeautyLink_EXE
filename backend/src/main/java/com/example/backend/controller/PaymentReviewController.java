package com.example.backend.controller;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.service.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Internal operation, not a customer refund or payment-status override API. */
@RestController
@RequestMapping("/api/v1/payments/payos/review/bookings/{bookingId}")
@PreAuthorize("hasRole('ADMIN')")
public class PaymentReviewController {
    private final PaymentReviewService review;
    private final CurrentAccountService current;
    public PaymentReviewController(PaymentReviewService review, CurrentAccountService current) { this.review = review; this.current = current; }
    @GetMapping public PaymentReviewPreview preview(Authentication auth, @PathVariable Long bookingId) {
        return review.preview(current.require(auth), bookingId);
    }
    @PostMapping("/close-zero-money") public PaymentReviewResolution close(Authentication auth, @PathVariable Long bookingId,
            @Valid @RequestBody CloseZeroMoneyRequest request) {
        return review.closeZeroMoney(current.require(auth), bookingId, request);
    }
    @PostMapping("/close-zero-secondary") public PaymentReviewResolution closeSecondary(Authentication auth, @PathVariable Long bookingId,
            @Valid @RequestBody CloseZeroMoneyRequest request) {
        return review.closeZeroSecondary(current.require(auth), bookingId, request);
    }
}
