package com.example.backend;

import org.junit.jupiter.api.Test;
import java.nio.file.*;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class WorkforceMigrationTest {
    private static final String SOURCE = "beautylink_review_test";
    private static final String TARGET = "beautylink_workforce_migration_test";

    @Test void migrationPreservesLegacyEligibilityAndAddsConstrainedAssignments() throws Exception {
        String sourceUrl = System.getenv("REVIEW_TEST_JDBC_URL");
        assumeTrue(sourceUrl != null, "isolated MySQL CI only");
        assertTrue(sourceUrl.startsWith("jdbc:mysql://127.0.0.1:3306/" + SOURCE));
        String user = System.getenv("REVIEW_TEST_USERNAME"), password = System.getenv("REVIEW_TEST_PASSWORD");
        String targetUrl = sourceUrl.replace("/" + SOURCE, "/" + TARGET);
        try (Connection admin = DriverManager.getConnection(sourceUrl, user, password);
             Statement sql = admin.createStatement()) {
            sql.execute("DROP DATABASE IF EXISTS " + TARGET);
            sql.execute("CREATE DATABASE " + TARGET + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        }
        try (Connection connection = DriverManager.getConnection(targetUrl, user, password);
             Statement sql = connection.createStatement()) {
            sql.execute("CREATE TABLE practitioners (id BIGINT PRIMARY KEY)");
            sql.execute("CREATE TABLE service_offerings (id BIGINT PRIMARY KEY)");
            sql.execute("INSERT INTO practitioners VALUES (1)");
            sql.execute("INSERT INTO service_offerings VALUES (10)");
            String migration = Files.readString(Path.of("src/main/resources/db/migration/mysql/V20261017_01__practitioner_service_assignments.sql"))
                    .replaceAll("(?m)^\\s*--.*$", "");
            for (String command : migration.split(";")) if (!command.isBlank()) sql.execute(command);
            try (ResultSet rows = sql.executeQuery("SELECT service_assignments_restricted FROM practitioners WHERE id = 1")) {
                assertTrue(rows.next()); assertFalse(rows.getBoolean(1));
            }
            sql.execute("INSERT INTO practitioner_service_assignments VALUES (1, 10)");
            assertThrows(SQLException.class, () -> sql.execute("INSERT INTO practitioner_service_assignments VALUES (1, 99)"));
        } finally {
            try (Connection admin = DriverManager.getConnection(sourceUrl, user, password);
                 Statement sql = admin.createStatement()) { sql.execute("DROP DATABASE IF EXISTS " + TARGET); }
        }
    }
}
