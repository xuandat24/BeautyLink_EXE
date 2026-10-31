package com.example.backend.service;

import com.fasterxml.jackson.databind.*;
import java.math.*;
import java.time.*;
import java.util.*;

/** Pure pre-write validation; has no database, email, checkout, or payment-provider dependencies. */
public final class PresentationPaymentBatchValidator {
    public static final String BATCH="beautylink-report-payments-144-20261031-v1";
    private static final ZoneId ZONE=ZoneId.of("Asia/Ho_Chi_Minh");
    private PresentationPaymentBatchValidator() {}
    public static BigDecimal deposit(BigDecimal value) { return value.setScale(0,RoundingMode.HALF_UP).multiply(new BigDecimal("0.05")).setScale(0,RoundingMode.HALF_UP); }
    private static void require(boolean condition,String message) { if(!condition) throw new IllegalArgumentException(message); }
    private static Map<Long,JsonNode> index(JsonNode rows) {
        var map=new HashMap<Long,JsonNode>(); for(var row:rows) require(map.put(row.path("id").asLong(),row)==null,"Duplicate reference ID"); return map;
    }
    private record Slot(long person,long customer,LocalDateTime start,LocalDateTime end) {}
    private static Slot slot(JsonNode b,long person) {
        var day=LocalDate.parse(b.path("appointmentDate").asText()); var start=day.atTime(LocalTime.parse(b.path("startTime").asText()));
        var end=day.atTime(LocalTime.parse(b.path("endTime").asText())); if(!end.isAfter(start)) end=end.plusDays(1);
        return new Slot(person,b.path("customerId").asLong(),start,end);
    }
    private static boolean overlap(LocalDateTime start,LocalDateTime end,LocalDateTime otherStart,LocalDateTime otherEnd) { return start.isBefore(otherEnd)&&end.isAfter(otherStart); }
    private static void schedule(JsonNode source,JsonNode b,Slot slot) {
        var day=slot.start().toLocalDate(); JsonNode rule=null,exception=null;
        for(var r:source.path("rules")) if(r.path("practitionerId").asLong()==slot.person()&&r.path("day").asText().equals(day.getDayOfWeek().name())) rule=r;
        for(var r:source.path("exceptions")) if(r.path("practitionerId").asLong()==slot.person()&&r.path("exceptionDate").asText().equals(day.toString())) exception=r;
        require(exception==null||exception.path("available").asBoolean(),"Practitioner unavailable on report day");
        require(rule!=null||exception!=null,"Missing practitioner schedule");
        String start=exception!=null&&!exception.path("startTime").isNull()?exception.path("startTime").asText():rule==null?"":rule.path("startTime").asText();
        String end=exception!=null&&!exception.path("endTime").isNull()?exception.path("endTime").asText():rule==null?"":rule.path("endTime").asText();
        var opening=day.atTime(LocalTime.parse(start)); var closing=day.atTime(LocalTime.parse(end)); if(!closing.isAfter(opening))closing=closing.plusDays(1);
        int step=rule==null?30:rule.path("slotMinutes").asInt();
        require(step>0&&!slot.start().isBefore(opening)&&!slot.end().isAfter(closing)&&Duration.between(opening,slot.start()).toMinutes()%step==0,"Outside scheduled slots");
        if(rule!=null&&!rule.path("breakStart").isNull()&&!rule.path("breakEnd").isNull()) {
            var breakStart=day.atTime(LocalTime.parse(rule.path("breakStart").asText()));
            if(breakStart.isBefore(opening)&&closing.toLocalDate().isAfter(day))breakStart=breakStart.plusDays(1);
            var breakEnd=breakStart.toLocalDate().atTime(LocalTime.parse(rule.path("breakEnd").asText())); if(!breakEnd.isAfter(breakStart))breakEnd=breakEnd.plusDays(1);
            require(!overlap(slot.start(),slot.end(),breakStart,breakEnd),"Report appointment overlaps break");
        }
    }
    public static BigDecimal validate(JsonNode source,JsonNode plan) throws Exception {
        require(plan.path("version").asInt()==1&&plan.path("batch").path("version").asInt()==1&&BATCH.equals(plan.path("batch").path("id").asText()),"Unsupported report batch");
        require("SIMULATED".equals(plan.path("batch").path("source").asText()),"Batch source must be SIMULATED");
        var data=plan.path("data"); require(data.path("bookings").size()==144&&data.path("reportingPayments").size()==144,"Exactly 144 report bookings and payments required");
        var customers=index(source.path("customers")); var services=index(source.path("catalog")); var people=index(source.path("practitioners"));
        var ids=new HashSet<Long>(); var codes=new HashSet<String>(); var occupied=new ArrayList<Slot>();
        for(var b:source.path("occupied")) { ids.add(b.path("id").asLong()); codes.add(b.path("bookingCode").asText()); occupied.add(slot(b,b.path("practitionerId").asLong())); }
        var mapper=new ObjectMapper();
        for(var r:source.path("recovery")) {
            var root=mapper.readTree(r.path("payload").asText());
            for(var u:root.path("data").path("users")) if("CUSTOMER".equals(u.path("role").asText())) require(customers.put(u.path("id").asLong(),u)==null,"Recovery customer collides with operational customer");
            for(var b:root.path("data").path("bookings")) {
                ids.add(b.path("id").asLong()); codes.add(b.path("bookingCode").asText());
                if("CANCELLED".equals(b.path("status").asText()))continue;
                for(var p:people.values()) if(b.hasNonNull("practitionerId")?p.path("id").asLong()==b.path("practitionerId").asLong():p.path("supplierId").asLong()==b.path("supplierId").asLong()&&p.path("displayName").asText().equals(b.path("practitionerName").asText())) occupied.add(slot(b,p.path("id").asLong()));
            }
        }
        var byId=new HashMap<Long,JsonNode>();
        Instant cutoff=Instant.parse(source.path("asOf").asText());
        for(var b:data.path("bookings")) {
            long id=b.path("id").asLong();
            require(id>=9_100_000_000L&&id<9_100_000_144L&&ids.add(id)&&codes.add(b.path("bookingCode").asText()),"Duplicate/reserved report booking ID or code");
            require(BATCH.equals(b.path("batchId").asText())&&"SIMULATED".equals(b.path("source").asText()),"Booking provenance mismatch");
            require("COMPLETED".equals(b.path("status").asText())&&"PARTIALLY_PAID".equals(b.path("paymentStatus").asText()),"Report lifecycle mismatch");
            for(String field:List.of("verifiedOnlineAmount","verifiedPaidAt","verifiedPaymentOption"))require(b.has(field)&&b.path(field).isNull(),"Simulated record cannot claim verified receipt");
            var customer=customers.get(b.path("customerId").asLong()); var service=services.get(b.path("serviceId").asLong()); var person=people.get(b.path("practitionerId").asLong());
            require(customer!=null&&service!=null&&person!=null,"Orphan report reference");
            require(service.path("supplierId").asLong()==b.path("supplierId").asLong()&&person.path("supplierId").asLong()==b.path("supplierId").asLong(),"Supplier/service/practitioner mismatch");
            require(customer.path("fullName").asText().equals(b.path("customerName").asText())&&person.path("displayName").asText().equals(b.path("practitionerName").asText())&&service.path("name").asText().equals(b.path("serviceName").asText())&&service.path("supplierName").asText().equals(b.path("supplierName").asText()),"Report display labels differ from linked records");
            if(person.path("restricted").asBoolean()) {
                boolean supported=false; for(var a:source.path("assignments")) if(a.path("practitionerId").asLong()==person.path("id").asLong()&&a.path("serviceId").asLong()==service.path("id").asLong())supported=true;
                require(supported,"Practitioner not assigned to this service");
            }
            var value=b.path("totalAmount").decimalValue(); require(value.signum()>0&&value.compareTo(service.path("price").decimalValue())==0,"Report price differs from catalog");
            var slot=slot(b,person.path("id").asLong());
            require(Duration.between(slot.start(),slot.end()).toMinutes()==service.path("durationMinutes").asInt(),"Service duration mismatch");
            schedule(source,b,slot);
            for(var other:occupied)require((other.person()!=slot.person()&&other.customer()!=slot.customer())||!overlap(slot.start(),slot.end(),other.start(),other.end()),"Report practitioner/customer schedule conflict");
            occupied.add(slot);
            Instant created=Instant.parse(b.path("createdAt").asText()),paid=Instant.parse(b.path("simulatedPaidAt").asText()),completed=Instant.parse(b.path("completedAt").asText());
            require(!created.isBefore(Instant.parse(customer.path("createdAt").asText()))&&created.isBefore(paid)&&paid.isBefore(slot.start().atZone(ZONE).toInstant())&&!completed.isBefore(slot.end().atZone(ZONE).toInstant())&&completed.isBefore(cutoff),"Report lifecycle timestamps invalid");
            require(!paid.isBefore(LocalDate.of(2026,10,2).atStartOfDay(ZONE).toInstant())&&paid.isBefore(LocalDate.of(2026,11,1).atStartOfDay(ZONE).toInstant()),"Report payment outside target periods");
            byId.put(id,b);
        }
        var paymentIds=new HashSet<String>(); var paidIds=new HashSet<Long>(); BigDecimal total=BigDecimal.ZERO;
        var allowed=Set.of("id","batchId","source","bookingId","paymentOption","serviceValue","amount","depositRate","remainingAmount","paidAt");
        for(var p:data.path("reportingPayments")) {
            p.fieldNames().forEachRemaining(field->require(allowed.contains(field),"Unsupported payment field"));
            var b=byId.get(p.path("bookingId").asLong()); require(b!=null&&paidIds.add(b.path("id").asLong()),"Duplicate/orphan report payment link");
            require(paymentIds.add(p.path("id").asText())&&p.path("id").asText().startsWith(BATCH+":")&&BATCH.equals(p.path("batchId").asText())&&"SIMULATED".equals(p.path("source").asText()),"Invalid payment provenance or ID");
            require("DEPOSIT_05".equals(p.path("paymentOption").asText())&&"0.05".equals(p.path("depositRate").asText()),"Only five percent deposits permitted");
            var value=b.path("totalAmount").decimalValue(); var amount=p.path("amount").decimalValue(); var remaining=p.path("remainingAmount").decimalValue();
            require(amount.compareTo(deposit(value))==0&&amount.compareTo(new BigDecimal("2000"))>=0&&amount.scale()<=0,"Invalid deposit quote/rounding/minimum");
            require(value.compareTo(p.path("serviceValue").decimalValue())==0&&amount.add(remaining).compareTo(value)==0&&remaining.signum()>0,"Payment/booking values do not reconcile");
            require(amount.compareTo(b.path("simulatedOnlineAmount").decimalValue())==0&&remaining.compareTo(b.path("remainingAtSalon").decimalValue())==0&&p.path("paidAt").equals(b.path("simulatedPaidAt")),"Booking/payment metadata mismatch");
            total=total.add(amount);
        }
        BigDecimal baseline=BigDecimal.ZERO; for(var p:source.path("verified"))baseline=baseline.add(p.path("amount").decimalValue());
        require(baseline.compareTo(plan.path("batch").path("baselineVerified").decimalValue())==0&&total.compareTo(plan.path("batch").path("simulated").decimalValue())==0&&baseline.add(total).compareTo(plan.path("batch").path("resultingReportTotal").decimalValue())==0,"Batch totals inconsistent");
        require(baseline.add(total).subtract(plan.path("batch").path("target").decimalValue()).abs().compareTo(new BigDecimal("5000"))<=0,"Reporting result is not close to target");
        return total;
    }
}
