package com.example.backend.model;

import jakarta.persistence.*;
import java.time.Instant;
import static com.example.backend.model.DomainEnums.*;

@Entity
@Table(name = "suppliers", indexes = {@Index(name = "idx_supplier_location", columnList = "location_id"), @Index(name = "idx_supplier_status", columnList = "verification_status"), @Index(name = "idx_supplier_demo", columnList = "demo_data")})
public class Supplier {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @OneToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "owner_user_id", nullable = false, unique = true) private UserAccount owner;
    @Column(nullable = false, length = 160) private String name;
    @Column(nullable = false, unique = true, length = 180) private String slug;
    @Column(nullable = false, length = 120, columnDefinition = "varchar(120) default 'Beauty & wellness'") private String businessType = "Beauty & wellness";
    @Column(length = 1500) private String description;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "location_id") private Location location;
    @Column(nullable = false, length = 255) private String addressLine;
    @Column private Double latitude;
    @Column private Double longitude;
    @Lob @Column(columnDefinition = "LONGTEXT") private String imageUrl;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private VerificationStatus verificationStatus = VerificationStatus.PENDING;
    @Column(nullable = false) private double rating = 0;
    @Column(nullable = false) private int reviewCount = 0;
    @Column(nullable = false, columnDefinition = "boolean default false") private boolean demoData = false;
    @Column(nullable = false, columnDefinition = "boolean default false") private boolean nearbyFeatured = false;
    @Column(nullable = false, columnDefinition = "boolean default false") private boolean newPartner = false;
    @Column(nullable = false, updatable = false) private Instant createdAt = Instant.now();
    public Long getId() { return id; } public void setId(Long id) { this.id = id; }
    public UserAccount getOwner() { return owner; } public void setOwner(UserAccount owner) { this.owner = owner; }
    public String getName() { return name; } public void setName(String name) { this.name = name; }
    public String getSlug() { return slug; } public void setSlug(String slug) { this.slug = slug; }
    public String getBusinessType() { return businessType; } public void setBusinessType(String businessType) { this.businessType = businessType; }
    public String getDescription() { return description; } public void setDescription(String description) { this.description = description; }
    public Location getLocation() { return location; } public void setLocation(Location location) { this.location = location; }
    public String getAddressLine() { return addressLine; } public void setAddressLine(String addressLine) { this.addressLine = addressLine; }
    public Double getLatitude() { return latitude; } public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; } public void setLongitude(Double longitude) { this.longitude = longitude; }
    public String getImageUrl() { return imageUrl; } public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public VerificationStatus getVerificationStatus() { return verificationStatus; } public void setVerificationStatus(VerificationStatus verificationStatus) { this.verificationStatus = verificationStatus; }
    public double getRating() { return rating; } public void setRating(double rating) { this.rating = rating; }
    public int getReviewCount() { return reviewCount; } public void setReviewCount(int reviewCount) { this.reviewCount = reviewCount; }
    public boolean isDemoData() { return demoData; } public void setDemoData(boolean demoData) { this.demoData = demoData; }
    public boolean isNearbyFeatured() { return nearbyFeatured; } public void setNearbyFeatured(boolean nearbyFeatured) { this.nearbyFeatured = nearbyFeatured; }
    public boolean isNewPartner() { return newPartner; } public void setNewPartner(boolean newPartner) { this.newPartner = newPartner; }
    public Instant getCreatedAt() { return createdAt; }
}
