package com.example.backend.repository;
import com.example.backend.model.*;import org.springframework.data.jpa.repository.*;import org.springframework.data.repository.query.Param;import jakarta.persistence.LockModeType;import java.util.Optional;
public interface PromotionRepository extends JpaRepository<Promotion,Long> {
 Optional<Promotion> findByCode(String code);
 @Lock(LockModeType.PESSIMISTIC_READ) @Query("select p from Promotion p where p.code=:code") Optional<Promotion> forQuote(@Param("code") String code);
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select p from Promotion p where p.code=:code") Optional<Promotion> forUpdate(@Param("code") String code);
}
