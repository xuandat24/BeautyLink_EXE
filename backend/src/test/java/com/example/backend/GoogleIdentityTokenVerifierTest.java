package com.example.backend;

import com.example.backend.exception.ApiException;
import com.example.backend.service.GoogleIdentityTokenVerifier;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class GoogleIdentityTokenVerifierTest {
    @Test void missingConfigurationFailsClosedWithoutParsingCredential() {
        GoogleIdentityTokenVerifier verifier = new GoogleIdentityTokenVerifier("  , ");
        ApiException error = assertThrows(ApiException.class, () -> verifier.verify("not-a-token"));
        assertEquals("GOOGLE_AUTH_NOT_CONFIGURED", error.getCode());
        assertEquals(503, error.getStatus().value());
    }

    @Test void blankAndOversizedCredentialsFailBeforeAnyNetworkLookup() {
        GoogleIdentityTokenVerifier verifier = new GoogleIdentityTokenVerifier("client.apps.googleusercontent.com");
        assertEquals("GOOGLE_TOKEN_INVALID", assertThrows(ApiException.class, () -> verifier.verify(" ")).getCode());
        assertEquals("GOOGLE_TOKEN_INVALID", assertThrows(ApiException.class,
                () -> verifier.verify("x".repeat(20_001))).getCode());
    }
}
