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
    Optional<PaymentTransaction> findFirstByBookingIdOrderByCreatedAtDesc(Long bookingId);
    Optional<PaymentTransaction> findFirstByBookingIdAndStatusOrderByCreatedAtDesc(Long bookingId, PaymentTransactionStatus status);
    List<PaymentTransaction> findAllByBookingIdOrderByCreatedAtDesc(Long bookingId);
    Optional<PaymentTransaction> findByOrderCode(Long orderCode);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PaymentTransaction p join fetch p.booking b join fetch b.customer where p.orderCode = :orderCode")
    Optional<PaymentTransaction> findByOrderCodeForUpdate(@Param("orderCode") Long orderCode);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PaymentTransaction p join fetch p.booking b join fetch b.customer where p.id = :id")
    Optional<PaymentTransaction> findByIdForUpdate(@Param("id") Long id);
    List<PaymentTransaction> findByStatusAndExpiresAtBefore(PaymentTransactionStatus status, Instant expiresAt);
    @Query("select p from PaymentTransaction p where p.status = :status and p.createdAt <= :createdBefore " +
            "and (p.lastReconciledAt is null or p.lastReconciledAt <= :reconciledBefore) order by p.createdAt")
    List<PaymentTransaction> findReconciliationCandidates(@Param("status") PaymentTransactionStatus status,
            @Param("createdBefore") Instant createdBefore, @Param("reconciledBefore") Instant reconciledBefore,
            Pageable pageable);
    boolean existsByOrderCode(Long orderCode);
}
