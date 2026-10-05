package com.example.backend.repository;

import com.example.backend.model.PaymentTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import com.example.backend.model.DomainEnums.PaymentTransactionStatus;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {
    Optional<PaymentTransaction> findFirstByBookingIdOrderByCreatedAtDesc(Long bookingId);
    Optional<PaymentTransaction> findFirstByBookingIdAndStatusOrderByCreatedAtDesc(Long bookingId, PaymentTransactionStatus status);
    List<PaymentTransaction> findAllByBookingIdOrderByCreatedAtDesc(Long bookingId);
    Optional<PaymentTransaction> findByOrderCode(Long orderCode);
    List<PaymentTransaction> findByStatusAndExpiresAtBefore(PaymentTransactionStatus status, Instant expiresAt);
    boolean existsByOrderCode(Long orderCode);
}
