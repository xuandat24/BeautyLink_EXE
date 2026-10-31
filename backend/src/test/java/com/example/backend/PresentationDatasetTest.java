package com.example.backend;

import com.example.backend.dto.AdminV2Dtos.Granularity;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import com.example.backend.service.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static com.example.backend.model.DomainEnums.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties={"app.demo-data.enabled=false", "app.partner-catalog.enabled=false", "app.booking-email.enabled=false", "spring.config.import=",
        "spring.datasource.url=jdbc:h2:mem:beautylink-presentation-validation;MODE=MySQL;DB_CLOSE_DELAY=-1"})
@ActiveProfiles({"test", "presentation"}) @Transactional
class PresentationDatasetTest {
    @Autowired ConfigurableApplicationContext context;
    @Autowired BookingRepository bookings;
    @Autowired UserAccountRepository users;
    @Autowired PractitionerRepository people;
    @Autowired PaymentTransactionRepository payments;
    @Autowired EntityManager em;
    @Autowired AdminInsightsService insights;
    @Autowired AdminDashboardService dashboard;
    @Autowired BookingService bookingService;

    @BeforeEach void catalog() throws Exception { PresentationDataset.catalog(context); }

    @Test void recordsRelationshipsScheduleAndEveryAggregationReconcileWithoutReceipts() {
        long userCount = users.count(), peopleCount = people.count();
        var result = PresentationDataset.apply(context);
        assertEquals(0, result.baselineValue().signum()); assertEquals(0, result.baselineCompleted());
        assertEquals(9, result.inserted()); assertEquals(9, result.completedCount());
        assertEquals(0, result.completedValue().compareTo(new BigDecimal("3045000")));
        assertEquals(userCount, users.count()); assertEquals(peopleCount, people.count());
        assertEquals(0, payments.count(), "No PayOS IDs, confirmations, signatures or receipts are fabricated");
        var completed = bookings.findAll();
        var codes = new HashSet<String>();
        for (var b : completed) {
            assertTrue(codes.add(b.getBookingCode()));
            assertEquals(Role.CUSTOMER, b.getCustomer().getRole());
            assertEquals(b.getSupplier().getId(), b.getService().getSupplier().getId());
            assertEquals(b.getSupplier().getId(), b.getPractitioner().getSupplier().getId());
            assertEquals(0, b.getTotalAmount().compareTo(b.getService().getPrice()));
            assertEquals(b.getStartTime().plusMinutes(b.getService().getDurationMinutes()), b.getEndTime());
            assertTrue(b.getCreatedAt().isBefore(BookingCompletionPolicy.startsAt(b)));
            assertTrue(BookingCompletionPolicy.appointmentEnd(b).isBefore(LocalDateTime.of(2026,10,31,0,0)));
            assertEquals(BookingStatus.COMPLETED, b.getStatus());
            PresentationDataset.validSlot(context, b);
        }
        PresentationDataset.otherStatuses(context);
        assertEquals(12, bookings.count());
        for (var grain : Granularity.values()) {
            var data = insights.insights(PresentationDataset.FROM, PresentationDataset.TO, false, grain);
            assertEquals(0, data.completedServiceValue().value().compareTo(PresentationDataset.TARGET));
            assertEquals(9, data.completedBookings().value().intValue());
            assertEquals(12, data.totalBookings().value().intValue());
            assertEquals(0, data.revenue().value().signum());
            assertEquals(0, data.trends().stream().map(t -> t.completedServiceValue()).reduce(BigDecimal.ZERO, BigDecimal::add).compareTo(PresentationDataset.TARGET));
            assertEquals(12, data.trends().stream().mapToLong(t -> t.bookings()).sum());
            assertEquals(0, data.topSalons().stream().map(s -> s.completedServiceValue()).reduce(BigDecimal.ZERO, BigDecimal::add).compareTo(PresentationDataset.TARGET));
        }
        var days = insights.insights(PresentationDataset.FROM, PresentationDataset.TO, false, Granularity.DAY).trends();
        var partial = insights.insights(PresentationDataset.FROM, LocalDate.of(2026,10,7), false, Granularity.DAY);
        assertEquals(830000, partial.completedServiceValue().value().intValue());
        assertEquals(2, partial.completedBookings().value().intValue());
        assertEquals(830000, partial.trends().stream().map(t -> t.completedServiceValue()).reduce(BigDecimal.ZERO, BigDecimal::add).intValue());
        assertTrue(days.stream().anyMatch(t -> t.completedServiceValue().signum() == 0));
        assertTrue(days.stream().map(t -> t.completedServiceValue()).distinct().count() > 5, "High, low and zero days derive from actual bookings");
        BigDecimal supplierTotal = BigDecimal.ZERO;
        for (var owner : users.findAll().stream().filter(u -> u.getRole() == Role.SUPPLIER).toList()) {
            var rows = bookingService.supplierBookings(owner);
            supplierTotal = supplierTotal.add(rows.stream().filter(b -> b.status() == BookingStatus.COMPLETED).map(b -> b.totalAmount()).reduce(BigDecimal.ZERO, BigDecimal::add));
        }
        assertEquals(0, supplierTotal.compareTo(PresentationDataset.TARGET));
        assertEquals(0, dashboard.paymentSummary(PresentationDataset.FROM, PresentationDataset.TO, false).verifiedOnlineCollected().signum());
        assertEquals(0, payments.count());
    }

    @Test void repeatedRunDoesNotDuplicateOrModifyExistingHistory() {
        PresentationDataset.apply(context);
        var before = bookings.findAll().stream().map(b -> List.of(b.getId(), b.getBookingCode(), b.getStatus(), b.getPaymentStatus(), b.getTotalAmount(), b.getCreatedAt())).toList();
        var repeated = PresentationDataset.apply(context);
        assertEquals(0, repeated.inserted()); assertEquals(9, bookings.count());
        assertEquals(before, bookings.findAll().stream().map(b -> List.of(b.getId(), b.getBookingCode(), b.getStatus(), b.getPaymentStatus(), b.getTotalAmount(), b.getCreatedAt())).toList());
    }

    @Test void unrecognizedExistingCompletedBookingFailsClosedWithoutAnyWrites() {
        PresentationDataset.apply(context);
        var existing = bookings.findAll().getFirst(); existing.setBookingCode("ORIGINAL-KEEP"); bookings.saveAndFlush(existing);
        var total = bookings.count(); var amount = existing.getTotalAmount();
        assertThrows(IllegalStateException.class, () -> PresentationDataset.apply(context));
        assertEquals(total, bookings.count()); assertEquals(amount, existing.getTotalAmount());
        assertEquals("ORIGINAL-KEEP", existing.getBookingCode()); assertEquals(0, payments.count());
    }
}
