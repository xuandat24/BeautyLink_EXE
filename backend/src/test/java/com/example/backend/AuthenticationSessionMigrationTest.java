package com.example.backend;

import org.junit.jupiter.api.Test;
import java.nio.file.*;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class AuthenticationSessionMigrationTest {
    @Test void additiveMysqlMigrationPreservesAccountsAndEnforcesSessionForeignKey() throws Exception {
        String url = System.getenv("REVIEW_TEST_JDBC_URL");
        assumeTrue(url != null, "Requires isolated MySQL CI service");
        assertEquals("jdbc:mysql://127.0.0.1:3306/beautylink_review_test", url,
                "Refuse migration test outside dedicated loopback test database");
        String user = System.getenv("REVIEW_TEST_USERNAME"), password = System.getenv("REVIEW_TEST_PASSWORD");
        String database = "beautylink_auth_migration_test";
        try (var connection = DriverManager.getConnection(url, user, password); var sql = connection.createStatement()) {
            sql.execute("DROP DATABASE IF EXISTS " + database);
            sql.execute("CREATE DATABASE " + database + " CHARACTER SET utf8mb4");
        }
        try (var connection = DriverManager.getConnection(url.replace("beautylink_review_test", database), user, password);
             var sql = connection.createStatement()) {
            sql.execute("CREATE TABLE user_accounts (id BIGINT PRIMARY KEY, full_name VARCHAR(120) NOT NULL) ENGINE=InnoDB");
            sql.execute("INSERT INTO user_accounts VALUES (1, 'Preserved account')");
            String ddl = Files.readString(Path.of("src/main/resources/db/migration/mysql/V20261024_01__authentication_sessions.sql"))
                    .replaceAll("(?m)^--.*$", "");
            for (String statement : ddl.split(";")) if (!statement.isBlank()) sql.execute(statement);
            try (var result = sql.executeQuery("SELECT COUNT(*) FROM user_accounts WHERE id=1 AND full_name='Preserved account'")) {
                assertTrue(result.next()); assertEquals(1, result.getInt(1));
            }
            sql.execute("INSERT INTO authentication_sessions VALUES ('11111111-1111-4111-8111-111111111111',1,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 HOUR),0)");
            assertThrows(SQLException.class, () -> sql.execute("INSERT INTO authentication_sessions VALUES ('22222222-2222-4222-8222-222222222222',99,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),0)"));
            try (var result = sql.executeQuery("SELECT COUNT(*) FROM authentication_sessions WHERE revoked=0 AND expires_at>created_at")) {
                assertTrue(result.next()); assertEquals(1, result.getInt(1));
            }
        } finally {
            try (var connection = DriverManager.getConnection(url, user, password); var sql = connection.createStatement()) {
                sql.execute("DROP DATABASE " + database);
            }
        }
    }
}
