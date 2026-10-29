package com.example.backend;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.WebApplicationType;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** Manual SQL against a disposable clone of previous-release non-Community tables. */
@SpringBootTest(properties={"app.demo-data.enabled=false","app.partner-catalog.enabled=false"})
@ActiveProfiles("test") @DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
@EnabledIfEnvironmentVariable(named="REVIEW_TEST_JDBC_URL",matches="jdbc:mysql://127\\.0\\.0\\.1:3306/beautylink_review_test")
class CommunityMigrationTest {
    private static final String SOURCE="jdbc:mysql://127.0.0.1:3306/beautylink_review_test";
    private static final String SCHEMA="beautylink_community_migration_test";
    @DynamicPropertySource static void database(DynamicPropertyRegistry p) {
        if(!SOURCE.equals(System.getenv("REVIEW_TEST_JDBC_URL")))throw new IllegalStateException("Isolated MySQL only");
        p.add("spring.datasource.url",()->SOURCE);p.add("spring.datasource.driver-class-name",()->"com.mysql.cj.jdbc.Driver");
        p.add("spring.datasource.username",()->System.getenv("REVIEW_TEST_USERNAME"));p.add("spring.datasource.password",()->System.getenv("REVIEW_TEST_PASSWORD"));
    }
    private long count(Statement s,String table)throws SQLException {try(var r=s.executeQuery("SELECT COUNT(*) FROM `"+table+"`")){r.next();return r.getLong(1);}}
    @Test void additiveMigrationIsRepeatablePreservesOldRowsAndMatchesHibernate()throws Exception {
        String user=System.getenv("REVIEW_TEST_USERNAME"),password=System.getenv("REVIEW_TEST_PASSWORD");
        try(var source=DriverManager.getConnection(SOURCE,user,password);var sql=source.createStatement()) {
            var tables=new ArrayList<String>();
            try(var r=sql.executeQuery("SHOW TABLES")){while(r.next()){String name=r.getString(1);assertTrue(name.matches("[a-z_]+"));if(!name.startsWith("community_"))tables.add(name);}}
            assertTrue(tables.containsAll(List.of("user_accounts","bookings","payment_transactions","suppliers","practitioners")));
            sql.execute("CREATE DATABASE "+SCHEMA+" CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"); // Refuse to overwrite any existing database.
            try(var target=DriverManager.getConnection("jdbc:mysql://127.0.0.1:3306/"+SCHEMA,user,password);var dest=target.createStatement()) {
                dest.execute("SET FOREIGN_KEY_CHECKS=0");
                for(String table:tables) {
                    try(var r=sql.executeQuery("SHOW CREATE TABLE `"+table+"`")){r.next();dest.execute(r.getString(2));}
                    dest.execute("INSERT INTO `"+table+"` SELECT * FROM beautylink_review_test.`"+table+"`");
                }
                dest.execute("SET FOREIGN_KEY_CHECKS=1");
                dest.execute("INSERT INTO user_accounts(full_name,email,password_hash,role,status,created_at,updated_at,auth_version,loyalty_points,booking_contact_confirmation_required) VALUES('Migration synthetic','community-migration@example.com','synthetic-hash','CUSTOMER','ACTIVE',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),0,0,false)");
                var before=new HashMap<String,Long>();for(String table:tables)before.put(table,count(dest,table));
                String migration;try(var in=getClass().getResourceAsStream("/db/migration/mysql/V20261030_01__community.sql")){assertNotNull(in);migration=new String(in.readAllBytes(),StandardCharsets.UTF_8).replaceAll("(?m)^--.*$","");}
                for(int pass=0;pass<2;pass++)for(String statement:migration.split(";"))if(!statement.isBlank())dest.execute(statement.trim());
                for(String table:tables)assertEquals(before.get(table),count(dest,table),"Old table changed: "+table);
                try(var r=dest.executeQuery("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='"+SCHEMA+"' AND table_name LIKE 'community_%'")){r.next();assertEquals(7,r.getInt(1));}
                try(var r=dest.executeQuery("SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema='"+SCHEMA+"' AND table_name LIKE 'community_%'")){r.next();assertEquals(18,r.getInt(1));}
                long uid;try(var r=dest.executeQuery("SELECT id FROM user_accounts WHERE email='community-migration@example.com'")){r.next();uid=r.getLong(1);}
                dest.execute("INSERT INTO community_posts(public_id,author_id,request_key,fingerprint,content,category,visibility,identity,created_at,updated_at) VALUES(UUID(),"+uid+",UUID(),REPEAT('a',64),'Synthetic migration','GENERAL','PUBLISHED','ACCOUNT',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))");
                long pid;try(var r=dest.executeQuery("SELECT id FROM community_posts")){r.next();pid=r.getLong(1);}
                String insert="INSERT INTO community_reactions(post_id,author_id,created_at) VALUES("+pid+","+uid+",UTC_TIMESTAMP(6))";
                dest.execute(insert);assertThrows(SQLException.class,()->dest.execute(insert));
                assertThrows(SQLException.class,()->dest.execute("INSERT INTO community_reactions(post_id,author_id,created_at) VALUES(-1,"+uid+",UTC_TIMESTAMP(6))"));
                try(var app=new SpringApplicationBuilder(BackendApplication.class).web(WebApplicationType.SERVLET).profiles("test").run(
                    "--spring.config.import=","--server.port=0","--server.address=127.0.0.1","--spring.datasource.url=jdbc:mysql://127.0.0.1:3306/"+SCHEMA,"--spring.datasource.username="+user,"--spring.datasource.password="+password,
                    "--spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver","--spring.jpa.hibernate.ddl-auto=validate","--app.demo-data.enabled=false","--app.partner-catalog.enabled=false",
                    "--app.community.enabled=false","--app.payos.client-id=","--app.payos.api-key=","--app.payos.checksum-key=","--app.otp.resend.api-key=")) {assertTrue(app.isActive());}
            } finally {sql.execute("DROP DATABASE "+SCHEMA);}
        }
    }
}
