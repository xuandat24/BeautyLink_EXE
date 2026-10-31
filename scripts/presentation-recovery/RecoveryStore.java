import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.sql.*;
import java.time.*;
import java.util.*;

/** Operator tool. Only apply writes, and only to presentation_recovery; never to the operational ledger. */
class RecoveryStore {
    static final ObjectMapper JSON = new ObjectMapper().registerModule(new JavaTimeModule()).disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    static final String KEY = "beautylink-presentation-20261031";
    static final ZoneId ZONE = ZoneId.of("Asia/Bangkok");
    static final String CANONICAL = "p.status='PAID' and p.paid_at is not null and p.requires_manual_review=false and p.id=(select min(p2.id) from payment_transactions p2 where p2.booking_id=b.id and p2.status='PAID')";
    static List<Map<String,Object>> query(Connection c, String sql) throws Exception {
        var rows = new ArrayList<Map<String,Object>>();
        try (var s = c.createStatement()) {
            s.setQueryTimeout(30);
            try (var r = s.executeQuery(sql)) {
                var meta = r.getMetaData();
                while (r.next()) {
                    var row = new LinkedHashMap<String,Object>();
                    for (int i=1;i<=meta.getColumnCount();i++) {
                        Object v = r.getObject(i);
                        if (v instanceof Timestamp) v = r.getTimestamp(i, Calendar.getInstance(TimeZone.getTimeZone(ZONE))).toInstant().toString();
                        else if (v instanceof LocalDateTime d) v = d.atZone(ZONE).toInstant().toString();
                        else if (v instanceof java.sql.Date d) v = d.toLocalDate().toString();
                        else if (v instanceof java.sql.Time t) v = t.toLocalTime().toString();
                        row.put(meta.getColumnLabel(i), v);
                    }
                    rows.add(row);
                }
            }
        }
        return rows;
    }
    static String hash(Connection c, String table) throws Exception {
        if (!Set.of("bookings", "payment_transactions").contains(table)) throw new IllegalArgumentException();
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(JSON.writeValueAsBytes(query(c, "select * from " + table + " order by id"))));
    }
    static List<Map<String,Object>> liveBookings(Connection c) throws Exception {
        return query(c, "select b.id,b.booking_code as bookingCode,b.customer_id as customerId,u.full_name as customerName,u.phone as customerPhone,b.supplier_id as supplierId,s.name as supplierName,b.service_id as serviceId,o.name as serviceName,pr.display_name as practitionerName,b.appointment_date as appointmentDate,b.start_time as startTime,b.end_time as endTime,b.total_amount as totalAmount,b.status,b.payment_status as paymentStatus,b.created_at as createdAt,p.payment_option as verifiedPaymentOption,p.amount as verifiedOnlineAmount,p.remaining_amount as remainingAtSalon,p.paid_at as verifiedPaidAt,false as paymentReviewRequired from bookings b join user_accounts u on u.id=b.customer_id join suppliers s on s.id=b.supplier_id join service_offerings o on o.id=b.service_id join practitioners pr on pr.id=b.practitioner_id left join payment_transactions p on p.booking_id=b.id and " + CANONICAL + " where u.role='CUSTOMER' and s.demo_data=false order by b.created_at desc,b.id desc");
    }
    static void export(Connection c, Path path) throws Exception {
        var result = new LinkedHashMap<String,Object>();
        result.put("users", query(c, "select id,full_name as fullName,email,role,status,created_at as createdAt from user_accounts order by created_at desc,id desc"));
        result.put("customers", query(c, "select u.id,u.full_name as fullName,u.phone,u.email,u.gender,u.date_of_birth as dateOfBirth,count(b.id) as bookingsPlaced,count(p.id) as paidBookings,sum(case when b.status='COMPLETED' then 1 else 0 end) as completedBookings,coalesce(sum(p.amount),0) as totalVerifiedOnlineAmount,max(b.created_at) as lastBookingAt from user_accounts u left join bookings b on b.customer_id=u.id and b.supplier_id in (select s.id from suppliers s where s.demo_data=false) left join payment_transactions p on p.booking_id=b.id and " + CANONICAL + " where u.role='CUSTOMER' group by u.id order by u.id"));
        result.put("salons", query(c, "select s.id,s.name,u.full_name as ownerName,u.email as ownerEmail,s.business_type as businessType,l.name as location,s.address_line as address,s.verification_status as approvalStatus,(s.verification_status='VERIFIED' and u.status='ACTIVE') as active,(select count(*) from service_offerings o where o.supplier_id=s.id) as serviceCount,(select count(*) from practitioners p where p.supplier_id=s.id) as practitionerCount,(select count(*) from bookings b where b.supplier_id=s.id) as bookingCount from suppliers s join user_accounts u on u.id=s.owner_user_id left join locations l on l.id=s.location_id where s.demo_data=false order by s.id"));
        var catalog = query(c, "select o.id,o.supplier_id as supplierId,s.name as supplierName,o.name,o.price,o.duration_minutes as durationMinutes from service_offerings o join suppliers s on s.id=o.supplier_id where s.demo_data=false and o.active=true order by o.id");
        var people = query(c, "select id,supplier_id as supplierId,display_name as displayName from practitioners where active=true order by id");
        for (var offering : catalog) offering.put("practitioners", people.stream().filter(p -> p.get("supplierId").equals(offering.get("supplierId"))).toList());
        result.put("catalog", catalog); result.put("bookings", liveBookings(c));
        result.put("fingerprints", Map.of("bookings", hash(c,"bookings"), "payments", hash(c,"payment_transactions")));
        Files.writeString(path, JSON.writeValueAsString(result), StandardCharsets.UTF_8);
        System.out.println("Exported recovery source; original booking/payment records unchanged; no credentials exported.");
    }
    static void apply(Connection c, Path path, boolean write) throws Exception {
        var root = JSON.readTree(Files.readString(path));
        if (root.path("version").asInt() != 1 || !root.path("data").isObject()) throw new IllegalArgumentException("Unsupported recovery file");
        var proof = root.path("provenance");
        String bookingHash=hash(c,"bookings"), paymentHash=hash(c,"payment_transactions");
        // Provider reconciliation may update receipt timestamps while the site is live; this tool never writes that table.
        if (!bookingHash.equals(proof.path("fingerprints").path("bookings").asText()))
            throw new IllegalStateException("Live bookings changed since export. Refresh the source; never overwrite them.");
        var ids = new HashSet<Long>(); var users = new HashSet<Long>();
        query(c,"select id from user_accounts").forEach(row -> users.add(((Number)row.get("id")).longValue()));
        for (var user : root.path("data").path("users")) {
            long id=user.path("id").asLong(); if (id<8000000000L || id>=8000000286L || !users.add(id)) throw new IllegalArgumentException("Invalid presentation identity");
        }
        var catalog = new HashMap<Long,Long>();
        query(c,"select id,supplier_id from service_offerings").forEach(row -> catalog.put(((Number)row.get("id")).longValue(),((Number)row.get("supplier_id")).longValue()));
        long syntheticValue=0;
        for (var b : root.path("data").path("bookings")) {
            long id=b.path("id").asLong(), amount=b.path("totalAmount").asLong(-1), supplier=b.path("supplierId").asLong();
            if (id<9000000000L || id>=9000000147L || !ids.add(id) || !users.contains(b.path("customerId").asLong()) || !Objects.equals(catalog.get(b.path("serviceId").asLong()), supplier) || amount<0)
                throw new IllegalArgumentException("Invalid recovery relationship or amount");
            if (!b.path("verifiedOnlineAmount").isNull() || !b.path("verifiedPaidAt").isNull() || !b.path("verifiedPaymentOption").isNull())
                throw new IllegalArgumentException("Presentation history cannot claim verified payment receipts");
            if (b.path("status").asText().equals("COMPLETED")) syntheticValue += amount;
        }
        long liveValue=0, liveCompleted=0;
        for (var b : liveBookings(c)) {
            String day=Instant.parse((String)b.get("createdAt")).atZone(ZONE).toLocalDate().toString();
            if ("COMPLETED".equals(b.get("status")) && day.compareTo("2026-10-01")>=0 && day.compareTo("2026-10-31")<=0) { liveValue+=((Number)b.get("totalAmount")).longValue(); liveCompleted++; }
        }
        if (liveValue+syntheticValue!=3045000L) throw new IllegalArgumentException("Recovery does not reconcile to 3045000 VND");
        if (write) {
            String payload=JSON.writeValueAsString(root);
            try (var s=c.prepareStatement("select payload from presentation_recovery where id=? for update")) {
                s.setString(1,KEY); try(var rows=s.executeQuery()) {
                    if (rows.next()) { if (!JSON.readTree(rows.getString(1)).equals(root)) throw new IllegalStateException("Existing recovery differs; no overwrite allowed"); }
                    else try(var insert=c.prepareStatement("insert into presentation_recovery(id,payload) values (?,?)")) { insert.setString(1,KEY); insert.setString(2,payload); insert.executeUpdate(); }
                }
            }
            if (!bookingHash.equals(hash(c,"bookings")) || !paymentHash.equals(hash(c,"payment_transactions"))) throw new IllegalStateException("Ledger integrity check failed");
            c.commit();
        }
        System.out.println((write?"APPLIED":"VALIDATED")+" presentation recovery: synthetic="+ids.size()+", originalCompleted="+liveCompleted+", originalValue="+liveValue+", syntheticValue="+syntheticValue+", total="+(liveValue+syntheticValue)+"; real bookings/payments unchanged");
    }
    public static void main(String[] args) throws Exception {
        if (args.length!=2 || !Set.of("export","check","apply").contains(args[0])) throw new IllegalArgumentException("export|check|apply <path>");
        URI uri=URI.create(System.getenv("MYSQL_PUBLIC_URL"));
        if (!"acela.proxy.rlwy.net".equals(uri.getHost()) || uri.getPort()!=10050 || !"/railway".equals(uri.getPath())) throw new IllegalStateException("Unexpected database target");
        var auth=uri.getRawUserInfo().split(":",2); var p=new Properties();
        p.setProperty("user",URLDecoder.decode(auth[0],StandardCharsets.UTF_8)); p.setProperty("password",URLDecoder.decode(auth[1],StandardCharsets.UTF_8));
        p.setProperty("sslMode","REQUIRED"); p.setProperty("connectTimeout","15000"); p.setProperty("socketTimeout","45000"); p.setProperty("connectionTimeZone",ZONE.getId());
        try(var c=DriverManager.getConnection("jdbc:mysql://"+uri.getHost()+":"+uri.getPort()+uri.getPath(),p)) {
            c.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ); c.setReadOnly(!args[0].equals("apply")); c.setAutoCommit(false);
            if (args[0].equals("export")) export(c,Path.of(args[1])); else apply(c,Path.of(args[1]),args[0].equals("apply"));
            c.rollback();
        } catch (SQLException e) { System.err.println("Recovery database operation failed: SQLState="+e.getSQLState()+", code="+e.getErrorCode()); System.exit(1); }
    }
}
