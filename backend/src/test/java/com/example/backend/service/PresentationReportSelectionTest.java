package com.example.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class PresentationReportSelectionTest {
    final ObjectMapper json=new ObjectMapper();
    ObjectNode data() {
        var d=json.createObjectNode();
        d.putArray("bookings").addObject().put("id",9000000000L);
        d.withArray("bookings").addObject().put("id",9100000000L);
        d.putArray("reportingPayments").addObject().put("bookingId",9100000000L).put("amount",2000);
        d.putArray("users").addObject().put("id",8000000000L);
        d.putArray("salons").addObject().put("id",14);
        return d;
    }
    ObjectNode selection(List<Long> ids) {
        var p=json.createObjectNode().put("version",1);
        p.putObject("batch").put("version",1).put("kind","REPORT_SELECTION").put("source","SIMULATED");
        p.putObject("data").set("excludedBookingIds",json.valueToTree(ids));return p;
    }
    @Test void filtersBookingAndLinkedReceiptTogetherWithoutChangingDirectoryOrAudit() {
        var original=data();var selected=original.deepCopy();var plan=selection(List.of(9100000000L));var audit=plan.deepCopy();
        PresentationReportSelection.apply(selected,plan);
        assertEquals(1,selected.path("bookings").size());assertEquals(0,selected.path("reportingPayments").size());
        assertEquals(original.path("users"),selected.path("users"));assertEquals(original.path("salons"),selected.path("salons"));
        assertEquals(2,original.path("bookings").size());assertEquals(audit,plan);
    }
    @Test void rejectsRealUnknownDuplicateAndMalformedIdsBeforeMutation() {
        for(var ids:List.of(List.of(85L),List.of(9100000001L),List.of(9000000000L,9000000000L))) {
            var d=data();var before=d.deepCopy();assertThrows(IllegalArgumentException.class,()->PresentationReportSelection.apply(d,selection(ids)));assertEquals(before,d);
        }
        var p=selection(List.of(9000000000L));p.withObject("batch").put("version",2);
        assertThrows(IllegalArgumentException.class,()->PresentationReportSelection.apply(data(),p));
    }
}
