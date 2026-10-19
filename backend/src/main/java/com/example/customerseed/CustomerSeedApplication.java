package com.example.customerseed;

import com.example.backend.model.UserAccount;
import com.example.backend.repository.UserAccountRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;

import javax.sql.DataSource;
import java.net.URI;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Map;

/** Explicit CLI context: no web server, application runners, payment gateway or schedulers. */
@SpringBootConfiguration
@EnableAutoConfiguration
@EntityScan(basePackageClasses = UserAccount.class)
@EnableJpaRepositories(basePackageClasses = UserAccountRepository.class)
public class CustomerSeedApplication {
    public static void run(String[] args) {
        SpringApplication app = new SpringApplication(CustomerSeedApplication.class);
        app.setWebApplicationType(WebApplicationType.NONE);
        app.addInitializers(context -> context.getEnvironment().getPropertySources().addFirst(
                new MapPropertySource("customer-seed-safety", Map.of(
                        "spring.jpa.hibernate.ddl-auto", "validate",
                        "spring.main.web-application-type", "none"))));
        try (var context = app.run(args)) {
            // Closing the isolated context also closes the database connection pool.
        }
    }

    @Bean
    PasswordEncoder customerSeedPasswordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    CustomerSeedService customerSeedService(UserAccountRepository users, PasswordEncoder encoder,
                                            PlatformTransactionManager manager) {
        return new CustomerSeedService(users, encoder, manager);
    }

    @Bean
    PractitionerSeedService practitionerSeedService(
            com.example.backend.repository.PractitionerRepository practitioners,
            com.example.backend.repository.SupplierRepository suppliers,
            com.example.backend.repository.ServiceOfferingRepository services,
            com.example.backend.repository.AvailabilityRuleRepository rules,
            jakarta.persistence.EntityManager em, PlatformTransactionManager manager) {
        return new PractitionerSeedService(practitioners, suppliers, services, rules, em, manager);
    }

