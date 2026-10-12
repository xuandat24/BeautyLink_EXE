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
    boolean existsByEmailIgnoreCase(String email);
    List<UserAccount> findByRole(Role role);
}
