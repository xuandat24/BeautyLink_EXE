package com.example.backend.service;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.example.backend.repository.ServiceOfferingRepository;
import com.example.backend.model.DomainEnums.PaymentOption;
import org.junit.jupiter.api.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class PresentationPaymentBatchValidatorTest {
    final ObjectMapper json=new ObjectMapper(); ObjectNode source,plan;
    @BeforeEach void fixture() {
        source=json.createObjectNode().put("asOf","2026-10-31T08:00:00Z");
        source.putArray("customers").addObject().put("id",1).put("fullName","Customer").put("createdAt","2026-08-01T00:00:00Z");
        source.putArray("catalog").addObject().put("id",2).put("supplierId",3).put("supplierName","Salon").put("name","Service").put("price",254000).put("durationMinutes",60);
        source.putArray("practitioners").addObject().put("id",4).put("supplierId",3).put("displayName","Person").put("restricted",false);
        source.putArray("assignments");source.putArray("exceptions");source.putArray("occupied");source.putArray("recovery");
        source.putArray("verified").addObject().put("amount",1215458);
        var rules=source.putArray("rules");for(var day:DayOfWeek.values())rules.addObject().put("practitionerId",4).put("day",day.name()).put("startTime","09:00").put("endTime","18:00").put("breakStart","12:00").put("breakEnd","13:00").put("slotMinutes",30);
        plan=json.createObjectNode().put("version",1);var batch=plan.putObject("batch").put("id",PresentationPaymentBatchValidator.BATCH).put("version",1).put("source","SIMULATED");
        batch.put("baselineVerified",1215458).put("target",3045000).put("simulated",1828800).put("resultingReportTotal",3044258);
        var data=plan.putObject("data");var bookings=data.putArray("bookings");var payments=data.putArray("reportingPayments");
        for(int i=0;i<144;i++) {
            var date=LocalDate.of(2026,10,2).plusDays(i/6);int hour=new int[]{9,10,11,13,14,15}[i%6];
            String created=date.minusDays(1).atTime(8,0).atOffset(ZoneOffset.ofHours(7)).toInstant().toString();
            String paid=Instant.parse(created).plusSeconds(300).toString();
            // First day's receipts are moved to Oct 2, before that day's appointments.
            if(date.getDayOfMonth()==2) { created=date.atTime(7,0).atOffset(ZoneOffset.ofHours(7)).toInstant().toString();paid=Instant.parse(created).plusSeconds(300).toString(); }
            var b=bookings.addObject().put("id",9100000000L+i).put("batchId",PresentationPaymentBatchValidator.BATCH).put("source","SIMULATED").put("bookingCode","REPORT-"+i)
                    .put("customerId",1).put("customerName","Customer").put("supplierId",3).put("supplierName","Salon").put("serviceId",2).put("serviceName","Service").put("practitionerId",4).put("practitionerName","Person")
                    .put("appointmentDate",date.toString()).put("startTime",LocalTime.of(hour,0).toString()).put("endTime",LocalTime.of(hour+1,0).toString()).put("createdAt",created).put("simulatedPaidAt",paid)
                    .put("completedAt",date.atTime(hour+1,15).atOffset(ZoneOffset.ofHours(7)).toInstant().toString()).put("status","COMPLETED").put("paymentStatus","PARTIALLY_PAID")
                    .put("totalAmount",254000).put("simulatedOnlineAmount",12700).put("remainingAtSalon",241300);
            b.putNull("verifiedOnlineAmount").putNull("verifiedPaidAt").putNull("verifiedPaymentOption");
            payments.addObject().put("id",PresentationPaymentBatchValidator.BATCH+":"+i).put("batchId",PresentationPaymentBatchValidator.BATCH).put("source","SIMULATED").put("bookingId",9100000000L+i)
                    .put("paymentOption","DEPOSIT_05").put("depositRate","0.05").put("serviceValue",254000).put("amount",12700).put("remainingAmount",241300).put("paidAt",paid);
        }
    }
    ObjectNode booking() {return (ObjectNode)plan.path("data").path("bookings").get(0);}
    ObjectNode payment() {return (ObjectNode)plan.path("data").path("reportingPayments").get(0);}
    @Test void validates144DistinctBookingsWithExactQuotesAndRealCalendarChecks() throws Exception {
        assertEquals(new BigDecimal("1828800"),PresentationPaymentBatchValidator.validate(source,plan));
    }
    @Test void depositCalculationAgreesWithAuthoritativeQuoteIncludingHalfUpBoundaries() {
        var quotes=new PaymentQuoteService(mock(ServiceOfferingRepository.class));
        for(int amount:new int[]{40000,40009,40010,254000,299000,359000,599000,999000})
            assertEquals(quotes.calculate(BigDecimal.valueOf(amount),PaymentOption.DEPOSIT_05,null).amount(),PresentationPaymentBatchValidator.deposit(BigDecimal.valueOf(amount)));
    }
    @Test void rejectsDuplicatesOrphanReferencesAndSupplierAssignmentMismatch() {
        booking().put("customerId",999);assertThrows(IllegalArgumentException.class,()->PresentationPaymentBatchValidator.validate(source,plan));
        booking().put("customerId",1).put("supplierId",999);assertThrows(IllegalArgumentException.class,()->PresentationPaymentBatchValidator.validate(source,plan));
        booking().put("supplierId",3);((ObjectNode)plan.path("data").path("bookings").get(1)).put("id",9100000000L);assertThrows(IllegalArgumentException.class,()->PresentationPaymentBatchValidator.validate(source,plan));
    }
    @Test void rejectsPriceRemainderInjectionAndVerifiedProviderFields() {
        payment().put("amount",12742);assertThrows(IllegalArgumentException.class,()->PresentationPaymentBatchValidator.validate(source,plan));
        payment().put("amount",12700).put("orderCode",123);assertThrows(IllegalArgumentException.class,()->PresentationPaymentBatchValidator.validate(source,plan));
        payment().remove("orderCode");booking().put("verifiedOnlineAmount",12700);assertThrows(IllegalArgumentException.class,()->PresentationPaymentBatchValidator.validate(source,plan));
    }
    @Test void rejectsBreaksConflictsAndPaymentsBeforeCreation() {
        booking().put("startTime","12:00").put("endTime","13:00");assertThrows(IllegalArgumentException.class,()->PresentationPaymentBatchValidator.validate(source,plan));
        booking().put("startTime","09:00").put("endTime","10:00");((ArrayNode)source.path("occupied")).add(booking().deepCopy());assertThrows(IllegalArgumentException.class,()->PresentationPaymentBatchValidator.validate(source,plan));
        ((ArrayNode)source.path("occupied")).removeAll();booking().put("createdAt","2026-10-30T00:00:00Z");assertThrows(IllegalArgumentException.class,()->PresentationPaymentBatchValidator.validate(source,plan));
    }
}
