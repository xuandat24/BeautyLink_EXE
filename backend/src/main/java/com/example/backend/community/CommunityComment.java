package com.example.backend.community;
import jakarta.persistence.*;
import java.time.Instant;
import com.example.backend.model.*;
@Entity @Table(name="community_comments",uniqueConstraints=@UniqueConstraint(name="uk_community_comment_request",columnNames={"post_id","author_id","request_key"}),indexes={@Index(name="idx_community_thread",columnList="post_id,parent_id,id")})
public class CommunityComment {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 public Long getId() { return id; } public void setId(Long value) { id=value; }
 @Column(name="public_id",nullable=false,unique=true,length=36) private String publicId;
 public String getPublicId() { return publicId; } public void setPublicId(String value) { publicId=value; }
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="post_id",nullable=false) private CommunityPost post;
 public CommunityPost getPost() { return post; } public void setPost(CommunityPost value) { post=value; }
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="author_id",nullable=false) private UserAccount author;
 public UserAccount getAuthor() { return author; } public void setAuthor(UserAccount value) { author=value; }
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="parent_id") private CommunityComment parent;
 public CommunityComment getParent() { return parent; } public void setParent(CommunityComment value) { parent=value; }
 @Column(name="request_key",nullable=false,length=36) private String requestKey;
 public String getRequestKey() { return requestKey; } public void setRequestKey(String value) { requestKey=value; }
 @Column(name="fingerprint",nullable=false,length=64) private String fingerprint;
 public String getFingerprint() { return fingerprint; } public void setFingerprint(String value) { fingerprint=value; }
 @Column(name="content",nullable=false,length=2000) private String content;
 public String getContent() { return content; } public void setContent(String value) { content=value; }
 @Enumerated(EnumType.STRING) @Column(name="visibility",nullable=false,length=24,columnDefinition="varchar(24)") private CommunityTypes.Visibility visibility;
 public CommunityTypes.Visibility getVisibility() { return visibility; } public void setVisibility(CommunityTypes.Visibility value) { visibility=value; }
 @Version @Column(name="revision",nullable=false) private long revision;
 public long getRevision() { return revision; } public void setRevision(long value) { revision=value; }
 @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt = Instant.now();
 public Instant getCreatedAt() { return createdAt; } public void setCreatedAt(Instant value) { createdAt=value; }
 @Column(name="updated_at",nullable=false) private Instant updatedAt = Instant.now();
 public Instant getUpdatedAt() { return updatedAt; } public void setUpdatedAt(Instant value) { updatedAt=value; }
}
