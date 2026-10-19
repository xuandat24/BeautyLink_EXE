package com.example.customerseed;

import com.example.backend.model.*;
import com.example.backend.repository.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import static com.example.backend.model.DomainEnums.VerificationStatus.VERIFIED;

/** Only explicit bio markers are managed; unmarked supplier workforce is never adopted or changed. */
public final class PractitionerSeedService {
    public static final int SIZE = 24;
    public static final String MARKER = "DEMO BeautyLink [bl-practitioner-";
    public record Profile(int index, String name, String supplierSlug) {
        public String marker() { return MARKER + String.format("%03d", index) + "]"; }
    }
    public record Result(int existing, int inserted, int missingSchedules, int conflicts) {}
    private final PractitionerRepository practitioners;
    private final SupplierRepository suppliers;
    private final ServiceOfferingRepository services;
    private final AvailabilityRuleRepository rules;
    private final EntityManager em;
    private final PlatformTransactionManager manager;

    public PractitionerSeedService(PractitionerRepository practitioners, SupplierRepository suppliers,
            ServiceOfferingRepository services, AvailabilityRuleRepository rules, EntityManager em,
            PlatformTransactionManager manager) {
        this.practitioners = practitioners; this.suppliers = suppliers; this.services = services;
        this.rules = rules; this.em = em; this.manager = manager;
    }

    public static List<Profile> manifest(Path path) throws java.io.IOException {
        var lines = Files.readAllLines(path, StandardCharsets.UTF_8);
        if (lines.size() != SIZE + 1 || !lines.getFirst().equals("index|displayName|supplierSlug"))
            throw new IllegalArgumentException("Expected exactly 24 practitioner profiles");
        List<Profile> result = new ArrayList<>();
        Set<String> names = new HashSet<>();
        for (int i = 1; i <= SIZE; i++) {
            var f = lines.get(i).split("\\|", -1);
            if (f.length != 3 || !f[0].equals(Integer.toString(i))
                    || !f[1].matches("[\\p{L}]+(?: [\\p{L}]+)+") || f[1].length() > 120
                    || !names.add(f[1]) || !f[2].matches("[a-z0-9-]{3,180}"))
                throw new IllegalArgumentException("Invalid practitioner row " + i);
            result.add(new Profile(i, f[1], f[2]));
        }
        return List.copyOf(result);
    }

    public Result run(List<Profile> profiles, boolean apply) {
        if (profiles.size() != SIZE) throw new IllegalArgumentException("Expected 24 practitioners");
        var tx = new TransactionTemplate(manager);
        tx.setReadOnly(!apply);
        return tx.execute(status -> {
            if (apply) {
                // Serialize repeat CLI runs before reading the managed rows.
                profiles.stream().map(Profile::supplierSlug).distinct().sorted().forEach(slug ->
                        em.createQuery("select s from Supplier s where s.slug = :slug", Supplier.class)
                                .setParameter("slug", slug).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList());
            }
            Result plan = inspect(profiles, false);
            if (!apply || plan.conflicts() != 0) {
                if (apply) throw new IllegalStateException("Practitioner seed conflicts; no records changed");
                return plan;
            }
            Result result = inspect(profiles, true);
            if (result.conflicts() != 0) throw new IllegalStateException("Practitioner seed changed during apply");
            em.flush();
            return result;
        });
    }

