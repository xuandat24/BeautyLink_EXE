package com.example.backend.community;
import jakarta.persistence.*;
import java.time.Instant;
import com.example.backend.model.*;
@Entity @Table(name="community_post_media",indexes={@Index(name="idx_community_media_post",columnList="post_id,id")})
public class CommunityMedia {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 public Long getId() { return id; } public void setId(Long value) { id=value; }
 @Column(name="public_id",nullable=false,unique=true,length=36) private String publicId;
 public String getPublicId() { return publicId; } public void setPublicId(String value) { publicId=value; }
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="owner_id",nullable=false) private UserAccount owner;
 public UserAccount getOwner() { return owner; } public void setOwner(UserAccount value) { owner=value; }
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="post_id") private CommunityPost post;
 public CommunityPost getPost() { return post; } public void setPost(CommunityPost value) { post=value; }
 @Column(name="url",nullable=false,length=700) private String url;
 public String getUrl() { return url; } public void setUrl(String value) { url=value; }
 @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt = Instant.now();
 public Instant getCreatedAt() { return createdAt; } public void setCreatedAt(Instant value) { createdAt=value; }
}
