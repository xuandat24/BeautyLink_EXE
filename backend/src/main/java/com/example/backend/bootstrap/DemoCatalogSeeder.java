package com.example.backend.bootstrap;

import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Profile;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.example.backend.model.DomainEnums.*;

/**
 * Database-backed demo catalog used for presentations and local development.
 * Every generated supplier is explicitly tagged with demo_data=true so the
 * records can be identified and removed without confusing them with real partners.
 */
@Component
@Profile("!prod")
@ConditionalOnProperty(name = "app.demo-data.enabled", havingValue = "true", matchIfMissing = false)
@Order(3)
public class DemoCatalogSeeder implements CommandLineRunner {
    private final UserAccountRepository users;
    private final LocationRepository locations;
    private final ServiceCategoryRepository categories;
    private final SupplierRepository suppliers;
    private final PractitionerRepository practitioners;
    private final ServiceOfferingRepository services;
    private final AvailabilityRuleRepository rules;
    private final PasswordEncoder encoder;
    private final String demoPassword;
    private String demoPasswordHash;

    public DemoCatalogSeeder(UserAccountRepository users, LocationRepository locations,
                             ServiceCategoryRepository categories, SupplierRepository suppliers,
                             PractitionerRepository practitioners, ServiceOfferingRepository services,
                             AvailabilityRuleRepository rules, PasswordEncoder encoder,
                             @Value("${app.demo-data.password}") String demoPassword) {
        this.users = users;
        this.locations = locations;
        this.categories = categories;
        this.suppliers = suppliers;
        this.practitioners = practitioners;
        this.services = services;
        this.rules = rules;
        this.encoder = encoder;
        this.demoPassword = demoPassword;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (demoPassword == null || demoPassword.length() < 12 || "Demo123!".equalsIgnoreCase(demoPassword)) {
            throw new IllegalStateException("DEMO_ACCOUNT_PASSWORD must be a private value of at least 12 characters when demo data is enabled");
        }
        Location hcm = locations.findBySlug("ho-chi-minh").orElse(null);
        Location hanoi = locations.findBySlug("ha-noi").orElse(null);
        if (hcm == null && hanoi == null) return;
        Map<String, ServiceCategory> categoryMap = categories.findByActiveTrueOrderByDisplayOrderAsc().stream()
                .collect(Collectors.toMap(ServiceCategory::getSlug, Function.identity()));
        if (categoryMap.isEmpty()) return;
        demoPasswordHash = encoder.encode(demoPassword);
        if (hcm != null) demoEntries().forEach(entry -> seed(entry, hcm, categoryMap));
        if (hanoi != null) hanoiEntries().forEach(entry -> seed(entry, hanoi, categoryMap));
    }

