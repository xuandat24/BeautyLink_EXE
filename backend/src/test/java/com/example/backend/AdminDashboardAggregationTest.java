package com.example.backend;

import com.example.backend.model.Booking;
import com.example.backend.model.PaymentTransaction;
import com.example.backend.model.Practitioner;
import com.example.backend.model.ServiceCategory;
import com.example.backend.model.ServiceOffering;
import com.example.backend.model.Supplier;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.BookingRepository;
import com.example.backend.repository.PaymentTransactionRepository;
import com.example.backend.repository.PractitionerRepository;
import com.example.backend.repository.ServiceCategoryRepository;
import com.example.backend.repository.ServiceOfferingRepository;
import com.example.backend.repository.SupplierRepository;
import com.example.backend.repository.UserAccountRepository;
import com.example.backend.service.AdminDashboardService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.springframework.data.domain.PageRequest;

import static com.example.backend.model.DomainEnums.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

@DataJpaTest(properties = "app.demo-data.enabled=false")
@ActiveProfiles("test")
class AdminDashboardAggregationTest {
    @Autowired UserAccountRepository users;
    @Autowired SupplierRepository suppliers;
    @Autowired ServiceCategoryRepository categories;
    @Autowired ServiceOfferingRepository services;
    @Autowired PractitionerRepository practitioners;
    @Autowired BookingRepository bookings;
    @Autowired PaymentTransactionRepository payments;

    @Test
    void uniqueCustomersBookingsDemoBoundariesAndDuplicatePaymentsStayAccurate() {
        Instant from = Instant.parse("2026-10-01T17:00:00Z"); // 2026-10-02 00:00 in Vietnam
        Instant to = Instant.parse("2026-10-02T17:00:00Z");
        UserAccount customerA = user("Customer A", "0900000101", Role.CUSTOMER);
        UserAccount customerB = user("Customer B", "0900000102", Role.CUSTOMER);
        Supplier real = supplier("Real Salon", "real-salon", false, "0900000201");
        Supplier demo = supplier("Demo Salon", "demo-salon", true, "0900000202");
        ServiceCategory category = new ServiceCategory(); category.setSlug("admin-test"); category.setName("Admin test"); categories.save(category);
        ServiceOffering realService = service(real, category, "Real service");
        ServiceOffering demoService = service(demo, category, "Demo service");
        Practitioner realPractitioner = practitioner(real, "Real practitioner");
        Practitioner demoPractitioner = practitioner(demo, "Demo practitioner");

        Booking paid = booking("ADMIN-1", customerA, real, realService, realPractitioner, from.plusSeconds(60), BookingStatus.CONFIRMED);
        booking("ADMIN-2", customerA, real, realService, realPractitioner, from.plusSeconds(120), BookingStatus.CANCELLED);
        booking("ADMIN-3", customerA, real, realService, realPractitioner, from.plusSeconds(180), BookingStatus.COMPLETED);
        booking("ADMIN-4", customerB, real, realService, realPractitioner, from.plusSeconds(240), BookingStatus.CONFIRMED);
        booking("ADMIN-5", customerB, real, realService, realPractitioner, from.plusSeconds(300), BookingStatus.CONFIRMED);
        Booking demoBooking = booking("ADMIN-DEMO", customerB, demo, demoService, demoPractitioner,
                from.plusSeconds(360), BookingStatus.CONFIRMED);
        booking("ADMIN-BOUNDARY", customerB, real, realService, realPractitioner, to, BookingStatus.CONFIRMED);

        payment(paid, 810001L, new BigDecimal("25000"), PaymentOption.DEPOSIT_05, from.plusSeconds(500));
        payment(paid, 810002L, new BigDecimal("25000"), PaymentOption.DEPOSIT_05, from.plusSeconds(600));
        payment(demoBooking, 810003L,
                new BigDecimal("500000"), PaymentOption.FULL_100, from.plusSeconds(700));

        assertEquals(5, bookings.countAdminBookings(from, to, Role.CUSTOMER, false));
        assertEquals(2, bookings.countAdminBookingCustomers(from, to, Role.CUSTOMER, false));
        assertEquals(2, bookings.findAdminRepeatCustomerIds(from, to, Role.CUSTOMER, false).size());
        assertEquals(1, bookings.countAdminBookingsByStatus(from, to, BookingStatus.CANCELLED, Role.CUSTOMER, false));
        assertEquals(1, bookings.countAdminVerifiedPaidBookings(from, to, PaymentTransactionStatus.PAID, Role.CUSTOMER, false));
        assertEquals(6, bookings.countAdminBookings(from, to, Role.CUSTOMER, true));
        assertEquals(new BigDecimal("25000.00"), payments.sumAdminCanonicalPaidAmount(from, to,
                PaymentTransactionStatus.PAID, Role.CUSTOMER, false).setScale(2));
        assertEquals(1, payments.countAdminCanonicalPaid(from, to, PaymentTransactionStatus.PAID, Role.CUSTOMER, false));
        assertEquals(2, bookings.findAdminCustomerBookingStats(BookingStatus.COMPLETED, Role.CUSTOMER, false).size());
        assertEquals(1, bookings.findAdminCustomerPaidBookingStats(PaymentTransactionStatus.PAID, Role.CUSTOMER, false).size());
        assertEquals(1, payments.findAdminCustomerVerifiedAmounts(PaymentTransactionStatus.PAID, Role.CUSTOMER, false).size());
        assertEquals(new BigDecimal("25000.00"), payments.sumAdminCanonicalPaidAmountByOptions(from, to,
                List.of(PaymentOption.DEPOSIT_05, PaymentOption.DEPOSIT_50), PaymentTransactionStatus.PAID,
                Role.CUSTOMER, false).setScale(2));
        assertEquals(5, bookings.searchAdminBookings(from, to, null, null, null, Role.CUSTOMER,
                false, PageRequest.of(0, 20)).getTotalElements());
        AdminDashboardService dashboard = new AdminDashboardService(bookings, payments, users);
        var revenue = dashboard.revenue(LocalDate.of(2026, 10, 2), LocalDate.of(2026, 10, 2), false, 0, 20);
        assertEquals(1, revenue.totalElements());
        assertEquals("ADMIN-1", revenue.content().getFirst().bookingCode());
        assertEquals(new BigDecimal("25000.00"), revenue.content().getFirst().amount().setScale(2));
        assertEquals(2, dashboard.revenue(LocalDate.of(2026, 10, 2), LocalDate.of(2026, 10, 2),
                true, 0, 20).totalElements());
    }

