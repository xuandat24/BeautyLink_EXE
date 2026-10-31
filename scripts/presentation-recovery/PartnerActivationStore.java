import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.example.backend.service.*;
import java.nio.file.*;
import java.sql.*;
import java.time.*;
import java.util.*;

/** Privileged operator workflow. No public endpoint; owner must approve the exact reviewed plan hash. */
class PartnerActivationStore extends DisplayProfileRevisionStore {
    static ObjectNode activationSnapshot(Connection c) throws Exception {return PartnerActivationPlan.baseline(revisionSnapshot(c));}
    static void validate(JsonNode p) {
        if(p.path("version").asInt()!=1||!PartnerActivationPlan.ID.equals(p.path("id").asText())||!"PARTNER_ACTIVATION".equals(p.path("kind").asText())||!p.path("targets").isArray()||p.path("auditAdminId").asLong()<=0)throw new IllegalStateException("Invalid activation plan");
        var users=new HashSet<Long>();var salons=new HashSet<Long>();for(var t:p.path("targets"))if(!t.path("id").isIntegralNumber()||t.path("id").asLong()<=0||!salons.add(t.path("id").asLong())||!users.add(t.path("ownerUserId").asLong())||!t.path("ownerStatus").asText().equals("DISABLED")||!t.path("newOwnerStatus").asText().equals("ACTIVE"))throw new IllegalStateException("Unsafe activation target");
        if(!p.path("blocked").isEmpty())throw new IllegalStateException("Unresolved partner blockers; review separately instead of blanket activation");
    }
    static JsonNode immutableUsers(Connection c,JsonNode plan) throws Exception {
        var ids=new HashSet<Long>();plan.path("targets").forEach(t->ids.add(t.path("ownerUserId").asLong()));
        var rows=JSON.valueToTree(query(c,"select * from user_accounts order by id"));for(var u:rows)if(ids.contains(u.path("id").asLong()))((ObjectNode)u).remove(List.of("status","auth_version","updated_at"));return rows;
    }
    static ObjectNode financialIntegrity(Connection c) throws Exception {
        var state=JSON.createObjectNode();for(String table:List.of("suppliers","bookings","payment_transactions","external_identities","service_offerings","practitioners","availability_rules"))state.put(table,PresentationProfileRevision.hash(JSON.valueToTree(query(c,"select * from "+table+" order by id"))));return state;
    }
    static void audit(Connection c,long actor,JsonNode t,String action,String hash) throws Exception {
        try(var q=c.prepareStatement("insert into support_reports(reporter_id,assigned_staff_id,target_type,target_id,reason,details,status,resolution_note,created_at,resolved_at) values (?,?,'SUPPLIER',?,?,?,'RESOLVED',?,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))")) {
            q.setLong(1,actor);q.setLong(2,actor);q.setLong(3,t.path("id").asLong());q.setString(4,"OPERATOR-PARTNER-"+action);q.setString(5,"Privileged maintenance operator; attributed adminId="+actor+"; ownerUserId="+t.path("ownerUserId").asLong()+"; reviewedPlanSha256="+hash);q.setString(6,"Owner-approved account status change only; old sessions/reset proofs invalidated; financial records untouched");q.executeUpdate();
        }
    }
    static void change(Connection c,JsonNode plan,boolean rollback,String hash) throws Exception {
        long actor=plan.path("auditAdminId").asLong();try(var q=c.prepareStatement("select role,status from user_accounts where id=? for update")){q.setLong(1,actor);try(var rows=q.executeQuery()){if(!rows.next()||!rows.getString(1).equals("ADMIN")||!rows.getString(2).equals("ACTIVE"))throw new IllegalStateException("Audit admin is no longer eligible");}}
        var targets=new ArrayList<JsonNode>();plan.path("targets").forEach(targets::add);targets.sort(Comparator.comparingLong(t->t.path("ownerUserId").asLong()));
        for(var t:targets) {
            long owner=t.path("ownerUserId").asLong();String expected=rollback?"ACTIVE":"DISABLED",next=rollback?"DISABLED":"ACTIVE";
            try(var q=c.prepareStatement("select u.status,u.role,s.owner_user_id,s.verification_status,s.demo_data from user_accounts u join suppliers s on s.owner_user_id=u.id where u.id=? and s.id=? for update")){q.setLong(1,owner);q.setLong(2,t.path("id").asLong());try(var rows=q.executeQuery()){if(!rows.next()||!expected.equals(rows.getString(1))||!"SUPPLIER".equals(rows.getString(2))||rows.getLong(3)!=owner||!"VERIFIED".equals(rows.getString(4))||rows.getBoolean(5))throw new IllegalStateException("Owner/status/approval relation changed; no writes committed");}}
            try(var q=c.prepareStatement("update user_accounts set status=?,auth_version=auth_version+1,updated_at=CURRENT_TIMESTAMP(6) where id=? and status=? and role='SUPPLIER'")){q.setString(1,next);q.setLong(2,owner);q.setString(3,expected);if(q.executeUpdate()!=1)throw new IllegalStateException("Concurrent status change");}
            try(var q=c.prepareStatement("update authentication_sessions set revoked=true where account_id=? and revoked=false")){q.setLong(1,owner);q.executeUpdate();}
            audit(c,actor,t,rollback?"ACTIVATION_ROLLBACK":"ACTIVATED",hash);
        }
    }
    public static void main(String[] args) throws Exception {
        if(args.length==3&&args[0].equals("plan")){var p=PartnerActivationPlan.plan(JSON.readTree(Files.readString(Path.of(args[1]))));writeArtifact(Path.of(args[2]),JSON.writeValueAsString(p));print(p,"PLANNED OFFLINE");return;}
        if(args.length!=2||!Set.of("check","apply","rollback").contains(args[0]))throw new IllegalArgumentException("plan source.json plan.json | check|apply|rollback plan.json");
        var plan=JSON.readTree(Files.readString(Path.of(args[1])));validate(plan);String hash=PresentationProfileRevision.hash(plan);boolean write=!args[0].equals("check"),rollback=args[0].equals("rollback");
        if(write&&!hash.equals(System.getenv("APPROVE_PARTNER_ACTIVATION")))throw new IllegalStateException("Exact plan-hash approval required before any write");
        if(write&&!plan.path("auditAdminId").asText().equals(System.getenv("ACTIVATION_AUDIT_ADMIN_ID")))throw new IllegalStateException("Explicit audit attribution required");
        try(var c=openTarget()) {
            c.setTransactionIsolation(Connection.TRANSACTION_SERIALIZABLE);c.setReadOnly(!write);c.setAutoCommit(false);
            try {
                JsonNode existing=null,marker=null;try(var q=c.prepareStatement("select id,payload from presentation_recovery where id in (?,?)"+(write?" for update":""))){q.setString(1,PartnerActivationPlan.ID);q.setString(2,PartnerActivationPlan.ID+".rollback");try(var rows=q.executeQuery()){while(rows.next()){if(rows.getString(1).equals(PartnerActivationPlan.ID))existing=JSON.readTree(rows.getString(2));else marker=JSON.readTree(rows.getString(2));}}}
                if(existing!=null&&!existing.path("plan").equals(plan))throw new IllegalStateException("Different immutable activation batch exists");
                if(!rollback&&existing!=null){if(marker!=null)throw new IllegalStateException("Activation rolled back; no reactivation");print(plan,"NO-OP existing activation");return;}
                if(rollback&&marker!=null){print(plan,"NO-OP existing rollback");return;}
                if(rollback&&existing==null)throw new IllegalStateException("Activation missing");
                var beforeUsers=immutableUsers(c,plan);var beforeFinance=financialIntegrity(c);
                if(!rollback) {var current=activationSnapshot(c);if(!PresentationProfileRevision.hash(current).equals(plan.path("sourceHash").asText())||!PresentationProfileRevision.hash(PartnerActivationPlan.plan(current)).equals(hash))throw new IllegalStateException("Activation baseline changed; review a fresh plan");}
                else if(!existing.path("financialIntegrity").equals(beforeFinance))throw new IllegalStateException("Activity/finance changed after activation; review a controlled suspension, never undo bookings/payments");
                if(write) {
                    String backupAt=VerifiedBackupEvidence.require(c);
                    change(c,plan,rollback,hash);
                    if(!beforeUsers.equals(immutableUsers(c,plan))||!beforeFinance.equals(financialIntegrity(c)))throw new IllegalStateException("Invariant changed; full transaction rollback");
                    var audit=JSON.createObjectNode().put("version",1).put("kind","PARTNER_ACTIVATION").put("appliedAt",Instant.now().toString()).put("verifiedBackupAt",backupAt).put("planHash",hash);audit.set("plan",plan);audit.set("financialIntegrity",beforeFinance);insert(c,PartnerActivationPlan.ID+(rollback?".rollback":""),audit);c.commit();
                }
                print(plan,write?(rollback?"ROLLED BACK statuses only; old credentials remain revoked":"APPLIED statuses only"):"DRY-RUN VALIDATED; writes=0");
            }finally{c.rollback();}
        }catch(SQLException e){System.err.println("Activation database operation failed: SQLState="+e.getSQLState()+", code="+e.getErrorCode());System.exit(1);}
    }
    static void print(JsonNode p,String action){System.out.println(action+" candidates="+p.path("targets").size()+" active="+p.path("activeBefore")+"->"+p.path("activeAfter")+" blocked="+p.path("blocked").size()+" excludedDemo="+p.path("excludedDemo")+" planSha256="+PresentationProfileRevision.hash(p)+"; no booking/payment/contact/password/Google changes");}
}
