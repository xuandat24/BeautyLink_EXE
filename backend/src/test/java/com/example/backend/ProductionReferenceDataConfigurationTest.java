package com.example.backend;

import com.example.backend.repository.LocationRepository;
import com.example.backend.repository.ServiceCategoryRepository;
import com.example.backend.repository.SupplierRepository;
import com.example.backend.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:beautylink-prod-reference;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.jwt.secret=beautylink-production-reference-test-secret-for-hmac-sha256",
        "app.kyc.encryption-key=beautylink-production-reference-test-kyc-secret-value",
        "app.cors.allowed-origins=https://beautylink.example",
        "app.demo-data.enabled=false",
        "app.supplier.auto-verify=false"
})
@ActiveProfiles("prod")
class ProductionReferenceDataConfigurationTest {
    @Autowired LocationRepository locations;
    @Autowired ServiceCategoryRepository categories;
    @Autowired SupplierRepository suppliers;
    @Autowired UserAccountRepository users;

    @Test
    void productionWithoutDemoDataStillHasRequiredCatalogChoices() {
        assertEquals(2, locations.count());
        assertEquals(5, categories.count());
        assertEquals(0, suppliers.count());
        assertEquals(0, users.count());
    }
}
