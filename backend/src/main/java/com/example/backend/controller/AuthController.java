package com.example.backend.controller;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.service.*;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService auth; private final GoogleAuthService googleAuth; private final CurrentAccountService current; private final SupplierAccountService supplierAccounts; private final AuthAbuseGuard abuseGuard; private final RegistrationVerificationService verification; private final PasswordResetService passwordReset;
    public AuthController(AuthService auth, GoogleAuthService googleAuth, CurrentAccountService current, SupplierAccountService supplierAccounts, AuthAbuseGuard abuseGuard, RegistrationVerificationService verification, PasswordResetService passwordReset) { this.auth = auth; this.googleAuth = googleAuth; this.current = current; this.supplierAccounts = supplierAccounts; this.abuseGuard = abuseGuard; this.verification = verification; this.passwordReset = passwordReset; }
    @PostMapping("/registration-verification/start") public StartRegistrationVerificationResponse startVerification(@Valid @RequestBody StartRegistrationVerificationRequest request) { return verification.start(request); }
    @PostMapping("/registration-verification/confirm") public ConfirmRegistrationVerificationResponse confirmVerification(@Valid @RequestBody ConfirmRegistrationVerificationRequest request, HttpServletRequest http) { return verification.confirm(request, http.getRemoteAddr()); }
    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED) public AuthResponse register(@Valid @RequestBody RegisterRequest request) { return auth.register(request); }
    @PostMapping("/login") public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) { abuseGuard.checkLogin(http.getRemoteAddr(), request.identifier()); AuthResponse response = auth.login(request); abuseGuard.loginSucceeded(request.identifier()); return response; }
    @PostMapping("/google") public AuthResponse google(@Valid @RequestBody GoogleLoginRequest request, HttpServletRequest http) { abuseGuard.checkGoogleSignIn(http.getRemoteAddr()); return googleAuth.authenticate(request.credential()); }
    @PostMapping("/password-reset/start") public StartPasswordResetResponse startPasswordReset(@Valid @RequestBody StartPasswordResetRequest request, HttpServletRequest http) { return passwordReset.start(request, http.getRemoteAddr()); }
    @PostMapping("/password-reset/confirm") public ConfirmPasswordResetResponse confirmPasswordReset(@Valid @RequestBody ConfirmPasswordResetRequest request, HttpServletRequest http) { return passwordReset.confirm(request, http.getRemoteAddr()); }
    @PostMapping("/register-supplier") @ResponseStatus(HttpStatus.CREATED) public SupplierRegistrationResponse registerSupplier(@Valid @RequestBody SupplierRegistrationRequest request) { return supplierAccounts.register(request); }
    @GetMapping("/me") public UserResponse me(Authentication authentication) { return auth.toUser(current.require(authentication)); }
    @PatchMapping("/me/phone") public AuthResponse updatePhone(Authentication authentication, @Valid @RequestBody UpdatePhoneRequest request) { return auth.updatePhone(current.require(authentication), request); }
    @PatchMapping("/me/profile") public AuthResponse updateProfile(Authentication authentication, @Valid @RequestBody UpdateCustomerProfileRequest request) { return auth.updateProfile(current.require(authentication), request); }
}
