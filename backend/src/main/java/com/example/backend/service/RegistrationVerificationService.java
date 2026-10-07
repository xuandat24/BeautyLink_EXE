package com.example.backend.service;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.OtpVerificationChallenge;
import com.example.backend.model.DomainEnums.VerificationChannel;
import com.example.backend.repository.OtpVerificationChallengeRepository;
import com.example.backend.repository.UserAccountRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class RegistrationVerificationService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final OtpVerificationChallengeRepository challenges;
    private final OtpHashingService hashing;
    private final OtpDeliveryService delivery;
    private final UserAccountRepository users;
    private final AuthAbuseGuard abuseGuard;
    private final long codeTtlSeconds;
    private final long tokenTtlSeconds;
    private final int maxAttempts;

    public RegistrationVerificationService(OtpVerificationChallengeRepository challenges, OtpHashingService hashing,
                                           OtpDeliveryService delivery, UserAccountRepository users, AuthAbuseGuard abuseGuard,
                                           @Value("${app.otp.code-ttl-seconds:600}") long codeTtlSeconds,
                                           @Value("${app.otp.registration-token-ttl-seconds:900}") long tokenTtlSeconds,
                                           @Value("${app.otp.max-attempts:5}") int maxAttempts) {
        this.challenges = challenges;
        this.hashing = hashing;
        this.delivery = delivery;
        this.users = users;
        this.abuseGuard = abuseGuard;
        this.codeTtlSeconds = codeTtlSeconds;
        this.tokenTtlSeconds = tokenTtlSeconds;
        this.maxAttempts = maxAttempts;
    }

    @Transactional
    public StartRegistrationVerificationResponse start(StartRegistrationVerificationRequest request) {
        String phone = AuthService.normalizePhone(request.phone());
        String email = normalizeEmail(request.email());
        abuseGuard.checkVerificationTarget(phone, email);
        if (users.existsByPhone(phone) || users.existsByEmailIgnoreCase(email)) throw AuthService.registrationConflict();
        if (request.channel() == VerificationChannel.PHONE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_EMAIL_ONLY", "BeautyLink chỉ hỗ trợ gửi mã OTP qua email");
        }
        if (!delivery.isEmailConfigured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "OTP_DELIVERY_UNAVAILABLE", "Kênh email OTP chưa được cấu hình");
        }
        String challengeId = UUID.randomUUID().toString();
        String otpCode = code();
        OtpVerificationChallenge challenge = new OtpVerificationChallenge();
        challenge.setId(challengeId);
        challenge.setPhoneHash(hashing.hash("phone", phone));
        challenge.setEmailHash(hashing.hash("email", email));
        challenge.setPhoneCodeHash(hashing.hash("otp-phone-" + challengeId, otpCode));
        challenge.setEmailCodeHash(hashing.hash("otp-email-" + challengeId, otpCode));
        challenge.setVerificationChannel(VerificationChannel.EMAIL);
        challenge.setExpiresAt(Instant.now().plusSeconds(codeTtlSeconds));
        challenges.save(challenge);

        long minutes = Math.max(1, (codeTtlSeconds + 59) / 60);
        delivery.sendEmailCode(email, otpCode, minutes);
        Set<String> channels = new LinkedHashSet<>();
        channels.add(VerificationChannel.EMAIL.name());
        return new StartRegistrationVerificationResponse(challengeId, codeTtlSeconds, channels);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public ConfirmRegistrationVerificationResponse confirm(ConfirmRegistrationVerificationRequest request, String remoteAddress) {
        abuseGuard.checkVerificationAttempt(remoteAddress, request.challengeId());
        OtpVerificationChallenge challenge = challenges.findLockedById(request.challengeId())
                .orElseThrow(this::invalidCode);
        Instant now = Instant.now();
        if (challenge.getVerifiedAt() != null || challenge.getConsumedAt() != null || challenge.getExpiresAt().isBefore(now)
                || challenge.getAttempts() >= maxAttempts) throw invalidCode();
        boolean emailMatches = challenge.getVerificationChannel() == VerificationChannel.EMAIL
                && hashing.matches(challenge.getEmailCodeHash(), hashing.hash("otp-email-" + challenge.getId(), request.emailCode() == null ? "" : request.emailCode()));
        if (!emailMatches) {
            challenge.setAttempts(challenge.getAttempts() + 1);
            throw invalidCode();
        }
        String token = randomToken();
        challenge.setVerifiedAt(now);
        challenge.setRegistrationTokenHash(hashing.hash("registration-token", token));
        challenge.setTokenExpiresAt(now.plusSeconds(tokenTtlSeconds));
        return new ConfirmRegistrationVerificationResponse(token, tokenTtlSeconds);
    }

    @Transactional
    public void consume(String registrationToken, String phone, String email) {
        String tokenHash = hashing.hash("registration-token", registrationToken == null ? "" : registrationToken);
        OtpVerificationChallenge challenge = challenges.findByRegistrationTokenHash(tokenHash)
                .orElseThrow(this::invalidToken);
        Instant now = Instant.now();
        if (challenge.getVerifiedAt() == null || challenge.getConsumedAt() != null
                || challenge.getTokenExpiresAt() == null || !challenge.getTokenExpiresAt().isAfter(now)
                || !hashing.matches(challenge.getPhoneHash(), hashing.hash("phone", AuthService.normalizePhone(phone)))
                || !hashing.matchesNullable(challenge.getEmailHash(), email == null || email.isBlank() ? null : hashing.hash("email", normalizeEmail(email)))) {
            throw invalidToken();
        }
        challenge.setConsumedAt(now);
    }

    @Scheduled(cron = "0 17 3 * * *")
    @Transactional
    public void purgeExpiredChallenges() {
        challenges.deleteByExpiresAtBefore(Instant.now().minusSeconds(86400));
    }

    private String code() { return String.format("%06d", RANDOM.nextInt(1_000_000)); }
    private String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    private String normalizeEmail(String email) { return email == null || email.isBlank() ? null : email.trim().toLowerCase(Locale.ROOT); }
    private ApiException invalidCode() { return new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID", "Mã xác minh không đúng, đã hết hạn hoặc đã dùng"); }
    private ApiException invalidToken() { return new ApiException(HttpStatus.BAD_REQUEST, "VERIFICATION_REQUIRED", "Phiên xác minh không hợp lệ hoặc đã hết hạn"); }
}
