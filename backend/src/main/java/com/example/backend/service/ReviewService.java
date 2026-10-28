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
    private final PaymentTransactionRepository payments;
    private final BookingCompletionPolicy time;
    private final ImageDataValidator imageValidator;
    private final PublicImageStorage imageStorage;

    public ReviewService(BookingRepository bookings, BookingReviewRepository reviews, PaymentTransactionRepository payments, BookingCompletionPolicy time, ImageDataValidator imageValidator, PublicImageStorage imageStorage) {
        this.bookings = bookings;
        this.reviews = reviews;
        this.payments = payments; this.time = time; this.imageValidator = imageValidator; this.imageStorage = imageStorage;
    }

    @Transactional
    public BookingReviewResponse upsert(UserAccount customer, Long bookingId, ReviewTargetType targetType, UpsertBookingReviewRequest request) {
        Booking booking = bookings.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "BOOKING_NOT_FOUND", "Không tìm thấy lịch hẹn"));
        if (!booking.getCustomer().getId().equals(customer.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "REVIEW_FORBIDDEN", "Bạn chỉ có thể đánh giá đơn hàng của chính mình");
        }
        if (!isEligible(booking, time.now()) || payments.hasUnresolvedByBookingId(bookingId)) {
            throw new ApiException(HttpStatus.CONFLICT, "REVIEW_NOT_ELIGIBLE", "Đánh giá mở từ giữa thời gian dịch vụ; lịch hẹn phải được xác nhận, có thanh toán hoặc đặt cọc và không cần đối soát");
        }

        BookingReview review = reviews.findByBookingIdAndTargetType(bookingId, targetType).orElseGet(BookingReview::new);
        if (review.getId() == null) {
            review.setBooking(booking);
            review.setCustomer(customer);
            review.setSupplier(booking.getSupplier());
            review.setService(booking.getService());
            review.setTargetType(targetType);
        }
        if (request.images() != null) {
            if (request.images().size() > 3) throw new ApiException(HttpStatus.BAD_REQUEST, "REVIEW_IMAGE_LIMIT", "Tối đa 3 ảnh đánh giá");
            var retained = review.getImages();
            // Only a previously stored image of THIS review can be retained by URL.
            // New images must be validated raster data; arbitrary URLs never become public review content.
            for (String image : request.images()) {
                if (image == null || (!retained.contains(image) && !image.startsWith("data:")))
                    throw new ApiException(HttpStatus.BAD_REQUEST, "REVIEW_IMAGE_INVALID", "Ảnh đánh giá không hợp lệ");
                if (!retained.contains(image)) imageValidator.requireValidDataImage(image, 800_000, "REVIEW_IMAGE_INVALID", "Chỉ nhận ảnh JPG, PNG, WEBP hợp lệ");
            }
            java.util.List<String> stored = new java.util.ArrayList<>();
            for (String image : request.images()) stored.add(retained.contains(image) ? image : imageStorage.storeValidatedImage(image, customer.getId()));
            review.setImages(stored);
        }
        review.setEligibleAt(BookingCompletionPolicy.reviewOpensAt(booking));
        review.setRating(request.rating());
        review.setComment(normalize(request.comment()));
        return response(reviews.save(review));
    }

    public static boolean isEligible(Booking booking) {
        return isEligible(booking, java.time.Instant.now());
    }
    public static boolean isEligible(Booking booking, java.time.Instant now) {
        return BookingCompletionPolicy.hasVerifiedPayment(booking)
                && (booking.getStatus() == BookingStatus.COMPLETED
                    || (booking.getStatus() == BookingStatus.CONFIRMED && !now.isBefore(BookingCompletionPolicy.reviewOpensAt(booking))));
    }

    public BookingReviewResponse response(BookingReview review) {
        return new BookingReviewResponse(review.getId(), review.getBooking().getId(), review.getTargetType(), review.getRating(),
                review.getComment(), review.getCreatedAt(), review.getUpdatedAt(), review.getImages());
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }
}
