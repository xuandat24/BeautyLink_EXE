package com.example.backend.service;
import com.example.backend.exception.ApiException;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.UserAccountRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import com.example.backend.auth.AccountDetailsService.AccountPrincipal;
import com.example.backend.model.DomainEnums.AccountStatus;
@Service
public class CurrentAccountService {
    private final UserAccountRepository users;
    public CurrentAccountService(UserAccountRepository users) { this.users = users; }
    public UserAccount require(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Vui lòng đăng nhập");
        if (!(auth.getPrincipal() instanceof AccountPrincipal principal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Vui lòng đăng nhập");
        }
        return users.findById(principal.getAccountId())
                .filter(user -> user.getPhone().equals(auth.getName()) && user.getStatus() == AccountStatus.ACTIVE
                        && user.getUpdatedAt().toEpochMilli() == principal.getAccountUpdatedAt())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ACCOUNT_NOT_FOUND", "Phiên đăng nhập không còn hợp lệ"));
    }
}
