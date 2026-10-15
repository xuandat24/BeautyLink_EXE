package com.example.backend.service;

import com.example.backend.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Service
public class OtpDeliveryService {
    private final TransactionalEmailSender emailSender;
    private final String mailFrom;

    @Autowired
    public OtpDeliveryService(TransactionalEmailSender emailSender,
                              @Value("${app.otp.mail-from:}") String mailFrom) {
        this.emailSender = emailSender;
        this.mailFrom = mailFrom == null ? "" : mailFrom.trim();
    }

    public OtpDeliveryService(RestClient resendClient, String resendApiKey, String mailFrom) {
        this(new ResendTransactionalEmailSender(resendClient, resendApiKey), mailFrom);
    }

    public void sendEmailCode(String email, String code, long expiresMinutes) {
        send(email, "Mã xác minh đăng ký BeautyLink",
                "Mã xác minh đăng ký BeautyLink của bạn là " + code + ". Mã có hiệu lực trong "
                        + expiresMinutes + " phút và chỉ được sử dụng một lần.",
                registrationEmailTemplate(code, expiresMinutes));
    }

    public void sendPasswordResetCode(String email, String code, long expiresMinutes) {
        send(email, "Mã đặt lại mật khẩu BeautyLink",
                "Mã đặt lại mật khẩu BeautyLink của bạn là " + code + ". Mã có hiệu lực trong "
                        + expiresMinutes + " phút và chỉ được sử dụng một lần.",
                passwordResetEmailTemplate(code, expiresMinutes));
    }

    private void send(String email, String subject, String text, String html) {
        try {
            if (!StringUtils.hasText(mailFrom) || !emailSender.isConfigured()) {
                throw unavailable("Kênh email OTP chưa được cấu hình");
            }
            emailSender.send(new TransactionalEmailSender.EmailMessage(
                    mailFrom, null, email, subject, text, html, null));
        } catch (TransactionalEmailSender.EmailDeliveryException ex) {
            if ("EMAIL_PROVIDER_RATE_LIMITED".equals(ex.getSafeCode())) {
                throw new ApiException(SERVICE_UNAVAILABLE, "OTP_PROVIDER_RATE_LIMITED",
                        "Dịch vụ email đang giới hạn tần suất. Vui lòng thử lại sau");
            }
            throw unavailable("Không thể gửi email OTP. Vui lòng thử lại sau");
        }
    }

    public boolean isEmailConfigured() {
        return StringUtils.hasText(mailFrom) && emailSender.isConfigured();
    }

    private String registrationEmailTemplate(String code, long expiresMinutes) {
        return """
                <!doctype html>
                <html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#fff5f7;font-family:Arial,sans-serif;color:#1f2937">
                <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background:#fff5f7"><tr><td align="center" style="padding:32px 16px">
                <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #fbcfe8;box-shadow:0 12px 32px rgba(190,24,93,.08)">
                <tr><td style="padding:28px 32px;background:#be185d;color:#fff"><div style="font-size:25px;font-weight:800">BeautyLink</div><div style="margin-top:5px;font-size:13px">Xác minh đăng ký tài khoản</div></td></tr>
                <tr><td style="padding:32px"><h1 style="margin:0 0 12px;font-size:22px;color:#111827">Mã OTP của bạn</h1>
                <p style="margin:0 0 24px;line-height:1.65;color:#4b5563">Nhập mã gồm 6 chữ số dưới đây để xác minh email và hoàn tất đăng ký BeautyLink.</p>
                <div style="padding:19px 12px;text-align:center;background:#fdf2f8;border:1px solid #fbcfe8;border-radius:14px;color:#be185d;font-size:30px;font-weight:800;letter-spacing:8px">%s</div>
                <p style="margin:20px 0 0;line-height:1.65;color:#4b5563;font-size:14px">Mã có hiệu lực trong <strong>%d phút</strong> và chỉ được sử dụng một lần.</p>
                <div style="margin-top:22px;padding:14px 16px;background:#fff7ed;border-radius:12px;color:#9a3412;font-size:13px;line-height:1.55"><strong>Bảo mật:</strong> Không chia sẻ mã này với bất kỳ ai, kể cả người tự xưng là nhân viên BeautyLink.</div>
                <p style="margin:22px 0 0;color:#6b7280;font-size:12px;line-height:1.55">Nếu bạn không yêu cầu đăng ký, hãy bỏ qua email này. Vui lòng kiểm tra cả thư rác nếu chưa thấy email.</p>
                </td></tr></table></td></tr></table></body></html>
                """.formatted(code, expiresMinutes);
    }

    private String passwordResetEmailTemplate(String code, long expiresMinutes) {
        return """
                <!doctype html><html lang="vi"><body style="margin:0;background:#fff5f7;font-family:Arial,sans-serif;color:#1f2937">
                <table role="presentation" width="100%%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px">
                <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #fbcfe8">
                <tr><td style="padding:28px 32px;background:#be185d;color:#fff"><strong style="font-size:24px">BeautyLink</strong><br><span style="font-size:13px">Khôi phục tài khoản an toàn</span></td></tr>
                <tr><td style="padding:32px"><h1 style="margin:0 0 12px;font-size:22px">Đặt lại mật khẩu</h1><p style="margin:0 0 24px;line-height:1.6">Nhập mã gồm 6 chữ số dưới đây tại BeautyLink để đặt mật khẩu mới. Mã có hiệu lực trong %d phút.</p>
                <div style="padding:18px;text-align:center;background:#fdf2f8;border-radius:14px;color:#be185d;font-size:30px;font-weight:700;letter-spacing:8px">%s</div>
                <p style="margin:24px 0 0;line-height:1.6;color:#6b7280;font-size:13px">BeautyLink không bao giờ yêu cầu bạn đọc mã này qua điện thoại. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p></td></tr>
                </table></td></tr></table></body></html>
                """.formatted(expiresMinutes, code);
    }

    private ApiException unavailable(String message) {
        return new ApiException(SERVICE_UNAVAILABLE, "OTP_DELIVERY_UNAVAILABLE", message);
    }

}
