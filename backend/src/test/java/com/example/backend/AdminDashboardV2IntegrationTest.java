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
    @Autowired ReportingPaymentsService reportingPayments;
    @Autowired com.fasterxml.jackson.databind.ObjectMapper json;
    @Autowired org.springframework.security.crypto.password.PasswordEncoder encoder;
    @Autowired MockMvc mvc; @Autowired JwtService jwt;
    @MockitoBean CloudinaryImageGateway images;
    @MockitoBean GoogleTokenVerifier googleTokens;
    @Autowired GoogleAuthService googleAuth;
    final Instant start=Instant.parse("2026-10-01T17:00:00Z");
    final LocalDate day=LocalDate.of(2026,10,2);

    @Test void salonRosterHasRealOwnersAndUnlinkedPractitionerProfilesWithoutChangingLedgersOrCapacity() throws Exception {
        for(int i=0;i<12;i++)salon("Business"+i,false);
        for(int i=0;i<25;i++)salon("HiddenDemo"+i,true);
        for(int i=0;i<24;i++){var p=person(i%2==0?a:b);p.setDisplayName("Nguyễn Hoài An "+i);p.setBio("DEMO BeautyLink");people.saveAndFlush(p);}
        for(int i=0;i<10;i++){var p=person(a);p.setBio("Chuyên viên của "+a.getName());people.saveAndFlush(p);}
        var ownerPerson=person(a);ownerPerson.setUser(a.getOwner());people.saveAndFlush(ownerPerson);
        long accounts=users.count(),bookingsBefore=bookings.count(),paymentsBefore=payments.count(),servicesBefore=services.count(),peopleBefore=people.count();
        var before=insights.insights(day,day,false,Granularity.DAY);em.flush();em.clear();
        var roster=directory.salonRoster();assertEquals(14,roster.owners());assertEquals(26,roster.practitioners());assertEquals(40,roster.rows().size());assertEquals(10,roster.excludedCatalogProfiles());assertEquals(1,roster.sharedOwnerProfiles());
        assertEquals(40,roster.rows().stream().map(r->r.key()).distinct().count());
        assertTrue(roster.rows().stream().filter(r->r.kind().equals("PRACTITIONER")).allMatch(r->r.accountId()==null&&r.email()==null&&r.accountRole()==null));
        assertTrue(roster.rows().stream().filter(r->r.kind().equals("OWNER")).allMatch(r->r.accountRole()==Role.SUPPLIER));
        assertTrue(roster.rows().stream().anyMatch(r->r.accountId()!=null&&r.accountId().equals(a.getOwner().getId())&&r.salonId().equals(a.getId())&&r.alsoPractitioner()));
        assertFalse(roster.rows().stream().anyMatch(r->r.salonId().equals(demo.getId())));
        assertEquals(accounts,users.count());assertEquals(bookingsBefore,bookings.count());assertEquals(paymentsBefore,payments.count());assertEquals(servicesBefore,services.count());assertEquals(peopleBefore,people.count());
        var after=insights.insights(day,day,false,Granularity.DAY);assertEquals(before.totalBookings(),after.totalBookings());assertEquals(before.revenue(),after.revenue());assertEquals(before.activePartners(),after.activePartners());assertEquals(before.users(),after.users());
        mvc.perform(get("/api/v1/admin/salon-directory").header("Authorization","Bearer "+jwt.createToken(users.findById(admin.getId()).orElseThrow()))).andExpect(status().isOk()).andExpect(jsonPath("$.rows.length()").value(40)).andExpect(jsonPath("$.owners").value(14)).andExpect(jsonPath("$.practitioners").value(26));
    }
    @Test void salonRosterIsAdminOnlyAndDoesNotConfuseLoginRolesWithSalonResponsibilities() throws Exception {
        mvc.perform(get("/api/v1/admin/salon-directory")).andExpect(status().isUnauthorized());
        for(var role:List.of(Role.CUSTOMER,Role.SUPPLIER,Role.STAFF))mvc.perform(get("/api/v1/admin/salon-directory").header("Authorization","Bearer "+jwt.createToken(user("Denied"+role,role)))).andExpect(status().isForbidden());
        var colleague=user("Employee",Role.STAFF);var p=person(a);p.setUser(colleague);p.setBio("Chuyên viên của "+a.getName());people.saveAndFlush(p);
        var result=directory.salonRoster().rows().stream().filter(r->p.getId().equals(r.practitionerId())).findFirst().orElseThrow();assertEquals("PRACTITIONER",result.kind());assertEquals(Role.STAFF,result.accountRole());assertEquals(colleague.getId(),result.accountId());assertEquals(a.getId(),result.salonId());
        assertEquals(Role.STAFF,users.findById(colleague.getId()).orElseThrow().getRole());
    }

    @Test void recoveredHistoryIsPrivateReadOnlyAndScopedWithoutChangingTheOperationalLedger() throws Exception {
        long bookingCount=bookings.count(), paymentCount=payments.count();
        var before=insights.insights(day,day,false,Granularity.DAY);
        mvc.perform(get("/api/v1/admin/presentation").header("Authorization","Bearer "+jwt.createToken(admin))).andExpect(status().isNoContent());
        String payload=json.writeValueAsString(Map.of("version",1,"provenance",Map.of("source","synthetic"),"data",Map.of("users",List.of(),"salons",List.of(),"bookings",List.of(
                Map.of("id",9000000000L,"supplierId",a.getId(),"serviceId",sa.getId(),"serviceName",sa.getName(),"customerId",customer.getId(),"createdAt",start.plusSeconds(30).toString(),"status","COMPLETED","totalAmount",15000),
                Map.of("id",9000000001L,"supplierId",b.getId(),"serviceId",sb.getId(),"serviceName",sb.getName(),"customerId",customer.getId(),"createdAt",start.plusSeconds(31).toString(),"status","COMPLETED","totalAmount",25000)))));
        em.createNativeQuery("insert into presentation_recovery(id,payload) values (:id,:payload)")
                .setParameter("id","beautylink-presentation-20261031").setParameter("payload",payload).executeUpdate();
        mvc.perform(get("/api/v1/admin/presentation")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/presentation").header("Authorization","Bearer "+jwt.createToken(customer))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/presentation").header("Authorization","Bearer "+jwt.createToken(admin)))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control","private, no-store"))
                .andExpect(jsonPath("$.bookings.length()").value(2)).andExpect(jsonPath("$.provenance").doesNotExist());
        mvc.perform(get("/api/v1/supplier/presentation-bookings").header("Authorization","Bearer "+jwt.createToken(a.getOwner())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].supplierId").value(a.getId()));
        mvc.perform(get("/api/v1/supplier/presentation-bookings").header("Authorization","Bearer "+jwt.createToken(b.getOwner())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].supplierId").value(b.getId()));
        mvc.perform(post("/api/v1/admin/presentation").header("Authorization","Bearer "+jwt.createToken(admin)))
                .andExpect(status().isMethodNotAllowed());
        assertFalse(bookings.existsById(9000000000L)); assertEquals(bookingCount,bookings.count()); assertEquals(paymentCount,payments.count());
        var after=insights.insights(day,day,false,Granularity.DAY);
        assertEquals(before.revenue(),after.revenue()); assertEquals(42000,after.completedServiceValue().value().intValue());
        assertEquals(7,after.totalBookings().currentValue().intValue());
        assertNull(after.completedBookings().currentValue(),"no fabricated completion times");
    }
    UserAccount customer,admin; Supplier a,b,demo; ServiceOffering sa,sb,sd; Practitioner pa,pb,pd;
    @Test void reportingPartnersMatchStoredDirectoryWithoutEnablingOwnerAccounts() throws Exception {
        b.getOwner().setStatus(AccountStatus.SUSPENDED); users.saveAndFlush(b.getOwner());
        assertNull(insights.insights(day,day,false,Granularity.DAY).reportActivePartners(),"No reporting directory uses operational fallback");
        var root=json.createObjectNode().put("version",1);var data=root.putObject("data");data.putArray("users");data.putArray("bookings");
        var salons=data.putArray("salons");
        for(long id:List.of(a.getId(),a.getId(),b.getId(),demo.getId(),999999L))
            salons.addObject().put("id",id).put("active",true).put("approvalStatus","VERIFIED");
        salons.addObject().put("id",999998L).put("active",false).put("approvalStatus","VERIFIED");
        em.createNativeQuery("insert into presentation_recovery(id,payload) values (:id,:payload)")
                .setParameter("id","beautylink-presentation-20261031").setParameter("payload",json.writeValueAsString(root)).executeUpdate();
        var result=insights.insights(day,day,false,Granularity.DAY);
        assertEquals(2,result.reportActivePartners().currentValue().intValue(),"Two valid report IDs; no duplicate, orphan or demo count");
        assertEquals(1,result.activePartners().currentValue().intValue(),"Operational account status stays separate");
        assertNull(result.reportActivePartners().previousValue());
        assertEquals(AccountStatus.SUSPENDED,users.findById(b.getOwner().getId()).orElseThrow().getStatus());
        assertEquals(2,insights.insights(day.minusDays(7),day.minusDays(7),false,Granularity.DAY).reportActivePartners().currentValue().intValue(),"Snapshot does not change with booking date filters");
        assertEquals(3,insights.insights(day,day,true,Granularity.DAY).reportActivePartners().currentValue().intValue(),"Demo scope is explicit");
        mvc.perform(get("/api/v1/admin/dashboard/insights").param("from",day.toString()).param("to",day.toString()).header("Authorization","Bearer "+jwt.createToken(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.reportActivePartners.currentValue").value(2)).andExpect(jsonPath("$.activePartners.currentValue").value(1));
        salons.forEach(row->((com.fasterxml.jackson.databind.node.ObjectNode)row).put("active",false));
        em.createNativeQuery("delete from presentation_recovery where id=:id").setParameter("id","beautylink-presentation-20261031").executeUpdate();em.clear();
        em.createNativeQuery("insert into presentation_recovery(id,payload) values (:id,:payload)")
                .setParameter("id","beautylink-presentation-20261031").setParameter("payload",json.writeValueAsString(root)).executeUpdate();
        assertEquals(0,insights.insights(day,day,false,Granularity.DAY).reportActivePartners().currentValue().intValue(),"A zero report count must not fall back to operational active accounts");
    }

    @Test void reportPaymentsJoinTheSameBookingAndReconcileWithoutChangingVerifiedLedger() throws Exception {
        long originalBookings=bookings.count(),originalPayments=payments.count();
        var verifiedBefore=dashboard.paymentSummary(day,day,false);
        var original=Map.of("version",1,"data",Map.of("users",List.of(),"salons",List.of(),"bookings",List.of(),"originalCustomers",List.of()));
        em.createNativeQuery("insert into presentation_recovery(id,payload) values (:id,:payload)").setParameter("id","beautylink-presentation-20261031").setParameter("payload",json.writeValueAsString(original)).executeUpdate();
        String batch="beautylink-report-payments-fixture-v1";
        var reportBookings=new ArrayList<Map<String,Object>>();var reportReceipts=new ArrayList<Map<String,Object>>();
        for(int i=0;i<2;i++) {
            var supplier=i==0?a:b;var offering=i==0?sa:sb;var person=i==0?pa:pb;
            var row=new LinkedHashMap<String,Object>();
            row.put("id",9100000000L+i);row.put("batchId",batch);row.put("source","SIMULATED");row.put("bookingCode","REPORT-"+i);
            row.put("customerId",customer.getId());row.put("customerName",customer.getFullName());row.put("supplierId",supplier.getId());row.put("supplierName",supplier.getName());
            row.put("serviceId",offering.getId());row.put("serviceName",offering.getName());row.put("practitionerId",person.getId());row.put("practitionerName",person.getDisplayName());
            row.put("appointmentDate",day.toString());row.put("startTime","14:00:00");row.put("endTime","15:00:00");row.put("createdAt",start.plusSeconds(20+i).toString());row.put("status","COMPLETED");row.put("paymentStatus","PARTIALLY_PAID");row.put("totalAmount",200000);
            reportBookings.add(row);
            reportReceipts.add(Map.of("id",batch+":"+i,"batchId",batch,"source","SIMULATED","bookingId",9100000000L+i,"paymentOption","DEPOSIT_05","amount",10000,"remainingAmount",190000,"paidAt",start.plusSeconds(100+i).toString()));
        }
        var root=Map.of("version",1,"batch",Map.of("id",batch,"version",1),"data",Map.of("bookings",reportBookings,"reportingPayments",reportReceipts));
        em.createNativeQuery("insert into presentation_recovery(id,payload) values (:id,:payload)").setParameter("id",batch).setParameter("payload",json.writeValueAsString(root)).executeUpdate();
        var report=reportingPayments.summary(day,day,null,0,100);
        assertEquals(0,report.total().compareTo(verifiedBefore.verifiedOnlineCollected().add(new BigDecimal("20000"))));
        assertEquals(0,report.deposits().add(report.fullPayments()).compareTo(report.total()));
        assertEquals(0,report.verifiedAmount().compareTo(verifiedBefore.verifiedOnlineCollected()));assertEquals(20000,report.simulatedAmount().intValue());
        assertEquals(verifiedBefore.verifiedPaymentBookings()+2,report.uniqueBookings());assertEquals(report.transactions(),report.rows().totalElements());
        var row=report.rows().content().stream().filter(r->r.source().equals("SIMULATED")).findFirst().orElseThrow();
        assertEquals(day,row.appointmentDate());assertEquals(LocalTime.of(14,0),row.startTime());assertEquals(BookingStatus.COMPLETED,row.bookingStatus());
        var paged=reportingPayments.summary(day,day,null,1,1);assertEquals(report.total(),paged.total());assertEquals(1,paged.rows().content().size());
        assertEquals(0,reportingPayments.summary(day.plusDays(10),day.plusDays(10),null,0,100).simulatedAmount().signum());
        assertEquals(0,reportingPayments.summary(day,day,a.getId(),0,100).total().add(reportingPayments.summary(day,day,b.getId(),0,100).total()).compareTo(report.total()));
        for(var grain:Granularity.values()) {
            var insightsReport=insights.insights(day,day,false,grain);
            assertEquals(0,report.total().compareTo(insightsReport.reportPayments().currentValue()));
            assertEquals(0,report.total().compareTo(insightsReport.trends().stream().map(t->t.reportPaymentAmount()).reduce(BigDecimal.ZERO,BigDecimal::add)));
            assertEquals(0,report.total().compareTo(insightsReport.topSalons().stream().map(t->t.reportPaymentAmount()).reduce(BigDecimal.ZERO,BigDecimal::add)));
            assertEquals(0,verifiedBefore.verifiedOnlineCollected().compareTo(insightsReport.revenue().currentValue()));
            assertEquals(4L,insightsReport.reportOnlinePaymentRate().currentNumerator());
            assertEquals(7L,insightsReport.reportOnlinePaymentRate().currentDenominator());
            assertEquals(2L,insightsReport.onlinePaymentRate().currentNumerator(),"PayOS-only rate stays separate");
            assertEquals(400.0/7,insightsReport.reportOnlinePaymentRate().currentValue().doubleValue(),0.000001);
        }
        mvc.perform(get("/api/v1/admin/report-payments")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/report-payments").header("Authorization","Bearer "+jwt.createToken(customer))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/report-payments").param("from",day.toString()).param("to",day.toString()).header("Authorization","Bearer "+jwt.createToken(admin))).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andExpect(jsonPath("$.simulatedAmount").value(20000));
        mvc.perform(get("/api/v1/supplier/report-payments").param("from",day.toString()).param("to",day.toString()).param("salonId",b.getId().toString()).header("Authorization","Bearer "+jwt.createToken(a.getOwner()))).andExpect(status().isOk()).andExpect(jsonPath("$.simulatedAmount").value(10000));
        assertEquals(verifiedBefore.verifiedOnlineCollected(),dashboard.paymentSummary(day,day,false).verifiedOnlineCollected());
        assertTrue(dashboard.revenue(day,day,false,0,100).content().stream().noneMatch(r->r.bookingCode().startsWith("REPORT-")));
        assertEquals(originalBookings,bookings.count());assertEquals(originalPayments,payments.count());
        String selection="beautylink-report-payments-selection-fixture-v1";
        var selectionPayload=Map.of("version",1,"batch",Map.of("id",selection,"version",1,"kind","REPORT_SELECTION","source","SIMULATED"),"data",Map.of("excludedBookingIds",List.of(9100000000L)));
        em.createNativeQuery("insert into presentation_recovery(id,payload) values (:id,:payload)").setParameter("id",selection).setParameter("payload",json.writeValueAsString(selectionPayload)).executeUpdate();
        var compact=reportingPayments.summary(day,day,null,0,100);
        assertEquals(report.total().subtract(new BigDecimal("10000")),compact.total());
        assertEquals(report.uniqueBookings()-1,compact.uniqueBookings());
        assertEquals(6,insights.insights(day,day,false,Granularity.DAY).totalBookings().currentValue().intValue());
        mvc.perform(get("/api/v1/admin/presentation").header("Authorization","Bearer "+jwt.createToken(admin))).andExpect(status().isOk()).andExpect(jsonPath("$.bookings.length()").value(1)).andExpect(jsonPath("$.reportingPayments.length()").value(1));
        mvc.perform(get("/api/v1/supplier/presentation-bookings").header("Authorization","Bearer "+jwt.createToken(a.getOwner()))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        assertEquals(0,reportingPayments.summary(day,day,a.getId(),0,100).simulatedAmount().signum());
        for(var grain:Granularity.values()) {
            var selectedInsights=insights.insights(day,day,false,grain);
            assertEquals(compact.total(),selectedInsights.reportPayments().currentValue());
            assertEquals(0,compact.total().compareTo(selectedInsights.trends().stream().map(t->t.reportPaymentAmount()).reduce(BigDecimal.ZERO,BigDecimal::add)));
            assertEquals(0,compact.total().compareTo(selectedInsights.topSalons().stream().map(t->t.reportPaymentAmount()).reduce(BigDecimal.ZERO,BigDecimal::add)));
        }
        assertEquals(verifiedBefore.verifiedOnlineCollected(),dashboard.paymentSummary(day,day,false).verifiedOnlineCollected());
        assertEquals(originalBookings,bookings.count());assertEquals(originalPayments,payments.count());
        em.createNativeQuery("insert into presentation_recovery(id,payload) values (:id,:payload)").setParameter("id",selection+".rollback").setParameter("payload","{\"version\":1}").executeUpdate();
        assertEquals(report.total(),reportingPayments.summary(day,day,null,0,100).total(),"Selection rollback restores exact records and receipts without deleting audit");
        em.createNativeQuery("insert into presentation_recovery(id,payload) values (:id,:payload)").setParameter("id",batch+".rollback").setParameter("payload","{\"version\":1}").executeUpdate();
        assertEquals(0,reportingPayments.summary(day,day,null,0,100).simulatedAmount().signum());
        var rolledBackInsights=insights.insights(day,day,false,Granularity.DAY);
        assertEquals(2L,rolledBackInsights.reportOnlinePaymentRate().currentNumerator());
        assertEquals(5L,rolledBackInsights.reportOnlinePaymentRate().currentDenominator());
        assertEquals(2,((Number)em.createNativeQuery("select count(*) from presentation_recovery where id like :prefix").setParameter("prefix",batch+"%").getSingleResult()).intValue(),"Rollback marker retains immutable batch as audit");
    }
    @Test void persistedDisplayPatchOrdersWholeResultAndNeverChangesRawEditorOrOwnerOrMoney() throws Exception {
        customer.setFullName("phan.dinh.khoi91");customer.setEmail("khoi+001@seed.beautylink.test");users.saveAndFlush(customer);
        var owner=a.getOwner();owner.setEmail("catalog.alpha@beautylink.local");owner.setStatus(AccountStatus.DISABLED);users.saveAndFlush(owner);
        for(int i=45;i>0;i--){var u=user("Directory Fixture "+i,Role.CUSTOMER);u.setFullName(i%5==0?"Đặng An":(i%2==0?"Ánh "+i:"An "+i));users.saveAndFlush(u);}
        var source=json.createObjectNode();var rows=source.putArray("users");for(var u:users.findAll())rows.addObject().put("id",u.getId()).put("fullName",u.getFullName()).put("email",u.getEmail()).put("role",u.getRole().name()).put("createdAt",u.getCreatedAt().toString());
        source.putArray("salons").addObject().put("id",a.getId()).put("ownerUserId",owner.getId());
        var plan=PresentationProfilePatch.plan(source);String before=customer.getEmail(),password=customer.getPasswordHash();long bc=bookings.count(),pc=payments.count();
        em.createNativeQuery("insert into presentation_recovery(id,payload) values (:id,:payload)").setParameter("id",PresentationProfilePatch.ID).setParameter("payload",json.writeValueAsString(plan)).executeUpdate();em.clear();
        var first=directory.users(null,Role.CUSTOMER,0,20);var second=directory.users(null,Role.CUSTOMER,1,20);
        var combined=new ArrayList<com.example.backend.dto.AdminV2Dtos.UserRow>();combined.addAll(first.content());combined.addAll(second.content());
        for(int i=1;i<combined.size();i++)assertTrue(VietnameseDirectoryOrder.compare(combined.get(i-1).fullName(),combined.get(i).fullName())<=0);
        assertEquals(40,combined.stream().map(u->u.id()).distinct().count());
        var mapped=directory.users("Phan Dinh",Role.CUSTOMER,0,20).content().getFirst();assertEquals(customer.getId(),mapped.id());assertTrue(mapped.email().matches("[a-z0-9]+@gmail\\.com"));
        assertEquals("Phan Dinh Khoi",dashboard.customerBookings(customer.getId(),false,0,20).content().getFirst().customerName());
        assertEquals("Phan Dinh Khoi",reportingPayments.summary(day,day,null,0,20).rows().content().getFirst().customerName());
        assertEquals(before,details.account(customer.getId()).email());assertEquals(password,users.findById(customer.getId()).orElseThrow().getPasswordHash());
        assertEquals(before,directory.users("khoi+001",Role.CUSTOMER,0,20,true).content().getFirst().email());
        var salon=directory.salonsById(a.getId());assertEquals(owner.getId(),salon.ownerUserId());assertFalse(salon.active());assertTrue(salon.ownerEmail().endsWith("@gmail.com"));
        assertEquals(AccountStatus.DISABLED,users.findById(owner.getId()).orElseThrow().getStatus());assertEquals(bc,bookings.count());assertEquals(pc,payments.count());
        String token=jwt.createToken(admin);mvc.perform(get("/api/v1/admin/presentation/profiles").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.displayProfiles.length()").value(2));
        mvc.perform(get("/api/v1/admin/presentation/profiles").header("Authorization","Bearer "+jwt.createToken(users.findById(customer.getId()).orElseThrow()))).andExpect(status().isForbidden());
        em.createNativeQuery("insert into presentation_recovery(id,payload) values (:id,:payload)").setParameter("id",PresentationProfilePatch.ID+".rollback").setParameter("payload","{\"version\":1}").executeUpdate();em.clear();
        assertEquals(before,directory.users("khoi+001",Role.CUSTOMER,0,20).content().getFirst().email());
    }
    @Test void displayV2PrecedenceRollbackAndRegistrationCohortsKeepRawContactsAndLedger() throws Exception {
        customer.setEmail("eligible@outlook.com");users.saveAndFlush(customer);
        var source=json.createObjectNode();var rows=source.putArray("users");for(var u:users.findAll())rows.addObject().put("id",u.getId()).put("fullName",u.getFullName()).put("email",u.getEmail()).put("role",u.getRole().name()).put("createdAt",operatorDate(u.getCreatedAt()).toString());
        source.putArray("salons");var v1=PresentationProfilePatch.plan(source);source.set("priorProfilePlan",v1);var v2=PresentationProfileRevision.plan(source);((com.fasterxml.jackson.databind.node.ObjectNode)v2.path("profiles").get(0)).put("reportCreatedAt",PresentationProfileRevision.START.toString());
        long before=insights.insights(day,day,false,Granularity.DAY).users().currentValue().longValue(),beforePrevious=insights.insights(day,day,false,Granularity.DAY).users().previousValue().longValue();var money=dashboard.paymentSummary(day,day,false);long bc=bookings.count(),pc=payments.count();
        for(var plan:List.of(v1,v2))em.createNativeQuery("insert into presentation_recovery(id,payload) values (:id,:payload)").setParameter("id",plan.path("id").asText()).setParameter("payload",plan.toString()).executeUpdate();em.clear();
        var profile=v2.path("profiles").get(0);assertEquals(customer.getId().longValue(),profile.path("id").asLong());
        var view=directory.users("Customer",Role.CUSTOMER,0,20).content().getFirst();assertEquals(profile.path("email").asText(),view.email());
        var runtimeProfile=new PresentationDisplayProfiles(json);ReflectionTestUtils.setField(runtimeProfile,"em",em);assertEquals(customer.getCreatedAt().toString(),runtimeProfile.metadata().path("displayProfiles").get(0).path("actualCreatedAt").asText());assertEquals(Instant.parse(profile.path("reportCreatedAt").asText()),view.createdAt());
        assertEquals("eligible@outlook.com",details.account(customer.getId()).email());assertEquals(customer.getCreatedAt(),directory.users("eligible@",Role.CUSTOMER,0,20,true).content().getFirst().createdAt());
        assertEquals(before,insights.insights(day,day,false,Granularity.DAY).users().currentValue().longValue(),"Same cumulative total at current cutoff");assertEquals(beforePrevious+1,insights.insights(day,day,false,Granularity.DAY).users().previousValue().longValue(),"Earlier display date shifts prior cutoff once; real registration unchanged");
        mvc.perform(get("/api/v1/admin/presentation/profiles").header("Authorization","Bearer "+jwt.createToken(admin))).andExpect(status().isOk()).andExpect(jsonPath("$.profileVersion").value(2));
        em.createNativeQuery("insert into presentation_recovery(id,payload) values (:id,:payload)").setParameter("id",PresentationProfileRevision.ID+".rollback").setParameter("payload","{}").executeUpdate();em.clear();
        assertEquals("eligible@outlook.com",directory.users("Customer",Role.CUSTOMER,0,20).content().getFirst().email());assertEquals(before,insights.insights(day,day,false,Granularity.DAY).users().currentValue().longValue());
        var moneyBefore=(com.fasterxml.jackson.databind.node.ObjectNode)json.valueToTree(money);var moneyAfter=(com.fasterxml.jackson.databind.node.ObjectNode)json.valueToTree(dashboard.paymentSummary(day,day,false));moneyBefore.remove("generatedAt");moneyAfter.remove("generatedAt");assertEquals(moneyBefore,moneyAfter);assertEquals(bc,bookings.count());assertEquals(pc,payments.count());assertEquals("eligible@outlook.com",users.findById(customer.getId()).orElseThrow().getEmail());
    }
    @Test void displayRevisionUsesPersistedTimestampPrecisionWithoutWeakeningOriginalChecks() throws Exception {
        var u=new UserAccount();u.setFullName("Đặng Precision");u.setEmail("precision@outlook.com");u.setRole(Role.CUSTOMER);
        ReflectionTestUtils.setField(u,"createdAt",Instant.parse("2026-10-25T00:00:00.123456789Z"));users.saveAndFlush(u);Instant managed=u.getCreatedAt();long id=u.getId();em.clear();u=users.findById(id).orElseThrow();Instant persisted=u.getCreatedAt();assertNotEquals(managed,persisted,"Database stores microsecond precision");
        var source=json.createObjectNode();var original=source.putArray("users").addObject().put("id",id).put("fullName",u.getFullName()).put("email",u.getEmail()).put("role","CUSTOMER").put("createdAt",operatorDate(persisted).toString());var plan=PresentationProfileRevision.plan(source);
        assertTrue(PresentationProfileRevision.matches(plan.path("profiles").get(0),original));var stale=original.deepCopy().put("createdAt",operatorDate(managed).toString());assertFalse(PresentationProfileRevision.matches(plan.path("profiles").get(0),stale));
        em.createNativeQuery("insert into presentation_recovery(id,payload) values (:id,:payload)").setParameter("id",PresentationProfileRevision.ID).setParameter("payload",plan.toString()).executeUpdate();em.clear();
        assertTrue(directory.users("dang precision",Role.CUSTOMER,0,20).content().getFirst().email().endsWith("@gmail.com"));assertEquals("precision@outlook.com",details.account(id).email());
        em.createNativeQuery("update user_accounts set created_at=:changed where id=:id").setParameter("changed",persisted.plusSeconds(25200)).setParameter("id",id).executeUpdate();em.clear();assertEquals("precision@outlook.com",directory.users("dang precision",Role.CUSTOMER,0,20).content().getFirst().email(),"A real registration change must not match either an old UTC or local value");
    }
    private Instant operatorDate(Instant actual) {
        boolean mysql=em.unwrap(org.hibernate.Session.class).doReturningWork(c->c.getMetaData().getDatabaseProductName().equals("MySQL"));
        return mysql?actual.minusSeconds(7*3600):actual;
    }
    @BeforeEach void fixture() {
        ReflectionTestUtils.setField(insights,"clock",Clock.fixed(Instant.parse("2026-11-01T17:00:00Z"),ZoneOffset.UTC));
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
        assertNull(data.completedBookings().currentValue());
        assertEquals(com.example.backend.dto.AdminV2Dtos.ComparisonStatus.INSUFFICIENT_HISTORY,data.completedBookings().comparisonStatus());
        assertEquals(2000,data.completedServiceValue().value().intValue(),"completed service value is independent of verified receipt amount and refund status");
        assertEquals(500,data.revenue().value().intValue(),"gross first verified receipt, no duplicate/manual/demo or next-day receipt");
        assertEquals(500,dashboard.paymentSummary(day,day,false).verifiedOnlineCollected().intValue(),"legacy payment summary and CSV policy remain consistent");
        assertEquals(40,data.onlinePaymentRate().value().intValue(),"late receipt excluded at period cutoff");
        assertEquals(2,data.onlinePaymentRate().currentNumerator()); assertEquals(5,data.onlinePaymentRate().currentDenominator());
        assertEquals(1,data.trends().size());assertEquals(day,data.trends().getFirst().date());
        assertEquals(500,data.trends().getFirst().verifiedOnlineAmount().intValue());
        assertEquals(2000,data.trends().getFirst().completedServiceValue().intValue());
        assertEquals(a.getId(),data.topSalons().getFirst().id());assertEquals(3,data.topSalons().getFirst().bookings());
        assertEquals(200,data.topSalons().getFirst().verifiedOnlineAmount().intValue(),"salon money uses same paidAt period as revenue, excluding later receipts");
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
    @Test void cumulativeUsersAreComparedWithCumulativeUsersNotNewRegistrations() {
        var old = user("Previous account",Role.STAFF);
        em.createNativeQuery("update user_accounts set created_at=:created where id=:id").setParameter("created",start.minusSeconds(3600)).setParameter("id",old.getId()).executeUpdate();
        em.flush(); em.clear();
        var data=insights.insights(day,day,false,Granularity.DAY);
        assertEquals(6,data.users().currentValue().intValue()); assertEquals(1,data.users().previousValue().intValue());
        assertEquals(5,data.users().absoluteChange().intValue());
        assertTrue(data.users().metricDefinition().contains("Tổng tích lũy"));
    }
    @Test void partialCurrentAndPreviousCutoffsExcludeExactlyTheSameElapsedBoundary() {
        var cutoff=start.plusSeconds(12*3600);
        ReflectionTestUtils.setField(insights,"clock",Clock.fixed(cutoff,ZoneOffset.UTC));
        booking(a,sa,pa,BookingStatus.CONFIRMED,PaymentStatus.UNPAID,start.minusSeconds(86400).plusSeconds(1));
        booking(a,sa,pa,BookingStatus.CONFIRMED,PaymentStatus.UNPAID,cutoff.minusSeconds(86400));
        booking(a,sa,pa,BookingStatus.CONFIRMED,PaymentStatus.UNPAID,cutoff);
        em.flush();
        var data=insights.insights(day,day,false,Granularity.DAY);
        assertEquals(cutoff,data.asOf());assertEquals(cutoff,data.currentPeriod().endExclusive());
        assertEquals(cutoff.minusSeconds(86400),data.previousPeriod().endExclusive());
        assertEquals(5,data.totalBookings().currentValue().intValue());assertEquals(1,data.totalBookings().previousValue().intValue());
        assertEquals(com.example.backend.dto.AdminV2Dtos.ComparisonStatus.LOW_BASE,data.totalBookings().comparisonStatus());
    }
    @Test void chartsReconcileForEveryGrainAndSnapshotCompletesAreNotPeriodCompletions() {
        for(var grain:Granularity.values()) {
            var data=insights.insights(day,day.plusDays(1),false,grain);
            assertEquals(0,data.revenue().currentValue().compareTo(data.trends().stream().map(p->p.verifiedOnlineAmount()).reduce(BigDecimal.ZERO,BigDecimal::add)));
            assertEquals(data.totalBookings().currentValue().longValue(),data.trends().stream().mapToLong(p->p.bookings()).sum());
            assertNull(data.completedBookings().currentValue());assertNull(data.returningCustomers().currentValue());
            assertNull(data.activePartners().previousValue());
            assertEquals(0,data.completedServiceValue().currentValue().compareTo(data.trends().stream().map(p->p.completedServiceValue()).reduce(BigDecimal.ZERO,BigDecimal::add)));
        }
    }
    @ParameterizedTest @EnumSource(value=Role.class,names={"CUSTOMER","SUPPLIER","STAFF"})
    void nonAdminsCannotReadAnyNewAdminResource(Role role) throws Exception {
        String token=jwt.createToken(user("Denied"+role,role));
        for(String endpoint:List.of("dashboard/insights","users","salons","salons/"+a.getId(),"reviews"))
            mvc.perform(get("/api/v1/admin/"+endpoint).header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
    }
    @Test void adminCanReadAndInvalidDatesPagesAndAnonymousFailSafely() throws Exception {
        String bearer="Bearer "+jwt.createToken(users.findById(admin.getId()).orElseThrow());
        mvc.perform(get("/api/v1/admin/dashboard/insights").param("from","2026-10-02").param("to","2026-10-02").header("Authorization",bearer)).andExpect(status().isOk())
                .andExpect(jsonPath("totalBookings.value").value(5)).andExpect(jsonPath("totalBookings.currentValue").value(5))
                .andExpect(jsonPath("totalBookings.previousValue").value(0)).andExpect(jsonPath("totalBookings.absoluteChange").value(5))
                .andExpect(jsonPath("totalBookings.comparisonStatus").value("NEW_ACTIVITY"))
                .andExpect(jsonPath("onlinePaymentRate.currentNumerator").value(2)).andExpect(jsonPath("onlinePaymentRate.currentDenominator").value(5))
                .andExpect(jsonPath("onlinePaymentRate.previousDenominator").value(0)).andExpect(jsonPath("onlinePaymentRate.percentagePointChange").isEmpty())
                .andExpect(jsonPath("completedBookings.currentValue").isEmpty()).andExpect(jsonPath("completedBookings.comparisonStatus").value("INSUFFICIENT_HISTORY"))
                .andExpect(jsonPath("currentPeriod.startInclusive").value("2026-10-01T17:00:00Z"))
                .andExpect(jsonPath("previousPeriod.startInclusive").value("2026-09-30T17:00:00Z"))
                .andExpect(jsonPath("timezone").value("Asia/Ho_Chi_Minh")).andExpect(jsonPath("asOf").value("2026-11-01T17:00:00Z"));
        mvc.perform(get("/api/v1/admin/dashboard/insights").param("from","2026-11-03").param("to","2026-11-03").header("Authorization",bearer)).andExpect(status().isBadRequest());
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
