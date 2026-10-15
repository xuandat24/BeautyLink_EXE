package com.example.backend.repository;
import com.example.backend.model.UserAccount;
import com.example.backend.model.DomainEnums.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    Optional<UserAccount> findByPhone(String phone);
    Optional<UserAccount> findByEmailIgnoreCase(String email);
    Optional<UserAccount> findByPhoneOrEmailIgnoreCase(String phone, String email);
    boolean existsByPhone(String phone);
    boolean existsByPhoneAndIdNot(String phone, Long id);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select u from UserAccount u where u.id = :id")
    Optional<UserAccount> findLockedById(@org.springframework.data.repository.query.Param("id") Long id);
    boolean existsByEmailIgnoreCase(String email);
    List<UserAccount> findByRole(Role role);
    List<UserAccount> findByRoleOrderByIdAsc(Role role);
    long countByRole(Role role);
}
