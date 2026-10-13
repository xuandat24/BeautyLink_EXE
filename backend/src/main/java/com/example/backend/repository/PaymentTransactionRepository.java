package com.example.backend.repository;

import com.example.backend.model.PaymentTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import com.example.backend.model.DomainEnums.PaymentTransactionStatus;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {
    @Query("select (count(p) > 0) from PaymentTransaction p where p.booking.id = :bookingId and (p.requiresManualReview = true or p.status in "
            + "(:#{T(com.example.backend.model.DomainEnums.PaymentTransactionStatus).PENDING}, :#{T(com.example.backend.model.DomainEnums.PaymentTransactionStatus).REVIEW_REQUIRED}))")
    boolean hasUnresolvedByBookingId(@Param("bookingId") Long bookingId);
    Optional<PaymentTransaction> findFirstByBookingIdOrderByCreatedAtDesc(Long bookingId);
    Optional<PaymentTransaction> findFirstByBookingIdAndStatusOrderByCreatedAtDesc(Long bookingId, PaymentTransactionStatus status);
    List<PaymentTransaction> findAllByBookingIdOrderByCreatedAtDesc(Long bookingId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PaymentTransaction p where p.booking.id = :bookingId order by p.id")
    List<PaymentTransaction> findAllByBookingIdForUpdate(@Param("bookingId") Long bookingId);
    Optional<PaymentTransaction> findByOrderCode(Long orderCode);
    // Scalar lookups do not put stale payment/booking entities in the persistence context.
    @Query("select p.booking.id from PaymentTransaction p where p.orderCode = :orderCode")
    Optional<Long> findBookingIdByOrderCode(@Param("orderCode") Long orderCode);
    @Query("select p.booking.id from PaymentTransaction p where p.id = :id")
    Optional<Long> findBookingIdByPaymentId(@Param("id") Long id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PaymentTransaction p where p.orderCode = :orderCode")
    Optional<PaymentTransaction> findByOrderCodeForUpdate(@Param("orderCode") Long orderCode);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PaymentTransaction p where p.id = :id")
    Optional<PaymentTransaction> findByIdForUpdate(@Param("id") Long id);
    List<PaymentTransaction> findByStatusAndExpiresAtBefore(PaymentTransactionStatus status, Instant expiresAt);
    @Query("select p from PaymentTransaction p where (p.status = :status or p.requiresManualReview = true " +
            "or p.status = :#{T(com.example.backend.model.DomainEnums.PaymentTransactionStatus).REVIEW_REQUIRED}) and p.createdAt <= :createdBefore " +
            "and (p.lastReconciledAt is null or p.lastReconciledAt <= :reconciledBefore) order by p.createdAt, p.id")
    List<PaymentTransaction> findReconciliationCandidates(@Param("status") PaymentTransactionStatus status,
            @Param("createdBefore") Instant createdBefore, @Param("reconciledBefore") Instant reconciledBefore,
            Pageable pageable);
    boolean existsByOrderCode(Long orderCode);
}