    @Bean
    CommandLineRunner customerSeedRunner(Environment env, DataSource dataSource,
            CustomerSeedService seeder, PractitionerSeedService workforce, UserAccountRepository users) {
        return args -> {
            String mode = env.getProperty("customer.seed.mode", "dry-run");
            if (!mode.equals("dry-run") && !mode.equals("apply") && !mode.equals("verify")) {
                throw new IllegalArgumentException("Mode must be dry-run, apply or verify");
            }
            String manifestName = env.getRequiredProperty("customer.seed.manifest");
            String jdbcUrl;
            String database;
            try (var connection = dataSource.getConnection()) {
                jdbcUrl = connection.getMetaData().getURL();
                database = connection.getCatalog();
            }
            String host = mysqlHost(jdbcUrl);
            boolean loopback = host.equalsIgnoreCase("localhost")
                    || host.equals("127.0.0.1") || host.equals("::1");
            if (!loopback && !java.util.Objects.equals(database,
                    env.getProperty("customer.seed.expected-database")))
                throw new IllegalStateException("Remote database name must match explicit expected-database");
            System.out.printf("Seed target: host=%s database=%s mode=%s%n", host, database, mode);
            checkTarget(host, loopback,
                    env.getProperty("customer.seed.allow-remote", Boolean.class, false),
                    env.getProperty("customer.seed.expected-host", ""),
                    mode.equals("apply"),
                    Arrays.asList(env.getActiveProfiles()).contains("prod")
                            || System.getenv("RAILWAY_ENVIRONMENT") != null,
                    env.getProperty("customer.seed.allow-production", Boolean.class, false));
            if ("practitioners".equals(env.getProperty("customer.seed.dataset", "customers"))) {
                var profiles = PractitionerSeedService.manifest(Path.of(manifestName));
                var plan = workforce.run(profiles, false);
                System.out.printf("Practitioner seed: existing=%d missing=%d missing-schedules=%d conflicts=%d%n",
                        plan.existing(), PractitionerSeedService.SIZE - plan.existing(),
                        plan.missingSchedules(), plan.conflicts());
                if (plan.conflicts() != 0) throw new IllegalStateException("Practitioner conflicts; no records changed");
                if (mode.equals("apply")) {
                    if (!"CREATE_24_PRACTITIONERS".equals(env.getProperty("customer.seed.confirm-write")))
                        throw new IllegalStateException("Apply requires explicit practitioner write confirmation");
                    var result = workforce.run(profiles, true);
                    System.out.printf("Practitioner apply: existing=%d inserted=%d conflicts=%d%n",
                            result.existing(), result.inserted(), result.conflicts());
                }
                if (!mode.equals("dry-run")) {
                    var result = workforce.run(profiles, false);
                    if (result.existing() != PractitionerSeedService.SIZE || result.missingSchedules() != 0
                            || result.conflicts() != 0) throw new IllegalStateException("Practitioner verification failed");
                    System.out.println("Practitioner verification: managed=24 assignments/schedules valid");
                }
                return;
            }
            var profiles = CustomerSeedManifest.profiles(Path.of(manifestName));
            var plan = seeder.dryRun(profiles);
            System.out.printf("Customer seed %s target: existing=%d missing=%d conflicts=%d%n",
                    loopback ? "loopback" : "remote", plan.existing(),
                    CustomerSeedManifest.SIZE - plan.existing(), plan.conflicts());
            if (plan.conflicts() != 0) throw new IllegalStateException("Seed conflicts found; no records changed");
            long before = users.countByRole(com.example.backend.model.DomainEnums.Role.CUSTOMER);
            System.out.printf("Customer dashboard count: before=%d expected-after=%d%n",
                    before, before + CustomerSeedManifest.SIZE - plan.existing());
            if (mode.equals("dry-run")) return;
            String credentialName = env.getRequiredProperty("customer.seed.credentials");
            var credentials = CustomerSeedManifest.credentials(Path.of(credentialName));
            if (mode.equals("apply")) {
                if (!"CREATE_80_CUSTOMERS".equals(env.getProperty("customer.seed.confirm-write"))) {
                    throw new IllegalStateException("Apply requires explicit customer.seed.confirm-write");
                }
                var applied = seeder.apply(profiles, credentials);
                System.out.printf("Customer seed apply: existing=%d inserted=%d conflicts=%d%n",
                        applied.existing(), applied.inserted(), applied.conflicts());
            }
            var verified = seeder.verify(profiles, credentials);
            System.out.printf("Customer seed verification: present=%d active=%d matching-password-hashes=%d conflicts=%d%n",
                    verified.existing(), verified.active(), verified.validHashes(), verified.conflicts());
            if (verified.existing() != CustomerSeedManifest.SIZE
                    || verified.active() != CustomerSeedManifest.SIZE
                    || verified.validHashes() != CustomerSeedManifest.SIZE || verified.conflicts() != 0) {
                throw new IllegalStateException("Customer seed verification did not pass");
            }
        };
    }

    private static String mysqlHost(String jdbcUrl) {
        if (!jdbcUrl.startsWith("jdbc:mysql://")) {
            throw new IllegalStateException("Customer seed CLI requires a MySQL JDBC URL");
        }
        String host = URI.create(jdbcUrl.substring("jdbc:".length())).getHost();
        if (host == null || host.isBlank()) throw new IllegalStateException("Cannot identify MySQL host");
        return host;
    }

    static void checkTarget(String host, boolean loopback, boolean allowRemote, String expectedHost,
                            boolean apply, boolean production, boolean allowProduction) {
        if (!loopback && (!allowRemote || !host.equalsIgnoreCase(expectedHost))) {
            throw new IllegalStateException("Remote database requires an explicit matching expected host");
        }
        if (apply && production && !allowProduction) {
            throw new IllegalStateException("Production writes require the separate production opt-in");
        }
    }
}
