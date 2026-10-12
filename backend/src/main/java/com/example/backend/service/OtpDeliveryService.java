package com.example.backend.service;

import com.example.backend.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.List;

import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Service
public class OtpDeliveryService {
    private static final Logger log = LoggerFactory.getLogger(OtpDeliveryService.class);

    private final RestClient resendClient;
    private final String resendApiKey;
    private final String mailFrom;

    @Autowired
    public OtpDeliveryService(@Value("${app.otp.resend.api-key:}") String resendApiKey,
                              @Value("${app.otp.mail-from:}") String mailFrom,
                              @Value("${app.otp.resend.connect-timeout-ms:5000}") long connectTimeoutMs,
                              @Value("${app.otp.resend.read-timeout-ms:10000}") long readTimeoutMs) {
        this.resendApiKey = resendApiKey == null ? "" : resendApiKey.trim();
        this.mailFrom = mailFrom == null ? "" : mailFrom.trim();
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
        requestFactory.setReadTimeout(Duration.ofMillis(readTimeoutMs));
        this.resendClient = RestClient.builder().baseUrl("https://api.resend.com").requestFactory(requestFactory).build();
    }

    public OtpDeliveryService(RestClient resendClient, String resendApiKey, String mailFrom) {
        this.resendClient = resendClient;
        this.resendApiKey = resendApiKey == null ? "" : resendApiKey.trim();
        this.mailFrom = mailFrom == null ? "" : mailFrom.trim();
    }

    public void sendEmailCode(String email, String code, long expiresMinutes) {
        if (!isEmailConfigured()) {
            throw unavailable("Xác minh email chưa được cấu hình trên máy chủ");
        }
        try {
            ResendEmailResponse response = resendClient.post()
                    .uri("/emails")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + resendApiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new ResendEmailRequest(mailFrom, List.of(email),
                            "Mã xác minh đăng ký BeautyLink", emailTemplate(code, expiresMinutes)))
                    .retrieve()
                    .body(ResendEmailResponse.class);
            if (response == null || !StringUtils.hasText(response.id())) {
                log.warn("Resend accepted no identifiable OTP email request");
                throw unavailable("Dịch vụ email chưa xác nhận yêu cầu gửi OTP. Vui lòng thử lại sau");
            }
        } catch (ApiException ex) {
            throw ex;
        } catch (RestClientResponseException ex) {
            int status = ex.getStatusCode().value();
            log.warn("Resend rejected OTP email request status={}", status);
            if (status == 429) {
                throw new ApiException(SERVICE_UNAVAILABLE, "OTP_PROVIDER_RATE_LIMITED",
                        "Dịch vụ email đang giới hạn tần suất. Vui lòng thử lại sau");
            }
            throw unavailable("Không thể gửi email OTP. Vui lòng kiểm tra cấu hình người gửi hoặc thử lại sau");
        } catch (ResourceAccessException ex) {
            log.warn("Resend OTP email request failed due to network or timeout type={}", ex.getClass().getSimpleName());
            throw unavailable("Dịch vụ email tạm thời không phản hồi. Vui lòng thử lại sau");
        } catch (RuntimeException ex) {
            log.warn("Resend OTP email request failed unexpectedly type={}", ex.getClass().getSimpleName());
            throw unavailable("Không thể gửi email OTP. Vui lòng thử lại sau");
        }
    }

    public boolean isEmailConfigured() {
        return StringUtils.hasText(resendApiKey) && StringUtils.hasText(mailFrom);
    }

    private String emailTemplate(String code, long expiresMinutes) {
        return """
                <!doctype html>
                <html lang="vi"><body style="margin:0;background:#fff5f7;font-family:Arial,sans-serif;color:#1f2937">
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

    private ApiException unavailable(String message) {
        return new ApiException(SERVICE_UNAVAILABLE, "OTP_DELIVERY_UNAVAILABLE", message);
    }

    private record ResendEmailRequest(String from, List<String> to, String subject, String html) {}
    private record ResendEmailResponse(String id) {}
}
