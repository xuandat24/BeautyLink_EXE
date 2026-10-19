package com.example.backend.service;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.PasswordResetChallenge;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.PasswordResetChallengeRepository;
import com.example.backend.repository.UserAccountRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import static com.example.backend.model.DomainEnums.AccountStatus.ACTIVE;

@Service
public class PasswordResetService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String GENERIC_MESSAGE = "Nếu tài khoản tồn tại và có email hợp lệ, BeautyLink đã gửi mã OTP đặt lại mật khẩu.";
    private final PasswordResetChallengeRepository challenges;
    private final UserAccountRepository users;
    private final OtpHashingService hashing;
    private final OtpDeliveryService delivery;
    private final PasswordEncoder encoder;
    private final AuthAbuseGuard abuseGuard;
    private final long codeTtlSeconds;
    private final int maxAttempts;

    public PasswordResetService(PasswordResetChallengeRepository challenges, UserAccountRepository users,
                                OtpHashingService hashing, OtpDeliveryService delivery, PasswordEncoder encoder,
                                AuthAbuseGuard abuseGuard,
                                @Value("${app.otp.code-ttl-seconds:600}") long codeTtlSeconds,
                                @Value("${app.otp.max-attempts:5}") int maxAttempts) {
        this.challenges = challenges;
        this.users = users;
        this.hashing = hashing;
        this.delivery = delivery;
        this.encoder = encoder;
        this.abuseGuard = abuseGuard;
        this.codeTtlSeconds = codeTtlSeconds;
        this.maxAttempts = maxAttempts;
    }

    @Transactional
    public StartPasswordResetResponse start(StartPasswordResetRequest request, String remoteAddress) {
        String identifier = normalizeIdentifier(request.identifier());
        abuseGuard.checkPasswordResetStart(remoteAddress, identifier);
        if (!delivery.isEmailConfigured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "OTP_DELIVERY_UNAVAILABLE", "Kênh email OTP chưa được cấu hình");
        }

        Optional<UserAccount> matched = identifier.contains("@")
                ? users.findByEmailIgnoreCase(identifier)
                : users.findByPhone(AuthService.normalizePhone(identifier));
        UserAccount user = matched.filter(account -> account.getStatus() == ACTIVE)
                .filter(account -> account.getEmail() != null && !account.getEmail().isBlank())
                .filter(account -> AuthService.hasValidBcryptHash(account.getPasswordHash()))
                .orElse(null);

        String challengeId = UUID.randomUUID().toString();
        String otpCode = code();
        PasswordResetChallenge challenge = new PasswordResetChallenge();
        challenge.setId(challengeId);
        challenge.setUserId(user == null ? null : user.getId());
        challenge.setCodeHash(hashing.hash("password-reset-otp-" + challengeId, otpCode));
        challenge.setExpiresAt(Instant.now().plusSeconds(codeTtlSeconds));
        challenges.save(challenge);

        if (user != null) {
            long minutes = Math.max(1, (codeTtlSeconds + 59) / 60);
            delivery.sendPasswordResetCode(user.getEmail().trim().toLowerCase(Locale.ROOT), otpCode, minutes);
        }
        return new StartPasswordResetResponse(challengeId, codeTtlSeconds, GENERIC_MESSAGE);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public ConfirmPasswordResetResponse confirm(ConfirmPasswordResetRequest request, String remoteAddress) {
        abuseGuard.checkPasswordResetAttempt(remoteAddress, request.challengeId());
        PasswordResetChallenge challenge = challenges.findLockedById(request.challengeId())
                .orElseThrow(this::invalidCode);
        Instant now = Instant.now();
        if (challenge.getConsumedAt() != null || !challenge.getExpiresAt().isAfter(now)
                || challenge.getAttempts() >= maxAttempts) throw invalidCode();
        boolean codeMatches = hashing.matches(challenge.getCodeHash(),
                hashing.hash("password-reset-otp-" + challenge.getId(), request.otpCode()));
        if (!codeMatches || challenge.getUserId() == null) {
            challenge.setAttempts(challenge.getAttempts() + 1);
            throw invalidCode();
        }

        UserAccount user = users.findById(challenge.getUserId()).filter(account -> account.getStatus() == ACTIVE)
                .orElseThrow(this::invalidCode);
        user.setPasswordHash(encoder.encode(request.newPassword()));
        user.setAuthVersion(user.getAuthVersion() + 1);
        challenge.setConsumedAt(now);
        return new ConfirmPasswordResetResponse("Mật khẩu đã được đặt lại. Bạn có thể đăng nhập bằng mật khẩu mới.");
    }

    @Scheduled(cron = "0 23 3 * * *")
    @Transactional
    public void purgeExpiredChallenges() {
        challenges.deleteByExpiresAtBefore(Instant.now().minusSeconds(86400));
    }

    private String normalizeIdentifier(String identifier) {
        String normalized = identifier == null ? "" : identifier.trim().toLowerCase(Locale.ROOT);
        return normalized.contains("@") ? normalized : AuthService.normalizePhone(normalized);
    }
    private String code() { return String.format("%06d", RANDOM.nextInt(1_000_000)); }
    private ApiException invalidCode() {
        return new ApiException(HttpStatus.BAD_REQUEST, "PASSWORD_RESET_INVALID", "Mã OTP không đúng, đã hết hạn hoặc đã được sử dụng");
    }
}
