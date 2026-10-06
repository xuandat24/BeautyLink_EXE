package com.example.backend.service;

import com.example.backend.auth.JwtService;
import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.UserAccountRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.*;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.example.backend.model.DomainEnums.*;

@Service
public class AuthService {
    private final UserAccountRepository users; private final PasswordEncoder encoder; private final JwtService jwt; private final AuthenticationManager authenticationManager; private final RegistrationVerificationService verification;
    public AuthService(UserAccountRepository users, PasswordEncoder encoder, JwtService jwt, AuthenticationManager authenticationManager, RegistrationVerificationService verification) {
        this.users = users; this.encoder = encoder; this.jwt = jwt; this.authenticationManager = authenticationManager; this.verification = verification;
    }
    @Transactional public AuthResponse register(RegisterRequest request) {
        String phone = normalizePhone(request.phone());
        verification.consume(request.verificationToken(), phone, request.email());
        if (users.existsByPhone(phone)) throw registrationConflict();
        if (users.existsByEmailIgnoreCase(request.email().trim())) throw registrationConflict();
        if (request.dateOfBirth().getYear() < 1900) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_BIRTH_DATE", "Năm sinh phải gồm 4 chữ số và từ năm 1900 trở đi");
        }
        UserAccount user = new UserAccount(); user.setFullName(request.fullName().trim().replaceAll("\\s+", " ")); user.setPhone(phone);
        user.setEmail(request.email().trim().toLowerCase());
        user.setGender(request.gender()); user.setDateOfBirth(request.dateOfBirth());
        user.setPasswordHash(encoder.encode(request.password())); user.setRole(Role.CUSTOMER); user.setStatus(AccountStatus.ACTIVE);
        try { return response(users.saveAndFlush(user)); }
        catch (DataIntegrityViolationException ex) { throw registrationConflict(); }
    }
    public AuthResponse login(LoginRequest request) {
        String identifier = request.identifier().trim();
        UserAccount user = identifier.contains("@") ? users.findByEmailIgnoreCase(identifier).orElse(null) : users.findByPhone(normalizePhone(identifier)).orElse(null);
        if (user == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Thông tin đăng nhập không chính xác");
        try { authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(user.getPhone(), request.password())); }
        catch (AuthenticationException ex) { throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Thông tin đăng nhập không chính xác"); }
        return response(user);
    }
    public AuthResponse response(UserAccount user) { return new AuthResponse(jwt.createToken(user), "Bearer", jwt.getExpirationMs(), toUser(user)); }
    public UserResponse toUser(UserAccount u) { return new UserResponse(u.getId(), u.getFullName(), u.getPhone(), u.getEmail(), u.getGender(), u.getDateOfBirth(), u.getRole(), u.getLoyaltyPoints()); }
    public static String normalizePhone(String value) { return value == null ? "" : value.replaceAll("[\\s.-]", ""); }
    public static ApiException registrationConflict() { return new ApiException(HttpStatus.CONFLICT, "REGISTRATION_CONFLICT", "Không thể đăng ký với thông tin đã cung cấp. Hãy đăng nhập hoặc sử dụng quy trình khôi phục tài khoản"); }
}
