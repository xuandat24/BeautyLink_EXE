package com.example.backend;

import com.example.backend.model.*;
import com.example.backend.repository.*;
import com.example.backend.service.*;
import com.example.customerseed.PractitionerSeedService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import java.nio.file.Path;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static com.example.backend.model.DomainEnums.*;
import static org.assertj.core.api.Assertions.*;

@DataJpaTest(properties = {"spring.jpa.show-sql=false", "logging.level.org.hibernate.SQL=OFF"})
@ActiveProfiles("test")
class PractitionerSeedTest {
    @Autowired PractitionerRepository practitioners;
    @Autowired SupplierRepository suppliers;
    @Autowired ServiceOfferingRepository services;
    @Autowired AvailabilityRuleRepository rules;
    @Autowired UserAccountRepository users;
    @Autowired ServiceCategoryRepository categories;
    @Autowired ScheduleExceptionRepository exceptions;
    @Autowired BookingRepository bookings;
    @Autowired EntityManager em;
    @Autowired PlatformTransactionManager manager;

    @Test
    void twentyFourManagedPeopleAreBookableIdempotentAndLeaveRealWorkforceUntouched() throws Exception {
        var profiles = PractitionerSeedService.manifest(Path.of("../scripts/seed-customers/practitioners.psv"));
        var category = new ServiceCategory(); category.setName("Seed test"); category.setSlug("seed-test");
        categories.save(category);
        int number = 0;
        for (var slug : profiles.stream().map(PractitionerSeedService.Profile::supplierSlug).distinct().toList()) {
            var owner = new UserAccount(); owner.setFullName("Chủ Cơ Sở"); owner.setPhone("090010" + String.format("%04d", ++number));
            owner.setRole(Role.SUPPLIER); owner.setPasswordHash("unused-test-hash"); users.save(owner);
            var supplier = new Supplier(); supplier.setOwner(owner); supplier.setName(slug); supplier.setSlug(slug);
            supplier.setAddressLine("Địa chỉ kiểm thử"); supplier.setVerificationStatus(VerificationStatus.VERIFIED); suppliers.save(supplier);
            var service = new ServiceOffering(); service.setSupplier(supplier); service.setCategory(category);
            service.setName("Dịch vụ kiểm thử"); service.setDurationMinutes(60); service.setPrice(BigDecimal.valueOf(100000)); services.save(service);
        }
        var real = new Practitioner(); real.setSupplier(suppliers.findAll().getFirst()); real.setDisplayName("Nhân Viên Hiện Hữu");
        real.setBio("Unmanaged profile"); practitioners.save(real);
        var seed = new PractitionerSeedService(practitioners, suppliers, services, rules, em, manager);
        assertThat(seed.run(profiles, false)).isEqualTo(new PractitionerSeedService.Result(0, 0, 168, 0));
        assertThat(practitioners.count()).isEqualTo(1);
        assertThat(seed.run(profiles, true).inserted()).isEqualTo(24);
        assertThat(seed.run(profiles, true)).isEqualTo(new PractitionerSeedService.Result(24, 0, 0, 0));
        assertThat(practitioners.count()).isEqualTo(25);
        assertThat(real.getBio()).isEqualTo("Unmanaged profile");
        var availability = new AvailabilityService(practitioners, services, rules, exceptions, bookings,
                new BookingCompletionPolicy(Clock.fixed(Instant.parse("2026-10-19T00:00:00Z"), ZoneOffset.UTC)));
        int checked = 0;
        for (var p : practitioners.findAll()) {
            if (p.getBio() == null || !p.getBio().startsWith(PractitionerSeedService.MARKER)) continue;
            assertThat(p.isActive()).isTrue();
            assertThat(p.isServiceAssignmentsRestricted()).isTrue();
            assertThat(p.getSupportedServices()).isNotEmpty();
            assertThat(rules.findByPractitionerIdOrderByDayOfWeek(p.getId())).hasSize(7);
            var service = p.getSupportedServices().iterator().next();
            var slots = availability.availability(service.getId(), p.getId(), LocalDate.of(2026, 10, 20)).availableSlots();
            assertThat(slots).contains(LocalTime.of(9, 0), LocalTime.of(13, 0));
            assertThat(slots).doesNotContain(LocalTime.of(12, 0), LocalTime.of(11, 30));
            checked++;
        }
        assertThat(checked).isEqualTo(24);
        // Missing schedules on managed rows can be repaired; unmarked workforce is untouched.
        var managed = practitioners.findAll().stream().filter(p -> p.getBio() != null
                && p.getBio().startsWith(PractitionerSeedService.MARKER)).findFirst().orElseThrow();
        rules.delete(rules.findByPractitionerIdOrderByDayOfWeek(managed.getId()).getFirst()); rules.flush();
        assertThat(seed.run(profiles, true).missingSchedules()).isEqualTo(1);
        assertThat(real.getBio()).isEqualTo("Unmanaged profile");
    }

    @Test
    void missingSuppliersFailClosedWithoutCreatingWorkforce() throws Exception {
        var profiles = PractitionerSeedService.manifest(Path.of("../scripts/seed-customers/practitioners.psv"));
        var seed = new PractitionerSeedService(practitioners, suppliers, services, rules, em, manager);
        assertThat(seed.run(profiles, false).conflicts()).isEqualTo(24);
        assertThatThrownBy(() -> seed.run(profiles, true)).isInstanceOf(IllegalStateException.class);
        assertThat(practitioners.count()).isZero();
    }
}
