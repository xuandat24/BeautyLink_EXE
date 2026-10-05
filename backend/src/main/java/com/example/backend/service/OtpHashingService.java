package com.example.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import com.example.backend.exception.ApiException;
import org.springframework.http.HttpStatus;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

@Component
public class OtpHashingService {
    private final byte[] pepper;

    public OtpHashingService(@Value("${app.otp.pepper}") String pepper) {
        this.pepper = pepper.getBytes(StandardCharsets.UTF_8);
    }

    public String hash(String purpose, String value) {
        if (pepper.length < 32) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "OTP_NOT_CONFIGURED",
                    "Xác minh liên hệ chưa được cấu hình trên máy chủ");
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(pepper, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal((purpose + ":" + value).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("HMAC-SHA256 is required", ex);
        }
    }

    public boolean matches(String expected, String actual) {
        if (expected == null || actual == null) return false;
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII), actual.getBytes(StandardCharsets.US_ASCII));
    }

    public boolean matchesNullable(String expected, String actual) {
        return expected == null ? actual == null : matches(expected, actual);
    }
}
