package com.example.backend;

import com.example.backend.service.BookingConfirmationNotificationService;
import com.example.backend.service.EmailNotificationDispatcher;
import com.example.backend.service.TransactionalEmailSender;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailNotificationDispatcherTest {
    @Mock BookingConfirmationNotificationService notifications;
    @Mock TransactionalEmailSender sender;

    @Test
    void customerFailureDoesNotPreventIndependentSupplierDelivery() {
        var customer = claim(1L, "customer@example.com", "customer-key");
        var supplier = claim(2L, "partner@example.com", "supplier-key");
        when(notifications.isEnabled()).thenReturn(true);
        when(notifications.claimBatch()).thenReturn(List.of(customer, supplier));
        when(sender.send(any()))
                .thenThrow(new TransactionalEmailSender.EmailDeliveryException(
                        TransactionalEmailSender.FailureKind.TRANSIENT, "EMAIL_PROVIDER_UNAVAILABLE"))
                .thenReturn(new TransactionalEmailSender.DeliveryReceipt("provider-supplier-2"));

        dispatcher().dispatch();

        InOrder order = inOrder(sender, notifications);
        order.verify(sender).send(any());
        order.verify(notifications).markFailed(eq(customer), any());
        order.verify(sender).send(any());
        order.verify(notifications).markSent(supplier, "provider-supplier-2");
    }

    @Test
    void disabledFeatureDoesNotClaimOrSendJobs() {
        when(notifications.isEnabled()).thenReturn(false);

        dispatcher().dispatch();

        verify(notifications, never()).claimBatch();
        verifyNoInteractions(sender);
    }

    @Test
    void failureToPersistOneJobResultDoesNotStopTheNextRecipient() {
        var customer = claim(1L, "customer@example.com", "customer-key");
        var supplier = claim(2L, "partner@example.com", "supplier-key");
        when(notifications.isEnabled()).thenReturn(true);
        when(notifications.claimBatch()).thenReturn(List.of(customer, supplier));
        when(sender.send(any()))
                .thenThrow(new TransactionalEmailSender.EmailDeliveryException(
                        TransactionalEmailSender.FailureKind.TRANSIENT, "EMAIL_PROVIDER_UNAVAILABLE"))
                .thenReturn(new TransactionalEmailSender.DeliveryReceipt("provider-supplier-2"));
        doThrow(new IllegalStateException("simulated database interruption"))
                .when(notifications).markFailed(eq(customer), any());

        dispatcher().dispatch();

        verify(sender, times(2)).send(any());
        verify(notifications).markSent(supplier, "provider-supplier-2");
    }

    private EmailNotificationDispatcher dispatcher() {
        return new EmailNotificationDispatcher(notifications, sender,
                "BeautyLink <no-reply@beautylink.cloud>", "support@beautylink.cloud");
    }

    private BookingConfirmationNotificationService.ClaimedEmail claim(Long id, String recipient, String key) {
        return new BookingConfirmationNotificationService.ClaimedEmail(
                id, "lease-token", recipient, "subject", "text", "html", key);
    }
}
