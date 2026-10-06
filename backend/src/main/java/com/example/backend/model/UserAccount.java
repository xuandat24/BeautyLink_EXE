package com.example.backend.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import static com.example.backend.model.DomainEnums.*;

@Entity
@Table(name = "user_accounts", indexes = {
        @Index(name = "idx_user_phone", columnList = "phone", unique = true),
        @Index(name = "idx_user_email", columnList = "email", unique = true)
})
public class UserAccount {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, length = 120) private String fullName;
    @Column(nullable = false, length = 20, unique = true) private String phone;
    @Column(length = 160, unique = true) private String email;
    @Enumerated(EnumType.STRING) @Column(length = 20) private Gender gender;
    @Column(name = "date_of_birth") private LocalDate dateOfBirth;
    @Column(name = "password_hash", nullable = false) private String passwordHash;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Role role = Role.CUSTOMER;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private AccountStatus status = AccountStatus.ACTIVE;
    @Column(nullable = false) private int loyaltyPoints = 0;
    @Column(nullable = false, updatable = false) private Instant createdAt = Instant.now();
    @Column(nullable = false) private Instant updatedAt = Instant.now();
    @PreUpdate void touch() { updatedAt = Instant.now(); }
    public Long getId() { return id; } public void setId(Long id) { this.id = id; }
    public String getFullName() { return fullName; } public void setFullName(String fullName) { this.fullName = fullName; }
    public String getPhone() { return phone; } public void setPhone(String phone) { this.phone = phone; }
    public String getEmail() { return email; } public void setEmail(String email) { this.email = email; }
    public Gender getGender() { return gender; } public void setGender(Gender gender) { this.gender = gender; }
    public LocalDate getDateOfBirth() { return dateOfBirth; } public void setDateOfBirth(LocalDate dateOfBirth) { this.dateOfBirth = dateOfBirth; }
    public String getPasswordHash() { return passwordHash; } public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public Role getRole() { return role; } public void setRole(Role role) { this.role = role; }
    public AccountStatus getStatus() { return status; } public void setStatus(AccountStatus status) { this.status = status; }
    public int getLoyaltyPoints() { return loyaltyPoints; } public void setLoyaltyPoints(int loyaltyPoints) { this.loyaltyPoints = loyaltyPoints; }
    public Instant getCreatedAt() { return createdAt; } public Instant getUpdatedAt() { return updatedAt; }
}
