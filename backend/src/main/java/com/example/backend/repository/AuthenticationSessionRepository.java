package com.example.backend.repository;

import com.example.backend.model.AuthenticationSession;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface AuthenticationSessionRepository extends JpaRepository<AuthenticationSession, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from AuthenticationSession s where s.id = :id")
    Optional<AuthenticationSession> findLockedById(@Param("id") String id);
}
