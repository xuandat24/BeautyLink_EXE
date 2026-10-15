package com.example.backend.service;

import com.example.backend.model.Booking;
import com.example.backend.model.PaymentTransaction;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.text.NumberFormat;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

import static com.example.backend.model.DomainEnums.EmailRecipientRole;
import static com.example.backend.model.DomainEnums.PaymentOption;

@Component
public class BookingConfirmationEmailTemplate {
    private static final Locale VIETNAM = Locale.forLanguageTag("vi-VN");
    private static final ZoneId VIETNAM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy", VIETNAM);
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm", VIETNAM);
    private final String frontendPublicUrl;

    public BookingConfirmationEmailTemplate(@Value("${app.frontend.public-url:https://beautylink.cloud}") String frontendPublicUrl) {
        this.frontendPublicUrl = requireSafeBaseUrl(frontendPublicUrl);
    }

    public RenderedEmail customer(PaymentTransaction payment) {
        Booking booking = payment.getBooking();
        Amounts amounts = amounts(booking, payment);
        String subject = "[BeautyLink] Xác nhận đặt lịch thành công - " + booking.getBookingCode();
        String paymentMessage = payment.getPaymentOption() == PaymentOption.FULL_100
                ? "BeautyLink đã ghi nhận đầy đủ khoản thanh toán trực tuyến của bạn."
                : "Bạn đã đặt cọc thành công. Số tiền còn lại sẽ được thanh toán tại cơ sở.";
        String detailsUrl = frontendPublicUrl + "/?booking=" + booking.getBookingCode() + "#bookings";
        String text = """
                Đặt lịch của bạn đã được xác nhận!

                Xin chào %s,
                BeautyLink đã ghi nhận thành công khoản thanh toán của bạn.

                Mã đặt lịch: %s
                Dịch vụ: %s
                Đối tác: %s
                Địa chỉ: %s
                Chuyên viên: %s
                Lịch hẹn: %s lúc %s
                Giá trị dịch vụ: %s
                Giảm giá voucher: %s
                Tổng sau giảm giá: %s
                Đã thanh toán qua PayOS: %s
                Còn lại tại cơ sở: %s
                Hình thức thanh toán: %s
                Trạng thái: Đã xác nhận

                %s
                Vui lòng đến đúng giờ và kiểm tra chi tiết lịch hẹn tại: %s
                Nếu cần hỗ trợ, hãy liên hệ BeautyLink qua kênh hỗ trợ chính thức trên website.
                """.formatted(value(booking.getCustomer().getFullName()), booking.getBookingCode(),
                value(booking.getService().getName()), value(booking.getSupplier().getName()),
                value(booking.getSupplier().getAddressLine()), practitioner(booking),
                appointment(booking).format(DATE), appointment(booking).format(TIME),
                money(amounts.original()), money(amounts.discount()), money(amounts.payable()),
                money(payment.getAmount()), money(payment.getRemainingAmount()), paymentLabel(payment.getPaymentOption()),
                paymentMessage, detailsUrl);
        String html = layout("Đặt lịch của bạn đã được xác nhận!", "BeautyLink đã ghi nhận thành công khoản thanh toán của bạn.",
                rows(new String[][]{
                        {"Khách hàng", value(booking.getCustomer().getFullName())},
                        {"Mã đặt lịch", booking.getBookingCode()},
                        {"Dịch vụ", value(booking.getService().getName())},
                        {"Đối tác", value(booking.getSupplier().getName())},
                        {"Địa chỉ", value(booking.getSupplier().getAddressLine())},
                        {"Chuyên viên", practitioner(booking)},
                        {"Lịch hẹn", appointment(booking).format(DATE) + " · " + appointment(booking).format(TIME)},
                        {"Giá trị dịch vụ", money(amounts.original())},
                        {"Giảm giá voucher", money(amounts.discount())},
                        {"Tổng sau giảm giá", money(amounts.payable())},
                        {"Đã thanh toán qua PayOS", money(payment.getAmount())},
                        {"Còn lại tại cơ sở", money(payment.getRemainingAmount())},
                        {"Hình thức thanh toán", paymentLabel(payment.getPaymentOption())},
                        {"Trạng thái", "Đã xác nhận"}
                }), paymentMessage, "Xem lịch hẹn", detailsUrl,
                "Vui lòng đến đúng giờ. Nếu cần hỗ trợ, hãy sử dụng kênh hỗ trợ chính thức trên BeautyLink.");
        return new RenderedEmail(EmailRecipientRole.CUSTOMER, booking.getCustomer().getEmail(), subject, text, html);
    }

