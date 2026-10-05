package com.example.backend;

import com.example.backend.repository.ServiceCategoryRepository;
import com.example.backend.repository.SupplierRepository;
import com.example.backend.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:beautylink-prod-demo;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.jwt.secret=beautylink-production-config-test-secret-for-hmac-sha256",
        "app.kyc.encryption-key=beautylink-production-config-test-kyc-secret-value",
        "app.otp.pepper=beautylink-production-config-test-otp-pepper-value",
        "app.security.rate-limit.backend=memory",
        "app.cors.allowed-origins=https://beautylink.example",
        "app.demo-data.enabled=true",
        "app.demo-data.password=PrivateDeployDemo123!",
        "app.supplier.auto-verify=true"
})
@ActiveProfiles("prod")
class ProductionDemoConfigurationTest {
    @Autowired ServiceCategoryRepository categories;
    @Autowired SupplierRepository suppliers;
    @Autowired UserAccountRepository users;
    @Autowired PasswordEncoder passwordEncoder;

    @Test
    void productionProfileCanExplicitlySeedTheClassroomCatalog() {
        assertEquals(5, categories.count());
        assertTrue(suppliers.count() > 1);
        assertTrue(passwordEncoder.matches("PrivateDeployDemo123!",
                users.findByPhone("0900000001").orElseThrow().getPasswordHash()));
    }
}
