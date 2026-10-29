package com.example.backend.community;
import org.springframework.data.jpa.repository.*;import org.springframework.data.repository.query.Param;import jakarta.persistence.LockModeType;import jakarta.persistence.QueryHint;import java.util.*;
public interface CommunityMediaRepository extends JpaRepository<CommunityMedia,Long> {
 List<CommunityMedia> findByPostIdInOrderByIdAsc(Collection<Long> ids);
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select m from CommunityMedia m where m.publicId in :ids order by m.id") List<CommunityMedia> lock(@Param("ids")Collection<String> ids);
 List<CommunityMedia> findByPostId(Long id);
}