    public RenderedEmail supplier(PaymentTransaction payment) {
        Booking booking = payment.getBooking();
        Amounts amounts = amounts(booking, payment);
        String subject = "[BeautyLink Partner] Bạn có lịch hẹn mới đã xác nhận - " + booking.getBookingCode();
        String paymentMessage = payment.getPaymentOption() == PaymentOption.FULL_100
                ? "Khách hàng đã thanh toán đầy đủ cho BeautyLink qua PayOS."
                : "Khách hàng đã thanh toán khoản đặt cọc cần thiết cho BeautyLink qua PayOS; phần còn lại dự kiến thanh toán tại cơ sở.";
        String dashboardUrl = frontendPublicUrl + "/#supplier-dashboard";
        String text = """
                Bạn có một lịch hẹn mới đã được xác nhận!

                Đối tác: %s
                Mã đặt lịch: %s
                Khách hàng: %s
                Điện thoại: %s
                Dịch vụ: %s
                Chuyên viên: %s
                Lịch hẹn: %s lúc %s
                Giá trị dịch vụ: %s
                Tổng sau giảm giá: %s
                Khách đã thanh toán BeautyLink qua PayOS: %s
                Còn lại dự kiến tại cơ sở: %s
                Hình thức thanh toán: %s
                Trạng thái: Đã xác nhận

                %s
                Quản lý lịch hẹn tại: %s
                """.formatted(value(booking.getSupplier().getName()), booking.getBookingCode(),
                value(booking.getCustomer().getFullName()), value(booking.getCustomer().getPhone()),
                value(booking.getService().getName()), practitioner(booking),
                appointment(booking).format(DATE), appointment(booking).format(TIME),
                money(amounts.original()), money(amounts.payable()), money(payment.getAmount()),
                money(payment.getRemainingAmount()), paymentLabel(payment.getPaymentOption()), paymentMessage, dashboardUrl);
        String html = layout("Bạn có một lịch hẹn mới đã được xác nhận!",
                "Khách hàng đã hoàn tất khoản thanh toán cần thiết để xác nhận lịch hẹn.",
                rows(new String[][]{
                        {"Đối tác", value(booking.getSupplier().getName())},
                        {"Mã đặt lịch", booking.getBookingCode()},
                        {"Khách hàng", value(booking.getCustomer().getFullName())},
                        {"Điện thoại", value(booking.getCustomer().getPhone())},
                        {"Dịch vụ", value(booking.getService().getName())},
                        {"Chuyên viên", practitioner(booking)},
                        {"Lịch hẹn", appointment(booking).format(DATE) + " · " + appointment(booking).format(TIME)},
                        {"Giá trị dịch vụ", money(amounts.original())},
                        {"Tổng sau giảm giá", money(amounts.payable())},
                        {"Khách đã thanh toán BeautyLink", money(payment.getAmount())},
                        {"Còn lại dự kiến tại cơ sở", money(payment.getRemainingAmount())},
                        {"Hình thức thanh toán", paymentLabel(payment.getPaymentOption())},
                        {"Trạng thái", "Đã xác nhận"}
                }), paymentMessage, "Mở trang quản lý lịch hẹn", dashboardUrl,
                "Khoản thanh toán được ghi nhận bởi BeautyLink qua PayOS; email này không xác nhận việc tiền đã được quyết toán trực tiếp cho đối tác.");
        String ownerEmail = booking.getSupplier().getOwner() == null ? null : booking.getSupplier().getOwner().getEmail();
        return new RenderedEmail(EmailRecipientRole.SUPPLIER, ownerEmail, subject, text, html);
    }

