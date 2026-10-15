package com.example.backend;

import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

import static com.example.backend.model.DomainEnums.*;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@ActiveProfiles("test")
class EmailNotificationOutboxRepositoryTest {
    @Autowired EmailNotificationOutboxRepository outbox;
    @Autowired UserAccountRepository users;
    @Autowired SupplierRepository suppliers;
    @Autowired ServiceCategoryRepository categories;
    @Autowired ServiceOfferingRepository services;
    @Autowired PractitionerRepository practitioners;
    @Autowired BookingRepository bookings;
    @Autowired PaymentTransactionRepository payments;

    @Test
    void schemaStartCreatesNoHistoricalNotificationRows() {
        assertEquals(0, outbox.count());
    }

    @Test
    void databaseRejectsDuplicateLogicalNotificationEvenWithDifferentIdempotencyKey() {
        PaymentTransaction payment = persistedPayment();
        outbox.saveAndFlush(job(payment, EmailRecipientRole.CUSTOMER, "logical-customer-1"));

        assertThrows(DataIntegrityViolationException.class, () ->
                outbox.saveAndFlush(job(payment, EmailRecipientRole.CUSTOMER, "logical-customer-2")));
    }

    @Test
    void customerAndSupplierAreSeparateLogicalJobs() {
        PaymentTransaction payment = persistedPayment();
        outbox.save(job(payment, EmailRecipientRole.CUSTOMER, "logical-customer"));
        outbox.save(job(payment, EmailRecipientRole.SUPPLIER, "logical-supplier"));
        outbox.flush();

        assertEquals(2, outbox.count());
        assertTrue(outbox.existsByBookingIdAndNotificationTypeAndRecipientRole(payment.getBooking().getId(),
                EmailNotificationType.BOOKING_PAYMENT_CONFIRMED, EmailRecipientRole.CUSTOMER));
        assertTrue(outbox.existsByBookingIdAndNotificationTypeAndRecipientRole(payment.getBooking().getId(),
                EmailNotificationType.BOOKING_PAYMENT_CONFIRMED, EmailRecipientRole.SUPPLIER));
    }

    private EmailNotificationOutbox job(PaymentTransaction payment, EmailRecipientRole role, String key) {
        EmailNotificationOutbox job = new EmailNotificationOutbox();
        job.setBooking(payment.getBooking());
        job.setPaymentTransaction(payment);
        job.setNotificationType(EmailNotificationType.BOOKING_PAYMENT_CONFIRMED);
        job.setRecipientRole(role);
        job.setRecipientEmail(role == EmailRecipientRole.CUSTOMER
                ? "customer@example.test" : "partner@example.test");
        job.setSubject("Booking confirmed");
        job.setTextBody("text");
        job.setHtmlBody("<p>html</p>");
        job.setIdempotencyKey(key);
        job.setStatus(EmailNotificationStatus.PENDING);
        job.setNextAttemptAt(Instant.now());
        return job;
    }

    private PaymentTransaction persistedPayment() {
        UserAccount customer = user("Customer", "0900100001", "customer@example.test", Role.CUSTOMER);
        UserAccount owner = user("Partner owner", "0900100002", "partner@example.test", Role.SUPPLIER);

        Supplier supplier = new Supplier();
        supplier.setOwner(owner);
        supplier.setName("Outbox Salon");
        supplier.setSlug("outbox-salon");
        supplier.setAddressLine("Hà Nội");
        supplier = suppliers.save(supplier);

        ServiceCategory category = new ServiceCategory();
        category.setSlug("outbox-category");
        category.setName("Outbox category");
        category = categories.save(category);

        ServiceOffering service = new ServiceOffering();
        service.setSupplier(supplier);
        service.setCategory(category);
        service.setName("Outbox service");
        service.setPrice(new BigDecimal("100000"));
        service.setDurationMinutes(60);
        service = services.save(service);

        Practitioner practitioner = new Practitioner();
        practitioner.setSupplier(supplier);
        practitioner.setDisplayName("Outbox practitioner");
        practitioner = practitioners.save(practitioner);

        Booking booking = new Booking();
        booking.setBookingCode("BL-OUTBOX-DB");
        booking.setCustomer(customer);
        booking.setSupplier(supplier);
        booking.setService(service);
        booking.setPractitioner(practitioner);
        booking.setAppointmentDate(LocalDate.of(2026, 10, 20));
        booking.setStartTime(LocalTime.of(10, 0));
        booking.setEndTime(LocalTime.of(11, 0));
        booking.setTotalAmount(new BigDecimal("100000"));
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPaymentStatus(PaymentStatus.PARTIALLY_PAID);
        booking = bookings.save(booking);

        PaymentTransaction payment = new PaymentTransaction();
        payment.setBooking(booking);
        payment.setOrderCode(910000001L);
        payment.setAmount(new BigDecimal("5000"));
        payment.setRemainingAmount(new BigDecimal("95000"));
        payment.setPaymentOption(PaymentOption.DEPOSIT_05);
        payment.setStatus(PaymentTransactionStatus.PAID);
        payment.setPaidAt(Instant.now());
        return payments.save(payment);
    }

    private UserAccount user(String name, String phone, String email, Role role) {
        UserAccount user = new UserAccount();
        user.setFullName(name);
        user.setPhone(phone);
        user.setEmail(email);
        user.setPasswordHash("test-hash");
        user.setRole(role);
        return users.save(user);
    }
}
