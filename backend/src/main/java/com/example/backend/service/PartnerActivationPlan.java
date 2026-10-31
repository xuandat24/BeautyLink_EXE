package com.example.backend.service;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;
/** Reviewable operational activation proposal; never cosmetically overrides a status badge. */
public final class PartnerActivationPlan {
    public static final String ID="beautylink-partner-activation-20261101-v1";
    private static final ObjectMapper JSON=new ObjectMapper();
    private PartnerActivationPlan() {}
    public static ObjectNode baseline(JsonNode source) {
        var b=JSON.createObjectNode();for(String k:List.of("database","users","salons","integrity","paymentSemanticHash","financialBaseline","recoveryBaseline"))b.set(k,source.path(k).deepCopy());if(b.path("integrity").isObject())((ObjectNode)b.path("integrity")).remove("payment_transactions");return b;
    }
    public static ObjectNode plan(JsonNode source) {
        var plan=JSON.createObjectNode().put("version",1).put("kind","PARTNER_ACTIVATION").put("id",ID).put("sourceHash",PresentationProfileRevision.hash(baseline(source)));
        var targets=plan.putArray("targets");var blocked=plan.putArray("blocked");long active=0,normal=0;
        var rows=new ArrayList<JsonNode>();source.path("salons").forEach(rows::add);rows.sort((a,b)->{int order=VietnameseDirectoryOrder.compare(a.path("name").asText(),b.path("name").asText());return order==0?Long.compare(a.path("id").asLong(),b.path("id").asLong()):order;});
        var owners=new HashSet<Long>();
        for(var s:rows) {
            if(s.path("demoData").asBoolean())continue;normal++;
            String status=s.path("ownerStatus").asText(),approval=s.path("approvalStatus").asText();
            if(status.equals("ACTIVE")&&approval.equals("VERIFIED")){active++;continue;}
            String reason=!s.path("ownerRole").asText().equals("SUPPLIER")?"OWNER_ROLE_MISMATCH":!approval.equals("VERIFIED")?"NOT_VERIFIED":!status.equals("DISABLED")?"SUSPENDED_REQUIRES_SEPARATE_REVIEW":null;
            if(reason!=null){blocked.addObject().put("supplierId",s.path("id").asLong()).put("name",s.path("name").asText()).put("reason",reason);continue;}
            if(!owners.add(s.path("ownerUserId").asLong()))throw new IllegalStateException("Duplicate owner relationship");
            var target=targets.addObject();for(String field:List.of("id","name","ownerUserId","ownerStatus","ownerUpdatedAt","authVersion","hasPassword","googleLinks","unrevokedSessions","activeServices","activePractitioners"))target.set(field,s.path(field));target.put("newOwnerStatus","ACTIVE");target.put("workforceReady",s.path("activeServices").asLong()>0&&s.path("activePractitioners").asLong()>0);
        }
        var admins=new ArrayList<Long>();source.path("users").forEach(u->{if(u.path("role").asText().equals("ADMIN")&&u.path("status").asText().equals("ACTIVE"))admins.add(u.path("id").asLong());});
        if(admins.size()==1)plan.put("auditAdminId",admins.getFirst());else throw new IllegalStateException("Exactly one active audit admin required for this scoped operator plan");
        plan.put("normalSalons",normal).put("activeBefore",active).put("activeAfter",active+targets.size()).put("excludedDemo",source.path("salons").size()-normal);
        plan.set("financialBaseline",source.path("financialBaseline").deepCopy());plan.put("moneyChanges",0).put("bookingChanges",0).put("approvalStatusChanges",0).put("contactChanges",0);
        plan.put("auditRecordsAdded",targets.size());
        plan.put("sessionPolicy","Revoke old owner sessions and increment authVersion; never revive old tokens or reset proofs. No password/Google/contact changes.");
        return plan;
    }
}
