package com.example.backend.service;

import com.example.backend.dto.AdminV2Dtos.*;
import com.example.backend.model.DomainEnums.*;
import com.example.backend.repository.AdminReadRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import java.math.*;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import static com.example.backend.repository.AdminReadRepository.*;

@Service
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class AdminInsightsService {
    private final AdminReadRepository read;
    private final AdminDashboardService dashboard;
    public AdminInsightsService(AdminReadRepository read, AdminDashboardService dashboard) { this.read = read; this.dashboard = dashboard; }

    public Insights insights(LocalDate from, LocalDate to, boolean demo, Granularity granularity) {
        var range = dashboard.range(from, to, demo);
        long days = range.toDate().toEpochDay() - range.fromDate().toEpochDay() + 1;
        var previous = dashboard.range(range.fromDate().minusDays(days), range.fromDate().minusDays(1), demo);
        var statuses = counts(range); var previousStatuses = counts(previous);
        long total = statuses.values().stream().mapToLong(Long::longValue).sum();
        long previousTotal = previousStatuses.values().stream().mapToLong(Long::longValue).sum();
        BigDecimal revenue = revenue(range), previousRevenue = revenue(previous);
        long active = read.count("select count(s) from Supplier s where s.verificationStatus = :approval and s.owner.status = :active and (:demo = true or s.demoData = false)", range);
        // Snapshot status history is not recorded, so no historical partner trend can be asserted.
        long attempts = read.count("select count(p) from PaymentTransaction p join p.booking b where p.createdAt >= :from and p.createdAt < :to and b.customer.role = :customer and (:demo = true or b.supplier.demoData = false)", range);
        long success = read.count("select count(p) from PaymentTransaction p join p.booking b where p.createdAt >= :from and p.createdAt < :to and b.customer.role = :customer and (:demo = true or b.supplier.demoData = false) and p.status = :paid and p.requiresManualReview = false and p.paidAt is not null", range);
        var salonAmounts = new HashMap<Long, BigDecimal>();
        var top = read.rows("select b.supplier.id, b.supplier.name, l.name, count(b) from Booking b left join b.supplier.location l where " + COHORT + " group by b.supplier.id, b.supplier.name, l.name order by count(b) desc, b.supplier.id asc", range, 5);
        if (!top.isEmpty()) {
            @SuppressWarnings("unchecked") List<Object[]> amounts = read.query("select b.supplier.id, sum(p.amount) from PaymentTransaction p join p.booking b where " + COHORT + " and " + PAID + " and b.supplier.id in :ids group by b.supplier.id", range).setParameter("ids", top.stream().map(r -> (Long)r[0]).toList()).getResultList();
            amounts.forEach(row -> salonAmounts.put((Long) row[0], money(row[1])));
        }
        List<TopSalon> salons = top.stream().map(r -> new TopSalon((Long) r[0], (String) r[1], (String) r[2], number(r[3]), salonAmounts.getOrDefault((Long) r[0], BigDecimal.ZERO))).toList();
        List<PopularService> services = read.rows("select b.service.id, b.service.name, b.supplier.name, count(b) from Booking b where " + COHORT + " group by b.service.id, b.service.name, b.supplier.name order by count(b) desc, b.service.id asc", range, 10)
                .stream().map(r -> new PopularService((Long) r[0], (String) r[1], (String) r[2], number(r[3]), percentage(number(r[3]), total))).toList();
        return new Insights(range.response(), granularity,
                metric(total, previousTotal, "Booking.createdAt; mọi trạng thái, gồm lịch hủy"),
                metric(newUsers(range), newUsers(previous), "UserAccount.createdAt; mọi vai trò, gồm tài khoản tổng hợp vì schema không có cờ demo cho user"),
                metric(revenue, previousRevenue, "Gross online; paidAt; PAID đầu tiên/booking, không cộng cờ manual; chưa trừ hoàn tiền ngoài app"),
                new Metric(BigDecimal.valueOf(active), null, null, "Snapshot hiện tại: VERIFIED và chủ tài khoản ACTIVE; không có lịch sử phê duyệt"),
                metric(rate(range, total), rate(previous, previousTotal), "Booking có PAID xác minh đầu tiên / mọi booking tạo trong kỳ, gồm lịch hủy"),
                metric(statuses.getOrDefault(BookingStatus.COMPLETED, 0L), previousStatuses.getOrDefault(BookingStatus.COMPLETED, 0L), "Trạng thái COMPLETED hiện tại của booking tạo trong kỳ"),
                read.count("select count(distinct b.customer.id) from Booking b where " + COHORT, range),
                attempts, success, attempts == 0 ? null : percentage(success, attempts), trends(range, granularity),
                Arrays.stream(BookingStatus.values()).map(s -> new StatusCount(s, statuses.getOrDefault(s, 0L))).toList(), salons, services);
    }
    private Map<BookingStatus, Long> counts(AdminDashboardService.Range range) {
        var values = new EnumMap<BookingStatus, Long>(BookingStatus.class);
        read.rows("select b.status, count(b) from Booking b where " + COHORT + " group by b.status", range, 4).forEach(r -> values.put((BookingStatus) r[0], number(r[1])));
        return values;
    }
    private long newUsers(AdminDashboardService.Range r) { return read.count("select count(u) from UserAccount u where u.createdAt >= :from and u.createdAt < :to", r); }
    private BigDecimal revenue(AdminDashboardService.Range r) {
        return money(read.query("select coalesce(sum(p.amount),0) from PaymentTransaction p join p.booking b where " + PAYMENT_PERIOD + " and " + PAID, r).getSingleResult());
    }
    private BigDecimal rate(AdminDashboardService.Range r, long denominator) {
        long paid = read.count("select count(b) from Booking b where " + COHORT + " and exists (select p.id from PaymentTransaction p where p.booking=b and " + PAID + ")", r);
        return BigDecimal.valueOf(percentage(paid, denominator));
    }
    private List<Trend> trends(AdminDashboardService.Range range, Granularity grain) {
        Map<LocalDate, Long> bookings = new HashMap<>(); Map<LocalDate, BigDecimal> amounts = new HashMap<>();
        // Shift instants by Vietnam's fixed UTC+07 before date grouping; SQL is generated for each dialect.
        read.rows("select cast(timestampadd(hour,7,b.createdAt) as LocalDate), count(b) from Booking b where " + COHORT + " group by cast(timestampadd(hour,7,b.createdAt) as LocalDate)", range, 366)
                .forEach(r -> bookings.put((LocalDate) r[0], number(r[1])));
        read.rows("select cast(timestampadd(hour,7,p.paidAt) as LocalDate), sum(p.amount) from PaymentTransaction p join p.booking b where " + PAYMENT_PERIOD + " and " + PAID + " group by cast(timestampadd(hour,7,p.paidAt) as LocalDate)", range, 366)
                .forEach(r -> amounts.put((LocalDate) r[0], money(r[1])));
        Map<LocalDate, Trend> buckets = new TreeMap<>();
        for (LocalDate date = range.fromDate(); !date.isAfter(range.toDate()); date = date.plusDays(1)) {
            LocalDate key = switch (grain) { case DAY -> date; case WEEK -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)); case MONTH -> date.withDayOfMonth(1); };
            if (key.isBefore(range.fromDate())) key = range.fromDate();
            Trend previous = buckets.getOrDefault(key, new Trend(key, 0, BigDecimal.ZERO));
            buckets.put(key, new Trend(key, previous.bookings() + bookings.getOrDefault(date, 0L), previous.verifiedOnlineAmount().add(amounts.getOrDefault(date, BigDecimal.ZERO))));
        }
        return List.copyOf(buckets.values());
    }
    private static long number(Object value) { return ((Number) value).longValue(); }
    private static BigDecimal money(Object value) { return value == null ? BigDecimal.ZERO : new BigDecimal(value.toString()); }
    private static double percentage(long value, long total) { return total == 0 ? 0 : BigDecimal.valueOf(value).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP).doubleValue(); }
    private static Metric metric(long value, long previous, String basis) { return metric(BigDecimal.valueOf(value), BigDecimal.valueOf(previous), basis); }
    private static Metric metric(BigDecimal value, BigDecimal previous, String basis) {
        return new Metric(value, previous, previous.signum() == 0 ? null : value.subtract(previous).multiply(BigDecimal.valueOf(100)).divide(previous, 1, RoundingMode.HALF_UP).doubleValue(), basis);
    }
}
