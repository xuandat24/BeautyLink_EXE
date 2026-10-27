package com.example.backend;

import com.example.backend.auth.JwtService;
import com.example.backend.dto.AdminV2Dtos.Granularity;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import com.example.backend.service.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static com.example.backend.model.DomainEnums.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"app.demo-data.enabled=false","app.partner-catalog.enabled=false",
        "spring.datasource.url=${REVIEW_TEST_JDBC_URL:jdbc:h2:mem:admin-v2;MODE=MySQL;DB_CLOSE_DELAY=-1}",
        "spring.datasource.driver-class-name=${REVIEW_TEST_DRIVER:org.h2.Driver}",
        "spring.datasource.username=${REVIEW_TEST_USERNAME:sa}","spring.datasource.password=${REVIEW_TEST_PASSWORD:}"})
@AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class AdminDashboardV2IntegrationTest {
    @BeforeAll static void isolatedOnly() { var url=System.getenv("REVIEW_TEST_JDBC_URL"); if(url!=null&&!url.equals("jdbc:mysql://127.0.0.1:3306/beautylink_review_test")) throw new IllegalStateException("Isolated MySQL only"); }
    @Autowired UserAccountRepository users; @Autowired SupplierRepository suppliers;
    @Autowired ServiceCategoryRepository categories; @Autowired ServiceOfferingRepository services;
    @Autowired PractitionerRepository people; @Autowired BookingRepository bookings;
    @Autowired PaymentTransactionRepository payments; @Autowired BookingReviewRepository reviews;
    @Autowired EntityManager em; @Autowired AdminInsightsService insights; @Autowired AdminDirectoryService directory;
    @Autowired AdminDashboardService dashboard;
    @Autowired AdminDetailService details;
    @Autowired AdminPartnerEditService partnerEdits;
    @Autowired com.fasterxml.jackson.databind.ObjectMapper json;
    @Autowired org.springframework.security.crypto.password.PasswordEncoder encoder;
    @Autowired MockMvc mvc; @Autowired JwtService jwt;
    @MockitoBean CloudinaryImageGateway images;
    @MockitoBean GoogleTokenVerifier googleTokens;
    @Autowired GoogleAuthService googleAuth;
    final Instant start=Instant.parse("2026-10-01T17:00:00Z");
    final LocalDate day=LocalDate.of(2026,10,2);
    UserAccount customer,admin; Supplier a,b,demo; ServiceOffering sa,sb,sd; Practitioner pa,pb,pd;
    @BeforeEach void fixture() {
        customer=user("Customer",Role.CUSTOMER); admin=user("Admin",Role.ADMIN);
        a=salon("Alpha",false);b=salon("Beta",false);demo=salon("Demo",true);
        var category=new ServiceCategory();category.setName("Care");category.setSlug("v2-care");categories.save(category);
        sa=service(a,category);sb=service(b,category);sd=service(demo,category);
        pa=person(a);pb=person(b);pd=person(demo);
        var rule=new AvailabilityRule();rule.setPractitioner(pa);rule.setDayOfWeek(DayOfWeek.MONDAY);rule.setStartTime(LocalTime.of(9,0));rule.setEndTime(LocalTime.of(18,0));em.persist(rule);
        var first=booking(a,sa,pa,BookingStatus.COMPLETED,PaymentStatus.PARTIALLY_PAID,start.plusSeconds(1));paid(first,100,start.plusSeconds(86410),false);
        var cancelled=booking(a,sa,pa,BookingStatus.CANCELLED,PaymentStatus.PAID,start.plusSeconds(2));paid(cancelled,200,start.plusSeconds(10),false);paid(cancelled,999,start.plusSeconds(11),false);
        var refunded=booking(b,sb,pb,BookingStatus.COMPLETED,PaymentStatus.REFUNDED,start.plusSeconds(3));paid(refunded,300,start.plusSeconds(12),false);
        var pending=booking(a,sa,pa,BookingStatus.PENDING,PaymentStatus.UNPAID,start.plusSeconds(4));paid(pending,900,start.plusSeconds(13),true);
        booking(b,sb,pb,BookingStatus.CONFIRMED,PaymentStatus.UNPAID,start.plusSeconds(5));
        var demoBooking=booking(demo,sd,pd,BookingStatus.COMPLETED,PaymentStatus.PAID,start.plusSeconds(6));paid(demoBooking,700,start.plusSeconds(14),false);
        booking(a,sa,pa,BookingStatus.PENDING,PaymentStatus.UNPAID,start.plusSeconds(86400)); // next-day boundary excluded
        for(var target:ReviewTargetType.values()) { var r=new BookingReview();r.setBooking(first);r.setCustomer(customer);r.setSupplier(a);r.setService(sa);r.setTargetType(target);r.setRating(5);r.setComment("Valid");reviews.save(r); }
        var invalid=new BookingReview();invalid.setBooking(refunded);invalid.setCustomer(customer);invalid.setSupplier(b);invalid.setService(sb);invalid.setTargetType(ReviewTargetType.SERVICE);invalid.setRating(5);reviews.save(invalid);
        em.flush();em.clear();
    }
    @Test void aggregatesUseVietnamCohortCanonicalPaymentsAndStableServiceIds() {
        var data=insights.insights(day,day,false,Granularity.DAY);
        assertEquals(5,data.totalBookings().value().longValue());
        assertEquals(5,data.statuses().stream().mapToLong(s->s.count()).sum());
        assertEquals(2,data.completedBookings().value().longValue());
        assertEquals(500,data.revenue().value().intValue(),"gross first verified receipt, no duplicate/manual/demo or next-day receipt");
        assertEquals(500,dashboard.paymentSummary(day,day,false).verifiedOnlineCollected().intValue(),"legacy payment summary and CSV policy remain consistent");
        assertEquals(60,data.onlinePaymentRate().value().intValue());
        assertEquals(1,data.trends().size());assertEquals(day,data.trends().getFirst().date());
        assertEquals(500,data.trends().getFirst().verifiedOnlineAmount().intValue());
        assertEquals(a.getId(),data.topSalons().getFirst().id());assertEquals(3,data.topSalons().getFirst().bookings());
        assertEquals(300,data.topSalons().getFirst().verifiedOnlineAmount().intValue(),"salon money follows booking cohort, including later paidAt");
        assertEquals(2,data.popularServices().size());assertNotEquals(data.popularServices().get(0).id(),data.popularServices().get(1).id());
        assertEquals(100,data.popularServices().stream().mapToDouble(s->s.percentage()).sum());
        assertNull(data.activePartners().changePercent());assertEquals(2,data.activePartners().value().intValue());
        assertNull(data.totalBookings().changePercent(),"zero previous cohort must be N/A");
        assertEquals(6,insights.insights(day,day,true,Granularity.WEEK).totalBookings().value().intValue());
        assertEquals(1200,insights.insights(day,day,true,Granularity.MONTH).revenue().value().intValue());
    }
    @Test void directoryIsPagedAndSalonContainsItsOwnServicesPractitionersAndSchedules() {
        var one=directory.users(null,null,0,1);var two=directory.users(null,null,1,1);
        assertNotEquals(one.content().getFirst().id(),two.content().getFirst().id());assertEquals(5,one.totalElements());
        assertEquals(1,directory.users(null,Role.ADMIN,0,20).totalElements());
        assertEquals(2,directory.salons(null,false,0,20).totalElements());assertEquals(3,directory.salons(null,true,0,20).totalElements());
        var detail=directory.salon(a.getId(),false);assertEquals(sa.getId(),detail.services().getFirst().id());
        assertEquals(pa.getId(),detail.practitioners().getFirst().id());assertEquals(pa.getId(),detail.schedules().getFirst().practitionerId());
        assertTrue(detail.recentBookings().stream().allMatch(row->row.supplierId().equals(a.getId())));
        assertEquals(2,directory.reviews(false,0,20).totalElements(),"refunded legacy review cannot enter admin valid list");
    }
    @Test void equivalentPreviousPeriodAndTiedSupplierRankingAreDeterministic() {
        var old=booking(a,sa,pa,BookingStatus.COMPLETED,PaymentStatus.PAID,start.minusSeconds(60)); paid(old,50,start.minusSeconds(50),false);
        var data=insights.insights(day,day,false,Granularity.WEEK);
        assertEquals(1,data.totalBookings().previous().intValue());assertEquals(400,data.totalBookings().changePercent());
        assertEquals(50,data.revenue().previous().intValue());assertEquals(900,data.revenue().changePercent());
        booking(b,sb,pb,BookingStatus.PENDING,PaymentStatus.UNPAID,start.plusSeconds(7));em.flush();
        var tie=insights.insights(day,day,false,Granularity.MONTH);
        assertEquals(3,tie.topSalons().get(0).bookings());assertEquals(3,tie.topSalons().get(1).bookings());
        assertEquals(a.getId(),tie.topSalons().getFirst().id());
    }
    @ParameterizedTest @EnumSource(value=Role.class,names={"CUSTOMER","SUPPLIER","STAFF"})
    void nonAdminsCannotReadAnyNewAdminResource(Role role) throws Exception {
        String token=jwt.createToken(user("Denied"+role,role));
        for(String endpoint:List.of("dashboard/insights","users","salons","salons/"+a.getId(),"reviews"))
            mvc.perform(get("/api/v1/admin/"+endpoint).header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
    }
    @Test void adminCanReadAndInvalidDatesPagesAndAnonymousFailSafely() throws Exception {
        String bearer="Bearer "+jwt.createToken(users.findById(admin.getId()).orElseThrow());
        mvc.perform(get("/api/v1/admin/dashboard/insights").param("from","2026-10-02").param("to","2026-10-02").header("Authorization",bearer)).andExpect(status().isOk()).andExpect(jsonPath("totalBookings.value").value(5));
        mvc.perform(get("/api/v1/admin/users").header("Authorization",bearer).param("size","101")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/users").header("Authorization",bearer).param("page","-1")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/dashboard/insights").header("Authorization",bearer).param("from","2026-10-03").param("to","2026-10-02")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/dashboard/insights")).andExpect(status().isUnauthorized());
        var empty=insights.insights(day.minusYears(2),day.minusYears(2),false,Granularity.MONTH);
        assertEquals(0,empty.totalBookings().value().intValue());assertNull(empty.paymentAttemptSuccessRate());assertTrue(empty.topSalons().isEmpty());
    }
    @Test void detailReadModelsStayInsideSalonAndCanonicalAccountingPolicy() throws Exception {
        var header=details.salonHeader(a.getId()); assertTrue(header.services().isEmpty()); assertEquals(a.getId(),header.salon().id());
        assertEquals(sa.getId(),details.services(a.getId(),0,1).content().getFirst().id());
        assertEquals(pa.getId(),details.practitioners(a.getId(),0,1).content().getFirst().id());
        assertEquals(pa.getId(),details.schedule(a.getId(),pa.getId()).getFirst().practitionerId());
        assertThrows(com.example.backend.exception.ApiException.class,()->details.schedule(a.getId(),pb.getId()));
        var rows=details.bookings(a.getId(),day,day,null,0,2); assertEquals(3,rows.totalElements()); assertTrue(rows.content().stream().allMatch(r->r.supplierId().equals(a.getId())));
        assertEquals(0,details.bookings(a.getId(),day,day,BookingStatus.CONFIRMED,0,20).totalElements());
        var money=details.payments(a.getId(),day,day,0,100);
        assertEquals(200,money.verifiedOnlineAmount().intValue(),"no later paidAt, duplicate, manual or other salon receipt");
        assertEquals(4,money.attempts()); assertEquals(1,money.reviewRequiredAttempts());
        assertTrue(money.rows().content().stream().allMatch(r->r.supplierName().equals("Alpha")));
        assertEquals(1,money.rows().content().stream().filter(r->r.canonicalVerified()&&r.paidAt().isBefore(start.plusSeconds(86400))).count());
        assertEquals(500,details.payments(null,day,day,0,100).verifiedOnlineAmount().intValue());
        assertThrows(com.example.backend.exception.ApiException.class,()->details.payments(demo.getId(),day,day,0,20));
        String token=jwt.createToken(admin);
        mvc.perform(get("/api/v1/admin/salons/"+a.getId()).param("headerOnly","true").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.services").isEmpty());
        mvc.perform(get("/api/v1/admin/users/"+customer.getId()).header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.passwordHash").doesNotExist()).andExpect(jsonPath("$.authVersion").doesNotExist());
        mvc.perform(get("/api/v1/admin/payments").param("size","101").header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
    }
    @Test void adminCanChangeOnlyApprovedCustomerFieldsWithVersionAndImmutableAudit() throws Exception {
        String token=jwt.createToken(admin), customerToken=jwt.createToken(customer);
        var before=details.account(customer.getId()); var current=users.findById(customer.getId()).orElseThrow(); int version=current.getAuthVersion();
        String payload="{\"fullName\":\"Nguyen Updated\",\"gender\":\"FEMALE\",\"dateOfBirth\":\"1995-01-01\",\"expectedUpdatedAt\":\""+before.updatedAt()+"\"}";
        mvc.perform(patch("/api/v1/admin/users/"+customer.getId()+"/profile").header("Authorization","Bearer "+token).contentType("application/json").content(payload)).andExpect(status().isOk()).andExpect(jsonPath("$.fullName").value("Nguyen Updated")).andExpect(jsonPath("$.role").value("CUSTOMER"));
        em.flush(); em.clear(); var after=users.findById(customer.getId()).orElseThrow(); assertEquals(version,after.getAuthVersion()); assertEquals(before.email(),after.getEmail()); assertEquals(before.phone(),after.getPhone()); assertEquals(before.status(),after.getStatus());
        var audit=em.createQuery("select r from SupportReport r where r.reason='ADMIN-PROFILE-AUDIT:UPDATE' and r.targetId=:id",SupportReport.class).setParameter("id",customer.getId()).getResultList();
        assertEquals(1,audit.size()); assertTrue(audit.getFirst().getDetails().contains("fullName")); assertFalse(audit.getFirst().getDetails().contains("Nguyen Updated"));
        mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+customerToken)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+jwt.createToken(after))).andExpect(status().isOk());
        mvc.perform(patch("/api/v1/reports/"+audit.getFirst().getId()).header("Authorization","Bearer "+token).contentType("application/json").content("{\"status\":\"OPEN\",\"resolutionNote\":\"tamper\"}")).andExpect(status().isConflict());
        mvc.perform(patch("/api/v1/admin/users/"+customer.getId()+"/profile").header("Authorization","Bearer "+token).contentType("application/json").content(payload)).andExpect(status().isConflict());
    }
    @Test void profileEditRejectsSensitiveFieldsInvalidInputAndOtherRoles() throws Exception {
        String token=jwt.createToken(admin); var before=details.account(customer.getId());
        String valid="{\"fullName\":\"Valid Name\",\"gender\":\"MALE\",\"dateOfBirth\":\"1995-01-01\",\"expectedUpdatedAt\":\""+before.updatedAt()+"\"}";
        for(String field:java.util.List.of("role","status","email","phone","passwordHash","authVersion")) mvc.perform(patch("/api/v1/admin/users/"+customer.getId()+"/profile").header("Authorization","Bearer "+token).contentType("application/json").content(valid.substring(0,valid.length()-1)+",\""+field+"\":\"forbidden\"}")).andExpect(status().isBadRequest());
        mvc.perform(patch("/api/v1/admin/users/"+customer.getId()+"/profile").header("Authorization","Bearer "+token).contentType("application/json").content(valid.replace("Valid Name"," "))).andExpect(status().isBadRequest());
        mvc.perform(patch("/api/v1/admin/users/"+admin.getId()+"/profile").header("Authorization","Bearer "+token).contentType("application/json").content(valid)).andExpect(status().isForbidden());
        for(Role role:java.util.List.of(Role.CUSTOMER,Role.SUPPLIER,Role.STAFF)) {
            String denied=jwt.createToken(user("Denied detail "+role,role));
            for(String path:java.util.List.of("/users/"+customer.getId(),"/salons/"+a.getId()+"/services","/salons/"+a.getId()+"/bookings","/payments?salonId="+a.getId())) mvc.perform(get("/api/v1/admin"+path).header("Authorization","Bearer "+denied)).andExpect(status().isForbidden());
            mvc.perform(patch("/api/v1/admin/users/"+customer.getId()+"/profile").header("Authorization","Bearer "+denied).contentType("application/json").content(valid)).andExpect(status().isForbidden());
        }
        assertEquals(before.fullName(),details.account(customer.getId()).fullName());
        assertNull(details.account(customer.getId()).dateOfBirth()); assertNull(details.account(customer.getId()).gender());
    }
    @Test void contactEditsNormalizeKeepCredentialsInvalidateOldSessionAndRequireUniqueValues() throws Exception {
        customer.setPhone("0391112233"); ExternalIdentity identity=new ExternalIdentity();identity.setProvider(ExternalIdentity.Provider.GOOGLE);identity.setProviderSubject("admin-contact-subject");identity.setUserAccount(customer);em.persist(identity);customer.setPasswordHash(encoder.encode("Synthetic Contact123!"));users.saveAndFlush(customer);var original=details.account(customer.getId());String old=jwt.createToken(customer),token=jwt.createToken(admin);
        var payload=new java.util.LinkedHashMap<String,Object>();payload.put("fullName",original.fullName());payload.put("expectedUpdatedAt",original.updatedAt());payload.put("email"," New.Contact@Example.com ");payload.put("phone","090 887-7665");payload.put("confirmContactChange",true);
        // Whitespace is normalized in the service; the public email validator still rejects malformed addresses.
        payload.put("email","New.Contact@Example.com");
        mvc.perform(patch("/api/v1/admin/users/"+customer.getId()+"/profile").header("Authorization","Bearer "+token).contentType("application/json").content(json.writeValueAsString(payload))).andExpect(status().isOk()).andExpect(jsonPath("email").value("new.contact@example.com")).andExpect(jsonPath("phone").value("0908877665"));
        em.flush();em.clear();var saved=users.findById(customer.getId()).orElseThrow();assertEquals(1,saved.getAuthVersion());assertTrue(saved.isBookingContactConfirmationRequired());assertNull(saved.getBookingContactConfirmedPhone());assertTrue(encoder.matches("Synthetic Contact123!",saved.getPasswordHash()));
        mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+old)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/login").contentType("application/json").content("{\"identifier\":\"new.contact@example.com\",\"password\":\"Synthetic Contact123!\"}")).andExpect(status().isOk()).andExpect(jsonPath("user.id").value(customer.getId()));
        org.mockito.Mockito.when(googleTokens.verify("existing-linked-google")).thenReturn(new GoogleTokenVerifier.VerifiedGoogleIdentity("admin-contact-subject",original.email(),original.fullName()));
        var google=googleAuth.authenticate("existing-linked-google");assertEquals(saved.getId(),google.user().id());assertEquals("new.contact@example.com",google.user().email());
        mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+google.accessToken())).andExpect(status().isOk());
        var audits=em.createQuery("select r from SupportReport r where r.targetId=:id and r.reason='ADMIN-PROFILE-AUDIT:UPDATE'",SupportReport.class).setParameter("id",customer.getId()).getResultList();assertEquals(1,audits.size());assertFalse(audits.getFirst().getDetails().contains("new.contact@"));
    }
    @Test void contactCollisionAndMissingAcknowledgementDoNotChangeProfile() throws Exception {
        String token=jwt.createToken(admin);var before=details.account(customer.getId());
        String payload="{\"fullName\":\"Unchanged Name\",\"email\":\""+admin.getEmail()+"\",\"confirmContactChange\":true,\"expectedUpdatedAt\":\""+before.updatedAt()+"\"}";
        mvc.perform(patch("/api/v1/admin/users/"+customer.getId()+"/profile").header("Authorization","Bearer "+token).contentType("application/json").content(payload)).andExpect(status().isConflict());
        assertEquals(before.email(),details.account(customer.getId()).email());assertEquals(before.fullName(),details.account(customer.getId()).fullName());
        mvc.perform(patch("/api/v1/admin/users/"+customer.getId()+"/profile").header("Authorization","Bearer "+token).contentType("application/json").content(payload.replace(admin.getEmail(),"new@example.com").replace("true","false"))).andExpect(status().isBadRequest());
    }
    @Test void partnerEditsStayScopedVersionedAuditedAndPreserveBusinessStatus() throws Exception {
        var snapshot=partnerEdits.profile(admin,a.getId());var p=snapshot.data();
        var form=new com.example.backend.dto.AdminPartnerEditDtos.Profile("Updated Salon",p.businessType(),"Business description",p.addressLine(),p.imageUrl(),p.locationId(),p.latitude(),p.longitude());
        var request=new com.example.backend.dto.AdminPartnerEditDtos.ProfileWrite(form,snapshot.revision());var changed=partnerEdits.profile(admin,a.getId(),request);assertEquals("Updated Salon",changed.data().name());assertEquals(p.verificationStatus(),changed.data().verificationStatus());assertFalse(a.isNewPartner());assertFalse(a.isDemoData());
        assertThrows(com.example.backend.exception.ApiException.class,()->partnerEdits.profile(admin,a.getId(),request));
        var service=partnerEdits.service(admin,a.getId(),sa.getId());var d=service.data();var serviceRequest=new com.example.backend.dto.AdminPartnerEditDtos.ServiceWrite(new com.example.backend.dto.ApiDtos.UpsertSupplierServiceRequest(d.categoryId(),"Updated Service",d.description(),BigDecimal.valueOf(2000),d.originalPrice(),45,d.imageUrl(),true),service.revision());
        assertEquals(2000,partnerEdits.service(admin,a.getId(),sa.getId(),serviceRequest).data().price().intValue());assertEquals(1000,bookings.findAll().stream().filter(row->row.getSupplier().getId().equals(a.getId())).findFirst().orElseThrow().getTotalAmount().intValue());
        assertThrows(com.example.backend.exception.ApiException.class,()->partnerEdits.service(admin,a.getId(),sb.getId()));
        var person=partnerEdits.person(admin,a.getId(),pa.getId());var pd=person.data();var personRequest=new com.example.backend.dto.AdminPartnerEditDtos.PersonWrite(new com.example.backend.dto.ApiDtos.CreatePractitionerRequest("Updated Practitioner",pd.specialty(),pd.bio(),pd.avatarUrl()),pd.active(),null,person.revision());
        assertEquals("Updated Practitioner",partnerEdits.person(admin,a.getId(),pa.getId(),personRequest).data().displayName());
        var schedule=partnerEdits.schedule(admin,a.getId(),pa.getId());var scheduleRequest=new com.example.backend.dto.AdminPartnerEditDtos.ScheduleWrite(new com.example.backend.dto.ApiDtos.ReplaceScheduleRequest(schedule.data().stream().map(row->new com.example.backend.dto.ApiDtos.ScheduleRuleRequest(row.dayOfWeek(),row.startTime(),row.endTime(),row.breakStart(),row.breakEnd(),row.slotMinutes(),row.active())).toList()),schedule.revision());
        assertEquals(schedule.data().size(),partnerEdits.schedule(admin,a.getId(),pa.getId(),scheduleRequest).data().size());
        String token=jwt.createToken(customer);for(String path:List.of("/edit","/services/"+sa.getId()+"/edit","/practitioners/"+pa.getId()+"/edit","/practitioners/"+pa.getId()+"/schedule/edit")) mvc.perform(get("/api/v1/admin/salons/"+a.getId()+path).header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        assertThrows(com.example.backend.exception.ApiException.class,()->partnerEdits.profile(customer,a.getId()));
        assertEquals(4,em.createQuery("select count(r) from SupportReport r where r.targetId=:id and r.reason like 'ADMIN-PROFILE-AUDIT:PARTNER_%'",Long.class).setParameter("id",a.getId()).getSingleResult());
    }
    @Test void partnerEditorCannotBypassFutureBookingGuardsOrRoleAndFieldRestrictions() throws Exception {
        var future=booking(a,sa,pa,BookingStatus.CONFIRMED,PaymentStatus.PAID,start);
        future.setAppointmentDate(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusWeeks(2).with(java.time.temporal.TemporalAdjusters.next(DayOfWeek.MONDAY)));future.setStartTime(LocalTime.of(14,0));future.setEndTime(LocalTime.of(15,0));em.flush();
        var person=partnerEdits.person(admin,a.getId(),pa.getId());var pd=person.data();
        var request=new com.example.backend.dto.AdminPartnerEditDtos.PersonWrite(new com.example.backend.dto.ApiDtos.CreatePractitionerRequest(pd.displayName(),pd.specialty(),pd.bio(),pd.avatarUrl()),false,null,person.revision());
        var conflict=assertThrows(com.example.backend.exception.ApiException.class,()->partnerEdits.person(admin,a.getId(),pa.getId(),request));assertEquals("FUTURE_BOOKINGS",conflict.getCode());
        var schedule=partnerEdits.schedule(admin,a.getId(),pa.getId());var inactive=new com.example.backend.dto.ApiDtos.ScheduleRuleRequest(DayOfWeek.MONDAY,LocalTime.of(9,0),LocalTime.of(18,0),null,null,30,false);
        var scheduleRequest=new com.example.backend.dto.AdminPartnerEditDtos.ScheduleWrite(new com.example.backend.dto.ApiDtos.ReplaceScheduleRequest(List.of(inactive)),schedule.revision());
        assertEquals("FUTURE_BOOKINGS",assertThrows(com.example.backend.exception.ApiException.class,()->partnerEdits.schedule(admin,a.getId(),pa.getId(),scheduleRequest)).getCode());
        for(Role role:List.of(Role.CUSTOMER,Role.SUPPLIER,Role.STAFF)) {
            String denied=jwt.createToken(user("Denied partner edit "+role,role));
            var deniedPayloads=Map.of("/edit","{\"name\":\"Valid Salon\",\"businessType\":\"SPA\",\"addressLine\":\"Test address\"}","/services/"+sa.getId()+"/edit","{\"categoryId\":1,\"name\":\"Valid Service\",\"price\":1000,\"durationMinutes\":30,\"active\":true}","/practitioners/"+pa.getId()+"/edit","{\"displayName\":\"Valid Person\"}","/practitioners/"+pa.getId()+"/schedule/edit","{\"rules\":[{\"dayOfWeek\":\"MONDAY\",\"startTime\":\"09:00\",\"endTime\":\"18:00\",\"slotMinutes\":30,\"active\":true}]}");
            for(var entry:deniedPayloads.entrySet()) mvc.perform(put("/api/v1/admin/salons/"+a.getId()+entry.getKey()).header("Authorization","Bearer "+denied).contentType("application/json").content("{\"data\":"+entry.getValue()+",\"expectedRevision\":\""+"0".repeat(64)+"\"}")).andExpect(status().isForbidden());
        }
        var profile=partnerEdits.profile(admin,a.getId());String malicious="{\"data\":{\"name\":\"Cannot Approve\",\"businessType\":\"SPA\",\"addressLine\":\"Test address\",\"verificationStatus\":\"VERIFIED\"},\"expectedRevision\":\""+profile.revision()+"\"}";
        mvc.perform(put("/api/v1/admin/salons/"+a.getId()+"/edit").header("Authorization","Bearer "+jwt.createToken(admin)).contentType("application/json").content(malicious)).andExpect(status().isBadRequest());
    }
    UserAccount user(String name,Role role) {var u=new UserAccount();u.setFullName(name);u.setEmail(name.toLowerCase()+"@v2.example.com");u.setRole(role);ReflectionTestUtils.setField(u,"createdAt",start.plusSeconds(1));return users.saveAndFlush(u);}
    Supplier salon(String name,boolean demo) {var s=new Supplier();s.setOwner(user(name,Role.SUPPLIER));s.setName(name);s.setSlug(name.toLowerCase());s.setAddressLine("Test address");s.setVerificationStatus(VerificationStatus.VERIFIED);s.setDemoData(demo);return suppliers.saveAndFlush(s);}
    ServiceOffering service(Supplier s,ServiceCategory c) {var o=new ServiceOffering();o.setSupplier(s);o.setCategory(c);o.setName("Same name");o.setPrice(BigDecimal.valueOf(1000));o.setDurationMinutes(60);return services.saveAndFlush(o);}
    Practitioner person(Supplier s) {var p=new Practitioner();p.setSupplier(s);p.setDisplayName(s.getName()+" person");return people.saveAndFlush(p);}
    Booking booking(Supplier s,ServiceOffering o,Practitioner p,BookingStatus status,PaymentStatus pay,Instant created) {var b=new Booking();b.setBookingCode("V2-"+UUID.randomUUID().toString().substring(0,18));b.setCustomer(customer);b.setSupplier(s);b.setService(o);b.setPractitioner(p);b.setStatus(status);b.setPaymentStatus(pay);b.setAppointmentDate(day);b.setStartTime(LocalTime.NOON);b.setEndTime(LocalTime.of(13,0));b.setTotalAmount(BigDecimal.valueOf(1000));ReflectionTestUtils.setField(b,"createdAt",created);return bookings.saveAndFlush(b);}
    void paid(Booking b,int amount,Instant at,boolean manual) {var p=new PaymentTransaction();p.setBooking(b);p.setOrderCode(100000L+payments.count());p.setAmount(BigDecimal.valueOf(amount));p.setRemainingAmount(BigDecimal.valueOf(1000-amount));p.setPaymentOption(amount==100?PaymentOption.DEPOSIT_05:PaymentOption.FULL_100);p.setStatus(PaymentTransactionStatus.PAID);p.setPaidAt(at);p.setRequiresManualReview(manual);p.setExpiresAt(at.plusSeconds(500));ReflectionTestUtils.setField(p,"createdAt",start.plusSeconds(1));payments.saveAndFlush(p);}
}
