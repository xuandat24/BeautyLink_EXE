package com.example.backend.service;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
class PresentationProfilePatchTest {
    final ObjectMapper json=new ObjectMapper();
    @Test void stablePlanPreservesCohortAndContactsAndRespectsEarliestActivity() throws Exception {
        var s=json.createObjectNode();var users=s.putArray("users");
        for(int i=1;i<=200;i++)users.addObject().put("id",i).put("fullName","Khách "+i).put("email","person"+i+"@company.vn").put("role","CUSTOMER").put("createdAt","2026-09-01T00:00:00Z");
        users.addObject().put("id",201).put("fullName","Đặng Mỹ Anh").put("email","catalog.salon@beautylink.local").put("role","SUPPLIER").put("status","DISABLED").put("createdAt","2026-09-01T00:00:00Z");
        s.putArray("salons").addObject().put("id",9).put("ownerUserId",201);
        var reports=s.putObject("data").putArray("users");
        reports.addObject().put("id",8000000001L).put("fullName","phan.dinh.khoi91").put("email","old.alias@yahoo.com").put("role","CUSTOMER").put("createdAt","2026-08-01T00:00:00Z");
        reports.addObject().put("id",8000000002L).put("fullName","Nguyễn Mỹ Linh").put("email","old@gmail.com").put("role","CUSTOMER").put("createdAt","2026-08-01T00:00:00Z");
        s.putArray("activity").addObject().put("customerId",8000000001L).put("createdAt","2026-10-10T00:00:00Z");
        s.putArray("bookings").addObject().put("customerId",8000000002L).put("createdAt","2026-10-21T00:00:00Z");
        var before=s.deepCopy();var p=PresentationProfilePatch.plan(s);
        assertEquals(before,s);assertEquals(p,PresentationProfilePatch.plan(s));assertEquals(3,p.path("profiles").size());assertEquals(71,p.path("returningCustomerIds").size());
        assertEquals(116,p.path("returningCustomerIds").get(0).asInt(),"membership still uses creation order including supplier before skipping85");
        var handle=p.path("profiles").get(1);assertEquals("Phan Dinh Khoi",handle.path("fullName").asText());assertFalse(handle.has("reportCreatedAt"));
        assertTrue(p.path("exceptions").toString().contains("ACTIVITY_BEFORE_WINDOW"));
        assertTrue(java.time.Instant.parse(p.path("profiles").get(2).path("reportCreatedAt").asText()).isBefore(java.time.Instant.parse("2026-10-21T00:00:00Z")));
        for(var profile:p.path("profiles"))assertTrue(profile.path("email").asText().matches("[a-z0-9]+@gmail\\.com"));
        assertEquals("DISABLED",s.path("users").get(200).path("status").asText());
    }
    @Test void gmailCanonicalCollisionIsReservedAcrossRealAndSeedSources() throws Exception {
        var s=json.readTree("""
            {"users":[{"id":1,"fullName":"Lê An","role":"CUSTOMER","email":"lean+001@seed.beautylink.test","createdAt":"2026-10-01T00:00:00Z"},
            {"id":2,"fullName":"Real","role":"CUSTOMER","email":"le.an1031+owned@gmail.com","createdAt":"2026-10-01T00:00:00Z"}],"salons":[],"data":{"users":[]}}
            """);
        var p=PresentationProfilePatch.plan(s);assertEquals("lean1032@gmail.com",p.path("profiles").get(0).path("email").asText());
        assertEquals("lean1@gmail.com",PresentationProfilePatch.canonical("Le.An1+owned@googlemail.com"));
        ((com.fasterxml.jackson.databind.node.ObjectNode)p.path("profiles").get(0)).put("email","a.b@gmail.com");assertThrows(IllegalStateException.class,()->PresentationProfilePatch.validate(p));
    }
    @Test void existingRealCanonicalDuplicatesAreReportedWithoutRewritingEitherContact() throws Exception {
        var source=json.readTree("{\"users\":[{\"id\":1,\"email\":\"real.person@gmail.com\",\"role\":\"CUSTOMER\"},{\"id\":2,\"email\":\"realperson+owned@gmail.com\",\"role\":\"CUSTOMER\"}]}");
        var plan=PresentationProfilePatch.plan(source);assertEquals(0,plan.path("profiles").size());
        assertEquals(2,java.util.stream.StreamSupport.stream(plan.path("exceptions").spliterator(),false).filter(e->e.path("reason").asText().equals("EXISTING_REAL_CANONICAL_COLLISION")).count());
    }
    @Test void vietnameseNaturalOrderIncludesDDiacriticsEmptyAndStableIdTies() {
        var names=new ArrayList<>(Arrays.asList("Salon 10","đặng"," An  ","Đặng","Dương","Salon 2","Ánh","Bình",null,""));names.sort(VietnameseDirectoryOrder::compare);
        assertEquals(Arrays.asList(" An  ","Ánh","Bình","Dương","đặng","Đặng","Salon 2","Salon 10",null,""),names);
        assertEquals(0,VietnameseDirectoryOrder.compare("  An\u00a0 2 ","An 2"));
        assertEquals(0,VietnameseDirectoryOrder.compare("ĐẶNG","Đa\u0323\u0306ng"));
    }
}
