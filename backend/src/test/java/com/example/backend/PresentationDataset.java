package com.example.backend;

import com.example.backend.bootstrap.DevelopmentDataSeeder;
import com.example.backend.bootstrap.PartnerCatalogSeeder;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import com.example.backend.service.BookingCompletionPolicy;
import com.example.backend.service.BookingService;
import jakarta.persistence.EntityManager;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.test.util.ReflectionTestUtils;
import javax.sql.DataSource;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static com.example.backend.model.DomainEnums.*;

/** Test-classpath only: never packaged in the production application. */
public final class PresentationDataset {
    public static final LocalDate FROM = LocalDate.of(2026, 10, 1), TO = LocalDate.of(2026, 10, 31);
    public static final BigDecimal TARGET = new BigDecimal("3045000");
    public record Entry(String code, String supplierSlug, String serviceName, LocalDate date) {}
    public record Result(BigDecimal baselineValue, long baselineCompleted, int inserted, BigDecimal completedValue, long completedCount) {}
    public static final List<Entry> PLAN = List.of(
        entry(1, "lumiere-beauty-house", "Makeup trong trẻo cá nhân", 5),
        entry(2, "lumiere-beauty-house", "Cắt & tạo kiểu cá nhân", 7),
        entry(3, "lumiere-beauty-house", "Massage thư giãn toàn thân", 9),
        entry(4, "lumiere-beauty-house", "Chăm sóc da phục hồi", 12),
        entry(5, "tham-my-hien-tran", "Điều trị mụn", 16),
        entry(6, "trang-tuti", "Nối mi", 19),
        entry(7, "trang-tuti", "Uốn mi", 21),
        entry(8, "trang-tuti", "Gội đầu cặp", 23),
        entry(9, "trang-tuti", "Gội đầu thường", 26));
    private static Entry entry(int index, String slug, String name, int day) {
        return new Entry("BL2610" + String.format("%04d", index), slug, name, LocalDate.of(2026, 10, day));
    }

    public static void requireIsolation(ConfigurableApplicationContext context) {
        var profiles = Arrays.asList(context.getEnvironment().getActiveProfiles());
        if (!profiles.contains("presentation") || profiles.contains("prod")) throw new IllegalStateException("Presentation profile only");
        try (var connection = context.getBean(DataSource.class).getConnection()) {
            if (!connection.getMetaData().getURL().matches("jdbc:h2:mem:beautylink-presentation(?:-[a-z0-9-]+)?"))
                throw new IllegalStateException("Only the dedicated in-memory presentation database is allowed");
        } catch (java.sql.SQLException error) { throw new IllegalStateException("Cannot validate presentation database", error); }
    }

    public static void catalog(ConfigurableApplicationContext context) throws Exception {
        requireIsolation(context);
        // Reuse the existing seed infrastructure; no replacement customer/workforce pool.
        context.getAutowireCapableBeanFactory().createBean(DevelopmentDataSeeder.class).run();
        context.getAutowireCapableBeanFactory().createBean(PartnerCatalogSeeder.class).run();
        var users = context.getBean(UserAccountRepository.class);
        var customer = users.findByPhone("0900000001").orElseThrow();
        if ("Khách hàng Demo".equals(customer.getFullName())) { customer.setFullName("Nguyễn Minh Anh"); users.save(customer); }
    }

    public static Result apply(ConfigurableApplicationContext context) {
        requireIsolation(context);
        var em = context.getBean(EntityManager.class);
        var repository = context.getBean(BookingRepository.class);
        var services = context.getBean(ServiceOfferingRepository.class);
        var suppliers = context.getBean(SupplierRepository.class);
        var people = context.getBean(PractitionerRepository.class);
        var users = context.getBean(UserAccountRepository.class);
        var baseline = eligible(em);
        var codes = PLAN.stream().map(Entry::code).toList();
        var existing = repository.findAll().stream().filter(b -> codes.contains(b.getBookingCode())).toList();
        if (baseline.size() != existing.size() || existing.stream().anyMatch(b -> b.getStatus() != BookingStatus.COMPLETED))
            throw new IllegalStateException("Unrecognized baseline: no booking or financial data was changed");
        var offerings = PLAN.stream().map(entry -> {
            var supplier = suppliers.findBySlug(entry.supplierSlug()).orElseThrow();
            return services.findBySupplierIdAndName(supplier.getId(), entry.serviceName()).orElseThrow();
        }).toList();
        if (offerings.stream().map(ServiceOffering::getPrice).reduce(BigDecimal.ZERO, BigDecimal::add).compareTo(TARGET) != 0)
            throw new IllegalStateException("Catalog prices no longer reconcile to the reviewed plan");
        var customers = users.findAll().stream().filter(u -> u.getRole() == Role.CUSTOMER && u.getStatus() == AccountStatus.ACTIVE).sorted(Comparator.comparing(UserAccount::getId)).toList();
        if (customers.isEmpty()) throw new IllegalStateException("Existing customers are required");
        int inserted = 0;
        for (int i = 0; i < PLAN.size(); i++) {
            var entry = PLAN.get(i); var offering = offerings.get(i);
            var previous = existing.stream().filter(b -> b.getBookingCode().equals(entry.code())).findFirst();
            if (previous.isPresent()) {
                if (!previous.get().getService().getId().equals(offering.getId()) || previous.get().getTotalAmount().compareTo(offering.getPrice()) != 0)
                    throw new IllegalStateException("Existing presentation record differs from its plan");
                continue;
            }
            var person = people.findBySupplierIdAndActiveTrue(offering.getSupplier().getId()).stream().filter(p -> p.supports(offering)).findFirst().orElseThrow();
            var customer = customers.get(i % customers.size());
            var booking = booking(entry.code(), offering, person, customer, entry.date());
            validSlot(context, booking);
            booking.setStatus(BookingStatus.PENDING); repository.saveAndFlush(booking);
            booking.setStatus(BookingStatus.CONFIRMED);
            // Simulated settlement state in this disposable DB only; no PaymentTransaction/receipt is created.
            booking.setPaymentStatus(PaymentStatus.PARTIALLY_PAID); repository.saveAndFlush(booking);
            context.getBean(BookingService.class).complete(customer, booking.getId());
            inserted++;
        }
        em.flush();
        var completed = eligible(em);
        if (sum(completed).compareTo(TARGET) != 0) throw new IllegalStateException("Completed service value does not reconcile");
        return new Result(sum(baseline), baseline.size(), inserted, sum(completed), completed.size());
    }

