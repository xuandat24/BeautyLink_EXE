package com.example.backend.repository;

import com.example.backend.model.BookingReview;
import com.example.backend.model.DomainEnums.ReviewTargetType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.Optional;
import java.util.List;

public interface BookingReviewRepository extends JpaRepository<BookingReview, Long> {
    String VALID_BOOKING = "r.booking.status = :#{T(com.example.backend.model.DomainEnums.BookingStatus).COMPLETED} "
            + "and r.booking.paymentStatus in (:#{T(com.example.backend.model.DomainEnums.PaymentStatus).PAID}, "
            + ":#{T(com.example.backend.model.DomainEnums.PaymentStatus).PARTIALLY_PAID}) and r.rating between 1 and 5 "
            + "and not exists (select p.id from PaymentTransaction p where p.booking.id = r.booking.id and "
            + "(p.requiresManualReview = true or p.status in (:#{T(com.example.backend.model.DomainEnums.PaymentTransactionStatus).PENDING}, "
            + ":#{T(com.example.backend.model.DomainEnums.PaymentTransactionStatus).REVIEW_REQUIRED})))";
    Optional<BookingReview> findByBookingIdAndTargetType(Long bookingId, ReviewTargetType targetType);
    @Query("select r from BookingReview r where r.supplier.id = :supplierId and r.targetType = :#{T(com.example.backend.model.DomainEnums.ReviewTargetType).SUPPLIER} and " + VALID_BOOKING + " order by r.createdAt desc, r.id desc")
    List<BookingReview> findBySupplierIdOrderByCreatedAtDesc(@Param("supplierId") Long supplierId, Pageable pageable);

    @Query("select r from BookingReview r where r.service.id = :serviceId and r.targetType = :targetType and " + VALID_BOOKING + " order by r.createdAt desc, r.id desc")
    Page<BookingReview> findPublicByService(@Param("serviceId") Long serviceId, @Param("targetType") ReviewTargetType targetType, Pageable pageable);
    @Query("select r from BookingReview r where r.supplier.id = :supplierId and r.targetType = :targetType and " + VALID_BOOKING + " order by r.createdAt desc, r.id desc")
    Page<BookingReview> findPublicBySupplier(@Param("supplierId") Long supplierId, @Param("targetType") ReviewTargetType targetType, Pageable pageable);

    @Query("select count(r) from BookingReview r where r.service.id = :serviceId and r.targetType = :targetType and " + VALID_BOOKING)
    long countByServiceIdAndTargetType(@Param("serviceId") Long serviceId, @Param("targetType") ReviewTargetType targetType);
    @Query("select avg(r.rating) from BookingReview r where r.service.id = :serviceId and r.targetType = :targetType and " + VALID_BOOKING)
    Double averageByService(@Param("serviceId") Long serviceId, @Param("targetType") ReviewTargetType targetType);

    @Query("select count(r) from BookingReview r where r.supplier.id = :supplierId and r.targetType = :targetType and " + VALID_BOOKING)
    long countBySupplierIdAndTargetType(@Param("supplierId") Long supplierId, @Param("targetType") ReviewTargetType targetType);
    @Query("select coalesce(sum(r.rating), 0) from BookingReview r where r.supplier.id = :supplierId and r.targetType = :targetType and " + VALID_BOOKING)
    Long ratingSumBySupplier(@Param("supplierId") Long supplierId, @Param("targetType") ReviewTargetType targetType);
}
