package com.example.backend.repository;

import com.example.backend.model.PaymentTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import com.example.backend.model.DomainEnums.PaymentOption;
import com.example.backend.model.DomainEnums.Role;
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

    @Query("select p from PaymentTransaction p where p.booking.id = :bookingId and p.status = :paidStatus " +
            "and p.id = (select min(p2.id) from PaymentTransaction p2 where p2.booking.id = :bookingId and p2.status = :paidStatus)")
    Optional<PaymentTransaction> findCanonicalPaidByBookingId(@Param("bookingId") Long bookingId,
            @Param("paidStatus") PaymentTransactionStatus paidStatus);

    @Query("select p from PaymentTransaction p join fetch p.booking where p.booking.id in :bookingIds and p.status = :paidStatus " +
            "and p.id = (select min(p2.id) from PaymentTransaction p2 where p2.booking = p.booking and p2.status = :paidStatus)")
    List<PaymentTransaction> findCanonicalPaidByBookingIds(@Param("bookingIds") Collection<Long> bookingIds,
            @Param("paidStatus") PaymentTransactionStatus paidStatus);

    @Query("select distinct p.booking.id from PaymentTransaction p where p.booking.id in :bookingIds " +
            "and (p.requiresManualReview = true or p.status = :reviewStatus)")
    List<Long> findReviewBookingIds(@Param("bookingIds") Collection<Long> bookingIds,
            @Param("reviewStatus") PaymentTransactionStatus reviewStatus);

    @Query("select coalesce(sum(p.amount), 0) from PaymentTransaction p where p.status = :paidStatus " +
            "and p.paidAt >= :from and p.paidAt < :to and p.booking.customer.role = :customerRole " +
            "and (:includeDemo = true or p.booking.supplier.demoData = false) " +
            "and p.id = (select min(p2.id) from PaymentTransaction p2 where p2.booking = p.booking and p2.status = :paidStatus)")
    BigDecimal sumAdminCanonicalPaidAmount(@Param("from") Instant from, @Param("to") Instant to,
            @Param("paidStatus") PaymentTransactionStatus paidStatus, @Param("customerRole") Role customerRole,
            @Param("includeDemo") boolean includeDemo);

    @Query("select coalesce(sum(p.amount), 0) from PaymentTransaction p where p.status = :paidStatus " +
            "and p.paidAt >= :from and p.paidAt < :to and p.paymentOption in :options " +
            "and p.booking.customer.role = :customerRole and (:includeDemo = true or p.booking.supplier.demoData = false) " +
            "and p.id = (select min(p2.id) from PaymentTransaction p2 where p2.booking = p.booking and p2.status = :paidStatus)")
    BigDecimal sumAdminCanonicalPaidAmountByOptions(@Param("from") Instant from, @Param("to") Instant to,
            @Param("options") Collection<PaymentOption> options, @Param("paidStatus") PaymentTransactionStatus paidStatus,
            @Param("customerRole") Role customerRole, @Param("includeDemo") boolean includeDemo);

    @Query("select coalesce(sum(p.remainingAmount), 0) from PaymentTransaction p where p.status = :paidStatus " +
            "and p.paidAt >= :from and p.paidAt < :to and p.paymentOption in :options " +
            "and p.booking.customer.role = :customerRole and (:includeDemo = true or p.booking.supplier.demoData = false) " +
            "and p.id = (select min(p2.id) from PaymentTransaction p2 where p2.booking = p.booking and p2.status = :paidStatus)")
    BigDecimal sumAdminCanonicalRemainingByOptions(@Param("from") Instant from, @Param("to") Instant to,
            @Param("options") Collection<PaymentOption> options, @Param("paidStatus") PaymentTransactionStatus paidStatus,
            @Param("customerRole") Role customerRole, @Param("includeDemo") boolean includeDemo);

    @Query("select count(p) from PaymentTransaction p where p.status = :paidStatus and p.paidAt >= :from and p.paidAt < :to " +
            "and p.booking.customer.role = :customerRole and (:includeDemo = true or p.booking.supplier.demoData = false) " +
            "and p.id = (select min(p2.id) from PaymentTransaction p2 where p2.booking = p.booking and p2.status = :paidStatus)")
    long countAdminCanonicalPaid(@Param("from") Instant from, @Param("to") Instant to,
            @Param("paidStatus") PaymentTransactionStatus paidStatus, @Param("customerRole") Role customerRole,
            @Param("includeDemo") boolean includeDemo);

    @Query("select count(p) from PaymentTransaction p where p.status = :paidStatus and p.paidAt >= :from and p.paidAt < :to " +
            "and p.paymentOption in :options and p.booking.customer.role = :customerRole " +
            "and (:includeDemo = true or p.booking.supplier.demoData = false) " +
            "and p.id = (select min(p2.id) from PaymentTransaction p2 where p2.booking = p.booking and p2.status = :paidStatus)")
    long countAdminCanonicalPaidByOptions(@Param("from") Instant from, @Param("to") Instant to,
            @Param("options") Collection<PaymentOption> options, @Param("paidStatus") PaymentTransactionStatus paidStatus,
            @Param("customerRole") Role customerRole, @Param("includeDemo") boolean includeDemo);

    @Query("select count(p) from PaymentTransaction p where p.createdAt >= :from and p.createdAt < :to " +
            "and (p.requiresManualReview = true or p.status = :reviewStatus) and p.booking.customer.role = :customerRole " +
            "and (:includeDemo = true or p.booking.supplier.demoData = false)")
    long countAdminReconciliationIssues(@Param("from") Instant from, @Param("to") Instant to,
            @Param("reviewStatus") PaymentTransactionStatus reviewStatus, @Param("customerRole") Role customerRole,
            @Param("includeDemo") boolean includeDemo);

    @Query("select p.booking.customer.id, coalesce(sum(p.amount), 0) from PaymentTransaction p " +
            "where p.status = :paidStatus and p.booking.customer.role = :customerRole " +
            "and (:includeDemo = true or p.booking.supplier.demoData = false) " +
            "and p.id = (select min(p2.id) from PaymentTransaction p2 where p2.booking = p.booking and p2.status = :paidStatus) " +
            "group by p.booking.customer.id")
    List<Object[]> findAdminCustomerVerifiedAmounts(@Param("paidStatus") PaymentTransactionStatus paidStatus,
            @Param("customerRole") Role customerRole, @Param("includeDemo") boolean includeDemo);
}