    private void seed(DemoEntry entry, Location city, Map<String, ServiceCategory> categoryMap) {
        ServiceCategory category = categoryMap.get(entry.categorySlug());
        if (category == null) return;

        Supplier supplier = suppliers.findBySlug(entry.supplierSlug()).orElseGet(() -> {
            UserAccount owner = new UserAccount();
            owner.setFullName(entry.supplierName() + " Demo Owner");
            owner.setPhone(demoPhone(entry.supplierSlug()));
            owner.setEmail("demo." + entry.supplierSlug() + "@beautylink.local");
            owner.setPasswordHash(demoPasswordHash);
            owner.setRole(Role.SUPPLIER);
            owner.setStatus(AccountStatus.ACTIVE);
            users.save(owner);

            Supplier created = new Supplier();
            created.setOwner(owner);
            created.setName(entry.supplierName());
            created.setSlug(entry.supplierSlug());
            created.setLocation(city);
            created.setAddressLine(entry.address());
            created.setVerificationStatus(VerificationStatus.VERIFIED);
            return created;
        });
        supplier.setBusinessType(entry.businessType());
        supplier.setDescription(entry.highlightText());
        supplier.setImageUrl(entry.imageUrl());
        double[] coordinates = demoCoordinates(city.getSlug(), entry.supplierSlug());
        supplier.setLatitude(coordinates[0]);
        supplier.setLongitude(coordinates[1]);
        supplier.setRating(entry.rating());
        supplier.setReviewCount(entry.reviewCount());
        supplier.setDemoData(true);
        supplier.setNearbyFeatured(supplier.isNearbyFeatured() || entry.nearby());
        supplier.setNewPartner(supplier.isNewPartner() || entry.newPartner());
        suppliers.save(supplier);
        supplier.getOwner().setPasswordHash(demoPasswordHash);
        supplier.getOwner().setStatus(AccountStatus.ACTIVE);
        users.save(supplier.getOwner());

        List<Practitioner> existingPeople = practitioners.findBySupplierIdAndActiveTrue(supplier.getId());
        Practitioner practitioner;
        if (existingPeople.isEmpty()) {
            practitioner = new Practitioner();
            practitioner.setSupplier(supplier);
            practitioner.setDisplayName("Chuyên viên " + shortName(entry.supplierName()));
            practitioner.setSpecialty(entry.businessType());
            practitioner = practitioners.save(practitioner);
            createSchedule(practitioner);
        } else {
            practitioner = existingPeople.get(0);
        }

        ServiceOffering offering = services.findBySupplierIdAndName(supplier.getId(), entry.serviceName())
                .orElseGet(ServiceOffering::new);
        offering.setSupplier(supplier);
        offering.setCategory(category);
        offering.setName(entry.serviceName());
        offering.setDescription(entry.highlightText());
        offering.setPrice(BigDecimal.valueOf(entry.price()));
        offering.setOriginalPrice(BigDecimal.valueOf(entry.originalPrice()));
        offering.setDurationMinutes(entry.durationMinutes());
        offering.setImageUrl(entry.imageUrl());
        offering.setHighlightText(entry.highlightText());
        offering.setFeatured(entry.featured());
        offering.setActive(true);
        services.save(offering);
    }

    private void createSchedule(Practitioner practitioner) {
        for (DayOfWeek day : DayOfWeek.values()) {
            AvailabilityRule rule = new AvailabilityRule();
            rule.setPractitioner(practitioner);
            rule.setDayOfWeek(day);
            rule.setStartTime(LocalTime.of(9, 0));
            rule.setEndTime(LocalTime.of(20, 0));
            rule.setBreakStart(LocalTime.of(12, 0));
            rule.setBreakEnd(LocalTime.of(13, 0));
            rule.setSlotMinutes(30);
            rule.setActive(day != DayOfWeek.SUNDAY);
            rules.save(rule);
        }
    }

    private String shortName(String name) {
        String cleaned = name.replaceAll("[^\\p{L}\\p{N} ]", "").trim();
        return cleaned.length() > 28 ? cleaned.substring(0, 28) : cleaned;
    }

    private String demoPhone(String supplierSlug) {
        int number = Math.floorMod(supplierSlug.hashCode(), 1_000_000);
        String candidate = String.format("0888%06d", number);
        while (users.existsByPhone(candidate)) {
            number = (number + 1) % 1_000_000;
            candidate = String.format("0888%06d", number);
        }
        return candidate;
    }

