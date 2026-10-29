package com.example.backend.community;
import jakarta.persistence.*;
import java.time.Instant;
import com.example.backend.model.*;
@Entity @Table(name="community_reactions",uniqueConstraints=@UniqueConstraint(name="uk_community_reaction",columnNames={"post_id","author_id"}))
public class CommunityReaction {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 public Long getId() { return id; } public void setId(Long value) { id=value; }
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="post_id",nullable=false) private CommunityPost post;
 public CommunityPost getPost() { return post; } public void setPost(CommunityPost value) { post=value; }
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="author_id",nullable=false) private UserAccount author;
 public UserAccount getAuthor() { return author; } public void setAuthor(UserAccount value) { author=value; }
 @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt = Instant.now();
 public Instant getCreatedAt() { return createdAt; } public void setCreatedAt(Instant value) { createdAt=value; }
}
