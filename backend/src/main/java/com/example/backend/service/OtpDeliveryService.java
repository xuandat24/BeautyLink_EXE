package com.example.backend.service;

import com.example.backend.exception.ApiException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Service
public class OtpDeliveryService {
    private final ObjectProvider<JavaMailSender> mailSender;
    private final String mailFrom;
    private final String twilioAccountSid;
    private final String twilioAuthToken;
    private final String twilioFromNumber;
    private final RestClient restClient;

    public OtpDeliveryService(ObjectProvider<JavaMailSender> mailSender,
                              @Value("${app.otp.mail-from:}") String mailFrom,
                              @Value("${app.otp.twilio.account-sid:}") String twilioAccountSid,
                              @Value("${app.otp.twilio.auth-token:}") String twilioAuthToken,
                              @Value("${app.otp.twilio.from-number:}") String twilioFromNumber) {
        this.mailSender = mailSender;
        this.mailFrom = mailFrom;
        this.twilioAccountSid = twilioAccountSid;
        this.twilioAuthToken = twilioAuthToken;
        this.twilioFromNumber = twilioFromNumber;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(8000);
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    public void sendPhoneCode(String phone, String code, long expiresMinutes) {
        if (!isPhoneConfigured()) {
            throw unavailable("Kênh SMS OTP chưa được cấu hình");
        }
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("To", toE164(phone));
        form.add("From", twilioFromNumber);
        form.add("Body", "BeautyLink: ma xac minh cua ban la " + code + ". Ma het han sau " + expiresMinutes + " phut.");
        try {
            restClient.post()
                    .uri("https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json", twilioAccountSid)
                    .headers(headers -> headers.setBasicAuth(twilioAccountSid, twilioAuthToken))
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve().toBodilessEntity();
        } catch (RuntimeException ex) {
            throw unavailable("Không thể gửi SMS OTP. Vui lòng thử lại sau");
        }
    }

    public void sendEmailCode(String email, String code, long expiresMinutes) {
        JavaMailSender sender = mailSender.getIfAvailable();
        if (!isEmailConfigured()) throw unavailable("Kênh email OTP chưa được cấu hình");
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(mailFrom);
            message.setTo(email);
            message.setSubject("Mã xác minh BeautyLink");
            message.setText("Mã xác minh BeautyLink của bạn là " + code + ". Mã hết hạn sau " + expiresMinutes + " phút. Không chia sẻ mã này với bất kỳ ai.");
            sender.send(message);
        } catch (RuntimeException ex) {
            throw unavailable("Không thể gửi email OTP. Vui lòng thử lại sau");
        }
    }

    public boolean isPhoneConfigured() {
        return StringUtils.hasText(twilioAccountSid) && StringUtils.hasText(twilioAuthToken)
                && StringUtils.hasText(twilioFromNumber);
    }

    public boolean isEmailConfigured() {
        return mailSender.getIfAvailable() != null && StringUtils.hasText(mailFrom);
    }

    private String toE164(String phone) {
        String normalized = AuthService.normalizePhone(phone);
        return normalized.startsWith("0") ? "+84" + normalized.substring(1) : normalized;
    }

    private ApiException unavailable(String message) {
        return new ApiException(SERVICE_UNAVAILABLE, "OTP_DELIVERY_UNAVAILABLE", message);
    }
}
