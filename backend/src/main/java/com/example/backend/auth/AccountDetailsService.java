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
        return principal(loadAccountByPhone(phone));
    }
    public UserDetails loadUserForToken(Claims claims, JwtService jwt) {
        UserAccount user = loadAccountForClaims(claims);
        if (!jwt.matchesAccount(claims, user)) throw new UsernameNotFoundException("Token identity is no longer current");
        return principal(user);
    }
    private UserDetails principal(UserAccount user) {
        UserDetails details = User.withUsername(JwtService.ACCOUNT_SUBJECT_PREFIX + user.getId())
                .password(user.getPasswordHash() == null ? "" : user.getPasswordHash())
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
    public UserAccount loadAccountByPhone(String phone) {
        return users.findByPhone(phone).orElseThrow(() -> new UsernameNotFoundException("Account not found"));
    }
    private UserAccount loadAccountForClaims(Claims claims) {
        Number accountId = claims.get("accountId", Number.class);
        if (accountId != null) return users.findById(accountId.longValue())
                .orElseThrow(() -> new UsernameNotFoundException("Account not found"));
        String subject = claims.getSubject();
        if (subject != null && subject.startsWith(JwtService.ACCOUNT_SUBJECT_PREFIX)) {
            try {
                return users.findById(Long.parseLong(subject.substring(JwtService.ACCOUNT_SUBJECT_PREFIX.length())))
                        .orElseThrow(() -> new UsernameNotFoundException("Account not found"));
            } catch (NumberFormatException error) {
                throw new UsernameNotFoundException("Account not found");
            }
        }
        return loadAccountByPhone(subject);
    }
}
