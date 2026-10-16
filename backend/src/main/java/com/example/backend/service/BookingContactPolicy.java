package com.example.backend.service;

import com.example.backend.exception.ApiException;
import com.example.backend.model.UserAccount;
import org.springframework.http.HttpStatus;
import java.util.Objects;

public final class BookingContactPolicy {
    private BookingContactPolicy() {}

    public static boolean isReady(UserAccount account) {
        String phone = AuthService.normalizePhone(account.getPhone());
        if (phone == null || !phone.matches("^0(?:3|5|7|8|9)[0-9]{8}$")) return false;
        return !account.isBookingContactConfirmationRequired()
                || (account.getBookingContactConfirmedAt() != null
                    && Objects.equals(phone, account.getBookingContactConfirmedPhone()));
    }

    public static void requireReady(UserAccount account) {
        if (!isReady(account)) throw new ApiException(HttpStatus.CONFLICT, "BOOKING_CONTACT_REQUIRED",
                "Vui lòng thêm và xác nhận số điện thoại liên hệ trước khi đặt lịch hoặc thanh toán.");
    }
}
