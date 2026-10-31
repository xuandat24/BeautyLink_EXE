package com.example.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;

/** Selects only synthetic report records; original payloads remain immutable audit evidence. */
public final class PresentationReportSelection {
    private PresentationReportSelection() {}
    public static void apply(ObjectNode data, JsonNode selection) {
        if (selection.path("version").asInt()!=1 || selection.path("batch").path("version").asInt()!=1
                || !"REPORT_SELECTION".equals(selection.path("batch").path("kind").asText())
                || !"SIMULATED".equals(selection.path("batch").path("source").asText())
                || !selection.path("data").path("excludedBookingIds").isArray()
                || selection.path("data").has("bookings") || selection.path("data").has("reportingPayments"))
            throw new IllegalArgumentException("Invalid report selection");
        var available=new HashSet<Long>();
        data.path("bookings").forEach(b->available.add(b.path("id").asLong()));
        var excluded=new HashSet<Long>();
        for(var id:selection.path("data").path("excludedBookingIds")) {
            if(!id.isIntegralNumber() || id.asLong()<9000000000L || id.asLong()>=10000000000L
                    || !available.contains(id.asLong()) || !excluded.add(id.asLong()))
                throw new IllegalArgumentException("Selection must reference existing unique synthetic booking IDs");
        }
        var bookings=data.putArray("selectedBookings");
        data.path("bookings").forEach(b->{if(!excluded.contains(b.path("id").asLong()))bookings.add(b);});
        data.set("bookings",data.remove("selectedBookings"));
        var payments=data.putArray("selectedPayments");
        data.path("reportingPayments").forEach(p->{if(!excluded.contains(p.path("bookingId").asLong()))payments.add(p);});
        data.set("reportingPayments",data.remove("selectedPayments"));
    }
}
