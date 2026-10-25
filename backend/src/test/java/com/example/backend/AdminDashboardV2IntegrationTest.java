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
    @Autowired MockMvc mvc; @Autowired JwtService jwt;
    @MockitoBean CloudinaryImageGateway images;
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
    UserAccount user(String name,Role role) {var u=new UserAccount();u.setFullName(name);u.setEmail(name.toLowerCase()+"@v2.example.com");u.setRole(role);ReflectionTestUtils.setField(u,"createdAt",start.plusSeconds(1));return users.saveAndFlush(u);}
    Supplier salon(String name,boolean demo) {var s=new Supplier();s.setOwner(user(name,Role.SUPPLIER));s.setName(name);s.setSlug(name.toLowerCase());s.setAddressLine("Test address");s.setVerificationStatus(VerificationStatus.VERIFIED);s.setDemoData(demo);return suppliers.saveAndFlush(s);}
    ServiceOffering service(Supplier s,ServiceCategory c) {var o=new ServiceOffering();o.setSupplier(s);o.setCategory(c);o.setName("Same name");o.setPrice(BigDecimal.valueOf(1000));o.setDurationMinutes(60);return services.saveAndFlush(o);}
    Practitioner person(Supplier s) {var p=new Practitioner();p.setSupplier(s);p.setDisplayName(s.getName()+" person");return people.saveAndFlush(p);}
    Booking booking(Supplier s,ServiceOffering o,Practitioner p,BookingStatus status,PaymentStatus pay,Instant created) {var b=new Booking();b.setBookingCode("V2-"+UUID.randomUUID().toString().substring(0,18));b.setCustomer(customer);b.setSupplier(s);b.setService(o);b.setPractitioner(p);b.setStatus(status);b.setPaymentStatus(pay);b.setAppointmentDate(day);b.setStartTime(LocalTime.NOON);b.setEndTime(LocalTime.of(13,0));b.setTotalAmount(BigDecimal.valueOf(1000));ReflectionTestUtils.setField(b,"createdAt",created);return bookings.saveAndFlush(b);}
    void paid(Booking b,int amount,Instant at,boolean manual) {var p=new PaymentTransaction();p.setBooking(b);p.setOrderCode(100000L+payments.count());p.setAmount(BigDecimal.valueOf(amount));p.setRemainingAmount(BigDecimal.valueOf(1000-amount));p.setPaymentOption(amount==100?PaymentOption.DEPOSIT_05:PaymentOption.FULL_100);p.setStatus(PaymentTransactionStatus.PAID);p.setPaidAt(at);p.setRequiresManualReview(manual);p.setExpiresAt(at.plusSeconds(500));ReflectionTestUtils.setField(p,"createdAt",start.plusSeconds(1));payments.saveAndFlush(p);}
}
