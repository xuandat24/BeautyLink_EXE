package com.example.backend.community;
import jakarta.persistence.*;
import java.time.Instant;
import com.example.backend.model.*;
@Entity @Table(name="community_moderation_actions",indexes={@Index(name="idx_community_audit_post",columnList="post_id,id")})
public class CommunityModerationAction {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 public Long getId() { return id; } public void setId(Long value) { id=value; }
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="post_id",nullable=false) private CommunityPost post;
 public CommunityPost getPost() { return post; } public void setPost(CommunityPost value) { post=value; }
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="comment_id") private CommunityComment comment;
 public CommunityComment getComment() { return comment; } public void setComment(CommunityComment value) { comment=value; }
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="moderator_id",nullable=false) private UserAccount moderator;
 public UserAccount getModerator() { return moderator; } public void setModerator(UserAccount value) { moderator=value; }
 @Enumerated(EnumType.STRING) @Column(name="action",nullable=false,length=24,columnDefinition="varchar(24)") private CommunityTypes.Action action;
 public CommunityTypes.Action getAction() { return action; } public void setAction(CommunityTypes.Action value) { action=value; }
 @Column(name="reason",nullable=false,length=500) private String reason;
 public String getReason() { return reason; } public void setReason(String value) { reason=value; }
 @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt = Instant.now();
 public Instant getCreatedAt() { return createdAt; } public void setCreatedAt(Instant value) { createdAt=value; }
}
