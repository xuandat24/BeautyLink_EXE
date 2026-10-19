package com.example.backend.service;

import com.example.backend.exception.ApiException;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@Service
public class GoogleIdentityTokenVerifier implements GoogleTokenVerifier {
    private final List<String> clientIds;
    private final GoogleIdTokenVerifier verifier;

    public GoogleIdentityTokenVerifier(@Value("${app.google.client-ids:}") String configuredClientIds) {
        this.clientIds = Arrays.stream(configuredClientIds.split(","))
                .map(String::trim).filter(value -> !value.isBlank()).distinct().toList();
        this.verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), GsonFactory.getDefaultInstance())
                .setAudience(clientIds).build();
    }

    @Override
    public VerifiedGoogleIdentity verify(String credential) {
        if (clientIds.isEmpty()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "GOOGLE_AUTH_NOT_CONFIGURED",
                    "Đăng nhập Google chưa được cấu hình. Vui lòng dùng phương thức đăng nhập hiện có.");
        }
        if (credential == null || credential.isBlank() || credential.length() > 20_000) throw invalidToken();
        try {
            GoogleIdToken token = verifier.verify(credential);
            if (token == null) throw invalidToken();
            GoogleIdToken.Payload payload = token.getPayload();
            String subject = clean(payload.getSubject());
            String email = clean(payload.getEmail());
            if (subject == null || email == null || !Boolean.TRUE.equals(payload.getEmailVerified())) throw invalidToken();
            String name = clean((String) payload.get("name"));
            if (name == null) name = email.substring(0, email.indexOf('@') > 0 ? email.indexOf('@') : email.length());
            return new VerifiedGoogleIdentity(subject, email.toLowerCase(Locale.ROOT), name);
        } catch (GeneralSecurityException | IOException | IllegalArgumentException error) {
            throw invalidToken();
        }
    }

    private static String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim();
        return cleaned.isBlank() ? null : cleaned;
    }

    private static ApiException invalidToken() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "GOOGLE_TOKEN_INVALID",
                "Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.");
    }
}
