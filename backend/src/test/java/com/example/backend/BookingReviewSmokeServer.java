package com.example.backend;

import com.example.backend.model.*;
import com.example.backend.repository.*;
import com.example.backend.service.PayOSGateway;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import vn.payos.model.v2.paymentRequests.*;
import static org.mockito.Mockito.*;
import static com.example.backend.model.DomainEnums.*;

/** Local browser fixture, on the test classpath only. Never included in the production jar. */
public class BookingReviewSmokeServer {
    private static final java.util.Map<Long, PaymentLink> links = new java.util.concurrent.ConcurrentHashMap<>();
    private static final java.util.Set<Long> failFirstStatus = java.util.concurrent.ConcurrentHashMap.newKeySet();
    @TestConfiguration(proxyBeanMethods = false)
    static class LocalGateway {
        @Bean @Primary PayOSGateway smokeGateway() {
            var gateway = mock(PayOSGateway.class); // no SDK or outbound requests in this test server
            when(gateway.create(any())).thenAnswer(i -> {
                if (System.getenv("SMOKE_PERF_MODE") != null) java.util.concurrent.locks.LockSupport.parkNanos(350_000_000L);
                CreatePaymentLinkRequest request = i.getArgument(0);
                var link = new PaymentLink(); link.setId("smoke-" + request.getOrderCode()); link.setOrderCode(request.getOrderCode());
                link.setAmount(request.getAmount()); link.setAmountPaid(0L); link.setStatus(PaymentLinkStatus.PENDING); links.put(request.getOrderCode(), link);
                var result = new CreatePaymentLinkResponse(); result.setQrCode(TestPayOSQr.payload(request.getAmount())); result.setBin("970422");
                result.setAccountNumber("TEST-ACCOUNT"); result.setDescription("TEST ONLY"); // accountName deliberately absent
                result.setOrderCode(request.getOrderCode()); result.setAmount(request.getAmount());
                result.setPaymentLinkId(link.getId()); result.setStatus(link.getStatus()); result.setCheckoutUrl("https://pay.payos.vn/web/" + link.getId()); if (System.getenv("SMOKE_PERF_MODE") == null) failFirstStatus.add(link.getOrderCode()); return result;
            });
            when(gateway.get(any())).thenAnswer(i -> {
                if (System.getenv("SMOKE_PERF_MODE") != null) java.util.concurrent.locks.LockSupport.parkNanos(250_000_000L);
                Long order=i.getArgument(0);
                if(failFirstStatus.remove(order))throw new com.example.backend.exception.ApiException(org.springframework.http.HttpStatus.BAD_GATEWAY,"PAYOS_RECONCILIATION_FAILED","Synthetic provider timeout");
                return links.get(order);
            });
            when(gateway.verify(any())).thenAnswer(i -> ((vn.payos.model.webhooks.Webhook)i.getArgument(0)).getData()); // test gateway only, never production signature verification
            when(gateway.cancel(any(), any())).thenAnswer(i -> { var link = links.get(i.getArgument(0)); if (link != null) link.setStatus(PaymentLinkStatus.CANCELLED); return link; });
            return gateway;
        }
    }
    // Future history fixtures must stay inside the seeded workforce's working week.
    static LocalDate futureFixtureDate(LocalDate today) {
        return today.plusDays(2).with(java.time.temporal.TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
    }
    public static void main(String[] args) {
        var context = new SpringApplicationBuilder(BackendApplication.class, LocalGateway.class).profiles("test").run(
                "--spring.config.import=", "--server.address="+System.getenv().getOrDefault("SMOKE_BIND_ADDRESS","127.0.0.1"), "--server.port="+System.getenv().getOrDefault("SMOKE_PORT","8080"),
                "--spring.datasource.url=jdbc:h2:mem:review-browser;MODE=MySQL;DB_CLOSE_DELAY=-1",
                "--app.payos.client-id=", "--app.payos.api-key=", "--app.payos.checksum-key=",
                "--app.otp.resend.api-key=", "--app.payos.reconciliation-initial-delay-ms=3600000");
        String url = context.getEnvironment().getProperty("spring.datasource.url", "");
        if (!url.startsWith("jdbc:h2:mem:review-browser")) throw new IllegalStateException("Unsafe smoke-test datasource");
        var bookings = context.getBean(BookingRepository.class);
        var services = context.getBean(ServiceOfferingRepository.class);
        var people = context.getBean(PractitionerRepository.class);
        var users = context.getBean(UserAccountRepository.class);
        var payments = context.getBean(PaymentTransactionRepository.class);
        new TransactionTemplate(context.getBean(PlatformTransactionManager.class)).execute(status -> {
            // Dedicated mobile login fixture: preserve password whitespace through real BCrypt/JWT auth.
            var mobile = new UserAccount(); mobile.setFullName("Mobile Browser Test");
            mobile.setPhone("0901234567"); mobile.setEmail("mobile-browser@example.com");
            mobile.setPasswordHash(context.getBean(org.springframework.security.crypto.password.PasswordEncoder.class)
                    .encode("Synthetic Mobile 123! "));
            users.saveAndFlush(mobile);
            var adminBrowser = new UserAccount(); adminBrowser.setFullName("Admin Browser Test");
            adminBrowser.setPhone("0901234599"); adminBrowser.setEmail("admin-browser@example.com"); adminBrowser.setRole(Role.ADMIN);
            adminBrowser.setPasswordHash(context.getBean(org.springframework.security.crypto.password.PasswordEncoder.class).encode("Synthetic Admin123!"));
            users.saveAndFlush(adminBrowser);
            var offering = services.findAll().stream().filter(s -> !people.findBySupplierIdAndActiveTrue(s.getSupplier().getId()).isEmpty()).findFirst().orElseThrow();
            // Exercise normal Admin reporting after removing demo inclusion controls.
            // Other demo suppliers remain marked demo; this in-memory fixture is not production data.
            offering.getSupplier().setDemoData(false);
            String[] codes = {"SMOKE-UNPAID", "SMOKE-FUTURE-DEPOSIT", "SMOKE-FUTURE-FULL", "SMOKE-PAST-DEPOSIT", "SMOKE-PAST-FULL", "SMOKE-CANCELLED", "SMOKE-REFUNDED"};
            for (int i = 0; i < codes.length; i++) {
                Booking b = new Booking(); b.setBookingCode(codes[i]); b.setCustomer(users.findByPhone("0900000001").orElseThrow());
                b.setService(offering); b.setSupplier(offering.getSupplier()); b.setPractitioner(people.findBySupplierIdAndActiveTrue(offering.getSupplier().getId()).get(0));
                var today=LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
                b.setAppointmentDate(i == 1 || i == 2 ? futureFixtureDate(today) : today.minusDays(2));
                b.setStartTime(LocalTime.of(10, 0)); b.setEndTime(LocalTime.of(11, 0)); b.setTotalAmount(offering.getPrice());
                b.setStatus(i == 0 ? BookingStatus.PENDING : i == 5 ? BookingStatus.CANCELLED : i == 6 ? BookingStatus.COMPLETED : BookingStatus.CONFIRMED);
                b.setPaymentStatus(i == 0 ? PaymentStatus.UNPAID : i == 6 ? PaymentStatus.REFUNDED : i == 1 || i == 3 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.PAID);
                if (i == 5) org.springframework.test.util.ReflectionTestUtils.setField(b, "createdAt", Instant.now().minusSeconds(10 * 86400));
                bookings.save(b);
            }
            {
                var local = ZonedDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
                var start = local.minusMinutes(35); var end = local.plusMinutes(25);
                Booking b = new Booking(); b.setBookingCode("SMOKE-MIDPOINT"); b.setCustomer(users.findByPhone("0900000001").orElseThrow());
                b.setService(offering); b.setSupplier(offering.getSupplier()); b.setPractitioner(people.findBySupplierIdAndActiveTrue(offering.getSupplier().getId()).getFirst());
                b.setAppointmentDate(start.toLocalDate()); b.setStartTime(start.toLocalTime()); b.setEndTime(end.toLocalTime());
                b.setTotalAmount(offering.getPrice()); b.setStatus(BookingStatus.CONFIRMED); b.setPaymentStatus(PaymentStatus.PARTIALLY_PAID); bookings.save(b);
            }
            for (int i = 0; i < 6; i++) {
                Booking b = new Booking(); b.setBookingCode(new String[]{"SMOKE-PENDING-LINK", "SMOKE-MANUAL", "SMOKE-RESUME", "SMOKE-RETRY", "SMOKE-UNCERTAIN-PAID", "SMOKE-HISTORY-PAID"}[i]);
                b.setCustomer(users.findByPhone("0900000001").orElseThrow()); b.setService(offering); b.setSupplier(offering.getSupplier());
                b.setPractitioner(people.findBySupplierIdAndActiveTrue(offering.getSupplier().getId()).get(0));
                b.setAppointmentDate(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(7).with(java.time.temporal.TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY)));
                if (i == 4 || i == 5) b.setAppointmentDate(b.getAppointmentDate().plusDays(i == 4 ? 1 : 2));
                b.setStartTime(LocalTime.of(i == 2 ? 9 : i == 3 ? 17 : 15, 0)); b.setEndTime(b.getStartTime().plusMinutes(offering.getDurationMinutes())); b.setTotalAmount(offering.getPrice());
                b.setStatus(i == 1 ? BookingStatus.COMPLETED : i == 3 ? BookingStatus.CANCELLED : BookingStatus.PENDING);
                b.setPaymentRetryAllowed(i == 3); b.setPaymentStatus(i == 1 ? PaymentStatus.PAID : PaymentStatus.UNPAID); bookings.saveAndFlush(b);
                PaymentTransaction p = new PaymentTransaction(); p.setBooking(b); p.setOrderCode(9100000L + i); p.setPaymentLinkId("smoke-" + p.getOrderCode());
                p.setAmount(offering.getPrice()); p.setRemainingAmount(java.math.BigDecimal.ZERO); p.setPaymentOption(PaymentOption.FULL_100);
                p.setExpiresAt(Instant.now().plusSeconds(i == 3 ? -60 : 900)); p.setCheckoutUrl("https://pay.payos.vn/web/" + p.getPaymentLinkId());
                p.setStatus(i == 1 ? PaymentTransactionStatus.REVIEW_REQUIRED : i == 3 ? PaymentTransactionStatus.EXPIRED : PaymentTransactionStatus.PENDING); p.setRequiresManualReview(i == 1 || i == 4); payments.save(p);
                var link = new PaymentLink(); link.setId(p.getPaymentLinkId()); link.setOrderCode(p.getOrderCode()); link.setAmount(p.getAmount().longValueExact());
                link.setAmountPaid(i == 4 || i == 5 ? p.getAmount().longValueExact() : 0L); link.setStatus(i == 4 || i == 5 ? PaymentLinkStatus.PAID : i == 3 ? PaymentLinkStatus.EXPIRED : PaymentLinkStatus.PENDING); links.put(p.getOrderCode(), link);
            }
            if (System.getenv("SMOKE_PERF_MODE") != null) for (int i = 0; i < 35; i++) {
                Booking b = new Booking(); b.setBookingCode("PERF-" + i); b.setCustomer(users.findByPhone("0900000001").orElseThrow());
                b.setService(offering); b.setSupplier(offering.getSupplier()); b.setPractitioner(people.findBySupplierIdAndActiveTrue(offering.getSupplier().getId()).getFirst());
                b.setAppointmentDate(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(3 + i / 8));
                b.setStartTime(LocalTime.of(9 + i % 8, 0)); b.setEndTime(b.getStartTime().plusMinutes(offering.getDurationMinutes()));
                b.setTotalAmount(offering.getPrice()); b.setStatus(BookingStatus.PENDING); b.setPaymentStatus(PaymentStatus.UNPAID); bookings.save(b);
            }
            if (System.getenv("SMOKE_REPORT_PAYMENTS") != null) {
                var password=users.findByPhone("0900000001").orElseThrow().getPasswordHash();
                for(int i=0;i<180;i++) {
                    var returning=new UserAccount();returning.setFullName("Khách lịch sử "+i);returning.setEmail("returning-"+i+"@example.com");
                    returning.setPhone("092"+String.format("%07d",i));returning.setPasswordHash(password);returning.setRole(Role.CUSTOMER);
                    users.save(returning);
                }
                users.flush();
                var json=context.getBean(com.fasterxml.jackson.databind.ObjectMapper.class);
                var original=json.createObjectNode().put("version",1);var history=original.putObject("data");
                history.putArray("users");history.set("salons",json.valueToTree(context.getBean(com.example.backend.service.AdminDirectoryService.class).salons(null,false,0,100).content()));history.putArray("bookings");history.putArray("originalCustomers");
                String batch=com.example.backend.service.PresentationPaymentBatchValidator.BATCH;
                var payload=json.createObjectNode().put("version",1);payload.putObject("batch").put("id",batch).put("version",1);
                var data=payload.putObject("data");var reportBookings=data.putArray("bookings");var receipts=data.putArray("reportingPayments");
                var person=people.findBySupplierIdAndActiveTrue(offering.getSupplier().getId()).getFirst();var customer=users.findByPhone("0900000001").orElseThrow();
                for(int i=0;i<144;i++) {
                    var date=LocalDate.of(2026,10,3).plusDays(i/6);int hour=9+i%6;
                    var created=date.minusDays(1).atTime(8,0).atOffset(ZoneOffset.ofHours(7)).toInstant();var paid=created.plusSeconds(300);
                    var value=offering.getPrice();var amount=com.example.backend.service.PresentationPaymentBatchValidator.deposit(value);
                    var b=reportBookings.addObject().put("id",9100000000L+i).put("batchId",batch).put("source","SIMULATED").put("bookingCode","BL2610R"+String.format("%04d",i+1))
                            .put("customerId",customer.getId()).put("customerName",customer.getFullName()).put("customerPhone",customer.getPhone()).put("supplierId",offering.getSupplier().getId()).put("supplierName",offering.getSupplier().getName())
                            .put("serviceId",offering.getId()).put("serviceName",offering.getName()).put("practitionerId",person.getId()).put("practitionerName",person.getDisplayName())
                            .put("appointmentDate",date.toString()).put("startTime",String.format("%02d:00:00",hour)).put("endTime",String.format("%02d:00:00",hour+1)).put("totalAmount",value)
                            .put("status","COMPLETED").put("paymentStatus","PARTIALLY_PAID").put("createdAt",created.toString()).put("simulatedPaidAt",paid.toString()).put("simulatedOnlineAmount",amount)
                            .put("remainingAtSalon",value.subtract(amount)).put("commissionAmount",0);
                    b.putNull("verifiedOnlineAmount").putNull("verifiedPaidAt").putNull("verifiedPaymentOption").put("paymentReviewRequired",false);
                    receipts.addObject().put("id",batch+":"+i).put("batchId",batch).put("source","SIMULATED").put("bookingId",9100000000L+i).put("paymentOption","DEPOSIT_05").put("amount",amount).put("remainingAmount",value.subtract(amount)).put("paidAt",paid.toString());
                }
                var em=context.getBean(jakarta.persistence.EntityManager.class);
                try {
                    em.createNativeQuery("insert into presentation_recovery(id,payload) values (:id,:payload)").setParameter("id","beautylink-presentation-20261031").setParameter("payload",json.writeValueAsString(original)).executeUpdate();
                    em.createNativeQuery("insert into presentation_recovery(id,payload) values (:id,:payload)").setParameter("id",batch).setParameter("payload",json.writeValueAsString(payload)).executeUpdate();
                    if(System.getenv("SMOKE_REPORT_SELECTION")!=null) {
                        String id="beautylink-report-payments-selection-smoke-v1";
                        var selection=json.createObjectNode().put("version",1);selection.putObject("batch").put("id",id).put("version",1).put("kind","REPORT_SELECTION").put("source","SIMULATED");
                        selection.putObject("data").putArray("excludedBookingIds").add(9100000078L);
                        em.createNativeQuery("insert into presentation_recovery(id,payload) values (:id,:payload)").setParameter("id",id).setParameter("payload",json.writeValueAsString(selection)).executeUpdate();
                    }
                } catch(com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException(e); }
            }
            if(System.getenv("SMOKE_DISPLAY_PROFILES")!=null) {
                var json=context.getBean(com.fasterxml.jackson.databind.ObjectMapper.class);var em=context.getBean(jakarta.persistence.EntityManager.class);
                var source=json.createObjectNode();var sourceUsers=source.putArray("users");
                for(int i=1;i<=45;i++) {
                    var u=new UserAccount();u.setFullName(i==1?"phan.dinh.khoi91":i%5==0?"Đặng An":i%2==0?"Ánh "+i:"An "+i);u.setEmail("customer"+i+"@seed.beautylink.test");u.setPhone("039111"+String.format("%04d",i));u.setRole(Role.CUSTOMER);users.saveAndFlush(u);
                }
                for(var u:users.findAll())sourceUsers.addObject().put("id",u.getId()).put("fullName",u.getFullName()).put("email",u.getEmail()).put("role",u.getRole().name()).put("createdAt",u.getCreatedAt().toString());
                var salons=source.putArray("salons");for(var salon:context.getBean(SupplierRepository.class).findAll())salons.addObject().put("id",salon.getId()).put("ownerUserId",salon.getOwner().getId());
                var patch=com.example.backend.service.PresentationProfilePatch.plan(source);
                em.createNativeQuery("insert into presentation_recovery(id,payload) values (:id,:payload)").setParameter("id",com.example.backend.service.PresentationProfilePatch.ID).setParameter("payload",patch.toString()).executeUpdate();
                source.set("priorProfilePlan",patch);var revision=com.example.backend.service.PresentationProfileRevision.plan(source);
                em.createNativeQuery("insert into presentation_recovery(id,payload) values (:id,:payload)").setParameter("id",com.example.backend.service.PresentationProfileRevision.ID).setParameter("payload",revision.toString()).executeUpdate();
            }
            return null;
        });
        var uncertain = payments.findByOrderCode(9100004L).orElseThrow();
        context.getBean(com.example.backend.service.PaymentService.class).reconcileById(uncertain.getId());
        var observed = payments.findById(uncertain.getId()).orElseThrow();
        if (observed.getStatus() != PaymentTransactionStatus.REVIEW_REQUIRED || !observed.isRequiresManualReview() || observed.getPaidAt() == null)
            throw new IllegalStateException("Manual receipt lost its blocker/evidence in browser fixture");
        System.out.println("BOOKING_REVIEW_SMOKE_READY: loopback / H2 / fake gateway only; no external payment requests");
    }
}
