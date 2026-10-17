package com.example.backend.model;

import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "practitioners", indexes = @Index(name = "idx_practitioner_supplier", columnList = "supplier_id"))
public class Practitioner {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "supplier_id", nullable = false) private Supplier supplier;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id") private UserAccount user;
    @Column(nullable = false, length = 120) private String displayName;
    @Column(length = 500) private String bio;
    @Column(length = 160) private String specialty;
    @Lob @Column(columnDefinition = "LONGTEXT") private String avatarUrl;
    @Column(nullable = false) private boolean active = true;
    // Legacy practitioners remain eligible for all their supplier's services until explicitly configured.
    @Column(nullable = false) private boolean serviceAssignmentsRestricted = false;
    @ManyToMany
    @JoinTable(name = "practitioner_service_assignments",
            joinColumns = @JoinColumn(name = "practitioner_id"), inverseJoinColumns = @JoinColumn(name = "service_id"))
    private Set<ServiceOffering> supportedServices = new HashSet<>();
    public Long getId() { return id; } public void setId(Long id) { this.id = id; }
    public Supplier getSupplier() { return supplier; } public void setSupplier(Supplier supplier) { this.supplier = supplier; }
    public UserAccount getUser() { return user; } public void setUser(UserAccount user) { this.user = user; }
    public String getDisplayName() { return displayName; } public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getBio() { return bio; } public void setBio(String bio) { this.bio = bio; }
    public String getSpecialty() { return specialty; } public void setSpecialty(String specialty) { this.specialty = specialty; }
    public String getAvatarUrl() { return avatarUrl; } public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    public boolean isActive() { return active; } public void setActive(boolean active) { this.active = active; }
    public boolean isServiceAssignmentsRestricted() { return serviceAssignmentsRestricted; }
    public void setServiceAssignmentsRestricted(boolean restricted) { this.serviceAssignmentsRestricted = restricted; }
    public Set<ServiceOffering> getSupportedServices() { return supportedServices; }
    public boolean supports(ServiceOffering service) {
        return !serviceAssignmentsRestricted || supportedServices.stream().anyMatch(s -> s.getId().equals(service.getId()));
    }
}
