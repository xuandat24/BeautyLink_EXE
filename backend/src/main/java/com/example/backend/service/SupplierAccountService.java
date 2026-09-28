package com.example.backend.service;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.net.URI;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;
import java.util.Locale;

import static com.example.backend.model.DomainEnums.*;

@Service
public class SupplierAccountService {
    private static final List<String> SUPPORTED_CITIES = List.of("ha-noi", "ho-chi-minh");
    private final UserAccountRepository users;
    private final SupplierRepository suppliers;
    private final LocationRepository locations;
    private final PractitionerRepository practitioners;
    private final AvailabilityRuleRepository rules;
    private final PasswordEncoder encoder;
    private final AuthService auth;
    private final ServiceCategoryRepository categories;
    private final ServiceOfferingRepository services;
    private final SupplierVerificationRepository verifications;
    private final SensitiveDataCipher sensitiveData;
    private final boolean autoVerify;

    public SupplierAccountService(UserAccountRepository users, SupplierRepository suppliers, LocationRepository locations,
                                  PractitionerRepository practitioners, AvailabilityRuleRepository rules,
                                  PasswordEncoder encoder, AuthService auth, ServiceCategoryRepository categories,
                                  ServiceOfferingRepository services, SupplierVerificationRepository verifications,
                                  SensitiveDataCipher sensitiveData,
                                  @Value("${app.supplier.auto-verify:false}") boolean autoVerify) {
        this.users = users;
        this.suppliers = suppliers;
        this.locations = locations;
        this.practitioners = practitioners;
        this.rules = rules;
        this.encoder = encoder;
        this.auth = auth;
        this.categories = categories;
        this.services = services;
        this.verifications = verifications;
        this.sensitiveData = sensitiveData;
        this.autoVerify = autoVerify;
    }

    @Transactional
    public SupplierRegistrationResponse register(SupplierRegistrationRequest request) {
        String phone = AuthService.normalizePhone(request.phone());
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByPhone(phone)) throw new ApiException(HttpStatus.CONFLICT, "PHONE_EXISTS", "Số điện thoại đã được đăng ký");
        if (users.existsByEmailIgnoreCase(email)) throw new ApiException(HttpStatus.CONFLICT, "EMAIL_EXISTS", "Email đã được đăng ký");
        String normalizedCccd = request.cccdNumber().replaceAll("\\s", "");
        String cccdHash = sensitiveData.hash(normalizedCccd);
        if (verifications.existsByCccdHash(cccdHash)) throw new ApiException(HttpStatus.CONFLICT, "CCCD_EXISTS", "CCCD này đã được dùng cho một hồ sơ đối tác");

