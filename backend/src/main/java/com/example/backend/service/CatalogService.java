package com.example.backend.service;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class CatalogService {
    private static final Set<String> SUPPORTED_CITY_SLUGS = Set.of("ha-noi", "ho-chi-minh");
    private static final Comparator<ServiceOffering> MANUAL_SUPPLIERS_FIRST = Comparator
            .comparing((ServiceOffering service) -> service.getSupplier().isDemoData())
            .thenComparing(ServiceOffering::isFeatured, Comparator.reverseOrder())
            .thenComparing(ServiceOffering::getId, Comparator.reverseOrder());
    private final LocationRepository locations; private final ServiceCategoryRepository categories;
    private final ServiceOfferingRepository services; private final PractitionerRepository practitioners;
    private final BookingReviewRepository reviews; private final SupplierRepository supplierRepository;
    public CatalogService(LocationRepository locations, ServiceCategoryRepository categories, ServiceOfferingRepository services, PractitionerRepository practitioners, BookingReviewRepository reviews, SupplierRepository supplierRepository) {
        this.locations = locations; this.categories = categories; this.services = services; this.practitioners = practitioners; this.reviews = reviews; this.supplierRepository = supplierRepository;
    }
    public List<LocationResponse> locations(Long parentId) {
        List<Location> result = parentId == null ? locations.findByActiveTrueOrderByNameAsc() : locations.findByParentIdAndActiveTrueOrderByNameAsc(parentId);
        return result.stream()
                .filter(l -> parentId != null || (l.getParent() == null && SUPPORTED_CITY_SLUGS.contains(l.getSlug())))
                .map(this::location).toList();
    }
    public List<CategoryResponse> categories() { return categories.findByActiveTrueOrderByDisplayOrderAsc().stream().map(this::category).toList(); }
    public List<ServiceResponse> services(String slug, Long locationId) {
        categories.findBySlugAndActiveTrue(slug).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CATEGORY_NOT_FOUND", "Không tìm thấy danh mục dịch vụ"));
        List<ServiceOffering> result = locationId == null ? services.findByCategorySlugAndActiveTrue(slug) : services.findActiveInLocationTree(slug, locationId);
        return result.stream().sorted(MANUAL_SUPPLIERS_FIRST).map(this::service).toList();
    }
    public ServiceResponse service(Long id) { return service(services.findById(id).filter(ServiceOffering::isActive).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SERVICE_NOT_FOUND", "Không tìm thấy dịch vụ"))); }
    public PublicSupplierShopResponse supplierShop(Long id) {
        Supplier supplier = supplierRepository.findByIdAndVerificationStatus(id, DomainEnums.VerificationStatus.VERIFIED)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SUPPLIER_NOT_FOUND", "Không tìm thấy cửa hàng"));
        List<ServiceResponse> shopServices = services.findBySupplierIdAndActiveTrue(id).stream()
                .sorted(Comparator.comparing(ServiceOffering::isFeatured).reversed().thenComparing(ServiceOffering::getId, Comparator.reverseOrder()))
                .map(this::service).toList();
        List<PublicReviewResponse> publicReviews = reviews.findBySupplierIdOrderByCreatedAtDesc(id).stream()
                .limit(100)
                .map(review -> new PublicReviewResponse(review.getId(), review.getTargetType(), review.getRating(), review.getComment(),
                        maskedName(review.getCustomer().getFullName()), review.getService().getId(), review.getService().getName(), review.getCreatedAt()))
                .toList();
        long liveCount = reviews.countBySupplierIdAndTargetType(id, DomainEnums.ReviewTargetType.SUPPLIER);
        long liveSum = Optional.ofNullable(reviews.ratingSumBySupplier(id, DomainEnums.ReviewTargetType.SUPPLIER)).orElse(0L);
        long totalCount = supplier.getReviewCount() + liveCount;
        double rating = totalCount == 0 ? 0 : roundRating((supplier.getRating() * supplier.getReviewCount() + liveSum) / totalCount);
        return new PublicSupplierShopResponse(supplier.getId(), supplier.getName(), supplier.getSlug(), supplier.getBusinessType(),
                supplier.getDescription(), supplier.getAddressLine(), supplier.getLocation() == null ? null : supplier.getLocation().getName(),
                supplier.getImageUrl(), supplier.getLatitude(), supplier.getLongitude(), supplier.getVerificationStatus(), rating,
                Math.toIntExact(totalCount), supplier.getCreatedAt(), shopServices, publicReviews);
    }
    public List<ServiceResponse> homepage(Long locationId) {
        return services.findHomepageServices(locationId).stream()
                .sorted(MANUAL_SUPPLIERS_FIRST)
                .map(this::service).toList();
    }
    private LocationResponse location(Location l) { return new LocationResponse(l.getId(), l.getName(), l.getSlug(), l.getType(), l.getParent() == null ? null : l.getParent().getId()); }
    private CategoryResponse category(ServiceCategory c) { return new CategoryResponse(c.getId(), c.getSlug(), c.getName(), c.getDescription(), c.getImageUrl()); }
    private ServiceResponse service(ServiceOffering s) {
        Supplier supplier = s.getSupplier();
        List<PractitionerResponse> people = practitioners.findBySupplierIdAndActiveTrue(supplier.getId()).stream().map(p -> new PractitionerResponse(p.getId(), p.getDisplayName(), p.getSpecialty(), p.getAvatarUrl(), p.getBio())).toList();
        long serviceReviewCount = reviews.countByServiceIdAndTargetType(s.getId(), DomainEnums.ReviewTargetType.SERVICE);
        Double serviceAverage = reviews.averageByService(s.getId(), DomainEnums.ReviewTargetType.SERVICE);
        double serviceRating = serviceAverage == null ? supplier.getRating() : roundRating(serviceAverage);
        long liveSupplierCount = reviews.countBySupplierIdAndTargetType(supplier.getId(), DomainEnums.ReviewTargetType.SUPPLIER);
        long liveSupplierSum = Optional.ofNullable(reviews.ratingSumBySupplier(supplier.getId(), DomainEnums.ReviewTargetType.SUPPLIER)).orElse(0L);
        long supplierReviewCount = supplier.getReviewCount() + liveSupplierCount;
        double supplierRating = supplierReviewCount == 0 ? 0 : roundRating((supplier.getRating() * supplier.getReviewCount() + liveSupplierSum) / supplierReviewCount);
        return new ServiceResponse(s.getId(), s.getName(), s.getDescription(), s.getPrice(), s.getDurationMinutes(), s.getImageUrl(), s.getCategory().getSlug(), supplier.getId(), supplier.getName(), supplier.getAddressLine(), serviceRating, Math.toIntExact(serviceReviewCount), supplierRating, people,
                s.getOriginalPrice() == null ? s.getPrice() : s.getOriginalPrice(), s.getHighlightText(), s.isFeatured(),
                supplier.getImageUrl(), supplier.getBusinessType(), Math.toIntExact(supplierReviewCount), supplier.isDemoData(),
                supplier.isNearbyFeatured(), supplier.isNewPartner(), supplier.getLatitude(), supplier.getLongitude());
    }
    private double roundRating(double rating) { return Math.round(rating * 10.0) / 10.0; }
    private String maskedName(String fullName) {
        if (fullName == null || fullName.isBlank()) return "Khách hàng BeautyLink";
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length == 1) return parts[0].substring(0, 1) + "***";
        return parts[0] + " " + parts[parts.length - 1].substring(0, 1) + ".";
    }
}
