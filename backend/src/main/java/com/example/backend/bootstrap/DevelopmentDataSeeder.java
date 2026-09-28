package com.example.backend.bootstrap;

import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static com.example.backend.model.DomainEnums.*;

@Component
@ConditionalOnProperty(name = "app.demo-data.enabled", havingValue = "true", matchIfMissing = true)
@Order(2)
public class DevelopmentDataSeeder implements CommandLineRunner {
    private final UserAccountRepository users; private final LocationRepository locations; private final ServiceCategoryRepository categories;
    private final SupplierRepository suppliers; private final PractitionerRepository practitioners; private final ServiceOfferingRepository services;
    private final AvailabilityRuleRepository rules; private final PasswordEncoder encoder; private final String demoPassword;
    public DevelopmentDataSeeder(UserAccountRepository users, LocationRepository locations, ServiceCategoryRepository categories, SupplierRepository suppliers, PractitionerRepository practitioners, ServiceOfferingRepository services, AvailabilityRuleRepository rules, PasswordEncoder encoder,
                                 @Value("${app.demo-data.password}") String demoPassword) {
        this.users = users; this.locations = locations; this.categories = categories; this.suppliers = suppliers; this.practitioners = practitioners; this.services = services; this.rules = rules; this.encoder = encoder; this.demoPassword = demoPassword;
    }
    @Override @Transactional public void run(String... args) {
        if (demoPassword == null || demoPassword.length() < 8) {
            throw new IllegalStateException("DEMO_ACCOUNT_PASSWORD must contain at least 8 characters when demo data is enabled");
        }
        seedAccounts(); if (suppliers.count() > 0) return;
        Location hcm = location("Thành phố Hồ Chí Minh", "ho-chi-minh", LocationType.PROVINCE_CITY, null);
        Location hanoi = location("Hà Nội", "ha-noi", LocationType.PROVINCE_CITY, null);
        Location danang = location("Đà Nẵng", "da-nang", LocationType.PROVINCE_CITY, null);
        Location q1 = location("Quận 1", "quan-1", LocationType.DISTRICT, hcm);
        Location benNghe = location("Phường Bến Nghé", "ben-nghe", LocationType.WARD_COMMUNE, q1);
        location("Phường Đa Kao", "da-kao", LocationType.WARD_COMMUNE, q1);
        Location hoanKiem = location("Quận Hoàn Kiếm", "hoan-kiem", LocationType.DISTRICT, hanoi);
        location("Phường Tràng Tiền", "trang-tien", LocationType.WARD_COMMUNE, hoanKiem);
        Location haiChau = location("Quận Hải Châu", "hai-chau", LocationType.DISTRICT, danang);
        location("Phường Hải Châu", "phuong-hai-chau", LocationType.WARD_COMMUNE, haiChau);

        Map<String, ServiceCategory> cats = new LinkedHashMap<>();
        cats.put("makeup", category("makeup", "Trang điểm", "Makeup cá nhân, cô dâu và sự kiện theo phong cách riêng.", "https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=900&q=85", 1));
        cats.put("hair", category("hair", "Làm tóc", "Cắt, nhuộm, uốn và tạo kiểu bởi stylist được xác minh.", "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=900&q=85", 2));
        cats.put("spa", category("spa", "Spa & Massage", "Liệu trình thư giãn và phục hồi cơ thể.", "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=900&q=85", 3));
        cats.put("nails", category("nails", "Nail", "Chăm sóc móng và thiết kế nail theo xu hướng.", "https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=900&q=85", 4));
        cats.put("skincare", category("skincare", "Chăm sóc da", "Liệu trình da mặt được cá nhân hóa.", "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=900&q=85", 5));

        UserAccount owner = users.findByPhone("0900000002").orElseThrow();
        Supplier supplier = new Supplier(); supplier.setOwner(owner); supplier.setName("Lumière Beauty House"); supplier.setSlug("lumiere-beauty-house");
        supplier.setBusinessType("Studio làm đẹp đa dịch vụ");
        supplier.setDescription("Không gian làm đẹp tuyển chọn với đội ngũ chuyên viên giàu kinh nghiệm."); supplier.setLocation(benNghe); supplier.setAddressLine("18 Lê Thánh Tôn, Phường Bến Nghé");
        supplier.setLatitude(10.7786); supplier.setLongitude(106.7044);
        supplier.setImageUrl("https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=85"); supplier.setVerificationStatus(VerificationStatus.VERIFIED); supplier.setRating(4.9); supplier.setReviewCount(248); suppliers.save(supplier);
        Practitioner linh = practitioner(supplier, "Nguyễn Ngọc Linh", "Makeup artist & skincare specialist", "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80");
        Practitioner minh = practitioner(supplier, "Trần Gia Minh", "Hair stylist", "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80");
        offering(supplier, cats.get("makeup"), "Makeup trong trẻo cá nhân", "Lớp nền mỏng nhẹ, tư vấn tone màu và kiểu trang điểm phù hợp.", 450000, 90, cats.get("makeup").getImageUrl());
        offering(supplier, cats.get("makeup"), "Makeup cô dâu thử layout", "Thiết kế layout cô dâu, thử nền và màu sắc trước ngày cưới.", 950000, 150, "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=85");
        offering(supplier, cats.get("hair"), "Cắt & tạo kiểu cá nhân", "Tư vấn kiểu tóc theo khuôn mặt, gội và tạo kiểu hoàn thiện.", 380000, 75, cats.get("hair").getImageUrl());
        offering(supplier, cats.get("spa"), "Massage thư giãn toàn thân", "Liệu trình 90 phút giúp thư giãn và phục hồi năng lượng.", 620000, 90, cats.get("spa").getImageUrl());
        offering(supplier, cats.get("nails"), "Nail gel thiết kế", "Chăm móng, sơn gel và thiết kế tối đa bốn ngón.", 320000, 75, cats.get("nails").getImageUrl());
        offering(supplier, cats.get("skincare"), "Chăm sóc da phục hồi", "Làm sạch sâu, cấp ẩm và phục hồi hàng rào bảo vệ da.", 580000, 90, cats.get("skincare").getImageUrl());
        for (Practitioner p : List.of(linh, minh)) for (DayOfWeek day : DayOfWeek.values()) if (day != DayOfWeek.SUNDAY) rule(p, day, LocalTime.of(9, 0), LocalTime.of(19, 0));
    }
    private void seedAccounts() {
        account("Khách hàng Demo", "0900000001", "customer@beautylink.vn", demoPassword, Role.CUSTOMER);
        account("Lumière Owner", "0900000002", "supplier@beautylink.vn", demoPassword, Role.SUPPLIER);
        account("Nhân viên Hỗ trợ", "0900000003", "staff@beautylink.vn", demoPassword, Role.STAFF);
        account("Quản trị BeautyLink", "0900000004", "admin@beautylink.vn", demoPassword, Role.ADMIN);
    }
    private UserAccount account(String name, String phone, String email, String password, Role role) {
        UserAccount account = users.findByPhone(phone).orElseGet(UserAccount::new);
        account.setFullName(name); account.setPhone(phone); account.setEmail(email);
        account.setPasswordHash(encoder.encode(password)); account.setRole(role); account.setStatus(AccountStatus.ACTIVE);
        return users.save(account);
    }
    private Location location(String name, String slug, LocationType type, Location parent) { Location l = locations.findBySlug(slug).orElseGet(Location::new); l.setName(name); l.setSlug(slug); l.setType(type); l.setParent(parent); l.setActive(true); return locations.save(l); }
    private ServiceCategory category(String slug, String name, String description, String image, int order) { ServiceCategory c = categories.findBySlug(slug).orElseGet(ServiceCategory::new); c.setSlug(slug); c.setName(name); c.setDescription(description); c.setImageUrl(image); c.setDisplayOrder(order); c.setActive(true); return categories.save(c); }
    private Practitioner practitioner(Supplier supplier, String name, String specialty, String avatar) { Practitioner p = new Practitioner(); p.setSupplier(supplier); p.setDisplayName(name); p.setSpecialty(specialty); p.setAvatarUrl(avatar); return practitioners.save(p); }
    private void offering(Supplier supplier, ServiceCategory category, String name, String description, int price, int duration, String image) { ServiceOffering s = new ServiceOffering(); s.setSupplier(supplier); s.setCategory(category); s.setName(name); s.setDescription(description); s.setPrice(BigDecimal.valueOf(price)); s.setDurationMinutes(duration); s.setImageUrl(image); services.save(s); }
    private void rule(Practitioner p, DayOfWeek day, LocalTime start, LocalTime end) { AvailabilityRule r = new AvailabilityRule(); r.setPractitioner(p); r.setDayOfWeek(day); r.setStartTime(start); r.setEndTime(end); r.setBreakStart(LocalTime.of(12, 0)); r.setBreakEnd(LocalTime.of(13, 0)); r.setSlotMinutes(30); rules.save(r); }
}
