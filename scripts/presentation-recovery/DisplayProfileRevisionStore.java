import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.example.backend.service.*;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/** v2 operator entry point; existing v1 rows/tools remain immutable and compatible. */
class DisplayProfileRevisionStore extends DisplayProfileStore {
    static ObjectNode revisionSnapshot(Connection c) throws Exception {
        ObjectNode source=snapshot(c);
        source.put("database",c.getCatalog());source.put("databaseVersion",c.getMetaData().getDatabaseProductVersion());
        source.set("salons",JSON.valueToTree(query(c,"select s.id,s.owner_user_id as ownerUserId,s.name,s.demo_data as demoData,s.verification_status as approvalStatus,s.created_at as createdAt,u.role as ownerRole,u.status as ownerStatus,u.auth_version as authVersion,u.updated_at as ownerUpdatedAt,(u.password_hash is not null) as hasPassword,(select count(*) from external_identities x where x.user_account_id=u.id) as googleLinks,(select count(*) from authentication_sessions a where a.account_id=u.id and a.revoked=false) as unrevokedSessions,(select count(*) from service_offerings o where o.supplier_id=s.id and o.active=true) as activeServices,(select count(*) from practitioners p where p.supplier_id=s.id and p.active=true) as activePractitioners from suppliers s join user_accounts u on u.id=s.owner_user_id order by s.id")));
        source.set("activity",JSON.valueToTree(query(c,"select customer_id as customerId,created_at as createdAt from bookings union all select s.owner_user_id,b.created_at from bookings b join suppliers s on s.id=b.supplier_id union all select owner_user_id,created_at from suppliers order by customerId,createdAt")));
        // Include all saved report activity, even rows excluded from the current report selection.
        var recovery=query(c,"select id,payload from presentation_recovery order by id");var ids=new HashSet<String>();recovery.forEach(row->ids.add(row.get("id").toString()));
        var baseline=source.putArray("recoveryBaseline");
        for(var row:recovery) {
            String id=row.get("id").toString();
            if(!id.startsWith("beautylink-display-profiles-"))baseline.add(JSON.valueToTree(row));
            if(id.equals(PresentationProfilePatch.ID)&&!ids.contains(id+".rollback"))source.set("priorProfilePlan",JSON.readTree(row.get("payload").toString()));
            var payload=JSON.readTree(row.get("payload").toString());for(var b:payload.path("data").path("bookings"))source.withArray("activity").add(b.deepCopy());
        }
        source.set("financialBaseline",JSON.valueToTree(query(c,"select (select count(*) from bookings) as bookingCount,(select coalesce(sum(total_amount),0) from bookings) as bookedServiceValue,(select count(*) from payment_transactions) as paymentAttempts,(select coalesce(sum(p.amount),0) from payment_transactions p join bookings b on b.id=p.booking_id join user_accounts u on u.id=b.customer_id join suppliers s on s.id=b.supplier_id where u.role='CUSTOMER' and s.demo_data=false and "+CANONICAL+") as verifiedGrossOnline")));
        var payments=JSON.valueToTree(query(c,"select * from payment_transactions order by id"));var columns=source.putObject("paymentObservationDiagnostics");
        if(!payments.isEmpty()){var fields=payments.get(0).fieldNames();while(fields.hasNext()){String key=fields.next();var values=JSON.createArrayNode();payments.forEach(p->values.add(p.path(key)));columns.put(key,PresentationProfileRevision.hash(values));}}
        for(var p:payments)((ObjectNode)p).remove(List.of("last_reconciled_at","updated_at"));
        source.put("paymentSemanticHash",PresentationProfileRevision.hash(payments));
        return (ObjectNode)JSON.readTree(JSON.writeValueAsString(source));
    }
    public static void main(String[] args) throws Exception {
        if(args.length==3&&args[0].equals("plan")){var plan=PresentationProfileRevision.plan(JSON.readTree(Files.readString(Path.of(args[1]))));writeArtifact(Path.of(args[2]),JSON.writeValueAsString(plan));summary(plan,"V2 PLANNED OFFLINE");return;}
        if(args.length!=2||!Set.of("export","check","apply","rollback").contains(args[0]))throw new IllegalArgumentException("export source.json | plan source.json plan.json | check|apply|rollback plan.json");
        boolean write=Set.of("apply","rollback").contains(args[0]);if(write&&!PresentationProfileRevision.hash(JSON.readTree(Files.readString(Path.of(args[1])))).equals(System.getenv("APPROVE_DISPLAY_PROFILE_WRITE")))throw new IllegalStateException("Exact v2 plan-hash approval required");
        try(var c=openTarget()) {
            c.setTransactionIsolation(Connection.TRANSACTION_SERIALIZABLE);c.setReadOnly(!write);c.setAutoCommit(false);
            try {
                if(args[0].equals("export")){writeArtifact(Path.of(args[1]),JSON.writeValueAsString(revisionSnapshot(c)));System.out.println("EXPORTED v2 private source; READ ONLY; writes=0");}
                else {
                    var plan=JSON.readTree(Files.readString(Path.of(args[1])));PresentationProfileRevision.validate(plan);JsonNode existing=null,marker=null;
                    try(var q=c.prepareStatement("select id,payload from presentation_recovery where id in (?,?)"+(write?" for update":""))){q.setString(1,PresentationProfileRevision.ID);q.setString(2,PresentationProfileRevision.ID+".rollback");try(var rows=q.executeQuery()){while(rows.next()){if(rows.getString(1).equals(PresentationProfileRevision.ID))existing=JSON.readTree(rows.getString(2));else marker=JSON.readTree(rows.getString(2));}}}
                    if(existing!=null&&!existing.equals(plan))throw new IllegalStateException("Different immutable revision exists; never overwrite");
                    if(write)VerifiedBackupEvidence.require(c);
                    var before=integrity(c);
                    if(args[0].equals("rollback")){if(existing==null)throw new IllegalStateException("Revision missing");if(marker==null)insert(c,PresentationProfileRevision.ID+".rollback",JSON.createObjectNode().put("version",2).put("patchHash",PresentationProfileRevision.hash(plan)));}
                    else if(existing!=null){if(marker!=null)throw new IllegalStateException("Revision rolled back; no reactivation");System.out.println("NO-OP identical revision");}
                    else {var current=revisionSnapshot(c);if(!PresentationProfileRevision.hash(PresentationProfileRevision.planningBaseline(current)).equals(plan.path("sourceHash").asText())||!PresentationProfileRevision.hash(PresentationProfileRevision.plan(current)).equals(PresentationProfileRevision.hash(plan)))throw new IllegalStateException("Source or reviewed plan changed; refresh preflight");if(args[0].equals("apply"))insert(c,PresentationProfileRevision.ID,plan);}
                    if(!before.equals(integrity(c)))throw new IllegalStateException("Operational integrity changed");if(write)c.commit();summary(plan,write?args[0].toUpperCase():"V2 DRY-RUN VALIDATED; writes=0");
                }
            }finally{c.rollback();}
        }catch(SQLException e){System.err.println("Profile v2 database operation failed: SQLState="+e.getSQLState()+", code="+e.getErrorCode());System.exit(1);}
    }
}
