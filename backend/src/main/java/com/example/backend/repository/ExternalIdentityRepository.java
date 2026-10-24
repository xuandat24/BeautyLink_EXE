package com.example.backend.repository;

import com.example.backend.model.ExternalIdentity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ExternalIdentityRepository extends JpaRepository<ExternalIdentity, Long> {
    @EntityGraph(attributePaths = "userAccount")
    Optional<ExternalIdentity> findByProviderAndProviderSubject(ExternalIdentity.Provider provider, String providerSubject);
}
