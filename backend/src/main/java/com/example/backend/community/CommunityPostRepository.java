package com.example.backend.community;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;import jakarta.persistence.QueryHint;
import java.util.*;
public interface CommunityPostRepository extends JpaRepository<CommunityPost,Long> {
 String GRAPH="select p from CommunityPost p join fetch p.author left join fetch p.salon s left join fetch s.owner left join fetch p.practitioner pr left join fetch pr.user left join fetch pr.supplier ps left join fetch ps.owner left join fetch p.service sv left join fetch sv.supplier ss left join fetch ss.owner left join fetch sv.category ";
 @Query(GRAPH+"where p.visibility=:visibility and p.id<:before and (:category is null or p.category=:category) and (:q='' or lower(p.content) like :q escape '!') order by p.id desc")
 @QueryHints(@QueryHint(name="jakarta.persistence.query.timeout",value="3000"))
 List<CommunityPost> feed(@Param("visibility") CommunityTypes.Visibility visibility,@Param("before") long before,@Param("category") CommunityTypes.Category category,@Param("q") String q,Pageable page);
 @Query(GRAPH+"where p.publicId=:id") Optional<CommunityPost> detail(@Param("id")String id);
 Optional<CommunityPost> findByPublicId(String publicId);
 Optional<CommunityPost> findByAuthorIdAndRequestKey(Long authorId,String requestKey);
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select p from CommunityPost p where p.publicId=:id") Optional<CommunityPost> lock(@Param("id")String id);
}
