package com.example.backend;

import com.example.backend.model.*;
import com.example.backend.repository.EmailNotificationOutboxRepository;
import com.example.backend.service.BookingConfirmationEmailTemplate;
import com.example.backend.service.BookingConfirmationNotificationService;
import com.example.backend.service.TransactionalEmailSender;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static com.example.backend.model.DomainEnums.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookingConfirmationNotificationServiceTest {
    @Mock EmailNotificationOutboxRepository repository;

    @Test
    void verifiedPaymentCreatesIndependentCustomerAndSupplierJobs() {
        BookingConfirmationNotificationService service = service(true);
        PaymentTransaction payment = payment("customer@example.com", "partner@example.com");
        service.enqueueVerifiedPayment(payment);

        ArgumentCaptor<EmailNotificationOutbox> jobs = ArgumentCaptor.forClass(EmailNotificationOutbox.class);
        verify(repository, times(2)).save(jobs.capture());
        assertEquals(List.of(EmailRecipientRole.CUSTOMER, EmailRecipientRole.SUPPLIER),
                jobs.getAllValues().stream().map(EmailNotificationOutbox::getRecipientRole).toList());
        assertTrue(jobs.getAllValues().stream().allMatch(job -> job.getStatus() == EmailNotificationStatus.PENDING));
        assertNotEquals(jobs.getAllValues().get(0).getIdempotencyKey(), jobs.getAllValues().get(1).getIdempotencyKey());
    }

    @Test
    void featureDisabledCreatesNoHistoricalOrNewJobs() {
        BookingConfirmationNotificationService service = service(false);
        service.enqueueVerifiedPayment(payment("customer@example.com", "partner@example.com"));
        verifyNoInteractions(repository);
    }

    @Test
    void missingRecipientsAreRecordedAsSkippedWithoutThrowing() {
        BookingConfirmationNotificationService service = service(true);
        service.enqueueVerifiedPayment(payment(null, "not-an-email"));
        ArgumentCaptor<EmailNotificationOutbox> jobs = ArgumentCaptor.forClass(EmailNotificationOutbox.class);
        verify(repository, times(2)).save(jobs.capture());
        assertTrue(jobs.getAllValues().stream().allMatch(job -> job.getStatus() == EmailNotificationStatus.SKIPPED));
        assertTrue(jobs.getAllValues().stream().allMatch(job -> "EMAIL_RECIPIENT_MISSING_OR_INVALID".equals(job.getLastErrorCode())));
    }

    @Test
    void duplicateLogicalJobsAreNotInserted() {
        when(repository.existsByBookingIdAndNotificationTypeAndRecipientRole(anyLong(), any(), any())).thenReturn(true);
        service(true).enqueueVerifiedPayment(payment("customer@example.com", "partner@example.com"));
        verify(repository, never()).save(any());
    }

    @Test
    void unverifiedOrManualReviewPaymentCannotCreateJobs() {
        BookingConfirmationNotificationService service = service(true);
        PaymentTransaction payment = payment("customer@example.com", "partner@example.com");
        payment.setStatus(PaymentTransactionStatus.PENDING);
        assertThrows(IllegalStateException.class, () -> service.enqueueVerifiedPayment(payment));

        payment.setStatus(PaymentTransactionStatus.PAID);
        payment.setRequiresManualReview(true);
        assertThrows(IllegalStateException.class, () -> service.enqueueVerifiedPayment(payment));

        verifyNoInteractions(repository);
    }

    @Test
    void transientAndAmbiguousFailuresRemainRetryableButPermanentFailureDoesNot() {
        BookingConfirmationNotificationService service = service(true);
        EmailNotificationOutbox job = job();
        job.setAttemptCount(1); job.setStatus(EmailNotificationStatus.PROCESSING); job.setClaimToken("claim");
        var claim = new BookingConfirmationNotificationService.ClaimedEmail(1L, "claim", "customer@example.com",
                "subject", "text", "html", "key");
        when(repository.findByIdAndClaimTokenAndStatus(1L, "claim", EmailNotificationStatus.PROCESSING))
                .thenReturn(Optional.of(job));
        service.markFailed(claim, new TransactionalEmailSender.EmailDeliveryException(
                TransactionalEmailSender.FailureKind.AMBIGUOUS, "EMAIL_PROVIDER_RESULT_AMBIGUOUS"));
        assertEquals(EmailNotificationStatus.RETRY, job.getStatus());
        assertNull(job.getClaimToken());

        job.setStatus(EmailNotificationStatus.PROCESSING); job.setClaimToken("claim");
        service.markFailed(claim, new TransactionalEmailSender.EmailDeliveryException(
                TransactionalEmailSender.FailureKind.PERMANENT, "EMAIL_PROVIDER_REJECTED"));
        assertEquals(EmailNotificationStatus.FAILED_PERMANENT, job.getStatus());
    }

    @Test
    void staleProcessingJobIsReclaimedAfterItsLeaseAndAttemptIsPersisted() {
        BookingConfirmationNotificationService service = service(true);
        EmailNotificationOutbox stale = job();
        stale.setStatus(EmailNotificationStatus.PROCESSING);
        stale.setAttemptCount(1);
        stale.setClaimToken("dead-worker");
        stale.setLeaseUntil(Instant.now().minusSeconds(1));
        stale.setRecipientEmail("customer@example.com");
        stale.setSubject("subject");
        stale.setTextBody("text");
        stale.setHtmlBody("html");
        stale.setIdempotencyKey("stable-key");
        when(repository.findClaimable(eq(EmailNotificationStatus.PENDING), eq(EmailNotificationStatus.RETRY),
                eq(EmailNotificationStatus.PROCESSING), any(Instant.class), any())).thenReturn(List.of(stale));

        var claims = service.claimBatch();

        assertEquals(1, claims.size());
        assertEquals(2, stale.getAttemptCount());
        assertEquals(EmailNotificationStatus.PROCESSING, stale.getStatus());
        assertNotEquals("dead-worker", stale.getClaimToken());
        assertTrue(stale.getLeaseUntil().isAfter(Instant.now()));
        assertEquals("stable-key", claims.get(0).idempotencyKey());
    }

    @Test
    void retryExhaustionBecomesPermanent() {
        BookingConfirmationNotificationService service = new BookingConfirmationNotificationService(repository,
                new BookingConfirmationEmailTemplate("https://beautylink.cloud"), true, 1, 20, 120);
        EmailNotificationOutbox job = job();
        job.setAttemptCount(1);
        job.setStatus(EmailNotificationStatus.PROCESSING);
        job.setClaimToken("claim");
        var claim = new BookingConfirmationNotificationService.ClaimedEmail(1L, "claim", "customer@example.com",
                "subject", "text", "html", "key");
        when(repository.findByIdAndClaimTokenAndStatus(1L, "claim", EmailNotificationStatus.PROCESSING))
                .thenReturn(Optional.of(job));

        service.markFailed(claim, new TransactionalEmailSender.EmailDeliveryException(
                TransactionalEmailSender.FailureKind.TRANSIENT, "EMAIL_PROVIDER_UNAVAILABLE"));

        assertEquals(EmailNotificationStatus.FAILED_PERMANENT, job.getStatus());
        assertEquals("EMAIL_PROVIDER_UNAVAILABLE", job.getLastErrorCode());
        assertNull(job.getClaimToken());
        assertNull(job.getLeaseUntil());
    }

    private BookingConfirmationNotificationService service(boolean enabled) {
        return new BookingConfirmationNotificationService(repository,
                new BookingConfirmationEmailTemplate("https://beautylink.cloud"), enabled, 5, 20, 120);
    }

    private EmailNotificationOutbox job() {
        EmailNotificationOutbox job = new EmailNotificationOutbox();
        job.setStatus(EmailNotificationStatus.PENDING);
        return job;
    }

    private PaymentTransaction payment(String customerEmail, String supplierEmail) {
        UserAccount customer = new UserAccount(); customer.setId(1L); customer.setFullName("Customer");
        customer.setEmail(customerEmail); customer.setPhone("0900000001");
        UserAccount owner = new UserAccount(); owner.setId(2L); owner.setFullName("Owner");
        owner.setEmail(supplierEmail); owner.setPhone("0900000002");
        Supplier supplier = new Supplier(); supplier.setId(3L); supplier.setOwner(owner);
        supplier.setName("Partner"); supplier.setAddressLine("Hà Nội");
        ServiceOffering offering = new ServiceOffering(); offering.setId(4L); offering.setSupplier(supplier);
        offering.setName("Service"); offering.setPrice(new BigDecimal("100000"));
        Practitioner practitioner = new Practitioner(); practitioner.setId(5L); practitioner.setSupplier(supplier);
        practitioner.setDisplayName("Practitioner");
        Booking booking = new Booking(); booking.setId(6L); booking.setBookingCode("BL-OUTBOX");
        booking.setCustomer(customer); booking.setSupplier(supplier); booking.setService(offering);
        booking.setPractitioner(practitioner); booking.setAppointmentDate(LocalDate.now().plusDays(1));
        booking.setStartTime(LocalTime.of(10, 0)); booking.setTotalAmount(new BigDecimal("100000"));
        booking.setStatus(BookingStatus.CONFIRMED); booking.setPaymentStatus(PaymentStatus.PARTIALLY_PAID);
        PaymentTransaction payment = new PaymentTransaction(); payment.setBooking(booking);
        payment.setAmount(new BigDecimal("5000")); payment.setRemainingAmount(new BigDecimal("95000"));
        payment.setPaymentOption(PaymentOption.DEPOSIT_05); payment.setStatus(PaymentTransactionStatus.PAID);
        return payment;
    }
}
