import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.*;
import java.time.*;
import java.util.*;
import com.example.backend.service.PresentationPaymentBatchValidator;

/** Private report partition only. Never insert operational bookings or financial transactions. */
class PaymentBatchStore extends RecoveryStore {
    static final String BATCH = "beautylink-report-payments-144-20261031-v1";
    static String digest(Object value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(JSON.writeValueAsBytes(value)));
    }
    static ObjectNode snapshot(Connection c) throws Exception {
        var out=JSON.createObjectNode();
        out.put("asOf",Instant.now().toString());
        out.set("recovery",JSON.valueToTree(query(c,"select id,payload from presentation_recovery order by id")));
        out.set("customers",JSON.valueToTree(query(c,"select id,full_name as fullName,phone,created_at as createdAt from user_accounts where role='CUSTOMER' order by id")));
        out.set("catalog",JSON.valueToTree(query(c,"select o.id,o.supplier_id as supplierId,s.name as supplierName,o.name,o.price,o.duration_minutes as durationMinutes from service_offerings o join suppliers s on s.id=o.supplier_id where s.demo_data=false and o.active=true order by o.id")));
        out.set("practitioners",JSON.valueToTree(query(c,"select p.id,p.supplier_id as supplierId,p.display_name as displayName,p.service_assignments_restricted as restricted from practitioners p join suppliers s on s.id=p.supplier_id where s.demo_data=false and p.active=true order by p.id")));
        out.set("assignments",JSON.valueToTree(query(c,"select practitioner_id as practitionerId,service_id as serviceId from practitioner_service_assignments order by practitioner_id,service_id")));
        out.set("rules",JSON.valueToTree(query(c,"select practitioner_id as practitionerId,day_of_week as day,start_time as startTime,end_time as endTime,break_start as breakStart,break_end as breakEnd,slot_minutes as slotMinutes from availability_rules where active=true order by practitioner_id,day_of_week")));
        out.set("exceptions",JSON.valueToTree(query(c,"select practitioner_id as practitionerId,exception_date as exceptionDate,available,start_time as startTime,end_time as endTime from schedule_exceptions where exception_date between '2026-09-30' and '2026-10-31' order by practitioner_id,exception_date")));
        out.set("occupied",JSON.valueToTree(query(c,"select id,booking_code as bookingCode,customer_id as customerId,practitioner_id as practitionerId,appointment_date as appointmentDate,start_time as startTime,end_time as endTime from bookings where status<>'CANCELLED' and appointment_date between '2026-09-30' and '2026-11-01' order by id")));
        out.set("verified",JSON.valueToTree(query(c,"select p.id,b.id as bookingId,p.payment_option as paymentOption,p.amount,p.remaining_amount as remainingAmount,p.paid_at as paidAt from payment_transactions p join bookings b on b.id=p.booking_id join user_accounts u on u.id=b.customer_id join suppliers s on s.id=b.supplier_id where u.role='CUSTOMER' and s.demo_data=false and "+CANONICAL+" and p.paid_at>='2026-10-01' and p.paid_at<'2026-11-01' order by p.id")));
        var refs=out.deepCopy(); refs.remove(List.of("asOf","recovery","verified"));
        out.put("referenceHash",digest(refs)); out.put("recoveryHash",digest(out.get("recovery"))); out.put("verifiedHash",digest(out.get("verified")));
        out.put("bookingHash",hash(c,"bookings"));
        return out;
    }
    public static void main(String[] args) throws Exception {
        if(args.length!=2 || !Set.of("export","check","apply","rollback").contains(args[0])) throw new IllegalArgumentException("export|check|apply|rollback <private-json-path>");
        try(var c=open()) {
            c.setTransactionIsolation(Connection.TRANSACTION_SERIALIZABLE);
            c.setReadOnly(!Set.of("apply","rollback").contains(args[0])); c.setAutoCommit(false);
            if(args[0].equals("export")) {
                Files.writeString(Path.of(args[1]),JSON.writeValueAsString(snapshot(c)),StandardCharsets.UTF_8);
                System.out.println("EXPORTED private reporting source; SELECT only; no financial writes");
            } else {
                var plan=JSON.readTree(Files.readString(Path.of(args[1])));
                if(!BATCH.equals(plan.path("batch").path("id").asText()))throw new IllegalArgumentException("Unexpected batch ID");
                boolean write=Set.of("apply","rollback").contains(args[0]);
                String beforeBookings=hash(c,"bookings"),beforePayments=hash(c,"payment_transactions");
                JsonNode existing=null,marker=null;
                try(var q=c.prepareStatement("select id,payload from presentation_recovery where id in (?,?)"+(write?" for update":""))) {
                    q.setString(1,BATCH);q.setString(2,BATCH+".rollback");
                    try(var rows=q.executeQuery()) { while(rows.next()) { if(rows.getString(1).equals(BATCH))existing=JSON.readTree(rows.getString(2)); else marker=JSON.readTree(rows.getString(2)); } }
                }
                if(existing!=null&&!existing.equals(plan))throw new IllegalStateException("Batch exists with different content; never overwrite");
                if(args[0].equals("rollback")) {
                    if(existing==null)throw new IllegalStateException("Batch missing; nothing to rollback");
                    if(marker==null) {
                        var audit=JSON.createObjectNode().put("version",1).put("batchId",BATCH).put("source","SIMULATED").put("rolledBackAt",Instant.now().toString()).put("payloadHash",digest(plan));
                        insert(c,BATCH+".rollback",audit);
                    }
                    integrity(c,beforeBookings,beforePayments);c.commit();
                    System.out.println("ROLLED BACK only report batch; immutable batch and original recovery retained as audit; real ledger unchanged");
                } else if(existing!=null) {
                    if(marker!=null)throw new IllegalStateException("Batch rolled back; no implicit reactivation");
                    System.out.println("NO-OP identical batch already present; no extra bookings/payments");
                } else {
                    var current=snapshot(c);var meta=plan.path("batch");
                    for(var pair:Map.of("recoveryHash","expectedRecoveryHash","referenceHash","expectedReferenceHash","bookingHash","expectedBookingHash","verifiedHash","expectedVerifiedHash").entrySet())
                        if(!current.path(pair.getKey()).asText().equals(meta.path(pair.getValue()).asText()))throw new IllegalStateException("Baseline changed: "+pair.getKey()+"; refresh source and plan, never overwrite live records");
                    var amount=PresentationPaymentBatchValidator.validate(current,plan);
                    if(args[0].equals("apply")) { insert(c,BATCH,plan);integrity(c,beforeBookings,beforePayments);c.commit(); }
                    System.out.println((args[0].equals("apply")?"APPLIED":"DRY-RUN VALIDATED")+" rows=144 uniqueBookings=144 deposits="+amount+" fullPayments=0 verifiedBaseline="+meta.path("baselineVerified")+" resultingReportTotal="+meta.path("resultingReportTotal")+"; operational bookings/payments unchanged");
                }
            }
            c.rollback();
        } catch(SQLException e) { System.err.println("Report database operation failed: SQLState="+e.getSQLState()+", code="+e.getErrorCode());System.exit(1); }
    }
    static void insert(Connection c,String id,JsonNode payload) throws Exception {
        try(var q=c.prepareStatement("insert into presentation_recovery(id,payload) values (?,?)")) { q.setString(1,id);q.setString(2,JSON.writeValueAsString(payload));q.executeUpdate(); }
    }
    static void integrity(Connection c,String bookings,String payments) throws Exception {
        if(!bookings.equals(hash(c,"bookings"))||!payments.equals(hash(c,"payment_transactions")))throw new IllegalStateException("Operational ledger integrity check failed");
    }
}
