package com.example.backend.community;
import jakarta.persistence.*;
import java.time.Instant;
import com.example.backend.model.*;
@Entity @Table(name="community_reports",uniqueConstraints=@UniqueConstraint(name="uk_community_report",columnNames={"reporter_id","target_key","target_revision"}),indexes={@Index(name="idx_community_report_queue",columnList="resolved,id")})
public class CommunityReport {
 @Column(name="target_revision",nullable=false) private long targetRevision;
 public long getTargetRevision(){return targetRevision;} public void setTargetRevision(long value){targetRevision=value;}
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 public Long getId() { return id; } public void setId(Long value) { id=value; }
 @Column(name="public_id",nullable=false,unique=true,length=36) private String publicId;
 public String getPublicId() { return publicId; } public void setPublicId(String value) { publicId=value; }
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="post_id",nullable=false) private CommunityPost post;
 public CommunityPost getPost() { return post; } public void setPost(CommunityPost value) { post=value; }
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="comment_id") private CommunityComment comment;
 public CommunityComment getComment() { return comment; } public void setComment(CommunityComment value) { comment=value; }
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="reporter_id",nullable=false) private UserAccount reporter;
 public UserAccount getReporter() { return reporter; } public void setReporter(UserAccount value) { reporter=value; }
 @Column(name="target_key",nullable=false,length=36) private String targetKey;
 public String getTargetKey() { return targetKey; } public void setTargetKey(String value) { targetKey=value; }
 @Column(name="reason",nullable=false,length=500) private String reason;
 public String getReason() { return reason; } public void setReason(String value) { reason=value; }
 @Column(name="resolved",nullable=false) private boolean resolved;
 public boolean getResolved() { return resolved; } public void setResolved(boolean value) { resolved=value; }
 @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt = Instant.now();
 public Instant getCreatedAt() { return createdAt; } public void setCreatedAt(Instant value) { createdAt=value; }
}
