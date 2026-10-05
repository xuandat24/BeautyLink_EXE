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
    private final AuthService auth; private final CurrentAccountService current; private final SupplierAccountService supplierAccounts; private final AuthAbuseGuard abuseGuard;
    public AuthController(AuthService auth, CurrentAccountService current, SupplierAccountService supplierAccounts, AuthAbuseGuard abuseGuard) { this.auth = auth; this.current = current; this.supplierAccounts = supplierAccounts; this.abuseGuard = abuseGuard; }
    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED) public AuthResponse register(@Valid @RequestBody RegisterRequest request) { return auth.register(request); }
    @PostMapping("/login") public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) { abuseGuard.checkLogin(http.getRemoteAddr(), request.identifier()); AuthResponse response = auth.login(request); abuseGuard.loginSucceeded(request.identifier()); return response; }
    @PostMapping("/register-supplier") @ResponseStatus(HttpStatus.CREATED) public SupplierRegistrationResponse registerSupplier(@Valid @RequestBody SupplierRegistrationRequest request) { return supplierAccounts.register(request); }
    @GetMapping("/me") public UserResponse me(Authentication authentication) { return auth.toUser(current.require(authentication)); }
}
