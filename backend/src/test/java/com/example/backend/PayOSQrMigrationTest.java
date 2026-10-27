package com.example.backend;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.nio.charset.StandardCharsets;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="REVIEW_TEST_JDBC_URL",matches="jdbc:mysql://127\\.0\\.0\\.1:3306/beautylink_review_test")
class PayOSQrMigrationTest {
    @Test void nullableTransferColumnsPreserveExistingAttemptsAndExactProviderPayload() throws Exception {
        String url=System.getenv("REVIEW_TEST_JDBC_URL");
        if(!"jdbc:mysql://127.0.0.1:3306/beautylink_review_test".equals(url))throw new IllegalStateException("Isolated test database only");
        try(var connection=DriverManager.getConnection(url,System.getenv("REVIEW_TEST_USERNAME"),System.getenv("REVIEW_TEST_PASSWORD"));var sql=connection.createStatement()) {
            sql.execute("CREATE TABLE qr_transfer_migration_probe (id BIGINT PRIMARY KEY, amount DECIMAL(12,2) NOT NULL, status VARCHAR(20) NOT NULL)");
            try {
                sql.execute("INSERT INTO qr_transfer_migration_probe VALUES (1,25000,'PENDING')");
                String migration;
                try(var input=getClass().getResourceAsStream("/db/migration/mysql/V20261027_01__payos_transfer_details.sql")) {
                    assertNotNull(input);migration=new String(input.readAllBytes(),StandardCharsets.UTF_8).replaceAll("(?m)^--.*$","").replace("ALTER TABLE payment_transactions","ALTER TABLE qr_transfer_migration_probe").strip();
                }
                sql.execute(migration);
                try(var result=sql.executeQuery("SELECT amount,status,qr_code,bank_bin,bank_account_number,bank_account_name,transfer_description FROM qr_transfer_migration_probe WHERE id=1")) {
                    assertTrue(result.next());assertEquals(25000,result.getBigDecimal(1).intValueExact());assertEquals("PENDING",result.getString(2));
                    for(int column=3;column<=7;column++)assertNull(result.getString(column));
                }
                try(var update=connection.prepareStatement("UPDATE qr_transfer_migration_probe SET qr_code=?,bank_bin=?,bank_account_number=?,bank_account_name=?,transfer_description=? WHERE id=1")) {
                    update.setString(1,TestPayOSQr.payload(25000));update.setString(2,"TEST-BIN");update.setString(3,"TEST-ACCOUNT");update.setString(4,null);update.setString(5,"TEST ONLY");assertEquals(1,update.executeUpdate());
                }
                try(var result=sql.executeQuery("SELECT qr_code,bank_account_name FROM qr_transfer_migration_probe WHERE id=1")) {assertTrue(result.next());assertEquals(TestPayOSQr.payload(25000),result.getString(1));assertNull(result.getString(2));}
            } finally {sql.execute("DROP TABLE qr_transfer_migration_probe");}
        }
    }
}