    private Result inspect(List<Profile> profiles, boolean apply) {
        Map<String, List<Practitioner>> managed = new HashMap<>();
        for (var p : em.createQuery("select p from Practitioner p where p.bio like :marker", Practitioner.class)
                .setParameter("marker", MARKER + "%").getResultList())
            managed.computeIfAbsent(p.getBio(), ignored -> new ArrayList<>()).add(p);
        Set<String> expected = new HashSet<>();
        profiles.forEach(p -> expected.add(p.marker()));
        int conflicts = (int) managed.keySet().stream().filter(k -> !expected.contains(k)).count();
        int existing = 0, inserted = 0, missingSchedules = 0;
        for (var profile : profiles) {
            Supplier supplier = suppliers.findBySlug(profile.supplierSlug()).orElse(null);
            if (supplier == null || supplier.getVerificationStatus() != VERIFIED) { conflicts++; continue; }
            var offerings = services.findBySupplierIdAndActiveTrue(supplier.getId());
            if (offerings.isEmpty() || offerings.stream().anyMatch(s -> s.getDurationMinutes() <= 0
                    || s.getDurationMinutes() > 360)) { conflicts++; continue; }
            var matches = managed.getOrDefault(profile.marker(), List.of());
            if (matches.size() > 1) { conflicts++; continue; }
            Practitioner p = matches.isEmpty() ? null : matches.getFirst();
            if (p != null) {
                if (!p.getSupplier().getId().equals(supplier.getId()) || !p.getDisplayName().equals(profile.name())
                        || p.getUser() != null || !p.isActive() || !p.isServiceAssignmentsRestricted()
                        || p.getSupportedServices().isEmpty()
                        || p.getSupportedServices().stream().anyMatch(s -> !s.isActive()
                                || !s.getSupplier().getId().equals(supplier.getId()))) { conflicts++; continue; }
                existing++;
            } else {
                boolean unmarkedDuplicate = practitioners.findBySupplierIdOrderById(supplier.getId()).stream()
                        .anyMatch(real -> real.getDisplayName().equals(profile.name()));
                if (unmarkedDuplicate) { conflicts++; continue; }
                if (apply) {
                    p = new Practitioner();
                    p.setSupplier(supplier); p.setDisplayName(profile.name()); p.setBio(profile.marker());
                    p.setSpecialty("DEMO - " + supplier.getBusinessType()); p.setActive(true);
                    p.setServiceAssignmentsRestricted(true); p.getSupportedServices().addAll(offerings);
                    p = practitioners.save(p); inserted++;
                }
            }
            var schedule = p == null ? List.<AvailabilityRule>of() : rules.findByPractitionerIdOrderByDayOfWeek(p.getId());
            if (schedule.stream().anyMatch(r -> !validSchedule(r))) { conflicts++; continue; }
            Set<DayOfWeek> present = new HashSet<>();
            schedule.forEach(r -> present.add(r.getDayOfWeek()));
            if (present.size() != schedule.size()) { conflicts++; continue; }
            int activeDays = (int) schedule.stream().filter(AvailabilityRule::isActive).count();
            for (var day : DayOfWeek.values()) {
                if (present.contains(day)) continue;
                missingSchedules++;
                if (day != DayOfWeek.SUNDAY) activeDays++;
                if (apply) {
                    var r = new AvailabilityRule(); r.setPractitioner(p); r.setDayOfWeek(day);
                    r.setStartTime(LocalTime.of(9, 0)); r.setEndTime(LocalTime.of(19, 0));
                    r.setBreakStart(LocalTime.NOON); r.setBreakEnd(LocalTime.of(13, 0));
                    r.setSlotMinutes(30); r.setActive(day != DayOfWeek.SUNDAY); rules.save(r);
                }
            }
            if (activeDays == 0) conflicts++;
        }
        return new Result(existing, inserted, missingSchedules, conflicts);
    }

    private static boolean validSchedule(AvailabilityRule r) {
        if (r.getDayOfWeek() == null || r.getStartTime() == null || r.getEndTime() == null
                || !r.getEndTime().isAfter(r.getStartTime()) || r.getSlotMinutes() <= 0) return false;
        if (r.getBreakStart() == null && r.getBreakEnd() == null) return true;
        return r.getBreakStart() != null && r.getBreakEnd() != null
                && !r.getBreakStart().isBefore(r.getStartTime()) && !r.getBreakEnd().isAfter(r.getEndTime())
                && r.getBreakEnd().isAfter(r.getBreakStart());
    }
}
