package com.example.backend.community;
import org.springframework.data.jpa.repository.*;import org.springframework.data.repository.query.Param;import org.springframework.data.domain.Pageable;import java.util.*;
public interface CommunityReportRepository extends JpaRepository<CommunityReport,Long> {
 Optional<CommunityReport> findByReporterIdAndTargetKeyAndTargetRevision(Long author,String key,long revision);
 @Query("select r from CommunityReport r join fetch r.post left join fetch r.comment where r.resolved=:resolved and r.id<:before order by r.id desc") List<CommunityReport> queue(@Param("resolved")boolean resolved,@Param("before")long before,Pageable page);
 @Modifying @Query("update CommunityReport r set r.resolved=true where r.targetKey=:key and r.resolved=false") void resolve(@Param("key")String key);
 Optional<CommunityReport> findByPublicId(String id);
}
