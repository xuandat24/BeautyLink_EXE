package com.example.backend.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Check;
import java.time.Instant;
import static com.example.backend.model.DomainEnums.*;

@Entity
@Check(constraints = "rating between 0 and 5")
@Table(name = "booking_reviews", uniqueConstraints = {
        @UniqueConstraint(name = "uk_booking_review_target", columnNames = {"booking_id", "target_type"})
}, indexes = {
        @Index(name = "idx_review_service", columnList = "service_id,target_type"),
        @Index(name = "idx_review_supplier", columnList = "supplier_id,target_type"),
        @Index(name = "idx_review_customer", columnList = "customer_id")
})
public class BookingReview {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "booking_id", nullable = false) private Booking booking;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "customer_id", nullable = false) private UserAccount customer;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "supplier_id", nullable = false) private Supplier supplier;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "service_id", nullable = false) private ServiceOffering service;
    @Enumerated(EnumType.STRING) @Column(name = "target_type", nullable = false, length = 20) private ReviewTargetType targetType;
    @Column(nullable = false) private int rating;
    @Column(length = 1500) private String comment;
    @Column(nullable = false, updatable = false) private Instant createdAt = Instant.now();
    @Column(nullable = false) private Instant updatedAt = Instant.now();

    @PreUpdate void touch() { updatedAt = Instant.now(); }
    public Long getId() { return id; } public void setId(Long id) { this.id = id; }
    public Booking getBooking() { return booking; } public void setBooking(Booking booking) { this.booking = booking; }
    public UserAccount getCustomer() { return customer; } public void setCustomer(UserAccount customer) { this.customer = customer; }
    public Supplier getSupplier() { return supplier; } public void setSupplier(Supplier supplier) { this.supplier = supplier; }
    public ServiceOffering getService() { return service; } public void setService(ServiceOffering service) { this.service = service; }
    public ReviewTargetType getTargetType() { return targetType; } public void setTargetType(ReviewTargetType targetType) { this.targetType = targetType; }
    public int getRating() { return rating; } public void setRating(int rating) { this.rating = rating; }
    public String getComment() { return comment; } public void setComment(String comment) { this.comment = comment; }
    public Instant getCreatedAt() { return createdAt; } public Instant getUpdatedAt() { return updatedAt; }
}
