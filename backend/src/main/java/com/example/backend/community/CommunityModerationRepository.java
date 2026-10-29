package com.example.backend.community;
import org.springframework.data.jpa.repository.JpaRepository;import org.springframework.data.domain.Pageable;import java.util.*;
public interface CommunityModerationRepository extends JpaRepository<CommunityModerationAction,Long> {
 @org.springframework.data.jpa.repository.EntityGraph(attributePaths={"moderator","comment"})
 List<CommunityModerationAction> findByPostIdOrderByIdDesc(Long post,Pageable page);
}
