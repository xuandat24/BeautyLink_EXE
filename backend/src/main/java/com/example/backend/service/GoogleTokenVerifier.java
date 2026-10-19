package com.example.backend.service;

public interface GoogleTokenVerifier {
    VerifiedGoogleIdentity verify(String credential);

    record VerifiedGoogleIdentity(String subject, String email, String fullName) {}
}
