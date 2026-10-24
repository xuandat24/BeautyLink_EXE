package com.example.backend.service;

import com.example.backend.dto.ApiDtos.AuthResponse;
import com.example.backend.exception.ApiException;
import com.example.backend.model.ExternalIdentity;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.ExternalIdentityRepository;
import com.example.backend.repository.UserAccountRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static com.example.backend.model.DomainEnums.*;

@Service
public class GoogleAuthService {
    private final GoogleTokenVerifier tokens;
    private final ExternalIdentityRepository identities;
    private final UserAccountRepository users;
    private final AuthService auth;
    private final TransactionTemplate transactions;

    public GoogleAuthService(GoogleTokenVerifier tokens, ExternalIdentityRepository identities,
                             UserAccountRepository users, AuthService auth, PlatformTransactionManager manager) {
        this.tokens = tokens;
        this.identities = identities;
        this.users = users;
        this.auth = auth;
        this.transactions = new TransactionTemplate(manager);
    }

    public AuthResponse authenticate(String credential) {
        GoogleTokenVerifier.VerifiedGoogleIdentity verified = tokens.verify(credential);
        UserAccount existing = identities.findByProviderAndProviderSubject(ExternalIdentity.Provider.GOOGLE, verified.subject())
                .map(ExternalIdentity::getUserAccount).orElse(null);
        if (existing != null) return auth.response(requireEligible(existing));
        try {
            UserAccount created = transactions.execute(status -> createOrFind(verified));
            return auth.response(requireEligible(created));
        } catch (DataIntegrityViolationException race) {
            UserAccount winner = identities.findByProviderAndProviderSubject(ExternalIdentity.Provider.GOOGLE, verified.subject())
                    .map(ExternalIdentity::getUserAccount).orElse(null);
            if (winner != null) return auth.response(requireEligible(winner));
            throw emailCollision();
        } catch (ApiException collision) {
            if (!"GOOGLE_ACCOUNT_LINK_REQUIRED".equals(collision.getCode())) throw collision;
            // The same subject may have won between the first lookup and the email check.
            UserAccount winner = identities.findByProviderAndProviderSubject(ExternalIdentity.Provider.GOOGLE, verified.subject())
                    .map(ExternalIdentity::getUserAccount).orElse(null);
            if (winner != null) return auth.response(requireEligible(winner));
            throw collision;
        }
    }

    private UserAccount createOrFind(GoogleTokenVerifier.VerifiedGoogleIdentity verified) {
        UserAccount linked = identities.findByProviderAndProviderSubject(ExternalIdentity.Provider.GOOGLE, verified.subject())
                .map(ExternalIdentity::getUserAccount).orElse(null);
        if (linked != null) return linked;
        if (users.existsByEmailIgnoreCase(verified.email())) throw emailCollision();

        UserAccount account = new UserAccount();
        account.setFullName(normalizeName(verified.fullName()));
        account.setEmail(verified.email());
        account.setPhone(null);
        account.setPasswordHash(null);
        account.setDateOfBirth(null);
        account.setBookingContactConfirmationRequired(true);
        account.setRole(Role.CUSTOMER);
        account.setStatus(AccountStatus.ACTIVE);
        account = users.saveAndFlush(account);

        ExternalIdentity identity = new ExternalIdentity();
        identity.setProvider(ExternalIdentity.Provider.GOOGLE);
        identity.setProviderSubject(verified.subject());
        identity.setUserAccount(account);
        identities.saveAndFlush(identity);
        return account;
    }

    private static UserAccount requireEligible(UserAccount account) {
        if (account.getStatus() != AccountStatus.ACTIVE) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "ACCOUNT_INACTIVE", "Tài khoản BeautyLink không còn hoạt động.");
        }
        if (account.getRole() != Role.CUSTOMER) {
            throw new ApiException(HttpStatus.FORBIDDEN, "GOOGLE_CUSTOMER_ONLY",
                    "Đăng nhập Google hiện chỉ dành cho tài khoản khách hàng.");
        }
        return account;
    }

    private static String normalizeName(String name) {
        String normalized = name.trim().replaceAll("\\s+", " ");
        return normalized.length() <= 120 ? normalized : normalized.substring(0, 120).trim();
    }

    private static ApiException emailCollision() {
        return new ApiException(HttpStatus.CONFLICT, "GOOGLE_ACCOUNT_LINK_REQUIRED",
                "Email này đã thuộc một tài khoản BeautyLink. Vui lòng đăng nhập bằng phương thức hiện có; BeautyLink không tự động liên kết tài khoản chỉ dựa trên email.");
    }
}
