package com.example.backend.community;
import jakarta.persistence.*;
import java.time.Instant;
import com.example.backend.model.*;
@Entity @Table(name="community_posts",uniqueConstraints=@UniqueConstraint(name="uk_community_post_request",columnNames={"author_id","request_key"}),indexes={@Index(name="idx_community_feed",columnList="visibility,id"),@Index(name="idx_community_topic",columnList="visibility,category,id"),@Index(name="idx_community_author",columnList="author_id,id")})
public class CommunityPost {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 public Long getId() { return id; } public void setId(Long value) { id=value; }
 @Column(name="public_id",nullable=false,unique=true,length=36) private String publicId;
 public String getPublicId() { return publicId; } public void setPublicId(String value) { publicId=value; }
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="author_id",nullable=false) private UserAccount author;
 public UserAccount getAuthor() { return author; } public void setAuthor(UserAccount value) { author=value; }
 @Column(name="request_key",nullable=false,length=36) private String requestKey;
 public String getRequestKey() { return requestKey; } public void setRequestKey(String value) { requestKey=value; }
 @Column(name="fingerprint",nullable=false,length=64) private String fingerprint;
 public String getFingerprint() { return fingerprint; } public void setFingerprint(String value) { fingerprint=value; }
 @Column(name="content",nullable=false,length=5000) private String content;
 public String getContent() { return content; } public void setContent(String value) { content=value; }
 @Enumerated(EnumType.STRING) @Column(name="category",nullable=false,length=24,columnDefinition="varchar(24)") private CommunityTypes.Category category;
 public CommunityTypes.Category getCategory() { return category; } public void setCategory(CommunityTypes.Category value) { category=value; }
 @Enumerated(EnumType.STRING) @Column(name="visibility",nullable=false,length=24,columnDefinition="varchar(24)") private CommunityTypes.Visibility visibility;
 public CommunityTypes.Visibility getVisibility() { return visibility; } public void setVisibility(CommunityTypes.Visibility value) { visibility=value; }
 @Enumerated(EnumType.STRING) @Column(name="identity",nullable=false,length=24,columnDefinition="varchar(24)") private CommunityTypes.Identity identity;
 public CommunityTypes.Identity getIdentity() { return identity; } public void setIdentity(CommunityTypes.Identity value) { identity=value; }
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="salon_id") private Supplier salon;
 public Supplier getSalon() { return salon; } public void setSalon(Supplier value) { salon=value; }
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="practitioner_id") private Practitioner practitioner;
 public Practitioner getPractitioner() { return practitioner; } public void setPractitioner(Practitioner value) { practitioner=value; }
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="service_id") private ServiceOffering service;
 public ServiceOffering getService() { return service; } public void setService(ServiceOffering value) { service=value; }
 @Column(name="like_count",nullable=false) private long likeCount;
 public long getLikeCount() { return likeCount; } public void setLikeCount(long value) { likeCount=value; }
 @Column(name="comment_count",nullable=false) private long commentCount;
 public long getCommentCount() { return commentCount; } public void setCommentCount(long value) { commentCount=value; }
 @Version @Column(name="revision",nullable=false) private long revision;
 public long getRevision() { return revision; } public void setRevision(long value) { revision=value; }
 @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt = Instant.now();
 public Instant getCreatedAt() { return createdAt; } public void setCreatedAt(Instant value) { createdAt=value; }
 @Column(name="updated_at",nullable=false) private Instant updatedAt = Instant.now();
 public Instant getUpdatedAt() { return updatedAt; } public void setUpdatedAt(Instant value) { updatedAt=value; }
}
