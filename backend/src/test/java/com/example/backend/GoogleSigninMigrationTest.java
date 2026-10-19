package com.example.backend;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class GoogleSigninMigrationTest {
    private static final String SOURCE_DATABASE = "beautylink_review_test";
    private static final String MIGRATION_DATABASE = "beautylink_google_migration_test";

    @Test
    void forwardMigrationRunsAgainstIsolatedMysqlAndPreservesExistingAccounts() throws Exception {
        String sourceUrl = System.getenv("REVIEW_TEST_JDBC_URL");
        assumeTrue(sourceUrl != null, "MySQL migration test only runs in the isolated CI job");
        assertTrue(sourceUrl.startsWith("jdbc:mysql://127.0.0.1:3306/" + SOURCE_DATABASE),
                "Refusing to run migration test outside the isolated loopback database");

        String username = System.getenv("REVIEW_TEST_USERNAME");
        String password = System.getenv("REVIEW_TEST_PASSWORD");
        String migrationUrl = sourceUrl.replace("/" + SOURCE_DATABASE, "/" + MIGRATION_DATABASE);

        try (Connection admin = DriverManager.getConnection(sourceUrl, username, password);
             Statement statement = admin.createStatement()) {
            statement.execute("DROP DATABASE IF EXISTS " + MIGRATION_DATABASE);
            statement.execute("CREATE DATABASE " + MIGRATION_DATABASE
                    + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        }

        try (Connection connection = DriverManager.getConnection(migrationUrl, username, password)) {
            createLegacySchema(connection);
            executeSqlFile(connection, Path.of("src/main/resources/db/migration/mysql/"
                    + "V20261016_01__google_identity_and_deferred_profile.sql"));

            try (Statement statement = connection.createStatement()) {
                try (ResultSet columns = statement.executeQuery("""
                        SELECT column_name, is_nullable
                        FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'user_accounts'
                          AND column_name IN ('phone', 'password_hash')
                        ORDER BY column_name
                        """)) {
                    int nullableColumns = 0;
                    while (columns.next()) {
                        assertEquals("YES", columns.getString("is_nullable"));
                        nullableColumns++;
                    }
                    assertEquals(2, nullableColumns);
                }

                try (ResultSet existing = statement.executeQuery("""
                        SELECT booking_contact_confirmation_required,
                               booking_contact_confirmed_phone,
                               booking_contact_confirmed_at
                        FROM user_accounts WHERE id = 1
                        """)) {
                    assertTrue(existing.next());
                    assertEquals(false, existing.getBoolean(1));
                    assertEquals("0901234567", existing.getString(2));
                    assertNotNull(existing.getTimestamp(3));
                }

                statement.executeUpdate("""
                        INSERT INTO user_accounts
                          (id, phone, password_hash, email, full_name, role, status, created_at, updated_at,
                           booking_contact_confirmation_required)
                        VALUES
                          (2, NULL, NULL, 'google@example.test', 'Google Customer', 'CUSTOMER', 'ACTIVE',
                           CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), b'1')
                        """);
                statement.executeUpdate("""
                        INSERT INTO external_identities
                          (user_account_id, provider, provider_subject, created_at)
                        VALUES (2, 'GOOGLE', 'google-subject-1', CURRENT_TIMESTAMP(6))
                        """);

                assertThrows(SQLException.class, () -> statement.executeUpdate("""
                        INSERT INTO external_identities
                          (user_account_id, provider, provider_subject, created_at)
                        VALUES (2, 'GOOGLE', 'google-subject-2', CURRENT_TIMESTAMP(6))
                        """));
                assertThrows(SQLException.class, () -> statement.executeUpdate("""
                        INSERT INTO external_identities
                          (user_account_id, provider, provider_subject, created_at)
                        VALUES (1, 'GOOGLE', 'google-subject-1', CURRENT_TIMESTAMP(6))
                        """));
            }
        } finally {
            try (Connection admin = DriverManager.getConnection(sourceUrl, username, password);
                 Statement statement = admin.createStatement()) {
                statement.execute("DROP DATABASE IF EXISTS " + MIGRATION_DATABASE);
            }
        }
    }

    private static void createLegacySchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TABLE user_accounts (
                      id BIGINT NOT NULL AUTO_INCREMENT,
                      phone VARCHAR(20) NOT NULL,
                      password_hash VARCHAR(255) NOT NULL,
                      email VARCHAR(255) NOT NULL,
                      full_name VARCHAR(255) NOT NULL,
                      role VARCHAR(30) NOT NULL,
                      status VARCHAR(30) NOT NULL,
                      created_at DATETIME(6) NOT NULL,
                      updated_at DATETIME(6) NOT NULL,
                      PRIMARY KEY (id),
                      UNIQUE KEY uk_user_account_phone (phone),
                      UNIQUE KEY uk_user_account_email (email)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """);
            statement.executeUpdate("""
                    INSERT INTO user_accounts
                      (id, phone, password_hash, email, full_name, role, status, created_at, updated_at)
                    VALUES
                      (1, '0901234567', '$2a$10$legacy.hash.for.migration.test', 'local@example.test',
                       'Existing Customer', 'CUSTOMER', 'ACTIVE', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
                    """);
        }
    }

    private static void executeSqlFile(Connection connection, Path path) throws Exception {
        String sql = Files.readString(path).replaceAll("(?m)^\\s*--.*$", "");
        try (Statement statement = connection.createStatement()) {
            for (String command : sql.split(";")) {
                if (!command.isBlank()) statement.execute(command);
            }
        }
    }
}