        Location city = locations.findById(request.locationId())
                .filter(location -> location.isActive() && location.getType() == LocationType.PROVINCE_CITY && SUPPORTED_CITIES.contains(location.getSlug()))
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "UNSUPPORTED_CITY", "BeautyLink hiện chỉ hỗ trợ Hà Nội và TP. Hồ Chí Minh"));

        UserAccount owner = new UserAccount();
        owner.setFullName(request.ownerName().trim());
        owner.setPhone(phone);
        owner.setEmail(email);
        owner.setPasswordHash(encoder.encode(request.password()));
        owner.setRole(Role.SUPPLIER);
        owner.setStatus(AccountStatus.ACTIVE);
        users.save(owner);

        Supplier supplier = new Supplier();
        supplier.setOwner(owner);
        supplier.setName(request.businessName().trim());
        supplier.setSlug(uniqueSlug(request.businessName()));
        supplier.setBusinessType(request.businessType().trim());
        supplier.setDescription(blankToNull(request.description()));
        supplier.setLocation(city);
        supplier.setAddressLine(request.addressLine().trim());
        supplier.setLatitude(request.latitude());
        supplier.setLongitude(request.longitude());
        supplier.setImageUrl(normalizeImageSource(request.imageUrl()));
        supplier.setVerificationStatus(autoVerify ? VerificationStatus.VERIFIED : VerificationStatus.PENDING);
        supplier.setNewPartner(true);
        suppliers.save(supplier);

        SupplierVerification verification = new SupplierVerification();
        verification.setSupplier(supplier);
        verification.setCccdHash(cccdHash);
        verification.setEncryptedCccdNumber(sensitiveData.encrypt(normalizedCccd));
        verification.setEncryptedFrontImage(sensitiveData.encrypt(requireIdentityImage(request.cccdFrontImage())));
        verification.setEncryptedBackImage(sensitiveData.encrypt(requireIdentityImage(request.cccdBackImage())));
        verifications.save(verification);

        Practitioner practitioner = new Practitioner();
        practitioner.setSupplier(supplier);
        practitioner.setUser(owner);
        practitioner.setDisplayName(owner.getFullName());
        practitioner.setSpecialty(request.specialty() == null || request.specialty().isBlank() ? request.businessType().trim() : request.specialty().trim());
        practitioners.save(practitioner);
        createDefaultSchedule(practitioner);

        return new SupplierRegistrationResponse(auth.response(owner), response(supplier));
    }

    @Transactional(readOnly = true)
    public SupplierResponse profile(UserAccount owner) {
        return response(requireSupplier(owner));
    }

    @Transactional
    public SupplierResponse updateProfile(UserAccount owner, UpdateSupplierProfileRequest request) {
        Supplier supplier = requireSupplier(owner);
        supplier.setName(request.name().trim());
        supplier.setBusinessType(request.businessType().trim());
        supplier.setDescription(blankToNull(request.description()));
        supplier.setAddressLine(request.addressLine().trim());
        supplier.setImageUrl(normalizeImageSource(request.imageUrl()));
        supplier.setLatitude(request.latitude());
        supplier.setLongitude(request.longitude());
        promoteManualSupplier(supplier);
        return response(suppliers.save(supplier));
    }

    @Transactional(readOnly = true)
    public List<SupplierServiceResponse> services(UserAccount owner) {
        Supplier supplier = requireSupplier(owner);
        return services.findBySupplierIdOrderByIdDesc(supplier.getId()).stream().map(this::serviceResponse).toList();
    }

    @Transactional
    public SupplierServiceResponse createService(UserAccount owner, UpsertSupplierServiceRequest request) {
        Supplier supplier = requireSupplier(owner);
        ServiceOffering offering = new ServiceOffering();
        offering.setSupplier(supplier);
        applyService(offering, request);
        promoteManualSupplier(supplier);
        suppliers.save(supplier);
        return serviceResponse(services.save(offering));
    }

    @Transactional
    public SupplierServiceResponse updateService(UserAccount owner, Long serviceId, UpsertSupplierServiceRequest request) {
        Supplier supplier = requireSupplier(owner);
        ServiceOffering offering = requireOwnedService(supplier, serviceId);
        applyService(offering, request);
        promoteManualSupplier(supplier);
        suppliers.save(supplier);
        return serviceResponse(services.save(offering));
    }

    @Transactional
    public void deactivateService(UserAccount owner, Long serviceId) {
        Supplier supplier = requireSupplier(owner);
        ServiceOffering offering = requireOwnedService(supplier, serviceId);
        offering.setActive(false);
        services.save(offering);
    }

    @Transactional
    public PractitionerResponse createPractitioner(UserAccount owner, CreatePractitionerRequest request) {
        Supplier supplier = requireSupplier(owner);
        Practitioner practitioner = new Practitioner();
        practitioner.setSupplier(supplier);
        practitioner.setDisplayName(request.displayName().trim());
        practitioner.setSpecialty(blankToNull(request.specialty()));
        practitioner.setBio(blankToNull(request.bio()));
        practitioner.setAvatarUrl(normalizeImageSource(request.avatarUrl()));
        practitioners.save(practitioner);
        createDefaultSchedule(practitioner);
        return new PractitionerResponse(practitioner.getId(), practitioner.getDisplayName(), practitioner.getSpecialty(), practitioner.getAvatarUrl(), practitioner.getBio());
    }

    @Transactional
    public PractitionerResponse updatePractitioner(UserAccount owner, Long practitionerId, CreatePractitionerRequest request) {
        Practitioner practitioner = practitioners.findByIdAndSupplierOwnerId(practitionerId, owner.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PRACTITIONER_NOT_FOUND", "Không tìm thấy chuyên viên của gian hàng"));
        practitioner.setDisplayName(request.displayName().trim());
        practitioner.setSpecialty(blankToNull(request.specialty()));
        practitioner.setBio(blankToNull(request.bio()));
        practitioner.setAvatarUrl(normalizeImageSource(request.avatarUrl()));
        practitioners.save(practitioner);
        return new PractitionerResponse(practitioner.getId(), practitioner.getDisplayName(), practitioner.getSpecialty(), practitioner.getAvatarUrl(), practitioner.getBio());
    }

    private Supplier requireSupplier(UserAccount owner) {
        return suppliers.findByOwnerId(owner.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SUPPLIER_NOT_FOUND", "Không tìm thấy hồ sơ nhà cung cấp"));
    }

    private ServiceOffering requireOwnedService(Supplier supplier, Long serviceId) {
        return services.findById(serviceId)
                .filter(service -> service.getSupplier().getId().equals(supplier.getId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SERVICE_NOT_FOUND", "Không tìm thấy dịch vụ của gian hàng"));
    }

    private void applyService(ServiceOffering offering, UpsertSupplierServiceRequest request) {
        ServiceCategory category = categories.findById(request.categoryId())
                .filter(ServiceCategory::isActive)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "CATEGORY_NOT_FOUND", "Danh mục dịch vụ không hợp lệ"));
        offering.setCategory(category);
        offering.setName(request.name().trim());
        offering.setDescription(blankToNull(request.description()));
        offering.setPrice(request.price());
        offering.setOriginalPrice(request.originalPrice());
        offering.setDurationMinutes(request.durationMinutes());
        String image = normalizeImageSource(request.imageUrl());
        offering.setImageUrl(image == null ? category.getImageUrl() : image);
        offering.setHighlightText(blankToNull(request.description()));
        offering.setActive(request.active());
        if (autoVerify && !offering.getSupplier().isDemoData()) offering.setFeatured(true);
    }

    private void promoteManualSupplier(Supplier supplier) {
        supplier.setNewPartner(true);
        if (supplier.getLatitude() != null && supplier.getLongitude() != null) supplier.setNearbyFeatured(true);
        if (autoVerify && supplier.getVerificationStatus() == VerificationStatus.PENDING) {
            supplier.setVerificationStatus(VerificationStatus.VERIFIED);
        }
    }

    private SupplierServiceResponse serviceResponse(ServiceOffering service) {
        ServiceCategory category = service.getCategory();
        return new SupplierServiceResponse(service.getId(), category.getId(), category.getSlug(), category.getName(),
                service.getName(), service.getDescription(), service.getPrice(), service.getOriginalPrice(),
                service.getDurationMinutes(), service.getImageUrl(), service.isActive());
    }

    private void createDefaultSchedule(Practitioner practitioner) {
        for (DayOfWeek day : DayOfWeek.values()) {
            AvailabilityRule rule = new AvailabilityRule();
            rule.setPractitioner(practitioner);
            rule.setDayOfWeek(day);
            rule.setStartTime(LocalTime.of(9, 0));
            rule.setEndTime(LocalTime.of(18, 0));
            rule.setBreakStart(LocalTime.of(12, 0));
            rule.setBreakEnd(LocalTime.of(13, 0));
            rule.setSlotMinutes(30);
            rule.setActive(day != DayOfWeek.SUNDAY);
            rules.save(rule);
        }
    }

    private SupplierResponse response(Supplier supplier) {
        Location location = supplier.getLocation();
        return new SupplierResponse(supplier.getId(), supplier.getName(), supplier.getSlug(), supplier.getBusinessType(),
                supplier.getDescription(), location == null ? null : location.getId(), location == null ? null : location.getName(),
                supplier.getAddressLine(), supplier.getImageUrl(), supplier.getLatitude(), supplier.getLongitude(),
                supplier.getVerificationStatus(), supplier.getRating(), supplier.getReviewCount());
    }

    private String uniqueSlug(String value) {
        String base = Normalizer.normalize(value.trim().toLowerCase(Locale.ROOT).replace('đ', 'd'), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (base.isBlank()) base = "supplier";
        String candidate = base;
        int suffix = 2;
        while (suppliers.existsBySlug(candidate)) candidate = base + "-" + suffix++;
        return candidate;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String normalizeImageSource(String value) {
        String source = blankToNull(value);
        if (source == null) return null;
        if (source.startsWith("data:image/jpeg;base64,") || source.startsWith("data:image/png;base64,") || source.startsWith("data:image/webp;base64,")) return source;
        try {
            URI uri = URI.create(source);
            if (("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme())) && uri.getHost() != null) return source;
        } catch (IllegalArgumentException ignored) {
            // Converted into a stable API validation response below.
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_IMAGE", "Ảnh phải là tệp JPG, PNG, WEBP hoặc đường dẫn HTTP hợp lệ");
    }

    private String requireIdentityImage(String value) {
        String source = blankToNull(value);
        if (source != null && (source.startsWith("data:image/jpeg;base64,") || source.startsWith("data:image/png;base64,") || source.startsWith("data:image/webp;base64,"))) {
            return source;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_IDENTITY_IMAGE", "Ảnh CCCD phải là tệp JPG, PNG hoặc WEBP hợp lệ");
    }
}
