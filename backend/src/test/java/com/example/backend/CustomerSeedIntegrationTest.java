package com.example.backend;

import com.example.backend.model.DomainEnums.AccountStatus;
import com.example.backend.model.DomainEnums.Role;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.UserAccountRepository;
import com.example.customerseed.CustomerSeedManifest;
import com.example.customerseed.CustomerSeedService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = BackendApplication.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:customer_seed_test;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.demo-data.enabled=false",
        "app.partner-catalog.enabled=false",
        "app.security.login.max-per-ip=500",
        "app.security.login.max-per-identifier=20"
})
@ActiveProfiles("test")
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class CustomerSeedIntegrationTest {
    @Autowired UserAccountRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired PlatformTransactionManager transactions;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private List<CustomerSeedManifest.Profile> profiles() throws Exception {
        return CustomerSeedManifest.profiles(Path.of("../scripts/seed-customers/customers.psv"));
    }

    private List<CustomerSeedManifest.Credential> credentials() {
        List<CustomerSeedManifest.Credential> values = new ArrayList<>();
        for (int i = 1; i <= 60; i++) {
            values.add(new CustomerSeedManifest.Credential(i, CustomerSeedManifest.email(i),
                    String.format("SeedTestPassword%03d!A", i)));
        }
        return values;
    }

    private CustomerSeedService seeder() {
        return new CustomerSeedService(users, encoder, transactions);
    }

    @Test @Order(1)
    void dryRunLeavesDatabaseUntouchedAndManifestIsThirtyPerCity() throws Exception {
        var profiles = profiles();
        assertThat(profiles).hasSize(60);
        assertThat(profiles.stream().filter(p -> p.city().equals("Hà Nội")).count()).isEqualTo(30);
        assertThat(profiles.stream().filter(p -> p.city().equals("Thành phố Hồ Chí Minh")).count()).isEqualTo(30);
        assertThat(profiles.stream().map(CustomerSeedManifest.Profile::email).distinct().count()).isEqualTo(60);
        assertThat(profiles.stream().map(CustomerSeedManifest.Profile::phone).distinct().count()).isEqualTo(60);
        assertThat(seeder().dryRun(profiles)).isEqualTo(new CustomerSeedService.Result(0, 0, 0, 0, 0));
        assertThat(users.findByEmailStartingWithIgnoreCase(CustomerSeedManifest.EMAIL_PREFIX)).isEmpty();
    }

    @Test @Order(2)
    void applyIsAtomicAndIdempotentWithCompleteCustomerProfiles() throws Exception {
        var seed = seeder();
        var inserted = seed.apply(profiles(), credentials());
        assertThat(inserted.inserted()).isEqualTo(60);
        assertThat(inserted.existing()).isZero();
        assertThat(seed.apply(profiles(), credentials()).inserted()).isZero();
        assertThat(seed.verify(profiles(), credentials()))
                .isEqualTo(new CustomerSeedService.Result(60, 0, 60, 60, 0));
        assertThat(users.findByEmailStartingWithIgnoreCase(CustomerSeedManifest.EMAIL_PREFIX))
                .allSatisfy(user -> {
                    assertThat(user.getRole()).isEqualTo(Role.CUSTOMER);
                    assertThat(user.getStatus()).isEqualTo(AccountStatus.ACTIVE);
                    assertThat(user.getGender()).isNotNull();
                    assertThat(user.getDateOfBirth()).isNotNull();
                    assertThat(user.getCreatedAt()).isNotNull();
                    assertThat(user.getUpdatedAt()).isNotNull();
                    assertThat(user.getPasswordHash()).startsWith("$2");
                    assertThat(user.getPasswordHash()).doesNotContain("SeedTestPassword");
                });
    }

    @Test @Order(3)
    void allSixtyCanLogInTwiceAndReadOnlyTheirOwnProfileAndEmptyBookingHistory() throws Exception {
        Set<Long> accountIds = new HashSet<>();
        for (int i = 1; i <= 60; i++) {
            var profile = profiles().get(i - 1);
            String password = credentials().get(i - 1).password();
            JsonNode first = login(profile.email(), password);
            String token = first.get("accessToken").asText();
            assertThat(token).isNotBlank();
            assertThat(first.at("/user/role").asText()).isEqualTo("CUSTOMER");
            long id = first.at("/user/id").asLong();
            assertThat(accountIds.add(id)).isTrue();

            JsonNode me = readJson("/api/v1/auth/me", token);
            assertThat(me.get("id").asLong()).isEqualTo(id);
            assertThat(me.get("fullName").asText()).isEqualTo(profile.fullName());
            assertThat(me.get("email").asText()).isEqualTo(profile.email());
            assertThat(me.get("phone").asText()).isEqualTo(profile.phone());
            assertThat(me.get("gender").asText()).isEqualTo(profile.gender().name());
            assertThat(me.get("dateOfBirth").asText()).isEqualTo(profile.dateOfBirth().toString());
            assertThat(me.get("role").asText()).isEqualTo("CUSTOMER");
            assertThat(readJson("/api/v1/bookings/mine", token).isArray()).isTrue();
            assertThat(readJson("/api/v1/bookings/mine", token).size()).isZero();
            assertThat(readJson("/api/v1/bookings/mine/history-status", token)
                    .get("hasPreviousBooking").asBoolean()).isFalse();

            JsonNode freshSession = login(profile.phone(), password);
            assertThat(freshSession.at("/user/id").asLong()).isEqualTo(id);
            assertThat(readJson("/api/v1/auth/me", freshSession.get("accessToken").asText())
                    .get("id").asLong()).isEqualTo(id);
        }
        assertThat(accountIds).hasSize(60);
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test @Order(4)
    void missingRecordIsRecreatedWithoutResettingOtherPasswords() throws Exception {
        var before = users.findByEmailIgnoreCase(CustomerSeedManifest.email(1)).orElseThrow();
        String originalHash = before.getPasswordHash();
        users.delete(users.findByEmailIgnoreCase(CustomerSeedManifest.email(60)).orElseThrow());
        var result = seeder().apply(profiles(), credentials());
        assertThat(result.existing()).isEqualTo(59);
        assertThat(result.inserted()).isEqualTo(1);
        assertThat(users.findByEmailIgnoreCase(CustomerSeedManifest.email(1)).orElseThrow().getPasswordHash())
                .isEqualTo(originalHash);
        assertThat(seeder().verify(profiles(), credentials()).existing()).isEqualTo(60);
    }

    @Test @Order(5)
    void conflictingReservedIdentityIsRejectedWithoutChangingOtherUsers() throws Exception {
        UserAccount original = users.findByEmailIgnoreCase(CustomerSeedManifest.email(60)).orElseThrow();
        users.delete(original);
        UserAccount unrelated = new UserAccount();
        unrelated.setFullName("Khách Hàng Khác");
        unrelated.setPhone("0390000060");
        unrelated.setEmail("unrelated-test@example.com");
        unrelated.setPasswordHash(encoder.encode("UnrelatedTestPassword1!"));
        unrelated.setRole(Role.CUSTOMER);
        unrelated.setStatus(AccountStatus.ACTIVE);
        users.saveAndFlush(unrelated);
        long id = unrelated.getId();
        String originalHash = unrelated.getPasswordHash();

        assertThat(seeder().dryRun(profiles()).conflicts()).isEqualTo(1);
        assertThatThrownBy(() -> seeder().apply(profiles(), credentials()))
                .isInstanceOf(IllegalStateException.class);
        assertThat(users.findById(id).orElseThrow().getEmail()).isEqualTo("unrelated-test@example.com");
        assertThat(users.findById(id).orElseThrow().getPasswordHash()).isEqualTo(originalHash);
        assertThat(users.findByEmailIgnoreCase(CustomerSeedManifest.email(60))).isEmpty();
        assertThat(users.findByEmailStartingWithIgnoreCase(CustomerSeedManifest.EMAIL_PREFIX)).hasSize(59);
    }

    private JsonNode login(String identifier, String password) throws Exception {
        var response = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsBytes(Map.of("identifier", identifier, "password", password))))
                .andExpect(status().isOk()).andReturn().getResponse();
        return json.readTree(response.getContentAsByteArray());
    }

    private JsonNode readJson(String path, String token) throws Exception {
        var response = mvc.perform(get(path).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse();
        return json.readTree(response.getContentAsByteArray());
    }
}
