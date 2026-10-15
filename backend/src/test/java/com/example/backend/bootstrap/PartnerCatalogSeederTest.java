package com.example.backend.bootstrap;

import com.example.backend.model.ServiceOffering;
import com.example.backend.model.Supplier;
import com.example.backend.repository.AvailabilityRuleRepository;
import com.example.backend.repository.PractitionerRepository;
import com.example.backend.repository.ServiceOfferingRepository;
import com.example.backend.repository.SupplierRepository;
import com.example.backend.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static com.example.backend.model.DomainEnums.AccountStatus.DISABLED;
import static com.example.backend.model.DomainEnums.Role.SUPPLIER;
import static com.example.backend.model.DomainEnums.VerificationStatus.VERIFIED;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:partner-catalog;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.demo-data.enabled=false",
        "app.partner-catalog.enabled=true"
})
@ActiveProfiles("test")
@DirtiesContext
class PartnerCatalogSeederTest {
    @Autowired PartnerCatalogSeeder seeder;
    @Autowired SupplierRepository suppliers;
    @Autowired ServiceOfferingRepository services;
    @Autowired UserAccountRepository users;
    @Autowired PractitionerRepository practitioners;
    @Autowired AvailabilityRuleRepository availabilityRules;

    @Test
    void importsWorkbookPartnersOnceWithDistinctServiceImagesAndSafeOwners() throws Exception {
        assertEquals(10, suppliers.count());
        assertEquals(77, services.count());
        assertEquals(3, services.findAll().stream().filter(service -> service.getPrice().signum() == 0).count());

        List<String> images = services.findAll().stream().map(ServiceOffering::getImageUrl).toList();
        assertTrue(images.stream().allMatch(image -> image != null && image.startsWith("https://")));
        assertEquals(77, images.stream().distinct().count());

        for (PartnerCatalogData.PartnerEntry entry : PartnerCatalogData.partners()) {
            Supplier supplier = suppliers.findBySlug(entry.slug()).orElseThrow();
            assertEquals(VERIFIED, supplier.getVerificationStatus());
            assertFalse(supplier.isDemoData());
            assertEquals(entry.services().size(), services.findBySupplierIdAndActiveTrue(supplier.getId()).size());
            var people = practitioners.findBySupplierIdAndActiveTrue(supplier.getId());
            assertEquals(1, people.size());
            assertEquals(7, availabilityRules.findByPractitionerIdOrderByDayOfWeek(people.getFirst().getId()).size());
        }

        assertEquals(10, users.findByRole(SUPPLIER).size());
        assertTrue(users.findByRole(SUPPLIER).stream().allMatch(user -> user.getStatus() == DISABLED));

        seeder.run();
        assertEquals(10, suppliers.count());
        assertEquals(77, services.count());
    }
}
