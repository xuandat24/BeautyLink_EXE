package com.example.backend.repository;
import com.example.backend.model.*;import org.springframework.data.jpa.repository.*;import org.springframework.data.repository.query.Param;import jakarta.persistence.LockModeType;import java.util.Optional;
public interface PromotionAuditRepository extends JpaRepository<PromotionAudit,Long> {}
