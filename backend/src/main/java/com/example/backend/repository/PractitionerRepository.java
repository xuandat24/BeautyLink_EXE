package com.example.backend.repository;
import com.example.backend.model.Practitioner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
public interface PractitionerRepository extends JpaRepository<Practitioner, Long> {
    @Query("select distinct p from Practitioner p left join fetch p.supportedServices where p.supplier.id in :ids and p.active=true")
    List<Practitioner> findPublicBySupplierIds(@Param("ids") Collection<Long> ids);
    List<Practitioner> findBySupplierIdAndActiveTrue(Long supplierId);
    List<Practitioner> findBySupplierIdOrderById(Long supplierId);
    Optional<Practitioner> findByIdAndSupplierOwnerId(Long id, Long ownerId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Practitioner p where p.id = :id and p.supplier.owner.id = :ownerId")
    Optional<Practitioner> findOwnedForUpdate(@Param("id") Long id, @Param("ownerId") Long ownerId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Practitioner p where p.id = :id")
    Optional<Practitioner> findByIdForUpdate(@Param("id") Long id);
}
