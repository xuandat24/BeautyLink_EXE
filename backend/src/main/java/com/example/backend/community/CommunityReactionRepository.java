package com.example.backend.community;
import org.springframework.data.jpa.repository.JpaRepository;import java.util.*;
public interface CommunityReactionRepository extends JpaRepository<CommunityReaction,Long> {
 Optional<CommunityReaction> findByPostIdAndAuthorId(Long post,Long author);
 List<CommunityReaction> findByAuthorIdAndPostIdIn(Long author,Collection<Long> posts);
}
