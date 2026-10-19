package com.example.backend.service;

import com.example.backend.exception.ApiException;
import com.example.backend.model.UserAccount;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;

class BookingContactPolicyTest {
    @Test void googleAccountCannotBypassMissingOrUnconfirmedPhone() {
        UserAccount account = new UserAccount();
        account.setBookingContactConfirmationRequired(true);
        assertEquals("BOOKING_CONTACT_REQUIRED", assertThrows(ApiException.class,
                () -> BookingContactPolicy.requireReady(account)).getCode());
        account.setPhone("0901234567");
        assertFalse(BookingContactPolicy.isReady(account));
        account.setBookingContactConfirmedPhone("0901234567");
        account.setBookingContactConfirmedAt(Instant.now());
        assertTrue(BookingContactPolicy.isReady(account));
    }

    @Test void legacyOrTraditionallyRegisteredPhoneRemainsReadyAfterMigration() {
        UserAccount account = new UserAccount();
        account.setPhone("0391234567");
        account.setBookingContactConfirmationRequired(false);
        assertTrue(BookingContactPolicy.isReady(account));
    }

    @Test void changingARequiredPhoneInvalidatesOldConfirmationBinding() {
        UserAccount account = new UserAccount();
        account.setPhone("0901234567");
        account.setBookingContactConfirmationRequired(true);
        account.setBookingContactConfirmedPhone("0901234568");
        account.setBookingContactConfirmedAt(Instant.now());
        assertFalse(BookingContactPolicy.isReady(account));
    }
}