    /**
     * Hà Nội demo coverage is intentionally balanced: two suppliers per category.
     * Reusing a supplier slug across entries gives one supplier multiple categorized
     * offerings without duplicating category data on the supplier table.
     */
    private List<DemoEntry> hanoiEntries() {
        return List.of(
                entry("lune-bridal-hair-hanoi", "LUNE Bridal & Hair", "Makeup & Hair Studio", "32 Phố Huế, Hai Bà Trưng, Hà Nội", "makeup", "Trang Điểm Cô Dâu Trong Veo", 750000, 1200000, 100, "Thiết kế layout cô dâu theo đường nét và phong cách riêng", img("1487412912498-0447578fcca8"), 4.9, 186, true, true, false),
                entry("lune-bridal-hair-hanoi", "LUNE Bridal & Hair", "Makeup & Hair Studio", "32 Phố Huế, Hai Bà Trưng, Hà Nội", "hair", "Tạo Kiểu Tóc Dự Tiệc", 320000, 480000, 60, "Tư vấn kiểu tóc hài hòa với khuôn mặt và trang phục", img("1562322140-8baeececf3df"), 4.9, 186, true, true, false),

                entry("sen-wellness-hanoi", "Sen Wellness Hà Nội", "Spa & Skincare", "18 Hàng Bông, Hoàn Kiếm, Hà Nội", "spa", "Massage Thảo Mộc Toàn Thân", 420000, 650000, 90, "Thư giãn với tinh dầu và túi chườm thảo mộc ấm", img("1540555700478-4be289fbecef"), 4.8, 264, true, true, false),
                entry("sen-wellness-hanoi", "Sen Wellness Hà Nội", "Spa & Skincare", "18 Hàng Bông, Hoàn Kiếm, Hà Nội", "skincare", "Phục Hồi Da Nhạy Cảm", 490000, 780000, 75, "Làm dịu và phục hồi hàng rào bảo vệ da chuyên sâu", img("1570172619644-dfd03ed5d881"), 4.8, 264, true, true, false),

                entry("muse-nail-lash-hanoi", "MUSE Nail & Lash", "Nail & Eyelash Studio", "65 Nguyễn Trãi, Thanh Xuân, Hà Nội", "nails", "Sơn Gel Thiết Kế Pastel", 210000, 360000, 60, "Bảng màu pastel và thiết kế theo phong cách cá nhân", img("1632345031435-8727f6897d53"), 4.9, 148, true, false, true),
                entry("muse-nail-lash-hanoi", "MUSE Nail & Lash", "Nail & Eyelash Studio", "65 Nguyễn Trãi, Thanh Xuân, Hà Nội", "makeup", "Nối Mi Tự Nhiên Thiết Kế", 260000, 420000, 60, "Dáng mi nhẹ, phù hợp từng dáng mắt", img("1524504388940-b1c1722653e1"), 4.9, 148, true, false, true),

                entry("an-nhien-beauty-hanoi", "An Nhiên Beauty House", "Hair Salon & Wellness", "102 Cầu Giấy, Cầu Giấy, Hà Nội", "hair", "Cắt & Phục Hồi Tóc Chuyên Sâu", 390000, 620000, 90, "Cắt tạo kiểu kết hợp phục hồi keratin", img("1562322140-8baeececf3df"), 4.8, 207, false, true, false),
                entry("an-nhien-beauty-hanoi", "An Nhiên Beauty House", "Hair Salon & Wellness", "102 Cầu Giấy, Cầu Giấy, Hà Nội", "spa", "Gội Đầu Dưỡng Sinh Cổ Vai Gáy", 240000, 390000, 70, "Thư giãn vùng đầu, cổ và vai gáy bằng thảo dược", img("1512290900672-1f5be63fa7ba"), 4.8, 207, false, true, false),

                entry("aurora-aesthetic-hanoi", "Aurora Aesthetic Studio", "Skin & Beauty Clinic", "27 Liễu Giai, Ba Đình, Hà Nội", "skincare", "Chăm Sóc Da Căng Bóng", 560000, 920000, 80, "Làm sạch sâu, cấp ẩm và điện di tinh chất", img("1517841905240-472988babdf9"), 5.0, 121, true, false, true),
                entry("aurora-aesthetic-hanoi", "Aurora Aesthetic Studio", "Skin & Beauty Clinic", "27 Liễu Giai, Ba Đình, Hà Nội", "nails", "Chăm Sóc Móng Spa Cao Cấp", 280000, 450000, 70, "Chăm sóc da tay, móng và sơn gel an toàn", img("1604654894610-df63bc536371"), 5.0, 121, true, false, true)
        );
    }

