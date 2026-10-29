package com.example.backend.community;
import org.springframework.data.jpa.repository.*;import org.springframework.data.repository.query.Param;import org.springframework.data.domain.Pageable;import jakarta.persistence.LockModeType;import jakarta.persistence.QueryHint;import java.util.*;
public interface CommunityCommentRepository extends JpaRepository<CommunityComment,Long> {
 @Query("select c from CommunityComment c join fetch c.author left join fetch c.parent par where c.post.id=:post and c.id<:before and ((:parent is null and c.parent is null) or par.publicId=:parent) order by c.id desc")
 List<CommunityComment> thread(@Param("post")Long post,@Param("parent")String parent,@Param("before")long before,Pageable page);
 Optional<CommunityComment> findByPublicId(String id);
 Optional<CommunityComment> findByPostIdAndAuthorIdAndRequestKey(Long post,Long author,String key);
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select c from CommunityComment c where c.publicId=:id") Optional<CommunityComment> lock(@Param("id")String id);
}
