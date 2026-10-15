package com.example.backend;

import com.example.backend.model.*;
import com.example.backend.service.BookingConfirmationEmailTemplate;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

import static com.example.backend.model.DomainEnums.*;
import static org.junit.jupiter.api.Assertions.*;

class BookingConfirmationEmailTemplateTest {
    private final BookingConfirmationEmailTemplate templates =
            new BookingConfirmationEmailTemplate("https://beautylink.cloud");

    @Test
    void fivePercentDepositUsesPersistedSnapshotAndEscapesUserControlledValues() {
        PaymentTransaction payment = payment(PaymentOption.DEPOSIT_05, "22500", "427500");
        payment.setVoucherCode("BEAUTY50");
        payment.getBooking().getCustomer().setFullName("Lan <script>alert(1)</script>");

        var customer = templates.customer(payment);
        var supplier = templates.supplier(payment);

        assertEquals("customer@example.com", customer.recipientEmail());
        assertEquals("partner@example.com", supplier.recipientEmail());
        assertTrue(customer.subject().contains("BL-EMAIL-1"));
        assertTrue(customer.textBody().contains("22.500đ"));
        assertTrue(customer.textBody().contains("427.500đ"));
        assertTrue(customer.textBody().contains("50.000đ"));
        assertTrue(customer.textBody().contains("Đặt cọc 5%"));
        assertTrue(customer.textBody().contains("18/10/2026 lúc 09:30"));
        assertTrue(customer.htmlBody().contains("Lan &lt;script&gt;alert(1)&lt;/script&gt;"));
        assertFalse(customer.htmlBody().contains("Lan <script>"));
        assertTrue(customer.htmlBody().contains("https://beautylink.cloud/?booking=BL-EMAIL-1#bookings"));
        assertFalse(customer.htmlBody().toLowerCase().contains("token="));
        assertTrue(supplier.textBody().contains("0900000001"));
        assertTrue(supplier.textBody().contains("thanh toán khoản đặt cọc"));
        assertTrue(supplier.textBody().contains("không xác nhận việc tiền đã được quyết toán")
                || supplier.htmlBody().contains("không xác nhận việc tiền đã được quyết toán"));
    }

    @Test
    void fullPaymentShowsZeroBalanceWithoutDepositLanguage() {
        PaymentTransaction payment = payment(PaymentOption.FULL_100, "500000", "0");
        var customer = templates.customer(payment);
        assertTrue(customer.textBody().contains("Thanh toán 100%"));
        assertTrue(customer.textBody().contains("Còn lại tại cơ sở: 0đ"));
        assertTrue(customer.textBody().contains("đầy đủ khoản thanh toán"));
        assertFalse(customer.textBody().contains("Bạn đã đặt cọc thành công"));
    }

    @Test
    void historicalFiftyPercentDepositUsesStoredAmountsInsteadOfCurrentPolicy() {
        PaymentTransaction payment = payment(PaymentOption.DEPOSIT_50, "250000", "250000");
        var customer = templates.customer(payment);
        assertTrue(customer.textBody().contains("Đặt cọc 50% (giao dịch lịch sử)"));
        assertTrue(customer.textBody().contains("Đã thanh toán qua PayOS: 250.000đ"));
        assertTrue(customer.textBody().contains("Còn lại tại cơ sở: 250.000đ"));
    }

    @Test
    void rejectsUnsafeFrontendOrigins() {
        assertThrows(IllegalArgumentException.class,
                () -> new BookingConfirmationEmailTemplate("http://beautylink.cloud"));
        assertThrows(IllegalArgumentException.class,
                () -> new BookingConfirmationEmailTemplate("https://user:pass@beautylink.cloud"));
        assertThrows(IllegalArgumentException.class,
                () -> new BookingConfirmationEmailTemplate("https://beautylink.cloud:444"));
    }

    private PaymentTransaction payment(PaymentOption option, String amount, String remaining) {
        UserAccount customer = new UserAccount();
        customer.setId(1L); customer.setFullName("Nguyễn Lan"); customer.setEmail("customer@example.com");
        customer.setPhone("0900000001");
        UserAccount owner = new UserAccount();
        owner.setId(2L); owner.setFullName("Partner Owner"); owner.setEmail("partner@example.com");
        owner.setPhone("0900000002");
        Supplier supplier = new Supplier();
        supplier.setId(3L); supplier.setOwner(owner); supplier.setName("Sen Wellness");
        supplier.setAddressLine("12 Phố Huế, Hà Nội");
        ServiceOffering service = new ServiceOffering();
        service.setId(4L); service.setSupplier(supplier); service.setName("Chăm sóc da <b>VIP</b>");
        service.setPrice(new BigDecimal("500000"));
        Practitioner practitioner = new Practitioner();
        practitioner.setId(5L); practitioner.setSupplier(supplier); practitioner.setDisplayName("Chuyên viên An");
        Booking booking = new Booking();
        booking.setId(6L); booking.setBookingCode("BL-EMAIL-1"); booking.setCustomer(customer);
        booking.setSupplier(supplier); booking.setService(service); booking.setPractitioner(practitioner);
        booking.setAppointmentDate(LocalDate.of(2026, 10, 18)); booking.setStartTime(LocalTime.of(9, 30));
        booking.setTotalAmount(new BigDecimal("500000")); booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPaymentStatus(option == PaymentOption.FULL_100 ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID);
        PaymentTransaction payment = new PaymentTransaction();
        payment.setBooking(booking); payment.setAmount(new BigDecimal(amount));
        payment.setRemainingAmount(new BigDecimal(remaining)); payment.setPaymentOption(option);
        payment.setStatus(PaymentTransactionStatus.PAID);
        return payment;
    }
}
