package com.example.backend.repository;

import com.example.backend.model.SupplierVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SupplierVerificationRepository extends JpaRepository<SupplierVerification, Long> {
    boolean existsByCccdHash(String cccdHash);
    Optional<SupplierVerification> findBySupplierId(Long supplierId);
}
