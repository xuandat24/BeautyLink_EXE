package com.example.backend.community;
import jakarta.persistence.*;
import java.time.Instant;
import com.example.backend.model.*;
@Entity @Table(name="community_restrictions")
public class CommunityRestriction {
 @Id private Long id;
 public Long getId() { return id; } public void setId(Long value) { id=value; }
 @Column(name="blocked",nullable=false) private boolean blocked;
 public boolean getBlocked() { return blocked; } public void setBlocked(boolean value) { blocked=value; }
 @Column(name="updated_at",nullable=false) private Instant updatedAt = Instant.now();
 public Instant getUpdatedAt() { return updatedAt; } public void setUpdatedAt(Instant value) { updatedAt=value; }
}