    private List<DemoEntry> demoEntries() {
        return List.of(
                entry("venus-beauty-spa", "Venus Beauty Spa", "Spa & Chăm sóc da", "Quận 1, TP. Hồ Chí Minh", "skincare", "Chăm Sóc Da Lưng - Nặn Mụn & Làm Sạch Dịu Nhẹ", 400000, 750000, 60, "Tặng tẩy tế bào chết cà phê muối biển", img("1540555700478-4be289fbecef"), 4.9, 342, true, false, false),
                entry("lotus-wellness-clinic", "Lotus Wellness Clinic", "Clinic & Skincare", "Quận 3, TP. Hồ Chí Minh", "skincare", "Làm Sạch - Nặn Mụn Lưng Chuẩn Y Khoa Dịu Nhẹ", 350000, 600000, 75, "Sử dụng dược mỹ phẩm hữu cơ dịu nhẹ", img("1519823551278-64ac92734fb1"), 4.8, 189, true, false, false),
                entry("lotus-wellness-clinic", "Lotus Wellness Clinic", "Clinic & Skincare", "Quận 3, TP. Hồ Chí Minh", "skincare", "Triệt Lông Diode Laser Không Đau", 99000, 400000, 30, "Bảo hành trọn gói 3 năm không giới hạn", img("1522337360788-8b13dee7a37e"), 4.9, 654, true, false, false),
                entry("pink-clinic-academy", "Pink Clinic & Academy", "Clinic & Academy", "Bình Thạnh, TP. Hồ Chí Minh", "skincare", "Điều Trị Mụn Bằng Ánh Sáng Sinh Học", 99000, 250000, 45, "Kháng viêm tầng sâu không để lại thâm", img("1570172619644-dfd03ed5d881"), 5.0, 524, true, false, false),
                entry("an-mien-spa", "An Miên Spa Dưỡng Sinh", "Spa & Dưỡng sinh", "94 Nguyễn Thái Bình, Quận 1, TP. Hồ Chí Minh", "spa", "Gói Thư Giãn Toàn Thân 90 Phút", 499000, 648000, 90, "Massage đá nóng bazan và tinh dầu hoa hồng", img("1600334089648-b0d9d3028eb2"), 4.9, 680, true, true, false),
                entry("an-mien-spa", "An Miên Spa Dưỡng Sinh", "Spa & Dưỡng sinh", "94 Nguyễn Thái Bình, Quận 1, TP. Hồ Chí Minh", "spa", "Gội Dưỡng Sinh & Chăm Sóc Da Mặt", 270000, 336000, 70, "Nước thảo mộc bồ kết cô đặc 12 vị", img("1600334089648-b0d9d3028eb2"), 4.9, 890, true, true, false),
                entry("bella-beauty-clinic", "Bella Beauty Clinic", "Beauty Clinic", "Quận 7, TP. Hồ Chí Minh", "skincare", "Cấy Tinh Chất Hoa Hồng Căng Bóng Da", 599000, 1200000, 60, "Tinh chất hoa hồng Damascus hữu cơ", img("1517841905240-472988babdf9"), 5.0, 412, true, false, false),
                entry("anail-boutique", "ANAIL BOUTIQUE", "Nail & Eyelash", "137/11 Lê Văn Sỹ, Phú Nhuận, TP. Hồ Chí Minh", "nails", "Sơn Gel Móng Tay Thiết Kế Hàn Quốc", 189000, 350000, 50, "Sơn gel thạch hồng pastel cao cấp", img("1632345031435-8727f6897d53"), 4.9, 320, true, true, false),
                entry("pmt-aesthetic-clinic", "PMT Aesthetic Clinic", "Aesthetic Clinic", "Quận 1, TP. Hồ Chí Minh", "skincare", "Liệu Trình Trẻ Hóa Da Beauty Radiance", 199000, 2500000, 60, "Soi da 3D và điện di Collagen tươi", img("1544005313-94ddf0286df2"), 5.0, 780, true, false, false),
                entry("hong-sen-beauty-academy", "Hồng Sen Beauty Academy", "Phun xăm & Makeup", "Quận 10, TP. Hồ Chí Minh", "makeup", "Điêu Khắc Chân Mày Hairstroke Vi Chạm", 899000, 2800000, 90, "Bảo hành dặm miễn phí trong 6 tháng", img("1534528741775-53994a69daeb"), 5.0, 460, true, false, false),
                entry("moc-nhien-duong-sinh", "Mộc Nhiên Dưỡng Sinh Đường", "Dưỡng sinh thảo dược", "Bình Thạnh, TP. Hồ Chí Minh", "spa", "Gội Đầu Dưỡng Sinh & Massage Cổ Vai Gáy", 129000, 350000, 65, "Canh bồ kết vỏ bưởi ấm nóng", img("1519735777090-ec97162dc266"), 4.8, 512, true, false, false),
                entry("de-paris-lash-studio", "De Paris Lash Studio", "Nail & Eyelash", "Quận 3, TP. Hồ Chí Minh", "makeup", "Nối Mi Thiết Kế Baby Doll & Dưỡng Mi", 220000, 450000, 60, "Sợi mi tơ siêu nhẹ không cộm ngứa", img("1524504388940-b1c1722653e1"), 4.9, 290, true, false, false),
                entry("tinh-y-vien", "TỊNH Y VIÊN DƯỠNG THÂN", "Massage Center", "14 Trà Khúc, Tân Bình, TP. Hồ Chí Minh", "spa", "Massage Dưỡng Thân Gia Truyền", 280000, 420000, 75, "Liệu trình thư giãn và đả thông kinh lạc", img("1519494026892-80bbd2d6fd0d"), 4.8, 162, false, true, false),
                entry("euphorea-wellness", "EUPHOREA SALON & WELLNESS", "Spa & Thẩm mỹ", "392/5 Ung Văn Khiêm, Bình Thạnh, TP. Hồ Chí Minh", "spa", "Euphorea Signature Wellness", 350000, 590000, 75, "Không gian thư giãn chuẩn 5 sao", img("1515377905703-c4788e51af15"), 4.9, 310, false, true, false),
                entry("lavi-beauty-clinic", "LAVI BEAUTY CLINIC", "Thẩm mỹ viện", "330/1D Phan Đình Phùng, Phú Nhuận, TP. Hồ Chí Minh", "skincare", "Phục Hồi Da & Dưỡng Mi Collagen", 300000, 550000, 60, "Nâng niu vẻ đẹp tự nhiên", img("1560750588-73207b1ef5b8"), 4.9, 278, false, true, true),
                entry("hera-hair-artisan", "HERA HAIR ARTISAN", "Salon tóc", "88 Võ Thị Sáu, Quận 1, TP. Hồ Chí Minh", "hair", "Cắt & Tạo Kiểu Hữu Cơ", 250000, 400000, 75, "Uốn nhuộm hữu cơ theo khuôn mặt", img("1562322140-8baeececf3df"), 4.8, 195, false, true, false),
                entry("shine-dental-esthetics", "SHINE DENTAL & ESTHETICS", "Dental & Esthetics", "154 Trần Não, TP. Thủ Đức", "skincare", "Chăm Sóc Nụ Cười Thẩm Mỹ", 400000, 750000, 60, "Quy trình thẩm mỹ công nghệ Đức", img("1606811841689-23dfddce3e95"), 4.9, 184, false, true, false),
                entry("orchid-retreat", "ORCHID RETREAT & FOOT SPA", "Massage Center", "28 Đường số 7, Quận 7, TP. Hồ Chí Minh", "spa", "Foot Spa Thảo Mộc Tự Nhiên", 200000, 350000, 60, "Ngâm chân và massage phục hồi", img("1540555700478-4be289fbecef"), 4.7, 142, false, true, false),
                entry("ishine-spa", "iShine Spa - Chăm Da Khoa Học", "Spa & Skincare", "28 Đường số 1, Quận 7, TP. Hồ Chí Minh", "skincare", "Phục Hồi Da & Peel Sinh Học", 325000, 500000, 60, "Giảm 35% dịch vụ trải nghiệm", img("1527799820374-dcf8d9d4a388"), 4.8, 48, false, false, true),
                entry("anh-duong-spa", "ÁNH DƯƠNG SPA DƯỠNG SINH", "Dưỡng sinh Đông y", "15 Đường 41, Quận 4, TP. Hồ Chí Minh", "spa", "Đả Thông Kinh Lạc Vai Gáy", 250000, 450000, 75, "Tặng xông hơi thảo dược", img("1544161515-4ab6ce6db874"), 4.9, 37, false, false, true),
                entry("acne-studio-clinic", "ACNE STUDIO CLINIC", "Clinic trị liệu da", "10 Đường số 8, Quận 10, TP. Hồ Chí Minh", "skincare", "Trị Mụn & Soi Da 3D", 299000, 600000, 60, "Khám và soi da 3D miễn phí", img("1512290900672-1f5be63fa7ba"), 4.9, 29, false, false, true),
                entry("may-spa-duong-sinh", "MÂY SPA DƯỠNG SINH CỔ TRUYỀN", "Dưỡng sinh cổ truyền", "45 Đặng Thai Mai, Phú Nhuận, TP. Hồ Chí Minh", "spa", "Gội Đầu Dưỡng Sinh Ngũ Hành", 180000, 300000, 65, "Tặng xông chân thảo mộc", img("1515377905703-c4788e51af15"), 4.8, 24, false, false, true),
                entry("royal-beauty-dental", "ROYAL BEAUTY & DENTAL", "Beauty & Dental", "215 Nguyễn Đình Chiểu, Quận 3, TP. Hồ Chí Minh", "skincare", "Tẩy Trắng Răng Laser Thẩm Mỹ", 450000, 900000, 60, "Giảm 50% công nghệ Laser Mỹ", img("1606811841689-23dfddce3e95"), 4.9, 31, false, false, true)
        );
    }

