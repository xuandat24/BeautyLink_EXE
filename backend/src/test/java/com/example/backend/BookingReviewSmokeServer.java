package com.example.backend;

import com.example.backend.model.*;
import com.example.backend.repository.*;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import static com.example.backend.model.DomainEnums.*;

/** Local browser fixture, on the test classpath only. Never included in the production jar. */
public class BookingReviewSmokeServer {
    public static void main(String[] args) {
        var context = new SpringApplicationBuilder(BackendApplication.class).profiles("test").run(
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
            return null;
        });
        System.out.println("BOOKING_REVIEW_SMOKE_READY: loopback / H2 only; no payment provider configured");
    }
}
