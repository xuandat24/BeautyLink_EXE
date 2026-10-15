package com.example.backend.repository;

import com.example.backend.model.EmailNotificationOutbox;
import com.example.backend.model.DomainEnums.EmailNotificationStatus;
import com.example.backend.model.DomainEnums.EmailNotificationType;
import com.example.backend.model.DomainEnums.EmailRecipientRole;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface EmailNotificationOutboxRepository extends JpaRepository<EmailNotificationOutbox, Long> {
    boolean existsByBookingIdAndNotificationTypeAndRecipientRole(
            Long bookingId, EmailNotificationType notificationType, EmailRecipientRole recipientRole);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from EmailNotificationOutbox e where " +
            "((e.status = :pending or e.status = :retry) and e.nextAttemptAt <= :now) " +
            "or (e.status = :processing and e.leaseUntil <= :now) order by e.nextAttemptAt, e.id")
    List<EmailNotificationOutbox> findClaimable(
            @Param("pending") EmailNotificationStatus pending,
            @Param("retry") EmailNotificationStatus retry,
            @Param("processing") EmailNotificationStatus processing,
            @Param("now") Instant now,
            Pageable pageable);

    Optional<EmailNotificationOutbox> findByIdAndClaimTokenAndStatus(
            Long id, String claimToken, EmailNotificationStatus status);
}