    private String layout(String title, String intro, String rows, String notice, String button, String url, String footer) {
        return """
                <!doctype html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;background:#fff5f7;font-family:Arial,sans-serif;color:#172033"><table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background:#fff5f7"><tr><td align="center" style="padding:24px 12px">
                <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #fbcfe8;border-radius:20px;overflow:hidden">
                <tr><td style="padding:24px 28px;background:#be185d;color:#fff"><div style="font-size:25px;font-weight:800">BeautyLink</div><div style="font-size:13px;margin-top:4px">Kết nối vẻ đẹp · Xác nhận an toàn</div></td></tr>
                <tr><td style="padding:28px"><h1 style="font-size:22px;margin:0 0 10px">%s</h1><p style="margin:0 0 20px;color:#596579;line-height:1.6">%s</p>%s
                <div style="margin:20px 0;padding:14px 16px;border-radius:12px;background:#fdf2f8;color:#9d174d;line-height:1.55">%s</div>
                <p style="text-align:center;margin:24px 0"><a href="%s" style="display:inline-block;background:#e1146c;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">%s</a></p>
                <p style="margin:20px 0 0;color:#6b7280;font-size:12px;line-height:1.55">%s</p></td></tr></table></td></tr></table></body></html>
                """.formatted(escape(title), escape(intro), rows, escape(notice), escape(url), escape(button), escape(footer));
    }

    private String rows(String[][] values) {
        StringBuilder html = new StringBuilder("<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"border-collapse:collapse\">");
        for (String[] row : values) {
            html.append("<tr><td style=\"padding:9px 6px;border-bottom:1px solid #fce7f3;color:#6b7280;font-size:13px\">")
                    .append(escape(row[0])).append("</td><td align=\"right\" style=\"padding:9px 6px;border-bottom:1px solid #fce7f3;font-size:13px;font-weight:700\">")
                    .append(escape(row[1])).append("</td></tr>");
        }
        return html.append("</table>").toString();
    }

    static String escape(String value) {
        return value(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    private static Amounts amounts(Booking booking, PaymentTransaction payment) {
        BigDecimal original = booking.getTotalAmount().setScale(0, RoundingMode.HALF_UP);
        BigDecimal payable = payment.getAmount().add(payment.getRemainingAmount()).setScale(0, RoundingMode.HALF_UP);
        return new Amounts(original, original.subtract(payable).max(BigDecimal.ZERO), payable);
    }

    private static String paymentLabel(PaymentOption option) {
        return switch (option) {
            case DEPOSIT_05 -> "Đặt cọc 5%";
            case DEPOSIT_50 -> "Đặt cọc 50% (giao dịch lịch sử)";
            case FULL_100 -> "Thanh toán 100%";
        };
    }

    private static String money(BigDecimal amount) {
        NumberFormat format = NumberFormat.getIntegerInstance(VIETNAM);
        return format.format(amount.setScale(0, RoundingMode.HALF_UP)) + "đ";
    }

    private static String practitioner(Booking booking) {
        return booking.getPractitioner() == null ? "Chưa chỉ định" : value(booking.getPractitioner().getDisplayName());
    }

    // Booking date/time fields are business wall-clock values for Vietnam, not UTC instants.
    private static ZonedDateTime appointment(Booking booking) {
        return booking.getAppointmentDate().atTime(booking.getStartTime()).atZone(VIETNAM_ZONE);
    }

    private static String value(String value) { return value == null || value.isBlank() ? "Không có thông tin" : value.trim(); }

    private static String requireSafeBaseUrl(String value) {
        URI uri = URI.create(value == null ? "" : value.trim());
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
                || (uri.getPort() != -1 && uri.getPort() != 443) || uri.getQuery() != null || uri.getFragment() != null) {
            throw new IllegalArgumentException("app.frontend.public-url must be a safe HTTPS origin");
        }
        String normalized = uri.toString();
        return normalized.endsWith("/") ? normalized.substring(0, normalized.length() - 1) : normalized;
    }

    public record RenderedEmail(EmailRecipientRole recipientRole, String recipientEmail, String subject,
                                String textBody, String htmlBody) {}
    private record Amounts(BigDecimal original, BigDecimal discount, BigDecimal payable) {}
}
