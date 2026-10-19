package com.example.backend.service;

import com.example.backend.auth.JwtService;
import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.Objects;
import static com.example.backend.model.DomainEnums.*;

@Service
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private final UserAccountRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final RegistrationVerificationService verification;

    public AuthService(UserAccountRepository users, PasswordEncoder encoder, JwtService jwt,
                       RegistrationVerificationService verification) {
        this.users = users; this.encoder = encoder; this.jwt = jwt; this.verification = verification;
    }

    @Transactional public AuthResponse register(RegisterRequest request) {
        String phone = normalizePhone(request.phone());
        verification.consume(request.verificationToken(), phone, request.email());
        if (users.existsByPhone(phone) || users.existsByEmailIgnoreCase(request.email().trim())) throw registrationConflict();
        if (request.dateOfBirth().getYear() < 1900) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_BIRTH_DATE", "Năm sinh phải từ năm 1900 trở đi");
        }
        UserAccount user = new UserAccount();
        user.setFullName(request.fullName().trim().replaceAll("\\s+", " "));
        user.setPhone(phone); user.setEmail(request.email().trim().toLowerCase());
        user.setGender(request.gender()); user.setDateOfBirth(request.dateOfBirth());
        user.setPasswordHash(encoder.encode(request.password()));
        user.setBookingContactConfirmedPhone(phone); user.setBookingContactConfirmedAt(Instant.now());
        user.setRole(Role.CUSTOMER); user.setStatus(AccountStatus.ACTIVE);
        try { return response(users.saveAndFlush(user)); }
        catch (DataIntegrityViolationException error) { throw registrationConflict(); }
    }

    public AuthResponse login(LoginRequest request) {
        String identifier = request.identifier().trim();
        UserAccount user = identifier.contains("@") ? users.findByEmailIgnoreCase(identifier).orElse(null)
                : users.findByPhone(normalizePhone(identifier)).orElse(null);
        if (user == null || user.getStatus() != AccountStatus.ACTIVE || !hasValidBcryptHash(user.getPasswordHash())) {
            if (user != null && user.getPasswordHash() != null && !hasValidBcryptHash(user.getPasswordHash()))
                log.warn("Login rejected because accountId={} has an invalid stored password hash", user.getId());
            throw invalidCredentials();
        }
        try { if (encoder.matches(request.password(), user.getPasswordHash())) return response(user); }
        catch (IllegalArgumentException error) { log.warn("Login rejected because accountId={} has an unreadable stored password hash", user.getId()); }
        throw invalidCredentials();
    }

    @Transactional public AuthResponse updatePhone(UserAccount current, UpdatePhoneRequest request) {
        String phone = normalizePhone(request.phone());
        if (phone == null || !phone.matches("^0(?:3|5|7|8|9)[0-9]{8}$")) throw new ApiException(HttpStatus.BAD_REQUEST,
                "INVALID_PHONE", "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09");
        if (Objects.equals(phone, current.getPhone()) && BookingContactPolicy.isReady(current)) return response(current);
        return updateProfile(current, new UpdateCustomerProfileRequest(null, request.phone(), null, null, true));
    }

    @Transactional public AuthResponse updateProfile(UserAccount current, UpdateCustomerProfileRequest request) {
        if (current.getRole() != Role.CUSTOMER) throw new ApiException(HttpStatus.FORBIDDEN, "CUSTOMER_PROFILE_ONLY",
                "Chỉ tài khoản khách hàng có thể cập nhật hồ sơ đặt lịch");
        UserAccount account = users.findLockedById(current.getId()).orElseThrow(AuthService::invalidCredentials);
        if (account.getUpdatedAt().toEpochMilli() != current.getUpdatedAt().toEpochMilli()) throw invalidCredentials();
        String phone = request.phone() == null ? account.getPhone() : normalizePhone(request.phone());
        if (phone == null || !phone.matches("^0(?:3|5|7|8|9)[0-9]{8}$")) throw new ApiException(HttpStatus.BAD_REQUEST,
                "INVALID_PHONE", "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09");
        boolean phoneChanged = !Objects.equals(phone, account.getPhone());
        if (phoneChanged && users.existsByPhoneAndIdNot(phone, account.getId())) throw phoneConflict();
        if (request.fullName() != null) account.setFullName(request.fullName().trim().replaceAll("\\s+", " "));
        if (request.gender() != null) account.setGender(request.gender());
        if (request.dateOfBirth() != null) {
            if (request.dateOfBirth().getYear() < 1900) throw new ApiException(HttpStatus.BAD_REQUEST,
                    "INVALID_BIRTH_DATE", "Năm sinh phải từ năm 1900 trở đi");
            account.setDateOfBirth(request.dateOfBirth());
        }
        account.setPhone(phone);
        if (request.confirmBookingContact()) {
            account.setBookingContactConfirmedPhone(phone); account.setBookingContactConfirmedAt(Instant.now());
            account.setBookingContactConfirmationRequired(false);
        } else if (phoneChanged) {
            account.setBookingContactConfirmedPhone(null); account.setBookingContactConfirmedAt(null);
            account.setBookingContactConfirmationRequired(true);
        }
        try { return response(users.saveAndFlush(account)); }
        catch (DataIntegrityViolationException error) { throw phoneConflict(); }
    }

    public AuthResponse response(UserAccount user) {
        return new AuthResponse(jwt.createToken(user), "Bearer", jwt.getExpirationMs(), toUser(user));
    }
    public UserResponse toUser(UserAccount user) {
        return new UserResponse(user.getId(), user.getFullName(), user.getPhone(), user.getEmail(), user.getGender(),
                user.getDateOfBirth(), user.getRole(), user.getLoyaltyPoints(), BookingContactPolicy.isReady(user));
    }
    public static String normalizePhone(String value) { return value == null ? null : value.replaceAll("[\\s.-]", ""); }
    public static boolean hasValidBcryptHash(String value) { return value != null && value.matches("^\\$2[aby]\\$[0-3][0-9]\\$[./A-Za-z0-9]{53}$"); }
    public static ApiException registrationConflict() { return new ApiException(HttpStatus.CONFLICT, "REGISTRATION_CONFLICT", "Không thể đăng ký với thông tin đã cung cấp. Hãy đăng nhập hoặc sử dụng quy trình khôi phục tài khoản"); }
    private static ApiException phoneConflict() { return new ApiException(HttpStatus.CONFLICT, "PHONE_ALREADY_IN_USE", "Số điện thoại này đang được sử dụng bởi tài khoản khác"); }
    private static ApiException invalidCredentials() { return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Thông tin đăng nhập không chính xác"); }
}
