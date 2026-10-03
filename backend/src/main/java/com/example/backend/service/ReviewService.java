package com.example.backend.service;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.example.backend.model.DomainEnums.*;

@Service
public class ReviewService {
    private final BookingRepository bookings;
    private final BookingReviewRepository reviews;

    public ReviewService(BookingRepository bookings, BookingReviewRepository reviews) {
        this.bookings = bookings;
        this.reviews = reviews;
    }

    @Transactional
    public BookingReviewResponse upsert(UserAccount customer, Long bookingId, ReviewTargetType targetType, UpsertBookingReviewRequest request) {
        Booking booking = bookings.findById(bookingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "BOOKING_NOT_FOUND", "Không tìm thấy lịch hẹn"));
        if (!booking.getCustomer().getId().equals(customer.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "REVIEW_FORBIDDEN", "Bạn chỉ có thể đánh giá đơn hàng của chính mình");
        }
        if (!isEligible(booking)) {
            throw new ApiException(HttpStatus.CONFLICT, "REVIEW_NOT_ELIGIBLE", "Chỉ đơn hàng đã thanh toán và chưa bị hủy hoặc hoàn tiền mới có thể đánh giá");
        }

        BookingReview review = reviews.findByBookingIdAndTargetType(bookingId, targetType).orElseGet(BookingReview::new);
        if (review.getId() == null) {
            review.setBooking(booking);
            review.setCustomer(customer);
            review.setSupplier(booking.getSupplier());
            review.setService(booking.getService());
            review.setTargetType(targetType);
        }
        review.setRating(request.rating());
        review.setComment(normalize(request.comment()));
        return response(reviews.save(review));
    }

    public static boolean isEligible(Booking booking) {
        boolean paid = booking.getPaymentStatus() == PaymentStatus.PAID || booking.getPaymentStatus() == PaymentStatus.SIMULATED;
        return paid && booking.getStatus() != BookingStatus.CANCELLED && booking.getPaymentStatus() != PaymentStatus.REFUNDED;
    }

    public BookingReviewResponse response(BookingReview review) {
        return new BookingReviewResponse(review.getId(), review.getBooking().getId(), review.getTargetType(), review.getRating(),
                review.getComment(), review.getCreatedAt(), review.getUpdatedAt());
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }
}
