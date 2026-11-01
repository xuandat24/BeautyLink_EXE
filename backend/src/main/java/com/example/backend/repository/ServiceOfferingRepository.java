package com.example.backend.repository;
import com.example.backend.model.ServiceOffering;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface ServiceOfferingRepository extends JpaRepository<ServiceOffering, Long> {
    @EntityGraph(attributePaths={"supplier","category"})
    @Query("""
            select offering from ServiceOffering offering
            join offering.supplier supplier
            where offering.category.slug = :categorySlug
              and offering.active = true
              and supplier.verificationStatus = com.example.backend.model.DomainEnums$VerificationStatus.VERIFIED
            """)
    List<ServiceOffering> findByCategorySlugAndActiveTrue(@Param("categorySlug") String categorySlug);
    @EntityGraph(attributePaths={"supplier","category"})
    @Query("""
            select offering from ServiceOffering offering
            join offering.supplier supplier
            join supplier.location location
            left join location.parent parentLocation
            left join parentLocation.parent grandparentLocation
            where offering.category.slug = :categorySlug
              and offering.active = true
              and supplier.verificationStatus = com.example.backend.model.DomainEnums$VerificationStatus.VERIFIED
              and (location.id = :locationId or parentLocation.id = :locationId or grandparentLocation.id = :locationId)
            """)
    List<ServiceOffering> findActiveInLocationTree(@Param("categorySlug") String categorySlug, @Param("locationId") Long locationId);
    @EntityGraph(attributePaths={"supplier","category"})
    List<ServiceOffering> findBySupplierIdAndActiveTrue(Long supplierId);
    @EntityGraph(attributePaths={"supplier","category"})
    @Query("""
            select offering from ServiceOffering offering
            join offering.supplier supplier
            where offering.active = true
              and supplier.verificationStatus = com.example.backend.model.DomainEnums$VerificationStatus.VERIFIED
            """)
    List<ServiceOffering> findPublicServices();
    @Query("select o.imageUrl from ServiceOffering o where o.id=:id and o.active=true and o.supplier.verificationStatus=com.example.backend.model.DomainEnums$VerificationStatus.VERIFIED")
    Optional<String> publicCover(@Param("id") Long id);
    List<ServiceOffering> findBySupplierIdOrderByIdDesc(Long supplierId);
    Optional<ServiceOffering> findBySupplierIdAndName(Long supplierId, String name);
    @EntityGraph(attributePaths={"supplier","category"})
    @Query("""
            select offering from ServiceOffering offering
            join offering.supplier supplier
            join supplier.location location
            left join location.parent parentLocation
            left join parentLocation.parent grandparentLocation
            where offering.active = true
              and supplier.verificationStatus = com.example.backend.model.DomainEnums$VerificationStatus.VERIFIED
              and (offering.featured = true or supplier.nearbyFeatured = true or supplier.newPartner = true)
              and (:locationId is null or location.id = :locationId or parentLocation.id = :locationId or grandparentLocation.id = :locationId)
            """)
    List<ServiceOffering> findHomepageServices(@Param("locationId") Long locationId);
}
