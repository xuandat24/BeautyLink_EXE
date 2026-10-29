package com.example.backend.community;
import jakarta.validation.constraints.*;import java.time.Instant;import java.math.BigDecimal;import java.util.*;
import static com.example.backend.community.CommunityTypes.*;
public final class CommunityDtos {
 private CommunityDtos(){}
 public record PostWrite(@NotBlank @Size(max=36)String requestKey,@NotBlank @Size(max=5000)String content,@NotNull Category category,@NotNull Identity identity,Long salonId,Long practitionerId,Long serviceId,@NotNull @Size(max=3)List<@NotBlank @Size(max=36)String> media,Long revision){}
 public record CommentWrite(@NotBlank @Size(max=36)String requestKey,@NotBlank @Size(max=2000)String content,@Size(max=36)String parent,Long revision){}
 public record LikeWrite(boolean liked){}
 public record MediaWrite(@NotBlank @Size(max=1100000)String image){}
 public record ReportWrite(@Size(max=36)String comment,@NotBlank @Size(max=500)String reason){}
 public record ModerationWrite(@NotNull Action action,@Size(max=36)String comment,@NotBlank @Size(max=500)String reason,Long revision){}
 public record Author(String name,String avatar,Identity identity,String salonName,String salonSlug,String specialty,boolean verifiedSalon){}
 public record ServiceCard(Long id,String name,String salonName,String image,BigDecimal price,int durationMinutes,double rating,long reviewCount){}
 public record Media(String id,String url){}
 public record PostEdit(Post post,PostWrite fields){}
 public record Post(String id,Author author,String content,Category category,Visibility visibility,List<Media> media,ServiceCard service,long likeCount,long commentCount,boolean liked,boolean owned,long revision,Instant createdAt,Instant updatedAt,String canonicalUrl){}
 public record Comment(String id,String parent,Author author,String content,Visibility visibility,boolean owned,long revision,Instant createdAt){}
 public record CursorPage<T>(List<T> items,String nextCursor){}
 public record IdentityOption(Identity identity,Long salonId,Long practitionerId,String label){}
 public record Report(String id,String post,String comment,String reason,boolean resolved,Instant createdAt){}
 public record Audit(String action,String comment,String moderator,String reason,Instant createdAt){}
}
