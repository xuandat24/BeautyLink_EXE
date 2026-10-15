package com.example.backend.bootstrap;

import com.example.backend.model.AvailabilityRule;
import com.example.backend.model.Location;
import com.example.backend.model.Practitioner;
import com.example.backend.model.ServiceCategory;
import com.example.backend.model.ServiceOffering;
import com.example.backend.model.Supplier;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.AvailabilityRuleRepository;
import com.example.backend.repository.LocationRepository;
import com.example.backend.repository.PractitionerRepository;
import com.example.backend.repository.ServiceCategoryRepository;
import com.example.backend.repository.ServiceOfferingRepository;
import com.example.backend.repository.SupplierRepository;
import com.example.backend.repository.UserAccountRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.example.backend.model.DomainEnums.AccountStatus.DISABLED;
import static com.example.backend.model.DomainEnums.Role.SUPPLIER;
import static com.example.backend.model.DomainEnums.VerificationStatus.VERIFIED;

/** Imports the approved DS Partner workbook catalog without requiring OTP registration. */
@Component
@Order(2)
@ConditionalOnProperty(name = "app.partner-catalog.enabled", havingValue = "true")
public class PartnerCatalogSeeder implements CommandLineRunner {
    private final UserAccountRepository users;
    private final LocationRepository locations;
    private final ServiceCategoryRepository categories;
    private final SupplierRepository suppliers;
    private final PractitionerRepository practitioners;
    private final ServiceOfferingRepository services;
    private final AvailabilityRuleRepository availabilityRules;
    private final PasswordEncoder passwordEncoder;

    public PartnerCatalogSeeder(UserAccountRepository users, LocationRepository locations,
            ServiceCategoryRepository categories, SupplierRepository suppliers,
            PractitionerRepository practitioners, ServiceOfferingRepository services,
            AvailabilityRuleRepository availabilityRules, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.locations = locations;
        this.categories = categories;
        this.suppliers = suppliers;
        this.practitioners = practitioners;
        this.services = services;
        this.availabilityRules = availabilityRules;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        Location hanoi = locations.findBySlug("ha-noi")
                .orElseThrow(() -> new IllegalStateException("Hanoi reference location must be seeded first"));
        Map<String, ServiceCategory> categoryMap = categories.findByActiveTrueOrderByDisplayOrderAsc().stream()
                .collect(Collectors.toMap(ServiceCategory::getSlug, Function.identity()));
        PartnerCatalogData.partners().forEach(entry -> seed(entry, hanoi, categoryMap));
    }

    private void seed(PartnerCatalogData.PartnerEntry entry, Location hanoi,
            Map<String, ServiceCategory> categoryMap) {
        Supplier supplier = suppliers.findBySlug(entry.slug()).orElseGet(() -> createSupplier(entry, hanoi));
        Practitioner practitioner = ensurePractitioner(supplier, entry);
        ensureSchedule(practitioner);

        for (int index = 0; index < entry.services().size(); index++) {
            PartnerCatalogData.ServiceEntry serviceEntry = entry.services().get(index);
            if (services.findBySupplierIdAndName(supplier.getId(), serviceEntry.name()).isPresent()) continue;
            ServiceCategory category = categoryMap.get(serviceEntry.categorySlug());
            if (category == null) {
                throw new IllegalStateException("Missing category " + serviceEntry.categorySlug());
            }
            ServiceOffering offering = new ServiceOffering();
            offering.setSupplier(supplier);
            offering.setCategory(category);
            offering.setName(serviceEntry.name());
            offering.setDescription(serviceEntry.description());
            offering.setPrice(BigDecimal.valueOf(serviceEntry.price()));
            offering.setOriginalPrice(null);
            offering.setDurationMinutes(serviceEntry.durationMinutes());
            offering.setImageUrl(serviceEntry.imageUrl());
            offering.setHighlightText(serviceEntry.highlightText());
            offering.setFeatured(index == 0 && serviceEntry.price() > 0);
            offering.setActive(true);
            services.save(offering);
        }
    }

    private Supplier createSupplier(PartnerCatalogData.PartnerEntry entry, Location hanoi) {
        UserAccount owner = createOwner(entry);
        Supplier supplier = new Supplier();
        supplier.setOwner(owner);
        supplier.setName(entry.name());
        supplier.setSlug(entry.slug());
        supplier.setBusinessType(entry.businessType());
        supplier.setDescription(entry.description());
        supplier.setLocation(hanoi);
        supplier.setAddressLine(entry.address());
        supplier.setImageUrl(entry.services().getFirst().imageUrl());
        double[] coordinates = coordinates(entry.slug());
        supplier.setLatitude(coordinates[0]);
        supplier.setLongitude(coordinates[1]);
        supplier.setVerificationStatus(VERIFIED);
        supplier.setDemoData(false);
        supplier.setNearbyFeatured(false);
        supplier.setNewPartner(false);
        return suppliers.save(supplier);
    }

    private UserAccount createOwner(PartnerCatalogData.PartnerEntry entry) {
        String email = "catalog." + entry.slug() + "@beautylink.local";
        return users.findByEmailIgnoreCase(email).orElseGet(() -> {
            UserAccount owner = new UserAccount();
            owner.setFullName(entry.ownerName());
            owner.setPhone(availableInternalPhone(entry.slug()));
            owner.setEmail(email);
            owner.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
            owner.setRole(SUPPLIER);
            owner.setStatus(DISABLED);
            return users.save(owner);
        });
    }

    private Practitioner ensurePractitioner(Supplier supplier, PartnerCatalogData.PartnerEntry entry) {
        List<Practitioner> existing = practitioners.findBySupplierIdAndActiveTrue(supplier.getId());
        if (!existing.isEmpty()) return existing.getFirst();
        Practitioner practitioner = new Practitioner();
        practitioner.setSupplier(supplier);
        practitioner.setDisplayName(entry.practitionerName());
        practitioner.setSpecialty(entry.businessType());
        practitioner.setBio("Chuyên viên của " + entry.name());
        practitioner.setActive(true);
        return practitioners.save(practitioner);
    }

    private void ensureSchedule(Practitioner practitioner) {
        if (!availabilityRules.findByPractitionerIdOrderByDayOfWeek(practitioner.getId()).isEmpty()) return;
        for (DayOfWeek day : DayOfWeek.values()) {
            AvailabilityRule rule = new AvailabilityRule();
            rule.setPractitioner(practitioner);
            rule.setDayOfWeek(day);
            rule.setStartTime(LocalTime.of(9, 0));
            rule.setEndTime(LocalTime.of(19, 0));
            rule.setBreakStart(LocalTime.of(12, 0));
            rule.setBreakEnd(LocalTime.of(13, 0));
            rule.setSlotMinutes(30);
            rule.setActive(day != DayOfWeek.SUNDAY);
            availabilityRules.save(rule);
        }
    }

    private String availableInternalPhone(String slug) {
        int suffix = Math.floorMod(slug.hashCode(), 1_000_000);
        String phone = String.format("0877%06d", suffix);
        while (users.existsByPhone(phone)) {
            suffix = (suffix + 1) % 1_000_000;
            phone = String.format("0877%06d", suffix);
        }
        return phone;
    }

    private double[] coordinates(String slug) {
        int hash = slug.hashCode();
        double latitude = 21.0285 + (Math.floorMod(hash, 1601) - 800) / 100_000.0;
        double longitude = 105.8542 + (Math.floorMod(hash / 1601, 1601) - 800) / 100_000.0;
        return new double[]{latitude, longitude};
    }
}
