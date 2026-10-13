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
    @TestConfiguration(proxyBeanMethods = false)
    static class LocalGateway {
        @Bean @Primary PayOSGateway smokeGateway() {
            var gateway = mock(PayOSGateway.class); // no SDK or outbound requests in this test server
            when(gateway.create(any())).thenAnswer(i -> {
                CreatePaymentLinkRequest request = i.getArgument(0);
                var link = new PaymentLink(); link.setId("smoke-" + request.getOrderCode()); link.setOrderCode(request.getOrderCode());
                link.setAmount(request.getAmount()); link.setAmountPaid(0L); link.setStatus(PaymentLinkStatus.PENDING); links.put(request.getOrderCode(), link);
                var result = new CreatePaymentLinkResponse(); result.setOrderCode(request.getOrderCode()); result.setAmount(request.getAmount());
                result.setPaymentLinkId(link.getId()); result.setStatus(link.getStatus()); result.setCheckoutUrl("https://pay.payos.vn/web/" + link.getId()); return result;
            });
            when(gateway.get(any())).thenAnswer(i -> links.get(i.getArgument(0)));
            when(gateway.cancel(any(), any())).thenAnswer(i -> { var link = links.get(i.getArgument(0)); if (link != null) link.setStatus(PaymentLinkStatus.CANCELLED); return link; });
            return gateway;
        }
    }
    public static void main(String[] args) {
        var context = new SpringApplicationBuilder(BackendApplication.class, LocalGateway.class).profiles("test").run(
                "--spring.config.import=", "--server.address=127.0.0.1", "--server.port=8080",
                "--spring.datasource.url=jdbc:h2:mem:review-browser;MODE=MySQL;DB_CLOSE_DELAY=-1",
                "--app.payos.client-id=", "--app.payos.api-key=", "--app.payos.checksum-key=",
                "--app.otp.resend.api-key=");
        String url = context.getEnvironment().getProperty("spring.datasource.url", "");
        if (!url.startsWith("jdbc:h2:mem:review-browser")) throw new IllegalStateException("Unsafe smoke-test datasource");
        var bookings = context.getBean(BookingRepository.class);
        var services = context.getBean(ServiceOfferingRepository.class);
        var people = context.getBean(PractitionerRepository.class);
        var users = context.getBean(UserAccountRepository.class);
        var payments = context.getBean(PaymentTransactionRepository.class);
        new TransactionTemplate(context.getBean(PlatformTransactionManager.class)).execute(status -> {
            var offering = services.findAll().stream().filter(s -> !people.findBySupplierIdAndActiveTrue(s.getSupplier().getId()).isEmpty()).findFirst().orElseThrow();
            String[] codes = {"SMOKE-UNPAID", "SMOKE-FUTURE-DEPOSIT", "SMOKE-FUTURE-FULL", "SMOKE-PAST-DEPOSIT", "SMOKE-PAST-FULL", "SMOKE-CANCELLED", "SMOKE-REFUNDED"};
            for (int i = 0; i < codes.length; i++) {
                Booking b = new Booking(); b.setBookingCode(codes[i]); b.setCustomer(users.findByPhone("0900000001").orElseThrow());
                b.setService(offering); b.setSupplier(offering.getSupplier()); b.setPractitioner(people.findBySupplierIdAndActiveTrue(offering.getSupplier().getId()).get(0));
                b.setAppointmentDate(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(i == 1 || i == 2 ? 2 : -2));
                b.setStartTime(LocalTime.of(10, 0)); b.setEndTime(LocalTime.of(11, 0)); b.setTotalAmount(offering.getPrice());
                b.setStatus(i == 0 ? BookingStatus.PENDING : i == 5 ? BookingStatus.CANCELLED : i == 6 ? BookingStatus.COMPLETED : BookingStatus.CONFIRMED);
                b.setPaymentStatus(i == 0 ? PaymentStatus.UNPAID : i == 6 ? PaymentStatus.REFUNDED : i == 1 || i == 3 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.PAID);
                bookings.save(b);
            }
            for (int i = 0; i < 2; i++) {
                Booking b = new Booking(); b.setBookingCode(i == 0 ? "SMOKE-PENDING-LINK" : "SMOKE-MANUAL");
                b.setCustomer(users.findByPhone("0900000001").orElseThrow()); b.setService(offering); b.setSupplier(offering.getSupplier());
                b.setPractitioner(people.findBySupplierIdAndActiveTrue(offering.getSupplier().getId()).get(0));
                b.setAppointmentDate(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(7).with(java.time.temporal.TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY)));
                b.setStartTime(LocalTime.of(15, 0)); b.setEndTime(LocalTime.of(16, 0)); b.setTotalAmount(offering.getPrice());
                b.setStatus(i == 0 ? BookingStatus.PENDING : BookingStatus.COMPLETED); b.setPaymentStatus(i == 0 ? PaymentStatus.UNPAID : PaymentStatus.PAID); bookings.saveAndFlush(b);
                PaymentTransaction p = new PaymentTransaction(); p.setBooking(b); p.setOrderCode(9100000L + i); p.setPaymentLinkId("smoke-" + p.getOrderCode());
                p.setAmount(offering.getPrice()); p.setRemainingAmount(java.math.BigDecimal.ZERO); p.setPaymentOption(PaymentOption.FULL_100);
                p.setExpiresAt(Instant.now().plusSeconds(900)); p.setCheckoutUrl("https://pay.payos.vn/web/" + p.getPaymentLinkId());
                p.setStatus(i == 0 ? PaymentTransactionStatus.PENDING : PaymentTransactionStatus.REVIEW_REQUIRED); p.setRequiresManualReview(i == 1); payments.save(p);
                var link = new PaymentLink(); link.setId(p.getPaymentLinkId()); link.setOrderCode(p.getOrderCode()); link.setAmount(p.getAmount().longValueExact());
                link.setAmountPaid(0L); link.setStatus(PaymentLinkStatus.PENDING); links.put(p.getOrderCode(), link);
            }
            return null;
        });
        System.out.println("BOOKING_REVIEW_SMOKE_READY: loopback / H2 / fake gateway only; no external payment requests");
    }
}
