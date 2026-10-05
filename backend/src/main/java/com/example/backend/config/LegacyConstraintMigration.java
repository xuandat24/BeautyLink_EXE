package com.example.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.*;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Removes the two legacy uniqueness constraints that prevented cancelled slots
 * from being reused and prevented append-only payment attempts. This is an
 * intentionally narrow, idempotent migration for existing MySQL deployments.
 */
@Component
public class LegacyConstraintMigration implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(LegacyConstraintMigration.class);
    private static final Pattern SAFE_IDENTIFIER = Pattern.compile("[A-Za-z0-9_$]+");
    private final DataSource dataSource;
    private final boolean enabled;

    public LegacyConstraintMigration(DataSource dataSource,
            @Value("${app.database.legacy-constraint-migration-enabled:true}") boolean enabled) {
        this.dataSource = dataSource;
        this.enabled = enabled;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        if (!enabled) return;
        try (Connection connection = dataSource.getConnection()) {
            String product = connection.getMetaData().getDatabaseProductName();
            if (product == null || !product.toLowerCase(Locale.ROOT).contains("mysql")) {
                log.debug("Legacy constraint migration skipped for database={}", product);
                return;
            }
            String schema = connection.getCatalog();
            acquireMigrationLock(connection);
            try {
                // Create replacements first: MySQL may use the legacy unique indexes to support foreign keys.
                ensureNonUniqueIndex(connection, schema, "payment_transactions", "idx_payment_booking_attempts_v2", List.of("booking_id", "created_at"));
                ensureNonUniqueIndex(connection, schema, "bookings", "idx_booking_practitioner_slot_v2",
                        List.of("practitioner_id", "appointment_date", "start_time"));
                dropExactUniqueIndex(connection, schema, "payment_transactions", List.of("booking_id"));
                dropExactUniqueIndex(connection, schema, "bookings", List.of("practitioner_id", "appointment_date", "start_time"));
            } finally {
                releaseMigrationLock(connection);
            }
        }
    }

    private void acquireMigrationLock(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("SELECT GET_LOCK(?, 30)")) {
            statement.setString(1, "beautylink_legacy_constraint_v1");
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next() || result.getInt(1) != 1) throw new SQLException("Could not acquire BeautyLink schema migration lock");
            }
        }
    }

    private void releaseMigrationLock(Connection connection) {
        try (PreparedStatement statement = connection.prepareStatement("SELECT RELEASE_LOCK(?)")) {
            statement.setString(1, "beautylink_legacy_constraint_v1");
            statement.executeQuery();
        } catch (SQLException exception) {
            log.warn("Could not explicitly release schema migration lock; MySQL will release it with the connection");
        }
    }

    private void dropExactUniqueIndex(Connection connection, String schema, String table, List<String> columns) throws SQLException {
        for (IndexDefinition index : indexes(connection, schema, table)) {
            if (index.unique && !"PRIMARY".equalsIgnoreCase(index.name) && index.columns.equals(columns)) {
                execute(connection, "ALTER TABLE " + quote(table) + " DROP INDEX " + quote(index.name));
                log.info("Removed legacy unique index table={} index={}", table, index.name);
            }
        }
    }

    private void ensureNonUniqueIndex(Connection connection, String schema, String table, String name, List<String> columns) throws SQLException {
        boolean present = indexes(connection, schema, table).stream()
                .anyMatch(index -> !index.unique && index.columns.equals(columns));
        if (!present) {
            String joined = columns.stream().map(this::quote).reduce((a, b) -> a + "," + b).orElseThrow();
            execute(connection, "CREATE INDEX " + quote(name) + " ON " + quote(table) + " (" + joined + ")");
            log.info("Created supporting index table={} index={}", table, name);
        }
    }

    private List<IndexDefinition> indexes(Connection connection, String schema, String table) throws SQLException {
        Map<String, IndexDefinition> result = new LinkedHashMap<>();
        String sql = "SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX " +
                "FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY INDEX_NAME, SEQ_IN_INDEX";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, schema);
            statement.setString(2, table);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    String name = rows.getString("INDEX_NAME");
                    IndexDefinition definition = result.computeIfAbsent(name,
                            ignored -> new IndexDefinition(name, rowsBoolean(rows, "NON_UNIQUE") == false));
                    definition.columns.add(rows.getString("COLUMN_NAME").toLowerCase(Locale.ROOT));
                }
            }
        }
        return new ArrayList<>(result.values());
    }

    private boolean rowsBoolean(ResultSet rows, String column) {
        try { return rows.getBoolean(column); }
        catch (SQLException exception) { throw new IllegalStateException(exception); }
    }

    private void execute(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement()) { statement.execute(sql); }
    }

    private String quote(String identifier) {
        if (!SAFE_IDENTIFIER.matcher(identifier).matches()) throw new IllegalArgumentException("Unsafe SQL identifier");
        return "`" + identifier + "`";
    }

    private static final class IndexDefinition {
        private final String name;
        private final boolean unique;
        private final List<String> columns = new ArrayList<>();
        private IndexDefinition(String name, boolean unique) { this.name = name; this.unique = unique; }
    }
}
