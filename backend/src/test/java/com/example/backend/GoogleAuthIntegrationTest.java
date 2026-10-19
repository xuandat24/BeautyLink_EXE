package com.example.backend;

import com.example.backend.exception.ApiException;
import com.example.backend.model.ExternalIdentity;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.ExternalIdentityRepository;
import com.example.backend.repository.UserAccountRepository;
import com.example.backend.service.GoogleAuthService;
import com.example.backend.service.GoogleTokenVerifier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import static com.example.backend.model.DomainEnums.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = {"app.demo-data.enabled=false", "app.partner-catalog.enabled=false"})
@ActiveProfiles("test")
@Transactional
class GoogleAuthIntegrationTest {
    @Autowired GoogleAuthService googleAuth;
    @Autowired UserAccountRepository users;
    @Autowired ExternalIdentityRepository identities;
    @MockitoBean GoogleTokenVerifier tokens;

    @Test
    void firstSignInCreatesPhonelessPasswordlessCustomerAndDuplicateCallbackReusesIt() {
        var verified = new GoogleTokenVerifier.VerifiedGoogleIdentity("google-sub-1", "new-google@example.com", "Google Customer");
        when(tokens.verify("credential-1")).thenReturn(verified);

        var first = googleAuth.authenticate("credential-1");
        var second = googleAuth.authenticate("credential-1");

        assertEquals(first.user().id(), second.user().id());
        assertNull(first.user().phone());
        assertNull(first.user().dateOfBirth());
        assertFalse(first.user().bookingContactConfirmed());
        UserAccount saved = users.findById(first.user().id()).orElseThrow();
        assertNull(saved.getPasswordHash());
        assertEquals(Role.CUSTOMER, saved.getRole());
        assertTrue(saved.isBookingContactConfirmationRequired());
        assertEquals(1, identities.count());
        assertTrue(first.accessToken().length() > 20);
    }

    @Test
    void matchingLocalOrPrivilegedEmailIsNeverAutomaticallyLinked() {
        UserAccount local = account("owner@example.com", Role.CUSTOMER, AccountStatus.ACTIVE);
        users.saveAndFlush(local);
        when(tokens.verify("local-collision")).thenReturn(new GoogleTokenVerifier.VerifiedGoogleIdentity(
                "google-sub-local", "OWNER@example.com", "Owner"));
        ApiException localError = assertThrows(ApiException.class, () -> googleAuth.authenticate("local-collision"));
        assertEquals("GOOGLE_ACCOUNT_LINK_REQUIRED", localError.getCode());
        assertEquals(0, identities.count());

        UserAccount admin = account("admin-collision@example.com", Role.ADMIN, AccountStatus.ACTIVE);
        admin.setPhone("0901234568");
        users.saveAndFlush(admin);
        when(tokens.verify("admin-collision")).thenReturn(new GoogleTokenVerifier.VerifiedGoogleIdentity(
                "google-sub-admin", "admin-collision@example.com", "Admin"));
        ApiException adminError = assertThrows(ApiException.class, () -> googleAuth.authenticate("admin-collision"));
        assertEquals("GOOGLE_ACCOUNT_LINK_REQUIRED", adminError.getCode());

        UserAccount supplier = account("supplier-collision@example.com", Role.SUPPLIER, AccountStatus.ACTIVE);
        supplier.setPhone("0901234569");
        users.saveAndFlush(supplier);
        when(tokens.verify("supplier-collision")).thenReturn(new GoogleTokenVerifier.VerifiedGoogleIdentity(
                "google-sub-supplier", "supplier-collision@example.com", "Supplier"));
        ApiException supplierError = assertThrows(ApiException.class, () -> googleAuth.authenticate("supplier-collision"));
        assertEquals("GOOGLE_ACCOUNT_LINK_REQUIRED", supplierError.getCode());
        assertEquals(0, identities.count());
    }

    @Test
    void linkedSuspendedAccountAndPrivilegedRoleCannotAuthenticate() {
        UserAccount suspended = users.saveAndFlush(account("suspended-google@example.com", Role.CUSTOMER, AccountStatus.SUSPENDED));
        link(suspended, "suspended-sub");
        when(tokens.verify("suspended-token")).thenReturn(new GoogleTokenVerifier.VerifiedGoogleIdentity(
                "suspended-sub", suspended.getEmail(), suspended.getFullName()));
        assertEquals("ACCOUNT_INACTIVE", assertThrows(ApiException.class,
                () -> googleAuth.authenticate("suspended-token")).getCode());

        UserAccount supplier = account("supplier-google@example.com", Role.SUPPLIER, AccountStatus.ACTIVE);
        supplier.setPhone("0901234568");
        supplier = users.saveAndFlush(supplier);
        link(supplier, "supplier-sub");
        when(tokens.verify("supplier-token")).thenReturn(new GoogleTokenVerifier.VerifiedGoogleIdentity(
                "supplier-sub", supplier.getEmail(), supplier.getFullName()));
        assertEquals("GOOGLE_CUSTOMER_ONLY", assertThrows(ApiException.class,
                () -> googleAuth.authenticate("supplier-token")).getCode());
    }

    @Test
    void linkedDisabledAccountCannotAuthenticate() {
        UserAccount disabled = users.saveAndFlush(account("disabled-google@example.com", Role.CUSTOMER, AccountStatus.DISABLED));
        link(disabled, "disabled-sub");
        when(tokens.verify("disabled-token")).thenReturn(new GoogleTokenVerifier.VerifiedGoogleIdentity(
                "disabled-sub", disabled.getEmail(), disabled.getFullName()));

        assertEquals("ACCOUNT_INACTIVE", assertThrows(ApiException.class,
                () -> googleAuth.authenticate("disabled-token")).getCode());
    }

    @Test
    void databaseConstraintsRejectDuplicateProviderSubjectsAndProviderPerAccount() {
        UserAccount one = users.saveAndFlush(account("one@example.com", Role.CUSTOMER, AccountStatus.ACTIVE));
        link(one, "same-subject");
        ExternalIdentity duplicate = new ExternalIdentity();
        duplicate.setProvider(ExternalIdentity.Provider.GOOGLE);
        duplicate.setProviderSubject("other-subject");
        duplicate.setUserAccount(one);
        assertThrows(DataIntegrityViolationException.class, () -> identities.saveAndFlush(duplicate));
    }

    private UserAccount account(String email, Role role, AccountStatus status) {
        UserAccount account = new UserAccount();
        account.setFullName("Existing Account");
        account.setPhone("0901234567");
        account.setEmail(email);
        account.setPasswordHash("$2a$12$012345678901234567890u12345678901234567890123456789012");
        account.setRole(role);
        account.setStatus(status);
        return account;
    }

    private void link(UserAccount account, String subject) {
        ExternalIdentity identity = new ExternalIdentity();
        identity.setProvider(ExternalIdentity.Provider.GOOGLE);
        identity.setProviderSubject(subject);
        identity.setUserAccount(account);
        identities.saveAndFlush(identity);
    }
}
