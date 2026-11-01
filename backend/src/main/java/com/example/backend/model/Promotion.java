package com.example.backend.model;
import jakarta.persistence.*;import java.math.BigDecimal;import java.time.Instant;
@Entity @Table(name="promotions",uniqueConstraints=@UniqueConstraint(name="uk_promotion_code",columnNames="code"))
public class Promotion {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 @Column(nullable=false,length=40) public String code;
 @Column(nullable=false,length=120) public String name;
 @Column(nullable=false,length=10) public String discountType;
 @Column(name="discount_value",nullable=false,precision=19,scale=2) public BigDecimal discountValue;
 @Column(nullable=false,precision=19,scale=0) public BigDecimal minimumOrder;
 @Column(precision=19,scale=0) public BigDecimal maximumDiscount;
 public Instant startsAt;public Instant endsAt;
 @Column(nullable=false,length=12) public String status;
 @Version @Column(nullable=false) public long version;
 @Column(nullable=false) public Instant updatedAt;
}
