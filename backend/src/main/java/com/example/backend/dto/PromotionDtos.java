package com.example.backend.dto;
import jakarta.validation.constraints.*;import java.math.BigDecimal;import java.time.Instant;
public final class PromotionDtos {
 private PromotionDtos(){}
 public record Write(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{3,40}") String code,@NotBlank @Size(max=120) String name,
  @NotNull @Pattern(regexp="FIXED|PERCENT") String discountType,@NotNull @DecimalMin("0.01") @DecimalMax("1000000000") @Digits(integer=10,fraction=2) BigDecimal value,
  @NotNull @DecimalMin("0") @DecimalMax("1000000000000") @Digits(integer=13,fraction=0) BigDecimal minimumOrder,
  @DecimalMin("1") @DecimalMax("1000000000") @Digits(integer=10,fraction=0) BigDecimal maximumDiscount,
  Instant startsAt,Instant endsAt,@NotNull @Pattern(regexp="DRAFT|ENABLED|PAUSED") String status,@NotNull Long expectedRevision) {}
 public record View(String code,String name,String discountType,BigDecimal value,BigDecimal minimumOrder,BigDecimal maximumDiscount,Instant startsAt,Instant endsAt,String status,String state,long revision) {}
}
