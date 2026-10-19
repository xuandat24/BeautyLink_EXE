package com.example.customerseed;

import com.example.backend.model.DomainEnums.AccountStatus;
import com.example.backend.model.DomainEnums.Role;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.UserAccountRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Operates only on the reserved current/legacy dataset; all writes are one transaction. */
public final class CustomerSeedService {
    private final UserAccountRepository users;
    private final PasswordEncoder encoder;
    private final TransactionTemplate transaction;

    public record Result(int existing, int inserted, int active, int validHashes, int conflicts) {}

    public CustomerSeedService(UserAccountRepository users, PasswordEncoder encoder,
                               PlatformTransactionManager manager) {
        this.users = users;
        this.encoder = encoder;
        this.transaction = new TransactionTemplate(manager);
    }

    public Result dryRun(List<CustomerSeedManifest.Profile> profiles) {
        TransactionTemplate readOnly = new TransactionTemplate(transaction.getTransactionManager());
        readOnly.setReadOnly(true);
        return readOnly.execute(status -> inspect(profiles, null, false));
    }

    public Result apply(List<CustomerSeedManifest.Profile> profiles,
                        List<CustomerSeedManifest.Credential> credentials) {
        if (credentials.size() != CustomerSeedManifest.SIZE) throw new IllegalArgumentException("Missing credentials");
        return transaction.execute(status -> {
            Result plan = inspect(profiles, null, false);
            if (plan.conflicts() != 0) throw new IllegalStateException("Seed conflicts found; no records were inserted");
            Result result = inspect(profiles, credentials, true);
            if (result.conflicts() != 0) {
                throw new IllegalStateException("Existing seed credentials do not match; transaction rolled back");
            }
            users.flush();
            return result;
        });
    }

    public Result verify(List<CustomerSeedManifest.Profile> profiles,
                         List<CustomerSeedManifest.Credential> credentials) {
        TransactionTemplate readOnly = new TransactionTemplate(transaction.getTransactionManager());
        readOnly.setReadOnly(true);
        return readOnly.execute(status -> inspect(profiles, credentials, false));
    }

    private Result inspect(List<CustomerSeedManifest.Profile> profiles,
                           List<CustomerSeedManifest.Credential> credentials, boolean insert) {
        if (profiles.size() != CustomerSeedManifest.SIZE) throw new IllegalArgumentException("Expected 80 profiles");
        Map<Integer, CustomerSeedManifest.Credential> secrets = new HashMap<>();
        if (credentials != null) {
            for (CustomerSeedManifest.Credential credential : credentials) {
                secrets.put(credential.index(), credential);
            }
            if (secrets.size() != CustomerSeedManifest.SIZE) throw new IllegalArgumentException("Expected 80 distinct credentials");
        }
        Set<String> expectedEmails = new HashSet<>();
        for (CustomerSeedManifest.Profile profile : profiles) expectedEmails.add(profile.email());
        for (int i = 1; i <= 60; i++) expectedEmails.add(CustomerSeedManifest.legacyEmail(i));
        int conflicts = 0;
        List<UserAccount> reservedAccounts = new java.util.ArrayList<>(
                users.findByEmailStartingWithIgnoreCase(CustomerSeedManifest.EMAIL_PREFIX));
        reservedAccounts.addAll(users.findByEmailEndingWithIgnoreCase(CustomerSeedManifest.EMAIL_DOMAIN));
        for (UserAccount reserved : reservedAccounts) {
            if (!expectedEmails.contains(reserved.getEmail().toLowerCase())) conflicts++;
        }
        int existing = 0;
        int inserted = 0;
        int active = 0;
        int validHashes = 0;
        for (CustomerSeedManifest.Profile profile : profiles) {
            UserAccount byEmail = users.findByEmailIgnoreCase(profile.email()).orElse(null);
            UserAccount legacy = profile.index() <= 60 ? users.findByEmailIgnoreCase(
                    CustomerSeedManifest.legacyEmail(profile.index())).orElse(null) : null;
            if (byEmail != null && legacy != null && !byEmail.getId().equals(legacy.getId())) { conflicts++; continue; }
            if (byEmail == null) byEmail = legacy;
            boolean oldIdentity = byEmail != null && byEmail.getEmail().equals(CustomerSeedManifest.legacyEmail(profile.index()));
            UserAccount byPhone = users.findByPhone(oldIdentity
                    ? CustomerSeedManifest.legacyPhone(profile.index()) : profile.phone()).orElse(null);
            if (byEmail != null) {
                if (byPhone == null || !byPhone.getId().equals(byEmail.getId())
                        || !matchesProfile(byEmail, profile)) {
                    conflicts++;
                    continue;
                }
                existing++;
                active++;
                if (isBcrypt(byEmail.getPasswordHash())) {
                    if (credentials == null || encoder.matches(secrets.get(profile.index()).password(),
                            byEmail.getPasswordHash())) validHashes++;
                    else conflicts++;
                } else conflicts++;
                continue;
            }
            if (byPhone != null) {
                conflicts++;
                continue;
            }
            if (insert) {
                CustomerSeedManifest.Credential credential = secrets.get(profile.index());
                if (credential == null) throw new IllegalArgumentException("Missing credential for manifest row " + profile.index());
                UserAccount account = new UserAccount();
                account.setFullName(profile.fullName());
                account.setPhone(profile.phone());
                account.setEmail(profile.email());
                account.setGender(profile.gender());
                account.setDateOfBirth(profile.dateOfBirth());
                account.setPasswordHash(encoder.encode(credential.password()));
                account.setRole(Role.CUSTOMER);
                account.setStatus(AccountStatus.ACTIVE);
                users.save(account);
                inserted++;
                active++;
                validHashes++;
            }
        }
        return new Result(existing, inserted, active, validHashes, conflicts);
    }

    private boolean matchesProfile(UserAccount account, CustomerSeedManifest.Profile profile) {
        boolean current = account.getEmail().equals(profile.email()) && account.getPhone().equals(profile.phone());
        boolean legacy = profile.index() <= 60 && account.getEmail().equals(CustomerSeedManifest.legacyEmail(profile.index()))
                && account.getPhone().equals(CustomerSeedManifest.legacyPhone(profile.index()));
        return (current || legacy)
                && account.getFullName().equals(profile.fullName())
                && account.getGender() == profile.gender()
                && profile.dateOfBirth().equals(account.getDateOfBirth())
                && account.getRole() == Role.CUSTOMER
                && account.getStatus() == AccountStatus.ACTIVE;
    }

    private boolean isBcrypt(String value) {
        return value != null && value.matches("^\\$2[aby]\\$[0-3][0-9]\\$[./A-Za-z0-9]{53}$");
    }
}
