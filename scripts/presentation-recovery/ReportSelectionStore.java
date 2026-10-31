import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.example.backend.service.PresentationReportSelection;
import com.example.backend.service.PresentationPaymentBatchValidator;
import java.math.BigDecimal;
import java.nio.file.*;
import java.sql.*;
import java.time.*;
import java.util.*;

/** Immutable, reversible report selection. Never writes operational bookings or payments. */
class ReportSelectionStore extends PaymentBatchStore {
    static final String SELECTION="beautylink-report-payments-select219-20261031-v1";
    static final long OMIT_PAID_BOOKING=9100000078L;
    static void require(boolean valid,String message) { if(!valid)throw new IllegalArgumentException(message); }
    static ObjectNode merged(JsonNode source) throws Exception {
        var data=JSON.createObjectNode();var bs=data.putArray("bookings");var ps=data.putArray("reportingPayments");
        var markers=new HashSet<String>();source.path("recovery").forEach(r->markers.add(r.path("id").asText()));
        for(var r:source.path("recovery")) {
            String id=r.path("id").asText();
            if(id.endsWith(".rollback")||markers.contains(id+".rollback"))continue;
            var p=JSON.readTree(r.path("payload").asText());
            require(!"REPORT_SELECTION".equals(p.path("batch").path("kind").asText()),"Another selection already active; review instead of stacking");
            p.path("data").path("bookings").forEach(bs::add);p.path("data").path("reportingPayments").forEach(ps::add);
        }
        return data;
    }
    static BigDecimal sum(JsonNode rows,String field) { var amount=BigDecimal.ZERO;for(var r:rows)amount=amount.add(r.path(field).decimalValue());return amount; }
    static void validate(JsonNode source,JsonNode plan) throws Exception {
        require(SELECTION.equals(plan.path("batch").path("id").asText()),"Unexpected selection ID");
        var references=(ObjectNode)source.deepCopy();var originalRows=references.putArray("recovery");JsonNode paymentBatch=null;
        for(var r:source.path("recovery")) {
            if(BATCH.equals(r.path("id").asText()))paymentBatch=JSON.readTree(r.path("payload").asText());
            else originalRows.add(r);
        }
        require(paymentBatch!=null,"Validated payment batch missing");
        PresentationPaymentBatchValidator.validate(references,paymentBatch);
        var before=merged(source);var after=before.deepCopy();PresentationReportSelection.apply(after,plan);
        require(before.path("bookings").size()==287&&after.path("bookings").size()==143,"Expected 287 -> 143 synthetic bookings");
        require(before.path("reportingPayments").size()==144&&after.path("reportingPayments").size()==143,"Expected 144 -> 143 synthetic receipts");
        require(plan.path("data").path("excludedBookingIds").size()==144,"Exactly 144 exclusions required");
        var ids=new HashSet<Long>();var codes=new HashSet<String>();var receiptBookings=new HashSet<Long>();
        for(var b:after.path("bookings")) {
            require("COMPLETED".equals(b.path("status").asText())&&"SIMULATED".equals(b.path("source").asText()),"Retain validated completed report bookings only");
            require(ids.add(b.path("id").asLong())&&codes.add(b.path("bookingCode").asText()),"Duplicate booking");
            var service=new ArrayList<JsonNode>();source.path("catalog").forEach(s->{if(s.path("id").asLong()==b.path("serviceId").asLong())service.add(s);});
            require(service.size()==1&&service.get(0).path("price").decimalValue().compareTo(b.path("totalAmount").decimalValue())==0,"Retained catalog price changed");
            require(service.get(0).path("supplierId").asLong()==b.path("supplierId").asLong(),"Supplier relationship mismatch");
        }
        for(var p:after.path("reportingPayments")) {
            require(ids.contains(p.path("bookingId").asLong())&&receiptBookings.add(p.path("bookingId").asLong()),"Receipt must join unique retained booking");
            require("SIMULATED".equals(p.path("source").asText())&&"DEPOSIT_05".equals(p.path("paymentOption").asText()),"No verified or invented full payments");
            require(PresentationPaymentBatchValidator.deposit(p.path("serviceValue").decimalValue()).compareTo(p.path("amount").decimalValue())==0,"Invalid deposit");
        }
        var verified=sum(source.path("verified"),"amount");var total=verified.add(sum(after.path("reportingPayments"),"amount"));
        require(verified.compareTo(new BigDecimal("1215458"))==0&&total.compareTo(new BigDecimal("3043208"))==0,"Money baseline changed; refresh plan");
        require(sum(before.path("reportingPayments"),"amount").subtract(sum(after.path("reportingPayments"),"amount")).compareTo(new BigDecimal("2000"))==0,"Only 2000 VND may leave report");
    }
    public static void main(String[] args) throws Exception {
        if(args.length==3&&args[0].equals("plan")) {
            var source=JSON.readTree(Files.readString(Path.of(args[1])));var plan=JSON.createObjectNode().put("version",1);
            var batch=plan.putObject("batch").put("id",SELECTION).put("version",1).put("kind","REPORT_SELECTION").put("source","SIMULATED").put("createdAt",Instant.now().toString());
            for(var name:List.of("recoveryHash","referenceHash","bookingHash","verifiedHash"))batch.put("expected"+Character.toUpperCase(name.charAt(0))+name.substring(1),source.path(name).asText());
            batch.put("reason","219 total / 147 completed in October; retain catalog-priced paid bookings, archive legacy unpaid report rows without deleting audit");
            batch.put("beforeTotal",3045208).put("afterTotal",3043208).put("omittedDeposit",2000).put("retainedSyntheticBookings",143).put("retainedSyntheticReceipts",143);
            var excluded=plan.putObject("data").putArray("excludedBookingIds");
            for(var r:source.path("recovery"))if(KEY.equals(r.path("id").asText()))JSON.readTree(r.path("payload").asText()).path("data").path("bookings").forEach(b->excluded.add(b.path("id").asLong()));
            excluded.add(OMIT_PAID_BOOKING);validate(source,plan);
            Files.writeString(Path.of(args[2]),JSON.writerWithDefaultPrettyPrinter().writeValueAsString(plan));
            System.out.println("PLAN exclusions=144 retainedSyntheticBookings=143 retainedReceipts=143 reportTotal=3043208; no database writes");return;
        }
        require(args.length==2&&Set.of("check","apply","rollback").contains(args[0]),"plan <source> <plan> | check|apply|rollback <plan>");
        var plan=JSON.readTree(Files.readString(Path.of(args[1])));require(SELECTION.equals(plan.path("batch").path("id").asText()),"Unexpected selection ID");
        boolean write=!args[0].equals("check");
        try(var c=open()) {
            c.setTransactionIsolation(Connection.TRANSACTION_SERIALIZABLE);c.setReadOnly(!write);c.setAutoCommit(false);
            String bookings=hash(c,"bookings"),payments=hash(c,"payment_transactions");JsonNode existing=null;boolean rolledBack=false;
            try(var q=c.prepareStatement("select id,payload from presentation_recovery where id in (?,?)"+(write?" for update":""))) {
                q.setString(1,SELECTION);q.setString(2,SELECTION+".rollback");
                try(var rows=q.executeQuery()) {while(rows.next())if(rows.getString(1).equals(SELECTION))existing=JSON.readTree(rows.getString(2));else rolledBack=true;}
            }
            require(existing==null||existing.equals(plan),"Immutable selection differs; never overwrite");
            if(args[0].equals("rollback")) {
                require(existing!=null,"No selection to rollback");
                if(!rolledBack)insert(c,SELECTION+".rollback",JSON.createObjectNode().put("version",1).put("batchId",SELECTION).put("rolledBackAt",Instant.now().toString()).put("payloadHash",digest(plan)));
                integrity(c,bookings,payments);c.commit();System.out.println("ROLLED BACK selection only; original payloads and ledger retained");
            } else if(existing!=null) {require(!rolledBack,"Selection rolled back; no implicit reactivation");System.out.println("NO-OP identical selection already applied");}
            else {
                var current=snapshot(c);
                for(var name:List.of("recoveryHash","referenceHash","bookingHash","verifiedHash"))require(current.path(name).asText().equals(plan.path("batch").path("expected"+Character.toUpperCase(name.charAt(0))+name.substring(1)).asText()),"Concurrent baseline change: "+name);
                validate(current,plan);
                long live=0,completed=0;
                for(var b:liveBookings(c)) {var day=Instant.parse((String)b.get("createdAt")).atZone(ZONE).toLocalDate();if(day.getYear()==2026&&day.getMonthValue()==10) {live++;if("COMPLETED".equals(b.get("status")))completed++;}}
                require(live==76&&completed==4,"Operational booking baseline changed; review plan");
                if(write){insert(c,SELECTION,plan);integrity(c,bookings,payments);c.commit();}
                System.out.println((write?"APPLIED":"DRY-RUN VALIDATED")+" totalBookings=219 completed=147 reportTotal=3043208 deposits=2997208 full=46000 transactions=179 uniquePaidBookings=179; verified=1215458/36 unchanged; original payloads retained");
            }
            c.rollback();
        } catch(SQLException e){System.err.println("Report selection failed: SQLState="+e.getSQLState()+", code="+e.getErrorCode());System.exit(1);}
    }
}
