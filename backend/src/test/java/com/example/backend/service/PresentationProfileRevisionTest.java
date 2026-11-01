package com.example.backend.service;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
class PresentationProfileRevisionTest {
 final ObjectMapper json=new ObjectMapper();
 ObjectNode source() {var s=json.createObjectNode();s.putArray("users");s.putArray("salons");s.putObject("data").putArray("users");return s;}
 ObjectNode user(ObjectNode s,long id,String email) {return s.withArray("users").addObject().put("id",id).put("fullName","Đặng Mỹ Anh").put("email",email).put("role","CUSTOMER").put("status","ACTIVE").put("createdAt","2026-08-01T00:00:00Z");}
 @Test void requestedDomainsAreDisplayOnlyAndDatesNeverChangeSourceOrMoney() {
  var s=source();int id=0;for(String domain:PresentationProfileRevision.DOMAINS)user(s,++id,"Test@"+domain.toUpperCase()+"  ");user(s,99,"real@company.vn");
  s.put("paymentSemanticHash","paid-identity-and-amount");var original=s.deepCopy();var p=PresentationProfileRevision.plan(s);
  assertEquals(original,s);assertEquals(5,p.path("profiles").size());assertEquals(p,PresentationProfileRevision.plan(s));
  for(var r:p.path("profiles")){assertEquals("CONTACT_DISPLAY",r.path("source").asText());assertTrue(r.path("email").asText().matches("[a-z0-9]+@gmail\\.com"));assertTrue(r.path("emailIsDisplayOnly").asBoolean());Instant at=Instant.parse(r.path("reportCreatedAt").asText());assertFalse(at.isBefore(PresentationProfileRevision.START));assertTrue(at.isBefore(PresentationProfileRevision.END));}
  assertTrue(p.path("exceptions").toString().contains("REAL_CONTACT_AND_REGISTRATION_PRESERVED"));
 }
 @Test void v1AliasesAndFrozenMembershipSurviveWiderDates() {
  var s=source();for(int i=1;i<=200;i++)user(s,i,"an"+i+"@seed.beautylink.test");var prior=PresentationProfilePatch.plan(s);s.set("priorProfilePlan",prior);
  var p=PresentationProfileRevision.plan(s);assertEquals(prior.path("returningCustomerIds"),p.path("returningCustomerIds"));
  for(int i=0;i<200;i++)assertEquals(prior.path("profiles").get(i).path("email"),p.path("profiles").get(i).path("email"));
 }
 @Test void earlyOrUnverifiableActivityKeepsOriginalDateButStillChangesDisplayEmail() {
  var s=source();user(s,1,"old@outlook.com");user(s,2,"old@yahoo.com");user(s,3,"old@maxxspace.com");
  var activity=s.putArray("activity");activity.addObject().put("customerId",1).put("createdAt","2026-09-19T16:59:59Z");activity.addObject().put("customerId",2).put("createdAt","bad");activity.addObject().put("customerId",3).put("createdAt","2026-09-20T00:00:00Z");
  var p=PresentationProfileRevision.plan(s);assertFalse(p.path("profiles").get(0).has("reportCreatedAt"));assertFalse(p.path("profiles").get(1).has("reportCreatedAt"));assertFalse(Instant.parse(p.path("profiles").get(2).path("reportCreatedAt").asText()).isAfter(Instant.parse("2026-09-20T00:00:00Z")));assertEquals(2,p.path("exceptions").size());
 }
 @Test void canonicalApprovalHashSurvivesDiskNumbersAndKeyOrderButRejectsBusinessChanges() throws Exception {
  assertEquals(PresentationProfileRevision.hash(json.readTree("{\"a\":53261000.00,\"b\":1}")),PresentationProfileRevision.hash(json.readTree("{\"b\":1.0,\"a\":53261000}")));
  var s=source();s.putObject("integrity").put("payment_transactions","observation-a");s.put("paymentSemanticHash","same");var before=PresentationProfileRevision.hash(PresentationProfileRevision.planningBaseline(s));((ObjectNode)s.path("integrity")).put("payment_transactions","observation-b");assertEquals(before,PresentationProfileRevision.hash(PresentationProfileRevision.planningBaseline(s)));
  s.put("paymentSemanticHash","amount-or-status-or-ordercode-changed");assertNotEquals(before,PresentationProfileRevision.hash(PresentationProfileRevision.planningBaseline(s)));
 }
 @Test void activationPlanPreservesDemoSuspendedUnapprovedAndWrongRoleAccounts() {
  var s=source();user(s,1,"admin@company.vn").put("role","ADMIN");var salons=s.withArray("salons");
  for(int i=1;i<=6;i++)salons.addObject().put("id",i).put("name","Salon "+i).put("ownerUserId",100+i).put("ownerRole","SUPPLIER").put("ownerStatus",i==2?"ACTIVE":i==3?"SUSPENDED":"DISABLED").put("approvalStatus",i==4?"PENDING":"VERIFIED").put("demoData",i==5).put("activeServices",1).put("activePractitioners",1);
  ((ObjectNode)salons.get(5)).put("ownerRole","CUSTOMER");var baseline=s.deepCopy();var p=PartnerActivationPlan.plan(s);assertEquals(baseline,s);assertEquals(1,p.path("targets").size());assertEquals(101,p.path("targets").get(0).path("ownerUserId").asInt());assertEquals(3,p.path("blocked").size());assertEquals(1,p.path("excludedDemo").asInt());assertEquals(1,p.path("activeBefore").asInt());assertEquals(2,p.path("activeAfter").asInt());assertEquals(0,p.path("moneyChanges").asInt());
 }
}
