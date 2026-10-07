package com.example.backend.service;

import com.example.backend.exception.ApiException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;

import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Service
public class OtpDeliveryService {
    private final ObjectProvider<JavaMailSender> mailSender;
    private final String mailFrom;

    public OtpDeliveryService(ObjectProvider<JavaMailSender> mailSender,
                              @Value("${app.otp.mail-from:}") String mailFrom) {
        this.mailSender = mailSender;
        this.mailFrom = mailFrom;
    }

    public void sendEmailCode(String email, String code, long expiresMinutes) {
        JavaMailSender sender = mailSender.getIfAvailable();
        if (!isEmailConfigured()) throw unavailable("Kênh email OTP chưa được cấu hình");
        try {
            MimeMessage mimeMessage = sender.createMimeMessage();
            MimeMessageHelper message = new MimeMessageHelper(mimeMessage, false, StandardCharsets.UTF_8.name());
            message.setFrom(mailFrom);
            message.setTo(email);
            message.setSubject("Mã xác minh đăng ký BeautyLink");
            message.setText(emailTemplate(code, expiresMinutes), true);
            sender.send(mimeMessage);
        } catch (Exception ex) {
            throw unavailable("Không thể gửi email OTP. Vui lòng thử lại sau");
        }
    }

    public boolean isEmailConfigured() {
        return mailSender.getIfAvailable() != null && StringUtils.hasText(mailFrom);
    }

    private String emailTemplate(String code, long expiresMinutes) {
        return """
                <!doctype html><html lang=\"vi\"><body style=\"margin:0;background:#fff5f7;font-family:Arial,sans-serif;color:#1f2937\">
                <table role=\"presentation\" width=\"100%%\" cellspacing=\"0\" cellpadding=\"0\"><tr><td align=\"center\" style=\"padding:32px 16px\">
                <table role=\"presentation\" width=\"100%%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #fbcfe8\">
                <tr><td style=\"padding:28px 32px;background:#be185d;color:#fff\"><strong style=\"font-size:24px\">BeautyLink</strong><br><span style=\"font-size:13px\">Xác minh đăng ký tài khoản</span></td></tr>
                <tr><td style=\"padding:32px\"><h1 style=\"margin:0 0 12px;font-size:22px\">Mã xác minh của bạn</h1><p style=\"margin:0 0 24px;line-height:1.6\">Dùng mã gồm 6 chữ số dưới đây để hoàn tất đăng ký. Mã có hiệu lực trong %d phút.</p>
                <div style=\"padding:18px;text-align:center;background:#fdf2f8;border-radius:14px;color:#be185d;font-size:30px;font-weight:700;letter-spacing:8px\">%s</div>
                <p style=\"margin:24px 0 0;line-height:1.6;color:#6b7280;font-size:13px\">Không chia sẻ mã này với bất kỳ ai. Nếu bạn không yêu cầu đăng ký BeautyLink, hãy bỏ qua email này.</p></td></tr>
                </table></td></tr></table></body></html>
                """.formatted(expiresMinutes, code);
    }

    private ApiException unavailable(String message) {
        return new ApiException(SERVICE_UNAVAILABLE, "OTP_DELIVERY_UNAVAILABLE", message);
    }
}
