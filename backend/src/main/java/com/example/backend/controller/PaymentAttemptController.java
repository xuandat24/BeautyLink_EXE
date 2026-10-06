package com.example.backend.controller;

import com.example.backend.dto.ApiDtos.CreatePaymentRequest;
import com.example.backend.dto.ApiDtos.PaymentResponse;
import com.example.backend.service.CurrentAccountService;
import com.example.backend.service.PaymentAttemptService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/payments")
public class PaymentAttemptController {
    private final PaymentAttemptService payments;
    private final CurrentAccountService current;

    public PaymentAttemptController(PaymentAttemptService payments, CurrentAccountService current) {
        this.payments = payments;
        this.current = current;
    }

    @PostMapping("/bookings/{bookingId}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public PaymentResponse create(Authentication auth, @PathVariable Long bookingId,
                                  @Valid @RequestBody CreatePaymentRequest request,
                                  HttpServletRequest servletRequest) {
        return payments.create(current.require(auth), bookingId, request, servletRequest.getRemoteAddr());
    }

    @GetMapping("/{merchantReference}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public PaymentResponse status(Authentication auth, @PathVariable String merchantReference) {
        return payments.status(current.require(auth), merchantReference);
    }
}
