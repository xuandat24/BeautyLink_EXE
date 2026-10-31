package com.example.backend.service;

import com.example.backend.model.PresentationRecovery;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.SupplierRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
            return root.get("data");
        } catch (com.fasterxml.jackson.core.JsonProcessingException error) { throw new IllegalStateException("Invalid presentation recovery", error); }
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
