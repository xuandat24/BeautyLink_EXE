package com.example.backend.repository;
import com.example.backend.model.Supplier;
import com.example.backend.model.DomainEnums.VerificationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface SupplierRepository extends JpaRepository<Supplier, Long> {
    @org.springframework.data.jpa.repository.Query("select s.imageUrl from Supplier s where s.id=:id and s.verificationStatus=com.example.backend.model.DomainEnums$VerificationStatus.VERIFIED")
    Optional<String> publicCover(@org.springframework.data.repository.query.Param("id") Long id);
    Optional<Supplier> findByOwnerId(Long ownerId);
    Optional<Supplier> findBySlug(String slug);
    Optional<Supplier> findByIdAndVerificationStatus(Long id, VerificationStatus verificationStatus);
    boolean existsBySlug(String slug);
}
