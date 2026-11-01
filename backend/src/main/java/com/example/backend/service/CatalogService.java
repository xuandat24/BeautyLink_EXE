package com.example.backend.service;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
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
    private final BookingRepository bookings;
    public CatalogService(LocationRepository locations, ServiceCategoryRepository categories, ServiceOfferingRepository services, PractitionerRepository practitioners, BookingReviewRepository reviews, SupplierRepository supplierRepository, BookingRepository bookings) {
        this.locations = locations; this.categories = categories; this.services = services; this.practitioners = practitioners; this.reviews = reviews; this.supplierRepository = supplierRepository; this.bookings = bookings;
    }
    public List<LocationResponse> locations(Long parentId) {
        List<Location> result = parentId == null ? locations.findByActiveTrueOrderByNameAsc() : locations.findByParentIdAndActiveTrueOrderByNameAsc(parentId);
        return result.stream()
                .filter(l -> parentId != null || (l.getParent() == null && SUPPORTED_CITY_SLUGS.contains(l.getSlug())))
                .map(this::location).toList();
    }
    public List<CategoryResponse> categories() { return categories.findByActiveTrueOrderByDisplayOrderAsc().stream().map(this::category).toList(); }
    public List<ServiceResponse> services(String slug, Long locationId) { return services(slug,locationId,false); }
    public List<ServiceResponse> services(String slug, Long locationId, boolean compact) {
        categories.findBySlugAndActiveTrue(slug).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CATEGORY_NOT_FOUND", "Không tìm thấy danh mục dịch vụ"));
        List<ServiceOffering> result = locationId == null ? services.findByCategorySlugAndActiveTrue(slug) : services.findActiveInLocationTree(slug, locationId);
        return responses(result.stream().sorted(MANUAL_SUPPLIERS_FIRST).toList(),compact);
    }
    public List<ServiceResponse> publicServices() { return publicServices(false); }
    public List<ServiceResponse> publicServices(boolean compact) {
        List<ServiceOffering> offerings = services.findPublicServices();
        return responses(offerings.stream().sorted(MANUAL_SUPPLIERS_FIRST).toList(),compact);
    }
    public ServiceResponse service(Long id) { return service(services.findById(id).filter(ServiceOffering::isActive).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SERVICE_NOT_FOUND", "Không tìm thấy dịch vụ"))); }
    public PublicSupplierShopResponse supplierShop(Long id) { return supplierShop(id,false); }
    public PublicSupplierShopResponse supplierShop(Long id, boolean compact) {
        Supplier supplier = supplierRepository.findByIdAndVerificationStatus(id, DomainEnums.VerificationStatus.VERIFIED)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SUPPLIER_NOT_FOUND", "Không tìm thấy cửa hàng"));
        List<ServiceOffering> offerings = services.findBySupplierIdAndActiveTrue(id);
        List<ServiceResponse> shopServices = responses(offerings.stream()
                .sorted(Comparator.comparing(ServiceOffering::isFeatured).reversed().thenComparing(ServiceOffering::getId, Comparator.reverseOrder())).toList(),compact);
        List<PublicReviewResponse> publicReviews = reviews.findBySupplierIdOrderByCreatedAtDesc(id, PageRequest.of(0, 100)).stream()
                .map(this::publicReview)
                .toList();
        long liveCount = reviews.countBySupplierIdAndTargetType(id, DomainEnums.ReviewTargetType.SUPPLIER);
        long liveSum = Optional.ofNullable(reviews.ratingSumBySupplier(id, DomainEnums.ReviewTargetType.SUPPLIER)).orElse(0L);
        long totalCount = liveCount;
        double rating = totalCount == 0 ? 0 : roundRating((double) liveSum / totalCount);
        return new PublicSupplierShopResponse(supplier.getId(), supplier.getName(), supplier.getSlug(), supplier.getBusinessType(),
                supplier.getDescription(), supplier.getAddressLine(), supplier.getLocation() == null ? null : supplier.getLocation().getName(),
                compact ? PublicCatalogImages.reference(supplier.getImageUrl(),"suppliers",supplier.getId()) : supplier.getImageUrl(), supplier.getLatitude(), supplier.getLongitude(), supplier.getVerificationStatus(), rating,
                Math.toIntExact(totalCount), supplier.getCreatedAt(), shopServices, publicReviews);
    }
    public List<ServiceResponse> homepage(Long locationId) { return homepage(locationId,false); }
    public List<ServiceResponse> homepage(Long locationId, boolean compact) {
        List<ServiceOffering> offerings = services.findHomepageServices(locationId);
        return responses(offerings.stream().sorted(MANUAL_SUPPLIERS_FIRST).toList(),compact);
    }
    public PublicReviewPageResponse serviceReviews(Long id, int page, int size) {
        services.findById(id).filter(ServiceOffering::isActive)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SERVICE_NOT_FOUND", "Không tìm thấy dịch vụ"));
        Page<BookingReview> result = reviews.findPublicByService(id, DomainEnums.ReviewTargetType.SERVICE, reviewPage(page, size));
        Double average = reviews.averageByService(id, DomainEnums.ReviewTargetType.SERVICE);
        return reviewPageResponse(result, average == null ? 0 : roundRating(average));
    }
    public PublicReviewPageResponse supplierReviews(Long id, int page, int size) {
        supplierRepository.findByIdAndVerificationStatus(id, DomainEnums.VerificationStatus.VERIFIED)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SUPPLIER_NOT_FOUND", "Không tìm thấy cửa hàng"));
        Page<BookingReview> result = reviews.findPublicBySupplier(id, DomainEnums.ReviewTargetType.SUPPLIER, reviewPage(page, size));
        long count = result.getTotalElements();
        long sum = Optional.ofNullable(reviews.ratingSumBySupplier(id, DomainEnums.ReviewTargetType.SUPPLIER)).orElse(0L);
        return reviewPageResponse(result, count == 0 ? 0 : roundRating((double) sum / count));
    }
    private PageRequest reviewPage(int page, int size) {
        if (page < 0 || size < 1) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGINATION", "Trang và kích thước trang không hợp lệ");
        return PageRequest.of(page, Math.min(size, 100));
    }
    private PublicReviewPageResponse reviewPageResponse(Page<BookingReview> result, double rating) {
        return new PublicReviewPageResponse(result.getContent().stream().map(this::publicReview).toList(),
                result.getTotalElements(), result.getTotalPages(), result.getNumber(), result.getSize(), rating);
    }
    private PublicReviewResponse publicReview(BookingReview review) {
        return new PublicReviewResponse(review.getId(), review.getTargetType(), review.getRating(), review.getComment(),
                maskedName(review.getCustomer().getFullName()), review.getService().getId(), review.getService().getName(), review.getCreatedAt(), review.getImages());
    }
    private LocationResponse location(Location l) { return new LocationResponse(l.getId(), l.getName(), l.getSlug(), l.getType(), l.getParent() == null ? null : l.getParent().getId()); }
    private CategoryResponse category(ServiceCategory c) { return new CategoryResponse(c.getId(), c.getSlug(), c.getName(), c.getDescription(), c.getImageUrl()); }
    private Map<Long, Long> bookingCounts(List<ServiceOffering> offerings) {
        if (offerings.isEmpty()) return Map.of();
        List<Long> ids = offerings.stream().map(ServiceOffering::getId).toList();
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : bookings.countByServiceIdsAndStatuses(ids,
                List.of(DomainEnums.BookingStatus.CONFIRMED, DomainEnums.BookingStatus.COMPLETED))) {
            counts.put((Long) row[0], (Long) row[1]);
        }
        return counts;
    }
    private ServiceResponse service(ServiceOffering s) { return responses(List.of(s),false).getFirst(); }
    private List<ServiceResponse> responses(List<ServiceOffering> offerings,boolean compact) {
        if(offerings.isEmpty())return List.of();var serviceIds=offerings.stream().map(ServiceOffering::getId).toList();var supplierIds=offerings.stream().map(o->o.getSupplier().getId()).distinct().toList();
        var serviceStats=new HashMap<Long,Object[]>();for(var row:reviews.publicStatsByServiceIds(serviceIds,DomainEnums.ReviewTargetType.SERVICE))serviceStats.put((Long)row[0],row);
        var supplierStats=new HashMap<Long,Object[]>();for(var row:reviews.publicStatsBySupplierIds(supplierIds,DomainEnums.ReviewTargetType.SUPPLIER))supplierStats.put((Long)row[0],row);
        var staff=practitioners.findPublicBySupplierIds(supplierIds).stream().collect(java.util.stream.Collectors.groupingBy(p->p.getSupplier().getId()));var counts=bookingCounts(offerings);
        return offerings.stream().map(s->service(s,counts,serviceStats,supplierStats,staff,compact)).toList();
    }
    private ServiceResponse service(ServiceOffering s,Map<Long,Long> bookingCounts,Map<Long,Object[]> serviceStats,Map<Long,Object[]> supplierStats,Map<Long,List<Practitioner>> staff,boolean compact) {
        Supplier supplier=s.getSupplier();var people=staff.getOrDefault(supplier.getId(),List.of()).stream().filter(p->p.supports(s)).sorted(Comparator.comparing(Practitioner::getId)).map(p->new PractitionerResponse(p.getId(),p.getDisplayName(),p.getSpecialty(),p.getAvatarUrl(),p.getBio())).toList();
        var stats=serviceStats.get(s.getId());long serviceReviewCount=stats==null?0:((Number)stats[1]).longValue();double serviceRating=stats==null?0:roundRating(((Number)stats[2]).doubleValue());
        var supplierRow=supplierStats.get(supplier.getId());long supplierReviewCount=supplierRow==null?0:((Number)supplierRow[1]).longValue();double supplierRating=supplierReviewCount==0?0:roundRating(((Number)supplierRow[2]).doubleValue()/supplierReviewCount);
        return new ServiceResponse(s.getId(), s.getName(), s.getDescription(), s.getPrice(), s.getDurationMinutes(), compact?PublicCatalogImages.reference(s.getImageUrl(),"services",s.getId()):s.getImageUrl(), s.getCategory().getSlug(), supplier.getId(), supplier.getName(), supplier.getAddressLine(), serviceRating, Math.toIntExact(serviceReviewCount), supplierRating, people,
                s.getOriginalPrice() == null ? s.getPrice() : s.getOriginalPrice(), s.getHighlightText(), s.isFeatured(),
                compact?PublicCatalogImages.reference(supplier.getImageUrl(),"suppliers",supplier.getId()):supplier.getImageUrl(), supplier.getBusinessType(), Math.toIntExact(supplierReviewCount), supplier.isDemoData(),
                supplier.isNearbyFeatured(), supplier.isNewPartner(), supplier.getLatitude(), supplier.getLongitude(),
                bookingCounts.getOrDefault(s.getId(), 0L));
    }
    private double roundRating(double rating) { return Math.round(rating * 10.0) / 10.0; }
    private String maskedName(String fullName) {
        if (fullName == null || fullName.isBlank()) return "Khách hàng BeautyLink";
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length == 1) return parts[0].substring(0, 1) + "***";
        return parts[0] + " " + parts[parts.length - 1].substring(0, 1) + ".";
    }
}
