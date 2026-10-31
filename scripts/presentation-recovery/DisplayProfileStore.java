import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.example.backend.service.*;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/** Explicit operator command. Only inserts a display overlay / rollback marker; no account or ledger writes. */
class DisplayProfileStore extends RecoveryStore {
    static Connection openTarget() throws Exception {
        String isolated=System.getenv("DISPLAY_PROFILE_TEST_JDBC");if(isolated==null)return open();
        if(!isolated.equals("jdbc:mysql://127.0.0.1:13379/beautylink_display_test"))throw new IllegalStateException("Only the literal isolated test target is allowed");
        return DriverManager.getConnection(isolated,"root",System.getenv("DISPLAY_PROFILE_TEST_PASSWORD"));
    }
    static void writeArtifact(Path path,String value) throws Exception {
        if(Files.exists(path)){if(!Files.readString(path).equals(value))throw new IllegalStateException("Different private artifact already exists; use a new path");return;}
        Files.writeString(path,value,StandardOpenOption.CREATE_NEW);
    }
    static ObjectNode snapshot(Connection c) throws Exception {
        var source=JSON.createObjectNode();
        var stored=query(c,"select id,payload from presentation_recovery order by id");
        var data=JSON.createObjectNode();data.putArray("users");data.putArray("bookings");data.putArray("salons");
        var activity=source.putArray("activity");var selections=new ArrayList<JsonNode>();var markers=new HashSet<String>();
        stored.forEach(row->markers.add(row.get("id").toString()));
        for(var row:stored) {
            String id=row.get("id").toString();if(id.startsWith(PresentationProfilePatch.ID)||id.endsWith(".rollback")||markers.contains(id+".rollback"))continue;
            var payload=JSON.readTree(row.get("payload").toString());
            if(id.equals(KEY))data=payload.path("data").deepCopy();
        }
        for(var b:data.path("bookings"))activity.add(b.deepCopy());
        for(var row:stored) {
            String id=row.get("id").toString();if(!id.startsWith("beautylink-report-payments-")||id.endsWith(".rollback")||markers.contains(id+".rollback"))continue;
            var payload=JSON.readTree(row.get("payload").toString());
            if("REPORT_SELECTION".equals(payload.path("batch").path("kind").asText())){selections.add(payload);continue;}
            for(var b:payload.path("data").path("bookings")){data.withArray("bookings").add(b.deepCopy());activity.add(b.deepCopy());}
            for(var p:payload.path("data").path("reportingPayments"))data.withArray("reportingPayments").add(p.deepCopy());
        }
        for(var selection:selections)PresentationReportSelection.apply(data,selection);
        source.set("data",data);
        source.set("users",JSON.valueToTree(query(c,"select id,full_name as fullName,email,role,status,created_at as createdAt from user_accounts order by id")));
        source.set("salons",JSON.valueToTree(query(c,"select id,owner_user_id as ownerUserId,name from suppliers order by id")));
        // Include ALL historical operational bookings, not only the current reporting cohort.
        source.set("bookings",JSON.valueToTree(query(c,"select id,customer_id as customerId,created_at as createdAt from bookings order by id")));
        var recovery=source.putArray("recoveryBaseline");for(var row:stored)if(!row.get("id").toString().startsWith(PresentationProfilePatch.ID))recovery.add(JSON.valueToTree(row));
        source.set("integrity",integrity(c));return source;
    }
    static ObjectNode integrity(Connection c) throws Exception {
        var result=JSON.createObjectNode();
        for(String table:List.of("user_accounts","suppliers","bookings","payment_transactions"))result.put(table,PresentationProfilePatch.hash(JSON.valueToTree(query(c,"select * from "+table+" order by id"))));
        return result;
    }
    static void insert(Connection c,String id,JsonNode value) throws Exception {
        try(var q=c.prepareStatement("insert into presentation_recovery(id,payload) values (?,?)")){q.setString(1,id);q.setString(2,JSON.writeValueAsString(value));q.executeUpdate();}
    }
    public static void main(String[] args) throws Exception {
        if(args.length==3&&args[0].equals("plan")) {
            var plan=PresentationProfilePatch.plan(JSON.readTree(Files.readString(Path.of(args[1]))));
            writeArtifact(Path.of(args[2]),JSON.writeValueAsString(plan));summary(plan,"PLANNED OFFLINE");return;
        }
        if(args.length!=2||!Set.of("export","check","apply","rollback").contains(args[0]))throw new IllegalArgumentException("export source.json | plan source.json plan.json | check|apply|rollback plan.json");
        boolean write=Set.of("apply","rollback").contains(args[0]);
        if(write&&!PresentationProfilePatch.ID.equals(System.getenv("APPROVE_DISPLAY_PROFILE_WRITE")))throw new IllegalStateException("Explicit owner approval required: APPROVE_DISPLAY_PROFILE_WRITE=<patch-id>");
        try(var c=openTarget()) {
            c.setTransactionIsolation(Connection.TRANSACTION_SERIALIZABLE);c.setReadOnly(!write);c.setAutoCommit(false);
            try {
                if(args[0].equals("export")){writeArtifact(Path.of(args[1]),JSON.writeValueAsString(snapshot(c)));System.out.println("EXPORTED private inventory; SELECT only, no credentials");}
                else {
                    var plan=JSON.readTree(Files.readString(Path.of(args[1])));PresentationProfilePatch.validate(plan);
                    JsonNode existing=null,marker=null;
                    try(var q=c.prepareStatement("select id,payload from presentation_recovery where id in (?,?)"+(write?" for update":""))) {
                        q.setString(1,PresentationProfilePatch.ID);q.setString(2,PresentationProfilePatch.ID+".rollback");try(var rows=q.executeQuery()){while(rows.next()){if(rows.getString(1).equals(PresentationProfilePatch.ID))existing=JSON.readTree(rows.getString(2));else marker=JSON.readTree(rows.getString(2));}}
                    }
                    if(existing!=null&&!existing.equals(plan))throw new IllegalStateException("Different immutable patch already exists; never overwrite");
                    var before=integrity(c);
                    if(args[0].equals("rollback")) {
                        if(existing==null)throw new IllegalStateException("Patch not applied");
                        if(marker==null)insert(c,PresentationProfilePatch.ID+".rollback",JSON.createObjectNode().put("version",1).put("patchHash",PresentationProfilePatch.hash(plan)));
                    } else if(existing!=null) {
                        if(marker!=null)throw new IllegalStateException("Patch rolled back; no implicit reactivation");System.out.println("NO-OP identical patch; zero extra profiles");
                    } else {
                        var current=snapshot(c);
                        if(!PresentationProfilePatch.hash(current).equals(plan.path("sourceHash").asText()))throw new IllegalStateException("Source changed; export and review a new plan");
                        if(!PresentationProfilePatch.hash(PresentationProfilePatch.plan(current)).equals(PresentationProfilePatch.hash(plan)))throw new IllegalStateException("Plan differs from validated source");
                        if(args[0].equals("apply"))insert(c,PresentationProfilePatch.ID,plan);
                    }
                    if(!before.equals(integrity(c)))throw new IllegalStateException("Operational integrity changed; rollback");
                    if(write)c.commit();summary(plan,write?args[0].toUpperCase():"DRY-RUN VALIDATED; writes=0");
                }
            }finally{c.rollback();}
        }catch(SQLException e){System.err.println("Display profile database operation failed: SQLState="+e.getSQLState()+", code="+e.getErrorCode());System.exit(1);}
    }
    static void summary(JsonNode plan,String status) {
        var counts=new TreeMap<String,Integer>();plan.path("profiles").forEach(p->counts.merge(p.path("source").asText(),1,Integer::sum));
        var exceptions=new TreeMap<String,Integer>();plan.path("exceptions").forEach(p->exceptions.merge(p.path("reason").asText(),1,Integer::sum));
        System.out.println(status+" profiles="+counts+" cohort="+plan.path("returningCustomerIds").size()+" exceptions="+exceptions+"; operational accounts/relations/ledger unchanged");
    }
}
