package com.example.backend.repository;

import com.example.backend.model.OtpVerificationChallenge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;

public interface OtpVerificationChallengeRepository extends JpaRepository<OtpVerificationChallenge, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select challenge from OtpVerificationChallenge challenge where challenge.id = :id")
    Optional<OtpVerificationChallenge> findLockedById(@Param("id") String id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<OtpVerificationChallenge> findByRegistrationTokenHash(String tokenHash);
    long deleteByExpiresAtBefore(Instant threshold);
}
