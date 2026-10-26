package com.example.backend;

import com.example.backend.auth.JwtService;
import com.example.backend.model.*;
import com.example.backend.model.DomainEnums.*;
import com.example.backend.repository.UserAccountRepository;
import com.example.backend.service.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;

@SpringBootTest(properties={"app.demo-data.enabled=false","app.partner-catalog.enabled=false",
        "spring.datasource.url=${REVIEW_TEST_JDBC_URL:jdbc:h2:mem:admin-profile-concurrency;MODE=MySQL;DB_CLOSE_DELAY=-1}",
        "spring.datasource.driver-class-name=${REVIEW_TEST_DRIVER:org.h2.Driver}","spring.datasource.username=${REVIEW_TEST_USERNAME:sa}","spring.datasource.password=${REVIEW_TEST_PASSWORD:}"})
@AutoConfigureMockMvc @ActiveProfiles("test")
class AdminProfileConcurrencyTest {
    @BeforeAll static void isolatedOnly() { var url=System.getenv("REVIEW_TEST_JDBC_URL"); if(url!=null&&!url.equals("jdbc:mysql://127.0.0.1:3306/beautylink_review_test")) throw new IllegalStateException("Isolated database only"); }
    @Autowired UserAccountRepository users; @Autowired AdminDetailService details; @Autowired JwtService jwt;
    @Autowired MockMvc mvc; @Autowired EntityManager em; @Autowired PlatformTransactionManager manager;
    @MockitoBean CloudinaryImageGateway images;
    @Test void competingAdminUpdatesCommitOneProfileAndOneDurableImmutableAudit() throws Exception {
        UserAccount actor=new UserAccount();actor.setFullName("Scoped Admin");actor.setRole(Role.ADMIN);actor=users.saveAndFlush(actor);
        UserAccount target=new UserAccount();target.setFullName("Original Customer");target.setPasswordHash("unchanged-test-hash");target=users.saveAndFlush(target);
        final Long actorId=actor.getId(),id=target.getId(); String token=jwt.createToken(actor); var original=details.account(id);
        String template="{\"fullName\":\"%s\",\"gender\":\"FEMALE\",\"dateOfBirth\":\"1995-01-01\",\"expectedUpdatedAt\":\""+original.updatedAt()+"\"}";
        try {
            CyclicBarrier barrier=new CyclicBarrier(2);
            try(ExecutorService executor=Executors.newFixedThreadPool(2)) {
                List<Future<Integer>> results=new ArrayList<>();
                for(String name:List.of("Accepted First","Accepted Second")) results.add(executor.submit(()->{ barrier.await(10,TimeUnit.SECONDS);return mvc.perform(patch("/api/v1/admin/users/"+id+"/profile").header("Authorization","Bearer "+token).contentType("application/json").content(template.formatted(name))).andReturn().getResponse().getStatus(); }));
                assertEquals(Set.of(200,409),Set.of(results.get(0).get(20,TimeUnit.SECONDS),results.get(1).get(20,TimeUnit.SECONDS)));
            }
            var saved=users.findById(id).orElseThrow();assertTrue(Set.of("Accepted First","Accepted Second").contains(saved.getFullName()));
            assertEquals("unchanged-test-hash",saved.getPasswordHash());assertEquals(Role.CUSTOMER,saved.getRole());assertEquals(AccountStatus.ACTIVE,saved.getStatus());assertEquals(0,saved.getAuthVersion());
            new TransactionTemplate(manager).execute(status->{
                var audits=em.createQuery("select r from SupportReport r where r.reason='ADMIN-PROFILE-AUDIT:UPDATE' and r.targetId=:id",SupportReport.class).setParameter("id",id).getResultList();
                assertEquals(1,audits.size()); assertEquals(actorId,audits.getFirst().getReporter().getId()); assertEquals(ReportStatus.RESOLVED,audits.getFirst().getStatus()); assertNotNull(audits.getFirst().getResolvedAt());
                assertFalse(audits.getFirst().getDetails().contains(saved.getFullName()));return null;
            });
        } finally {
            new TransactionTemplate(manager).execute(status->{
                em.createQuery("delete from SupportReport r where r.reason='ADMIN-PROFILE-AUDIT:UPDATE' and r.targetId=:id").setParameter("id",id).executeUpdate();
                em.createQuery("delete from AuthenticationSession s where s.accountId in :ids").setParameter("ids",List.of(id,actorId)).executeUpdate();
                em.createQuery("delete from UserAccount u where u.id in :ids").setParameter("ids",List.of(id,actorId)).executeUpdate();return null;
            });
        }
    }
}
