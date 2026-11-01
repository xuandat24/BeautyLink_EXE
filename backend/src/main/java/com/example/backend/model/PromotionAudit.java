package com.example.backend.model;
import jakarta.persistence.*;import java.time.Instant;
@Entity @Table(name="promotion_audits")
public class PromotionAudit {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="actor_id",nullable=false) public UserAccount actor;
 @Column(nullable=false,length=40) public String code;
 @Column(nullable=false,length=12) public String action;
 @Lob @Column(columnDefinition="LONGTEXT") public String beforeJson;
 @Lob @Column(nullable=false,columnDefinition="LONGTEXT") public String afterJson;
 @Column(nullable=false) public Instant createdAt;
}
