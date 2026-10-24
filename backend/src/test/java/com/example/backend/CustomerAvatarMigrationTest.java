package com.example.backend;

import org.junit.jupiter.api.Test;
import java.nio.file.*;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class CustomerAvatarMigrationTest {
    @Test void additiveColumnPreservesExistingAccountAndAllowsNull() throws Exception {
        String url = System.getenv("REVIEW_TEST_JDBC_URL");
        assumeTrue(url != null, "Requires isolated MySQL CI service");
        assertEquals("jdbc:mysql://127.0.0.1:3306/beautylink_review_test", url);
        String user = System.getenv("REVIEW_TEST_USERNAME"), password = System.getenv("REVIEW_TEST_PASSWORD");
        String database = "beautylink_avatar_migration_test";
        try (var db = DriverManager.getConnection(url, user, password); var sql = db.createStatement()) {
            sql.execute("DROP DATABASE IF EXISTS " + database); sql.execute("CREATE DATABASE " + database);
        }
        try (var db = DriverManager.getConnection(url.replace("beautylink_review_test", database), user, password); var sql = db.createStatement()) {
            sql.execute("CREATE TABLE user_accounts (id BIGINT PRIMARY KEY, full_name VARCHAR(120) NOT NULL, password_hash VARCHAR(255)) ENGINE=InnoDB");
            sql.execute("INSERT INTO user_accounts VALUES (1,'Preserved Account','unchanged-hash')");
            String ddl = Files.readString(Path.of("src/main/resources/db/migration/mysql/V20261025_01__customer_avatar.sql")).replaceAll("(?m)^--.*$", "");
            for (String statement : ddl.split(";")) if (!statement.isBlank()) sql.execute(statement);
            try (var rows = sql.executeQuery("SELECT full_name,password_hash,avatar_url FROM user_accounts WHERE id=1")) {
                assertTrue(rows.next()); assertEquals("Preserved Account", rows.getString(1));
                assertEquals("unchanged-hash", rows.getString(2)); assertNull(rows.getString(3));
            }
            sql.execute("UPDATE user_accounts SET avatar_url='https://example.com/avatar.png' WHERE id=1");
            try (var rows = sql.executeQuery("SELECT COUNT(*) FROM user_accounts WHERE avatar_url='https://example.com/avatar.png'")) {
                assertTrue(rows.next()); assertEquals(1, rows.getInt(1));
            }
        } finally {
            try (var db = DriverManager.getConnection(url, user, password); var sql = db.createStatement()) { sql.execute("DROP DATABASE " + database); }
        }
    }
}