    private DemoEntry entry(String slug, String supplier, String type, String address, String category,
                            String service, int price, int originalPrice, int duration, String highlight,
                            String image, double rating, int reviews, boolean featured, boolean nearby, boolean newest) {
        return new DemoEntry(slug, supplier, type, address, category, service, price, originalPrice,
                duration, highlight, image, rating, reviews, featured, nearby, newest);
    }

    private String img(String id) {
        return "https://images.unsplash.com/photo-" + id + "?auto=format&fit=crop&w=900&q=85";
    }

    private double[] demoCoordinates(String citySlug, String supplierSlug) {
        double baseLatitude = "ha-noi".equals(citySlug) ? 21.0285 : 10.7769;
        double baseLongitude = "ha-noi".equals(citySlug) ? 105.8542 : 106.7009;
        int hash = supplierSlug.hashCode();
        double latitudeOffset = (Math.floorMod(hash, 1601) - 800) / 100_000.0;
        double longitudeOffset = (Math.floorMod(hash / 1601, 1601) - 800) / 100_000.0;
        return new double[]{baseLatitude + latitudeOffset, baseLongitude + longitudeOffset};
    }

    private record DemoEntry(String supplierSlug, String supplierName, String businessType, String address,
                             String categorySlug, String serviceName, int price, int originalPrice,
                             int durationMinutes, String highlightText, String imageUrl, double rating,
                             int reviewCount, boolean featured, boolean nearby, boolean newPartner) {}
}
