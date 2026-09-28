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
    public CatalogService(LocationRepository locations, ServiceCategoryRepository categories, ServiceOfferingRepository services, PractitionerRepository practitioners) {
        this.locations = locations; this.categories = categories; this.services = services; this.practitioners = practitioners;
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
        return new ServiceResponse(s.getId(), s.getName(), s.getDescription(), s.getPrice(), s.getDurationMinutes(), s.getImageUrl(), s.getCategory().getSlug(), supplier.getId(), supplier.getName(), supplier.getAddressLine(), supplier.getRating(), people,
                s.getOriginalPrice() == null ? s.getPrice() : s.getOriginalPrice(), s.getHighlightText(), s.isFeatured(),
                supplier.getImageUrl(), supplier.getBusinessType(), supplier.getReviewCount(), supplier.isDemoData(),
                supplier.isNearbyFeatured(), supplier.isNewPartner(), supplier.getLatitude(), supplier.getLongitude());
    }
}
