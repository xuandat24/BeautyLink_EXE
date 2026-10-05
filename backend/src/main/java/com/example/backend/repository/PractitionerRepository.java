package com.example.backend.repository;
import com.example.backend.model.Practitioner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
public interface PractitionerRepository extends JpaRepository<Practitioner, Long> {
    List<Practitioner> findBySupplierIdAndActiveTrue(Long supplierId);
    Optional<Practitioner> findByIdAndSupplierOwnerId(Long id, Long ownerId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Practitioner p where p.id = :id")
    Optional<Practitioner> findByIdForUpdate(@Param("id") Long id);
}