    public static void otherStatuses(ConfigurableApplicationContext context) {
        requireIsolation(context);
        var repository = context.getBean(BookingRepository.class);
        var source = repository.findAll().stream().filter(b -> b.getBookingCode().equals(PLAN.getFirst().code())).findFirst().orElseThrow();
        int index = 0;
        for (var status : List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CANCELLED)) {
            String code = "BL2610" + (1001 + index);
            if (repository.findAll().stream().noneMatch(b -> b.getBookingCode().equals(code))) {
                var b = booking(code, source.getService(), source.getPractitioner(), source.getCustomer(), LocalDate.of(2026, 11, 2 + index));
                ReflectionTestUtils.setField(b, "createdAt", Instant.now());
                validSlot(context, b); b.setStatus(status); repository.saveAndFlush(b);
            }
            index++;
        }
    }

    private static Booking booking(String code, ServiceOffering offering, Practitioner person, UserAccount customer, LocalDate date) {
        var b = new Booking(); b.setBookingCode(code); b.setService(offering); b.setSupplier(offering.getSupplier()); b.setPractitioner(person); b.setCustomer(customer);
        b.setAppointmentDate(date); b.setStartTime(LocalTime.of(9, 0)); b.setEndTime(b.getStartTime().plusMinutes(offering.getDurationMinutes()));
        b.setTotalAmount(offering.getPrice()); b.setStatus(BookingStatus.PENDING); b.setPaymentStatus(PaymentStatus.UNPAID);
        ReflectionTestUtils.setField(b, "createdAt", date.minusDays(1).atTime(10, 0).atZone(BookingCompletionPolicy.ZONE).toInstant());
        return b;
    }

    public static void validSlot(ConfigurableApplicationContext context, Booking b) {
        var rule = context.getBean(AvailabilityRuleRepository.class).findByPractitionerIdAndDayOfWeekAndActiveTrue(b.getPractitioner().getId(), b.getAppointmentDate().getDayOfWeek()).orElseThrow();
        var exception = context.getBean(ScheduleExceptionRepository.class).findByPractitionerIdAndExceptionDate(b.getPractitioner().getId(), b.getAppointmentDate());
        if (exception.isPresent()) throw new IllegalStateException("Review schedule exception before importing history");
        if (!b.getPractitioner().getSupplier().getId().equals(b.getSupplier().getId()) || !b.getService().getSupplier().getId().equals(b.getSupplier().getId()) || !b.getPractitioner().supports(b.getService())
                || b.getStartTime().isBefore(rule.getStartTime()) || b.getEndTime().isAfter(rule.getEndTime()) || !b.getEndTime().isAfter(b.getStartTime())
                || Duration.between(rule.getStartTime(), b.getStartTime()).toMinutes() % rule.getSlotMinutes() != 0
                || (rule.getBreakStart() != null && rule.getBreakEnd() != null && b.getStartTime().isBefore(rule.getBreakEnd()) && b.getEndTime().isAfter(rule.getBreakStart())))
            throw new IllegalStateException("Invalid practitioner/service schedule relationship");
        var start = b.getAppointmentDate().atTime(b.getStartTime()); var end = BookingCompletionPolicy.appointmentEnd(b);
        boolean conflict = context.getBean(BookingRepository.class).findAll().stream().filter(other -> other.getStatus() != BookingStatus.CANCELLED && !Objects.equals(other.getId(), b.getId()))
                .anyMatch(other -> (other.getPractitioner().getId().equals(b.getPractitioner().getId()) || other.getCustomer().getId().equals(b.getCustomer().getId())) && BookingCompletionPolicy.overlaps(other, start, end));
        if (conflict) throw new IllegalStateException("Customer or practitioner schedule conflict");
    }

    private static List<Booking> eligible(EntityManager em) {
        return em.createQuery("select b from Booking b where b.status = :status and b.customer.role = :role and b.supplier.demoData = false and b.createdAt >= :from and b.createdAt < :to", Booking.class)
                .setParameter("status", BookingStatus.COMPLETED).setParameter("role", Role.CUSTOMER)
                .setParameter("from", FROM.atStartOfDay(BookingCompletionPolicy.ZONE).toInstant()).setParameter("to", TO.plusDays(1).atStartOfDay(BookingCompletionPolicy.ZONE).toInstant()).getResultList();
    }
    private static BigDecimal sum(List<Booking> rows) { return rows.stream().map(Booking::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add); }
}
