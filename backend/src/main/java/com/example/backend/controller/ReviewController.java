package com.example.backend.controller;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.model.DomainEnums.ReviewTargetType;
import com.example.backend.service.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/bookings/{bookingId}/reviews")
public class ReviewController {
    private final ReviewService reviews;
    private final CurrentAccountService current;

    public ReviewController(ReviewService reviews, CurrentAccountService current) {
        this.reviews = reviews;
        this.current = current;
    }

    @PutMapping("/{targetType}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public BookingReviewResponse upsert(Authentication auth, @PathVariable Long bookingId,
                                        @PathVariable ReviewTargetType targetType,
                                        @Valid @RequestBody UpsertBookingReviewRequest request) {
        return reviews.upsert(current.require(auth), bookingId, targetType, request);
    }
}
