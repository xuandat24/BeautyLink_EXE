package com.example.backend.service;

import com.example.backend.BackendApplication;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.time.*;
import java.math.BigDecimal;
import static org.mockito.Mockito.*;
import static com.example.backend.model.DomainEnums.*;

/** Test-classpath only: H2 + real security/validation; fake outbound providers, no network side effects. */
public class CommunitySmokeServer {
    @TestConfiguration(proxyBeanMethods=false) static class Providers {
        @Bean @Primary CloudinaryImageGateway communityCloudinary() {
            var gateway=mock(CloudinaryImageGateway.class);
            when(gateway.upload(any())).thenAnswer(i->new CloudinaryImageGateway.UploadedImage("beautylink/public/"+java.util.UUID.randomUUID(),"https://res.cloudinary.com/community-smoke/image/upload/v1/beautylink/public/synthetic.webp"));
            return gateway;
        }
        @Bean @Primary PayOSGateway communityPayos() { return mock(PayOSGateway.class); }
    }
    public static void main(String[] args) {
        var context=new SpringApplicationBuilder(BackendApplication.class,Providers.class).profiles("test").run(
            "--spring.config.import=","--server.address="+System.getenv().getOrDefault("SMOKE_BIND_ADDRESS","127.0.0.1"),"--server.port=8080",
            "--spring.datasource.url=jdbc:h2:mem:community-browser;MODE=MySQL;DB_CLOSE_DELAY=-1",
            "--app.community.enabled=true","--app.cloudinary.enabled=true","--app.demo-data.enabled=false","--app.partner-catalog.enabled=false",
            "--app.payos.client-id=","--app.payos.api-key=","--app.payos.checksum-key=","--app.otp.resend.api-key=");
        if(!context.getEnvironment().getProperty("spring.datasource.url","").startsWith("jdbc:h2:mem:community-browser"))throw new IllegalStateException("Isolated H2 only");
        new TransactionTemplate(context.getBean(PlatformTransactionManager.class)).execute(status->{
            var users=context.getBean(UserAccountRepository.class);var encoder=context.getBean(PasswordEncoder.class);
            UserAccount supplier=null,linked=null;
            String[] handles={"customer","other","salon","practitioner","staff","admin"};
            Role[] roles={Role.CUSTOMER,Role.CUSTOMER,Role.SUPPLIER,Role.CUSTOMER,Role.STAFF,Role.ADMIN};
            for(int i=0;i<handles.length;i++) {var u=new UserAccount();u.setFullName("Community "+handles[i]);u.setEmail(handles[i]+"@community.example.com");u.setPhone("090123450"+i);u.setRole(roles[i]);u.setPasswordHash(encoder.encode("Synthetic Community123!"));users.saveAndFlush(u);if(i==2)supplier=u;if(i==3)linked=u;}
            var location=new Location();location.setName("Hà Nội");location.setType(LocationType.PROVINCE_CITY);location.setSlug("community-ha-noi");context.getBean(LocationRepository.class).save(location);
            var salon=new Supplier();salon.setName("Salon Community");salon.setSlug("salon-community");salon.setOwner(supplier);salon.setAddressLine("Hà Nội");salon.setLocation(location);salon.setVerificationStatus(VerificationStatus.VERIFIED);context.getBean(SupplierRepository.class).save(salon);
            var category=new ServiceCategory();category.setName("Chăm sóc tóc");category.setSlug("community-hair");context.getBean(ServiceCategoryRepository.class).save(category);
            var service=new ServiceOffering();service.setSupplier(salon);service.setCategory(category);service.setName("Chăm sóc tóc Community");service.setDescription("Dịch vụ thật trong môi trường test cô lập");service.setPrice(BigDecimal.valueOf(200000));service.setDurationMinutes(60);context.getBean(ServiceOfferingRepository.class).save(service);
            var p=new Practitioner();p.setSupplier(salon);p.setUser(linked);p.setDisplayName("Chuyên viên Community");p.setSpecialty("Chăm sóc tóc");context.getBean(PractitionerRepository.class).save(p);
            for(var day:DayOfWeek.values()){var r=new AvailabilityRule();r.setPractitioner(p);r.setDayOfWeek(day);r.setStartTime(LocalTime.of(8,0));r.setEndTime(LocalTime.of(20,0));context.getBean(AvailabilityRuleRepository.class).save(r);}
            return null;
        });
        System.out.println("COMMUNITY_SMOKE_READY: isolated H2, fake outbound providers; no production access");
    }
}
