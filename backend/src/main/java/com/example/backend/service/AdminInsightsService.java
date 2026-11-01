package com.example.backend.service;

import com.example.backend.dto.AdminV2Dtos.*;
import com.example.backend.dto.AdminV2Dtos.Period;
import com.example.backend.model.DomainEnums.*;
import com.example.backend.repository.AdminReadRepository;
import com.example.backend.exception.ApiException;
import org.springframework.http.HttpStatus;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import static com.example.backend.dto.AdminV2Dtos.ComparisonStatus.*;
import static com.example.backend.dto.AdminV2Dtos.MetricUnit.*;
import static com.example.backend.repository.AdminReadRepository.*;
import static com.example.backend.service.DashboardComparison.*;

@Service
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class AdminInsightsService {
    private final AdminReadRepository read;
    private final AdminDashboardService dashboard;
    private final PresentationRecoveryService recovery;
    private final int lowBase, smallDenominator;
    private final Clock clock;

    @Autowired
    public AdminInsightsService(AdminReadRepository read, AdminDashboardService dashboard, PresentationRecoveryService recovery,
            @Value("${app.dashboard.low-base-threshold:4}") int lowBase,
            @Value("${app.dashboard.small-rate-denominator:20}") int smallDenominator) {
        this(read, dashboard, recovery, lowBase, smallDenominator, Clock.systemUTC());
    }
    AdminInsightsService(AdminReadRepository read, AdminDashboardService dashboard, PresentationRecoveryService recovery,
            int lowBase, int smallDenominator, Clock clock) {
        if (lowBase < 1 || smallDenominator < 1) throw new IllegalArgumentException("Positive reporting thresholds required");
        this.read = read; this.dashboard = dashboard; this.recovery = recovery;
        this.lowBase = lowBase; this.smallDenominator = smallDenominator; this.clock = clock;
    }

    private record BookingFact(long id, Instant createdAt, BookingStatus status, BigDecimal value, long customerId,
            long supplierId, String supplierName, String location, long serviceId, String serviceName) {}
    private record Receipt(long bookingId, long supplierId, String supplierName, String location, Instant paidAt, BigDecimal amount) {}
    private record Cohort(List<BookingFact> bookings, long paidBookings, BigDecimal revenue, BigDecimal serviceValue) {}

    public Insights insights(LocalDate from, LocalDate to, boolean demo, Granularity granularity) {
        Instant asOf = clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        LocalDate today = asOf.atZone(ZONE).toLocalDate();
        LocalDate endDate = to == null ? today : to;
        var requested = dashboard.range(from == null ? endDate.minusDays(29) : from, endDate, demo);
        if (requested.fromDate().isAfter(today)) throw new ApiException(HttpStatus.BAD_REQUEST, "REPORTING_PERIOD_NOT_STARTED", "Khoảng thống kê chưa bắt đầu; chọn ngày bắt đầu không sau hôm nay.");
        var periods = periods(requested.fromDate(), requested.toDate(), asOf);
        var current = periods.current(); var previous = periods.previous();
        var combined = new AdminDashboardService.Range(previous.startInclusive().atZone(ZONE).toLocalDate(), requested.toDate(), previous.startInclusive(), current.endExclusive(), demo);
        // Scalar projections in bulk: no entity traversal, many-attempt join, or request/query per card.
        var facts = new LinkedHashMap<Long, BookingFact>();
        read.rows("select b.id, b.createdAt, b.status, b.totalAmount, b.customer.id, b.supplier.id, b.supplier.name, l.name, b.service.id, b.service.name from Booking b left join b.supplier.location l where " + COHORT, combined, Integer.MAX_VALUE)
                .forEach(r -> facts.put(number(r[0]), new BookingFact(number(r[0]), (Instant) r[1], (BookingStatus) r[2], money(r[3]), number(r[4]), number(r[5]), (String) r[6], (String) r[7], number(r[8]), (String) r[9])));
        var receipts = read.rows("select b.id, b.supplier.id, b.supplier.name, l.name, p.paidAt, p.amount from PaymentTransaction p join p.booking b left join b.supplier.location l where " + PAYMENT_PERIOD + " and " + PAID, combined, Integer.MAX_VALUE)
                .stream().map(r -> new Receipt(number(r[0]), number(r[1]), (String) r[2], (String) r[3], (Instant) r[4], money(r[5]))).toList();
        JsonNode stored = recovery.data();
        addStoredBookings(facts, stored, combined);
        var reportReceipts = new ArrayList<>(receipts);
        var reportSuppliers = new HashMap<Long,Object[]>();
        read.rows("select s.id,s.name,l.name from Supplier s left join s.location l where (:demo = true or s.demoData = false)",combined,Integer.MAX_VALUE)
                .forEach(r->reportSuppliers.put(number(r[0]),r));
        for(var p:recovery.reportingPayments()) {
            var supplier=reportSuppliers.get(p.supplierId());
            if(supplier!=null && !p.paidAt().isBefore(combined.from()) && p.paidAt().isBefore(combined.to()))
                reportReceipts.add(new Receipt(p.bookingId(),p.supplierId(),(String)supplier[1],(String)supplier[2],p.paidAt(),p.amount()));
        }
        Cohort now = cohort(facts.values(), receipts, current), before = cohort(facts.values(), receipts, previous);
        Cohort reportCohort = cohort(facts.values(), reportReceipts, current), previousReportCohort = cohort(facts.values(), reportReceipts, previous);
        BigDecimal reportNow=reportReceipts.stream().filter(p->inside(p.paidAt(),current)).map(Receipt::amount).reduce(BigDecimal.ZERO,BigDecimal::add);
        BigDecimal reportBefore=reportReceipts.stream().filter(p->inside(p.paidAt(),previous)).map(Receipt::amount).reduce(BigDecimal.ZERO,BigDecimal::add);
        long currentUsers = users(current.endExclusive(), stored, combined), previousUsers = users(previous.endExclusive(), stored, combined);
        long active = read.count("select count(s) from Supplier s where s.verificationStatus = :approval and s.owner.status = :active and (:demo = true or s.demoData = false)", combined);
        var currentRange = new AdminDashboardService.Range(requested.fromDate(), requested.toDate(), current.startInclusive(), current.endExclusive(), demo);
        long attempts = read.count("select count(p) from PaymentTransaction p join p.booking b where p.createdAt >= :from and p.createdAt < :to and b.customer.role = :customer and (:demo = true or b.supplier.demoData = false)", currentRange);
        long success = read.count("select count(p) from PaymentTransaction p join p.booking b where p.createdAt >= :from and p.createdAt < :to and b.customer.role = :customer and (:demo = true or b.supplier.demoData = false) and p.status = :paid and p.requiresManualReview = false and p.paidAt is not null and p.paidAt < :to", currentRange);
        var statuses = new EnumMap<BookingStatus, Long>(BookingStatus.class);
        now.bookings().forEach(b -> statuses.merge(b.status(), 1L, Long::sum));
        String scope = "Phạm vi: CUSTOMER, loại đối tác có cờ dữ liệu thử khi includeDemo=false. ";
        String unavailableCompletion = "Thiếu thời điểm hoàn thành thực tế (Booking không có completedAt/lịch sử chuyển trạng thái). Không dùng createdAt, ngày hẹn hoặc updatedAt thay thế.";
        var totalMetric = compare(BigDecimal.valueOf(now.bookings().size()), BigDecimal.valueOf(before.bookings().size()), BOOKING,
                scope + "Nguồn Booking và lịch sử báo cáo đã lưu trong presentation_recovery. Đếm ID duy nhất theo createdAt trong [bắt đầu, kết thúc), mọi trạng thái PENDING/CONFIRMED/COMPLETED/CANCELLED.");
        return new Insights(requested.response(), granularity, current, previous, ZONE.getId(), asOf, lowBase, smallDenominator,
                totalMetric,
                compare(BigDecimal.valueOf(currentUsers), BigDecimal.valueOf(previousUsers), ACCOUNT,
                        "Tổng tích lũy tài khoản còn lưu (CUSTOMER, SUPPLIER, STAFF, ADMIN) có createdAt < mốc kết thúc mỗi kỳ; gồm hồ sơ báo cáo đã lưu. Hồ sơ có overlay dùng ngày hồ sơ báo cáo nhất quán với danh sách; ngày đăng ký vận hành gốc không đổi. Không phải người dùng mới trong kỳ; không tái dựng tài khoản đã xóa."),
                compare(now.revenue(), before.revenue(), VND,
                        scope + "Nguồn PaymentTransaction, không cộng presentation_recovery. Doanh thu ở đây là tổng thu online xác minh (gross) theo paidAt: PAID đầu tiên mỗi booking, không manual review, paidAt hợp lệ. Chỉ cộng amount đã nhận (cọc 5% không phải 100% giá dịch vụ); không gồm tiền tại salon, không phải hoa hồng. Giữ chính sách sổ thu hiện có: chưa trừ hoàn tiền ngoài app vì không có sổ hoàn tiền/thời điểm hoàn tiền."),
                unavailable(BigDecimal.valueOf(active), PARTNER, "Snapshot vận hành tại asOf: Supplier VERIFIED và chủ tài khoản ACTIVE; loại demo theo bộ lọc. Không có lịch sử trạng thái nên không so sánh theo kỳ hoặc dùng trạng thái lưu trong báo cáo thay trạng thái vận hành.", CURRENT_SNAPSHOT),
                rate(now.paidBookings(), now.bookings().size(), before.paidBookings(), before.bookings().size(), scope + "Booking tạo trong kỳ có PAID đầu tiên đã xác minh trước mốc kết thúc kỳ / mọi booking tạo trong cùng kỳ (gồm lịch hủy và lịch sử báo cáo đã lưu). Đếm booking, không đếm lần thử; tiền cọc mô phỏng không được tính. Chênh lệch tính bằng điểm phần trăm.", smallDenominator),
                unavailable(null, BOOKING, unavailableCompletion, INSUFFICIENT_HISTORY),
                unavailable(now.serviceValue(), VND, scope + "Giá trị dịch vụ của booking tạo trong khoảng lọc đang có trạng thái COMPLETED tại asOf (snapshot cohort). Không phải doanh thu phát sinh/tiền thực thu trong kỳ; không so sánh quá khứ khi thiếu lịch sử hoàn thành.", INSUFFICIENT_HISTORY),
                unavailable(null, CUSTOMER, "Khách duy nhất có đơn hoàn thành trong kỳ và ít nhất một đơn hoàn thành sớm hơn. " + unavailableCompletion, INSUFFICIENT_HISTORY),
                compare(reportNow,reportBefore,VND,"Tổng thanh toán báo cáo theo thời điểm ghi nhận: tiền PayOS xác minh cộng các khoản mô phỏng trong partition báo cáo. Tổng bằng tiền cọc + thanh toán đủ; không phải giá trị dịch vụ hay tiền PayOS đã xác minh. Metadata cọc phục hồi cũ không phải receipt nên không được cộng lại."),
                rate(reportCohort.paidBookings(),reportCohort.bookings().size(),previousReportCohort.paidBookings(),previousReportCohort.bookings().size(),
                        scope + "Tỷ lệ đo được: booking tạo trong kỳ có khoản PayOS xác minh hoặc receipt mô phỏng trước mốc chốt / mọi booking tạo trong cùng kỳ, gồm lịch hủy. Đếm booking duy nhất, không đếm lượt thử; metadata cọc cũ không có receipt không được tính. Đây không phải chỉ tiêu trình bày hoặc tỷ lệ riêng PayOS.",smallDenominator),
                unavailable(BigDecimal.valueOf(now.bookings().stream().filter(b->b.status()==BookingStatus.COMPLETED).count()),BOOKING,"Số booking tạo trong kỳ đang có trạng thái COMPLETED tại mốc chốt, gồm hồ sơ báo cáo. Đây là snapshot trạng thái, không phải số lần chuyển sang hoàn thành phát sinh trong kỳ; không so sánh quá khứ khi thiếu lịch sử.",CURRENT_SNAPSHOT),
                reportActivePartners(stored,reportSuppliers.keySet()),
                now.bookings().stream().map(BookingFact::customerId).distinct().count(), attempts, success,
                attempts == 0 ? null : percentage(success, attempts).doubleValue(),
                trends(now, receipts, reportReceipts, current, requested.fromDate(), granularity),
                Arrays.stream(BookingStatus.values()).map(s -> new StatusCount(s, statuses.getOrDefault(s, 0L))).toList(),
                topSalons(now, receipts, reportReceipts, current), popularServices(now));
    }

    private Metric reportActivePartners(JsonNode stored, Set<Long> supplierIds) {
        if (stored == null || !stored.path("salons").isArray() || stored.path("salons").isEmpty()) return null;
        var activeIds = new HashSet<Long>();
        for (var salon : stored.path("salons"))
            if (supplierIds.contains(salon.path("id").asLong()) && salon.path("active").asBoolean() && "VERIFIED".equals(salon.path("approvalStatus").asText()))
                activeIds.add(salon.path("id").asLong());
        return unavailable(BigDecimal.valueOf(activeIds.size()), PARTNER,
                "Snapshot danh sách Đối tác trong hồ sơ báo cáo: đếm ID salon duy nhất được đánh dấu active và VERIFIED, còn tồn tại trong danh mục và thuộc phạm vi bộ lọc. Không phụ thuộc ngày đặt lịch; không phải trạng thái quyền đăng nhập của chủ salon. Trạng thái vận hành được giữ riêng trong activePartners; không so sánh lịch sử khi thiếu dữ liệu.", CURRENT_SNAPSHOT);
    }

    private Cohort cohort(Collection<BookingFact> all, List<Receipt> receipts, Period period) {
        var bookings = all.stream().filter(b -> inside(b.createdAt(), period)).toList();
        var paid = new HashSet<Long>();
        // Same cutoff for numerator/denominator: never today's payment state for a past cohort.
        receipts.stream().filter(p -> p.paidAt().isBefore(period.endExclusive())).forEach(p -> paid.add(p.bookingId()));
        return new Cohort(bookings, bookings.stream().filter(b -> paid.contains(b.id())).count(),
                receipts.stream().filter(p -> inside(p.paidAt(), period)).map(Receipt::amount).reduce(BigDecimal.ZERO, BigDecimal::add),
                bookings.stream().filter(b -> b.status() == BookingStatus.COMPLETED).map(BookingFact::value).reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    private long users(Instant cutoff, JsonNode stored, AdminDashboardService.Range range) {
        long count = ((Number) read.query("select count(u) from UserAccount u where u.createdAt < :cutoff", range).setParameter("cutoff", cutoff).getSingleResult()).longValue();
        JsonNode metadata=stored==null?recovery.profileMetadata():stored;
        if(metadata!=null)for(var p:metadata.path("displayProfiles"))if(p.path("id").asLong()<8_000_000_000L&&p.has("reportCreatedAt")) {
            Instant original=Instant.parse(p.has("actualCreatedAt")?p.path("actualCreatedAt").asText():p.path("original").path("createdAt").asText()),display=Instant.parse(p.path("reportCreatedAt").asText());
            count+=(display.isBefore(cutoff)?1:0)-(original.isBefore(cutoff)?1:0);
        }
        var ids = new HashSet<Long>();
        if (stored != null) for (var u : stored.path("users")) if (u.path("id").asLong() >= 8_000_000_000L && instant(u).isBefore(cutoff)) ids.add(u.path("id").asLong());
        return count + ids.size();
    }

    private void addStoredBookings(Map<Long, BookingFact> facts, JsonNode stored, AdminDashboardService.Range range) {
        if (stored == null || stored.path("bookings").isEmpty()) return;
        var suppliers = new HashMap<Long, Object[]>();
        read.rows("select s.id, s.name, l.name from Supplier s left join s.location l where (:demo = true or s.demoData = false)", range, Integer.MAX_VALUE).forEach(r -> suppliers.put(number(r[0]), r));
        for (var b : stored.path("bookings")) {
            long id = b.path("id").asLong(), supplierId = b.path("supplierId").asLong();
            if (id < 9_000_000_000L) throw new IllegalStateException("Recovery booking outside reserved partition");
            var supplier = suppliers.get(supplierId);
            if (supplier == null) continue;
            Instant created = instant(b);
            if (created.isBefore(range.from()) || !created.isBefore(range.to())) continue;
            if (!b.path("totalAmount").isNumber() || b.path("customerId").asLong() <= 0 || b.path("serviceId").asLong() <= 0) throw new IllegalStateException("Incomplete recovery booking");
            facts.putIfAbsent(id, new BookingFact(id, created, BookingStatus.valueOf(b.path("status").asText()), money(b.path("totalAmount").decimalValue()), b.path("customerId").asLong(), supplierId, (String) supplier[1], (String) supplier[2], b.path("serviceId").asLong(), b.path("serviceName").asText()));
        }
    }

    private List<Trend> trends(Cohort cohort, List<Receipt> receipts, List<Receipt> reportReceipts, Period period, LocalDate from, Granularity grain) {
        var buckets = new TreeMap<LocalDate, Trend>();
        LocalDate last = period.endExclusive().minusNanos(1).atZone(ZONE).toLocalDate();
        for (LocalDate day = from; !day.isAfter(last); day = day.plusDays(1)) {
            LocalDate key = bucket(day, from, grain); buckets.putIfAbsent(key, new Trend(key, 0, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO));
        }
        for (var b : cohort.bookings()) {
            LocalDate key = bucket(b.createdAt().atZone(ZONE).toLocalDate(), from, grain); var p = buckets.get(key);
            buckets.put(key, new Trend(key, p.bookings() + 1, p.verifiedOnlineAmount(), p.completedServiceValue().add(b.status() == BookingStatus.COMPLETED ? b.value() : BigDecimal.ZERO),p.reportPaymentAmount()));
        }
        for (var r : receipts) if (inside(r.paidAt(), period)) {
            LocalDate key = bucket(r.paidAt().atZone(ZONE).toLocalDate(), from, grain); var p = buckets.get(key);
            buckets.put(key, new Trend(key, p.bookings(), p.verifiedOnlineAmount().add(r.amount()), p.completedServiceValue(),p.reportPaymentAmount()));
        }
        for(var r:reportReceipts) if(inside(r.paidAt(),period)) {
            LocalDate key=bucket(r.paidAt().atZone(ZONE).toLocalDate(),from,grain); var p=buckets.get(key);
            buckets.put(key,new Trend(key,p.bookings(),p.verifiedOnlineAmount(),p.completedServiceValue(),p.reportPaymentAmount().add(r.amount())));
        }
        return List.copyOf(buckets.values());
    }
    private List<TopSalon> topSalons(Cohort cohort, List<Receipt> receipts, List<Receipt> reportReceipts, Period period) {
        var salons = new HashMap<Long, TopSalon>();
        for (var b : cohort.bookings()) {
            var p = salons.getOrDefault(b.supplierId(), new TopSalon(b.supplierId(), b.supplierName(), b.location(), 0, BigDecimal.ZERO, BigDecimal.ZERO,BigDecimal.ZERO));
            salons.put(b.supplierId(), new TopSalon(p.id(), p.name(), p.location(), p.bookings() + 1, p.verifiedOnlineAmount(), p.completedServiceValue().add(b.status() == BookingStatus.COMPLETED ? b.value() : BigDecimal.ZERO),p.reportPaymentAmount()));
        }
        // Same receipt period as the revenue card/chart, not the booking-created cohort.
        for (var r : receipts) if (inside(r.paidAt(), period)) {
            var p = salons.getOrDefault(r.supplierId(), new TopSalon(r.supplierId(), r.supplierName(), r.location(), 0, BigDecimal.ZERO, BigDecimal.ZERO,BigDecimal.ZERO));
            salons.put(p.id(), new TopSalon(p.id(), p.name(), p.location(), p.bookings(), p.verifiedOnlineAmount().add(r.amount()), p.completedServiceValue(),p.reportPaymentAmount()));
        }
        for(var r:reportReceipts) if(inside(r.paidAt(),period)) {
            var p=salons.getOrDefault(r.supplierId(),new TopSalon(r.supplierId(),r.supplierName(),r.location(),0,BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO));
            salons.put(p.id(),new TopSalon(p.id(),p.name(),p.location(),p.bookings(),p.verifiedOnlineAmount(),p.completedServiceValue(),p.reportPaymentAmount().add(r.amount())));
        }
        return salons.values().stream().sorted(Comparator.comparingLong(TopSalon::bookings).reversed().thenComparingLong(TopSalon::id)).limit(5).toList();
    }
    private List<PopularService> popularServices(Cohort cohort) {
        var counts = new HashMap<Long, PopularService>();
        for (var b : cohort.bookings()) { var p = counts.getOrDefault(b.serviceId(), new PopularService(b.serviceId(), b.serviceName(), b.supplierName(), 0, 0)); counts.put(b.serviceId(), new PopularService(p.id(), p.name(), p.supplierName(), p.bookings() + 1, 0)); }
        return counts.values().stream().sorted(Comparator.comparingLong(PopularService::bookings).reversed().thenComparingLong(PopularService::id)).limit(10)
                .map(p -> new PopularService(p.id(), p.name(), p.supplierName(), p.bookings(), percentage(p.bookings(), cohort.bookings().size()).doubleValue())).toList();
    }
    private Metric compare(BigDecimal value, BigDecimal previous, MetricUnit unit, String definition) { return metric(value, previous, unit, definition, lowBase); }
    private static LocalDate bucket(LocalDate day, LocalDate from, Granularity grain) {
        LocalDate key = switch (grain) { case DAY -> day; case WEEK -> day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)); case MONTH -> day.withDayOfMonth(1); };
        return key.isBefore(from) ? from : key;
    }
    private static boolean inside(Instant at, Period p) { return !at.isBefore(p.startInclusive()) && at.isBefore(p.endExclusive()); }
    private static Instant instant(JsonNode node) { return Instant.parse(node.path("createdAt").asText()); }
    private static long number(Object value) { return ((Number) value).longValue(); }
    private static BigDecimal money(Object value) { return value == null ? BigDecimal.ZERO : new BigDecimal(value.toString()); }
}
