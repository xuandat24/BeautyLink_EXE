package com.example.backend.repository;

import com.example.backend.model.PasswordResetChallenge;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface PasswordResetChallengeRepository extends JpaRepository<PasswordResetChallenge, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select challenge from PasswordResetChallenge challenge where challenge.id = :id")
    Optional<PasswordResetChallenge> findLockedById(@Param("id") String id);
    long deleteByExpiresAtBefore(Instant threshold);
}
