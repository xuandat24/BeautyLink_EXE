import com.example.backend.service.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.nio.file.*;
import java.sql.*;
import java.time.*;
import java.security.*;
import java.util.*;
/** Standalone isolated tests, never calls openTarget()/production. H2 by default; explicit loopback MySQL optional. */
class ProfileOperationsTest {
 static final ObjectMapper JSON=RecoveryStore.JSON;
 interface Throwing {void run() throws Exception;}
 static void check(boolean yes,String message){if(!yes)throw new AssertionError(message);}
 static void fails(Throwing action) throws Exception {try{action.run();}catch(Exception expected){return;}throw new AssertionError("Expected rejection");}
 static JsonNode row(Connection c,String sql) throws Exception{return JSON.valueToTree(RecoveryStore.query(c,sql)).get(0);}
 static void sql(Connection c,String sql) throws Exception{try(var q=c.createStatement()){q.execute(sql);}}
 static void write(Path p,Object v)throws Exception{Files.writeString(p,JSON.writeValueAsString(v));}
 static void backupChecks() throws Exception {
  Path root=Files.createTempDirectory("synthetic-backup-validator-test-");Path dump=Files.createDirectory(root.resolve("dump"));
  var proof=JSON.createObjectNode().put("checksum","PASS").put("schema","PASS").put("ApplicationRead","PASS").put("orphanRows",0).put("foreignKeysChecked",1).put("tableCount",2).put("target","isolated-local-docker").put("CompletedUtc",Instant.now().toString());
  var manifest=JSON.createArrayNode();for(String name:List.of("@.done.json","@.checksums.json","table.tsv")){Path file=dump.resolve(name);Files.writeString(file,"synthetic-test-only");manifest.addObject().put("File",name).put("Length",Files.size(file)).put("SHA256",HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(file))));}
  write(root.resolve("RESTORE_VERIFIED.json"),proof);write(root.resolve("source-schema.json"),Map.of("schema","isolated_test"));write(root.resolve("SHA256SUMS.json"),manifest);
  VerifiedBackupEvidence.validate(root,"isolated_test",2);
  fails(()->VerifiedBackupEvidence.validate(root,"production_wrong",2));fails(()->VerifiedBackupEvidence.validate(root,"isolated_test",3));
  proof.put("CompletedUtc",Instant.now().minusSeconds(90000).toString());write(root.resolve("RESTORE_VERIFIED.json"),proof);fails(()->VerifiedBackupEvidence.validate(root,"isolated_test",2));
  proof.put("CompletedUtc",Instant.now().toString());write(root.resolve("RESTORE_VERIFIED.json"),proof);Files.writeString(dump.resolve("table.tsv"),"tampered");fails(()->VerifiedBackupEvidence.validate(root,"isolated_test",2));
  Files.writeString(dump.resolve("table.tsv"),"synthetic-test-only");Files.writeString(dump.resolve("unlisted.tsv"),"extra");fails(()->VerifiedBackupEvidence.validate(root,"isolated_test",2));
  // Keep synthetic evidence in the temporary OS directory; never call it a real backup/restore result.
 }
 static ObjectNode plan() {
  var p=JSON.createObjectNode().put("id",PartnerActivationPlan.ID).put("kind","PARTNER_ACTIVATION").put("version",1).put("auditAdminId",1);p.putArray("blocked");
  p.putArray("targets").addObject().put("id",11).put("ownerUserId",2).put("ownerStatus","DISABLED").put("newOwnerStatus","ACTIVE");return p;
 }
 public static void main(String[] args) throws Exception {
  backupChecks();var plan=plan();PartnerActivationStore.validate(plan);var bad=plan.deepCopy();bad.withArray("blocked").addObject().put("reason","SUSPENDED");fails(()->PartnerActivationStore.validate(bad));
  // Prove write opt-ins are checked before any attempt to connect.
  Path artifact=Files.createTempFile("synthetic-activation-plan-", ".json");write(artifact,plan);
  fails(()->PartnerActivationStore.main(new String[]{"apply",artifact.toString()}));
  String url="jdbc:h2:mem:profile-operations;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",username="sa",password="";
  if(args.length>0){if(!args[0].equals("jdbc:mysql://127.0.0.1:13379/beautylink_profile_v2_test"))throw new IllegalArgumentException("Literal isolated test database only");url=args[0];username="root";password=System.getenv("DISPLAY_PROFILE_TEST_PASSWORD");}
  try(var c=DriverManager.getConnection(url,username,password)) {
   sql(c,"create table user_accounts(id bigint primary key,role varchar(20),status varchar(20),email varchar(100),password_hash varchar(100),auth_version bigint,updated_at timestamp(6),created_at timestamp(6))");
   sql(c,"create table suppliers(id bigint primary key,owner_user_id bigint,verification_status varchar(20),demo_data boolean,foreign key(owner_user_id) references user_accounts(id))");
   sql(c,"create table authentication_sessions(id bigint primary key,account_id bigint,revoked boolean,foreign key(account_id) references user_accounts(id))");
   sql(c,"create table support_reports(id bigint auto_increment primary key,reporter_id bigint,assigned_staff_id bigint,target_type varchar(30),target_id bigint,reason varchar(100),details varchar(1000),status varchar(20),resolution_note varchar(1000),created_at timestamp(6),resolved_at timestamp(6),foreign key(reporter_id) references user_accounts(id))");
   for(String table:List.of("bookings","payment_transactions","external_identities","service_offerings","practitioners","availability_rules"))sql(c,"create table "+table+"(id bigint primary key,preserved_value varchar(100))");
   for(int i=1;i<=3;i++)sql(c,"insert into user_accounts values ("+i+",'"+(i==1?"ADMIN":"SUPPLIER")+"','"+(i==1?"ACTIVE":"DISABLED")+"','synthetic"+i+"@example.test','unchanged-hash',7,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))");
   sql(c,"insert into suppliers values(11,2,'VERIFIED',false),(12,3,'VERIFIED',false)");sql(c,"insert into authentication_sessions values(1,2,false),(2,3,false)");sql(c,"insert into payment_transactions values(1,'amount-status-ordercode-linkid-preserved')");sql(c,"insert into external_identities values(1,'Google-link-preserved')");
   c.setAutoCommit(false);var original=PartnerActivationStore.immutableUsers(c,plan);var finance=PartnerActivationStore.financialIntegrity(c);
   PartnerActivationStore.change(c,plan,false,"synthetic-reviewed-hash");
   check(row(c,"select status,auth_version from user_accounts where id=2").path("status").asText().equals("ACTIVE"),"Target active");check(row(c,"select auth_version from user_accounts where id=2").path("auth_version").asLong()==8,"authVersion increments");
   check(row(c,"select revoked from authentication_sessions where id=1").path("revoked").asBoolean(),"Old target sessions revoked");check(!row(c,"select revoked from authentication_sessions where id=2").path("revoked").asBoolean(),"Unrelated session untouched");
   check(original.equals(PartnerActivationStore.immutableUsers(c,plan)),"Contacts/passwords/createdAt/other accounts unchanged");check(finance.equals(PartnerActivationStore.financialIntegrity(c)),"Financials/relationships/Google untouched");check(row(c,"select count(*) as n from support_reports").path("n").asInt()==1,"Audit exists");
   PartnerActivationStore.change(c,plan,true,"synthetic-reviewed-hash");check(row(c,"select auth_version from user_accounts where id=2").path("auth_version").asInt()==9,"Rollback never revives tokens");check(row(c,"select status from user_accounts where id=2").path("status").asText().equals("DISABLED"),"Rollback status restored");c.rollback();
   // A later failure must roll back the first status change AND its audit/session revocation.
   var conflict=plan.deepCopy();conflict.withArray("targets").addObject().put("id",999).put("ownerUserId",3).put("ownerStatus","DISABLED").put("newOwnerStatus","ACTIVE");fails(()->PartnerActivationStore.change(c,conflict,false,"synthetic-reviewed-hash"));c.rollback();
   check(row(c,"select status from user_accounts where id=2").path("status").asText().equals("DISABLED"),"Atomic rollback");check(!row(c,"select revoked from authentication_sessions where id=1").path("revoked").asBoolean(),"Session rollback");check(row(c,"select count(*) as n from support_reports").path("n").asInt()==0,"Audit rollback");
   sql(c,"update suppliers set demo_data=true where id=11");fails(()->PartnerActivationStore.change(c,plan,false,"synthetic-reviewed-hash"));c.rollback();
   sql(c,"update user_accounts set status='SUSPENDED' where id=2");fails(()->PartnerActivationStore.change(c,plan,false,"synthetic-reviewed-hash"));c.rollback();
   sql(c,"update user_accounts set role='CUSTOMER' where id=2");fails(()->PartnerActivationStore.change(c,plan,false,"synthetic-reviewed-hash"));c.rollback();
   sql(c,"update suppliers set verification_status='PENDING' where id=11");fails(()->PartnerActivationStore.change(c,plan,false,"synthetic-reviewed-hash"));c.rollback();
   // An audit failure cannot leave a status change partially committed.
   sql(c,"alter table support_reports add constraint force_audit_failure check (reason='NEVER')");fails(()->PartnerActivationStore.change(c,plan,false,"synthetic-reviewed-hash"));c.rollback();check(row(c,"select status from user_accounts where id=2").path("status").asText().equals("DISABLED"),"Audit failure rolls back mutation");
  }
  System.out.println("PASS isolated profile-operations: backup hash/age/schema gates; exact approval; target-only activation; session revocation; immutable contacts/passwords/Google/finance; ownership/demo/role/approval/suspension guards; audit atomicity; rollback. Synthetic backup fixtures only.");
 }
}

