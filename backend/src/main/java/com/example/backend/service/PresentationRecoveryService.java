package com.example.backend.service;

import com.example.backend.model.PresentationRecovery;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.SupplierRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.example.backend.dto.ReportingPaymentDtos.Row;
import com.example.backend.model.DomainEnums.*;
import java.time.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class PresentationRecoveryService {
    @PersistenceContext private EntityManager em;
    private final ObjectMapper json;
    private final SupplierRepository suppliers;
    public PresentationRecoveryService(ObjectMapper json, SupplierRepository suppliers) { this.json = json; this.suppliers = suppliers; }
    public JsonNode data() {
        var row = em.find(PresentationRecovery.class, "beautylink-presentation-20261031");
        if (row == null) return null;
        try {
            var root = json.readTree(row.getPayload());
            if (root.path("version").asInt() != 1 || !root.path("data").isObject()) throw new IllegalStateException("Invalid recovery version");
            ObjectNode data = root.path("data").deepCopy();
            var batches = em.createQuery("select r from PresentationRecovery r where r.id like :prefix order by r.id", PresentationRecovery.class)
                    .setParameter("prefix", "beautylink-report-payments-%").getResultList();
            var markers = new HashSet<String>(); batches.forEach(b -> markers.add(b.getId()));
            var bookings = data.withArray("bookings"); var payments = data.withArray("reportingPayments");
            for (var batch : batches) {
                if (batch.getId().endsWith(".rollback") || markers.contains(batch.getId()+".rollback")) continue;
                var payload = json.readTree(batch.getPayload());
                if (payload.path("version").asInt()!=1 || !batch.getId().equals(payload.path("batch").path("id").asText()))
                    throw new IllegalStateException("Invalid report payment batch");
                payload.path("data").path("bookings").forEach(bookings::add);
                payload.path("data").path("reportingPayments").forEach(payments::add);
            }
            return data;
        } catch (com.fasterxml.jackson.core.JsonProcessingException error) { throw new IllegalStateException("Invalid presentation recovery", error); }
    }
    public List<Row> reportingPayments() {
        var data=data(); if(data==null) return List.of();
        var bookings=new HashMap<Long,JsonNode>();
        data.path("bookings").forEach(b->{ if(bookings.put(b.path("id").asLong(),b)!=null) throw new IllegalStateException("Duplicate report booking"); });
        var result=new ArrayList<Row>(); var ids=new HashSet<String>(); var paidBookings=new HashSet<Long>();
        for(var p:data.path("reportingPayments")) {
            var b=bookings.get(p.path("bookingId").asLong());
            if(b==null || !"SIMULATED".equals(p.path("source").asText()) || !p.path("batchId").asText().equals(b.path("batchId").asText())
                    || !ids.add(p.path("id").asText()) || !paidBookings.add(b.path("id").asLong())) throw new IllegalStateException("Invalid report payment link");
            var amount=p.path("amount").decimalValue(); var remaining=p.path("remainingAmount").decimalValue();
            if(amount.signum()<=0 || remaining.signum()<0 || amount.add(remaining).compareTo(b.path("totalAmount").decimalValue())!=0)
                throw new IllegalStateException("Report payment does not reconcile to booking");
            result.add(new Row(p.path("id").asText(),"SIMULATED",p.path("batchId").asText(),b.path("id").asLong(),b.path("bookingCode").asText(),
                    b.path("customerId").asLong(),b.path("customerName").asText(),b.path("supplierId").asLong(),b.path("supplierName").asText(),b.path("serviceId").asLong(),
                    b.path("serviceName").asText(),b.path("practitionerId").asLong(),b.path("practitionerName").asText(),LocalDate.parse(b.path("appointmentDate").asText()),
                    LocalTime.parse(b.path("startTime").asText()),LocalTime.parse(b.path("endTime").asText()),BookingStatus.valueOf(b.path("status").asText()),Instant.parse(b.path("createdAt").asText()),
                    b.path("totalAmount").decimalValue(),PaymentOption.valueOf(p.path("paymentOption").asText()),amount,remaining,Instant.parse(p.path("paidAt").asText())));
        }
        return List.copyOf(result);
    }
    public List<JsonNode> supplierBookings(UserAccount owner) {
        var supplier = suppliers.findByOwnerId(owner.getId()).orElse(null);
        var data = data();
        if (supplier == null || data == null) return List.of();
        var rows = new ArrayList<JsonNode>();
        data.path("bookings").forEach(row -> { if (row.path("supplierId").asLong() == supplier.getId()) rows.add(row); });
        return List.copyOf(rows);
    }
}
