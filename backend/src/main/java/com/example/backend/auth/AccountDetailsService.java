package com.example.backend.auth;

import com.example.backend.model.UserAccount;
import com.example.backend.repository.UserAccountRepository;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;
import io.jsonwebtoken.Claims;

@Service
public class AccountDetailsService implements UserDetailsService {
    private final UserAccountRepository users;
    public AccountDetailsService(UserAccountRepository users) { this.users = users; }
    @Override public UserDetails loadUserByUsername(String phone) {
        UserAccount user = users.findByPhone(phone).orElseThrow(() -> new UsernameNotFoundException("Account not found"));
        return principal(user);
    }
    public UserDetails loadUserForToken(Claims claims, JwtService jwt) {
        UserAccount user = users.findByPhone(claims.getSubject())
                .orElseThrow(() -> new UsernameNotFoundException("Account not found"));
        if (!jwt.matchesAccount(claims, user)) throw new UsernameNotFoundException("Token identity is no longer current");
        return principal(user);
    }
    private UserDetails principal(UserAccount user) {
        UserDetails details = User.withUsername(user.getPhone()).password(user.getPasswordHash())
                .authorities("ROLE_" + user.getRole().name())
                .disabled(user.getStatus() != com.example.backend.model.DomainEnums.AccountStatus.ACTIVE).build();
        return new AccountPrincipal(user.getId(), user.getUpdatedAt().toEpochMilli(), details);
    }
    public static final class AccountPrincipal extends User {
        private final Long accountId;
        private final long accountUpdatedAt;
        private AccountPrincipal(Long accountId, long accountUpdatedAt, UserDetails details) {
            super(details.getUsername(), details.getPassword(), details.isEnabled(),
                    details.isAccountNonExpired(), details.isCredentialsNonExpired(),
                    details.isAccountNonLocked(), details.getAuthorities());
            this.accountId = accountId;
            this.accountUpdatedAt = accountUpdatedAt;
        }
        public Long getAccountId() { return accountId; }
        public long getAccountUpdatedAt() { return accountUpdatedAt; }
    }
}
