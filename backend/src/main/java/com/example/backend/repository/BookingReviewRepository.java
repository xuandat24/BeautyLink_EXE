package com.example.backend.repository;

import com.example.backend.model.BookingReview;
import com.example.backend.model.DomainEnums.ReviewTargetType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.List;

public interface BookingReviewRepository extends JpaRepository<BookingReview, Long> {
    Optional<BookingReview> findByBookingIdAndTargetType(Long bookingId, ReviewTargetType targetType);
    List<BookingReview> findBySupplierIdOrderByCreatedAtDesc(Long supplierId);

    long countByServiceIdAndTargetType(Long serviceId, ReviewTargetType targetType);
    @Query("select avg(r.rating) from BookingReview r where r.service.id = :serviceId and r.targetType = :targetType")
    Double averageByService(@Param("serviceId") Long serviceId, @Param("targetType") ReviewTargetType targetType);

    long countBySupplierIdAndTargetType(Long supplierId, ReviewTargetType targetType);
    @Query("select coalesce(sum(r.rating), 0) from BookingReview r where r.supplier.id = :supplierId and r.targetType = :targetType")
    Long ratingSumBySupplier(@Param("supplierId") Long supplierId, @Param("targetType") ReviewTargetType targetType);
}