    private UserAccount user(String name, String phone, Role role) {
        UserAccount user = new UserAccount(); user.setFullName(name); user.setPhone(phone);
        user.setEmail(phone + "@example.test"); user.setPasswordHash("test-hash"); user.setRole(role);
        return users.save(user);
    }

    private Supplier supplier(String name, String slug, boolean demo, String ownerPhone) {
        Supplier supplier = new Supplier(); supplier.setOwner(user(name + " owner", ownerPhone, Role.SUPPLIER));
        supplier.setName(name); supplier.setSlug(slug); supplier.setAddressLine("Hà Nội"); supplier.setDemoData(demo);
        return suppliers.save(supplier);
    }

    private ServiceOffering service(Supplier supplier, ServiceCategory category, String name) {
        ServiceOffering service = new ServiceOffering(); service.setSupplier(supplier); service.setCategory(category);
        service.setName(name); service.setPrice(new BigDecimal("500000")); service.setDurationMinutes(60);
        return services.save(service);
    }

    private Practitioner practitioner(Supplier supplier, String name) {
        Practitioner practitioner = new Practitioner(); practitioner.setSupplier(supplier); practitioner.setDisplayName(name);
        return practitioners.save(practitioner);
    }

    private Booking booking(String code, UserAccount customer, Supplier supplier, ServiceOffering service,
            Practitioner practitioner, Instant createdAt, BookingStatus status) {
        Booking booking = new Booking(); booking.setBookingCode(code); booking.setCustomer(customer); booking.setSupplier(supplier);
        booking.setService(service); booking.setPractitioner(practitioner); booking.setAppointmentDate(LocalDate.of(2026, 10, 20));
        booking.setStartTime(LocalTime.of(10, 0)); booking.setEndTime(LocalTime.of(11, 0));
        booking.setTotalAmount(new BigDecimal("500000")); booking.setStatus(status);
        ReflectionTestUtils.setField(booking, "createdAt", createdAt);
        return bookings.save(booking);
    }

    private void payment(Booking booking, long orderCode, BigDecimal amount, PaymentOption option, Instant paidAt) {
        PaymentTransaction payment = new PaymentTransaction(); payment.setBooking(booking); payment.setOrderCode(orderCode);
        payment.setAmount(amount); payment.setRemainingAmount(new BigDecimal("475000")); payment.setPaymentOption(option);
        payment.setStatus(PaymentTransactionStatus.PAID); payment.setPaidAt(paidAt); payments.save(payment);
    }
}
