package com.example.backend;

import com.example.backend.dto.ApiDtos.UpdatePhoneRequest;
import com.example.backend.exception.ApiException;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.UserAccountRepository;
import com.example.backend.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:phone-concurrency;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.demo-data.enabled=false"
})
@ActiveProfiles("test")
class PhoneUpdateConcurrencyTest {
    @Autowired UserAccountRepository users;
    @Autowired AuthService auth;

    @Test
    void twoAccountsCannotClaimSamePhoneAndLoserRetainsOriginalPhone() throws Exception {
        UserAccount first = account("0392222201"), second = account("0392222202");
        CyclicBarrier barrier = new CyclicBarrier(2);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<Integer> a = executor.submit(() -> updateAfterBarrier(first, "0392222203", barrier));
            Future<Integer> b = executor.submit(() -> updateAfterBarrier(second, "0392222203", barrier));
            assertEquals(java.util.Set.of(200, 409), java.util.Set.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS)));
        }
        long ownerId = users.findByPhone("0392222203").orElseThrow().getId();
        UserAccount loser = ownerId == first.getId() ? second : first;
        assertEquals(loser.getPhone(), users.findById(loser.getId()).orElseThrow().getPhone());
    }

    @Test
    void concurrentChangesOfSameAccountCannotOverwriteAcceptedChange() throws Exception {
        UserAccount original = account("0392222211");
        UserAccount otherSnapshot = users.findById(original.getId()).orElseThrow();
        CyclicBarrier barrier = new CyclicBarrier(2);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<Integer> a = executor.submit(() -> updateAfterBarrier(original, "0392222212", barrier));
            Future<Integer> b = executor.submit(() -> updateAfterBarrier(otherSnapshot, "0392222213", barrier));
            assertEquals(java.util.Set.of(200, 401), java.util.Set.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS)));
        }
        assertTrue(java.util.Set.of("0392222212", "0392222213").contains(users.findById(original.getId()).orElseThrow().getPhone()));
    }

    private int updateAfterBarrier(UserAccount user, String phone, CyclicBarrier barrier) throws Exception {
        barrier.await(10, TimeUnit.SECONDS);
        try {
            auth.updatePhone(user, new UpdatePhoneRequest(phone));
            return 200;
        } catch (ApiException error) {
            if (error.getStatus().value() == 409) assertEquals("PHONE_ALREADY_IN_USE", error.getCode());
            return error.getStatus().value();
        }
    }

    private UserAccount account(String phone) {
        UserAccount user = new UserAccount();
        user.setPhone(phone);
        user.setFullName("Test User");
        user.setPasswordHash("test-password-hash");
        return users.saveAndFlush(user);
    }
}
