package com.example.backend.service;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.time.*;
import java.util.*;
/** Immutable versioned display overlay; operational identities and financial snapshots stay untouched. */
public final class PresentationProfilePatch {
    public static final String ID="beautylink-display-profiles-20261101-v1";
    private static final ObjectMapper JSON=new ObjectMapper();
    private PresentationProfilePatch() {}
    public static String hash(JsonNode value) {
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.toString().getBytes(StandardCharsets.UTF_8)));}
        catch(Exception e){throw new IllegalStateException(e);}
    }
    public static String canonical(String email) {
        String v=email==null?"":email.strip().toLowerCase(Locale.ROOT);
        return v.endsWith("@gmail.com")||v.endsWith("@googlemail.com")?v.split("@")[0].split("\\+",2)[0].replace(".","")+"@gmail.com":v;
    }
    public static String source(JsonNode u,Set<Long> owners) {
        long id=u.path("id").asLong();String e=u.path("email").asText("").toLowerCase(Locale.ROOT),r=u.path("role").asText();
        if(id>=8000000000L&&id<8000000286L)return "REPORT";
        if(r.equals("CUSTOMER")&&e.matches("[a-z0-9._+\\-]+@seed\\.beautylink\\.test"))return "SEED_CUSTOMER";
        if(r.equals("SUPPLIER")&&owners.contains(id)&&e.matches("(catalog|demo)\\.[a-z0-9._\\-]+@beautylink\\.local"))return "SEED_PARTNER";
        return "REAL";
    }
    public static String name(String value) {
        String n=VietnameseDirectoryOrder.clean(value);if(!n.matches("[^\\s]+[._][^\\s]+"))return n;
        return Arrays.stream(n.replaceAll("[0-9]+$","").split("[._\\-]+")).filter(p->!p.isBlank()).map(p->p.substring(0,1).toUpperCase(Locale.forLanguageTag("vi"))+p.substring(1).toLowerCase(Locale.forLanguageTag("vi"))).reduce((a,b)->a+" "+b).orElse(n);
    }
    public static ObjectNode plan(JsonNode source) {
        var plan=JSON.createObjectNode().put("version",1).put("kind","DISPLAY_PROFILES").put("id",ID).put("sourceHash",hash(source));
        var profiles=plan.putArray("profiles");var exceptions=plan.putArray("exceptions");
        var owners=new HashSet<Long>();source.path("salons").forEach(s->owners.add(s.path("ownerUserId").asLong()));
        var all=new TreeMap<Long,JsonNode>();source.path("data").path("users").forEach(u->all.put(u.path("id").asLong(),u));source.path("users").forEach(u->all.put(u.path("id").asLong(),u));
        var descending=new ArrayList<>(all.values());descending.sort(Comparator.comparing((JsonNode u)->u.path("createdAt").asText()).reversed().thenComparing(Comparator.comparingLong((JsonNode u)->u.path("id").asLong()).reversed()));
        var cohort=plan.putArray("returningCustomerIds");descending.stream().skip(85).filter(u->u.path("role").asText().equals("CUSTOMER")).limit(71).forEach(u->cohort.add(u.path("id").asLong()));
        var used=new HashSet<String>();var realKeys=new HashMap<String,List<Long>>();
        for(var u:all.values())if(source(u,owners).equals("REAL")){String key=canonical(u.path("email").asText());if(!key.isBlank()){used.add(key);realKeys.computeIfAbsent(key,k->new ArrayList<>()).add(u.path("id").asLong());}}
        for(var ids:realKeys.values())if(ids.size()>1)for(Long id:ids)exceptions.addObject().put("id",id).put("reason","EXISTING_REAL_CANONICAL_COLLISION");
        var first=new HashMap<Long,Instant>();for(String field:List.of("bookings","activity"))for(var b:source.path(field))remember(first,b);for(var b:source.path("data").path("bookings"))remember(first,b);
        for(var u:all.values()) {
            long id=u.path("id").asLong();String scope=source(u,owners);
            if(scope.equals("REAL")){exceptions.addObject().put("id",id).put("reason","REAL_CONTACT_PRESERVED");continue;}
            String display=name(u.path("fullName").asText());if(display.isBlank()){exceptions.addObject().put("id",id).put("reason","MISSING_NAME");continue;}
            String stem=Normalizer.normalize(display,Normalizer.Form.NFD).replaceAll("\\p{M}","").replace('đ','d').replace('Đ','D').toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]","");
            stem=stem.replaceAll("demoowner$","");if(stem.isBlank())throw new IllegalStateException("Unsupported name");if(stem.length()>48)stem=stem.substring(0,48);long suffix=1000+Math.floorMod(id*31,9000);String email;do{email=stem+(suffix++)+"@gmail.com";}while(!used.add(canonical(email)));
            var p=profiles.addObject().put("id",id).put("source",scope).put("fullName",display).put("email",email);
            var original=p.putObject("original");for(String k:List.of("fullName","email","createdAt"))original.set(k,u.path(k));
            if(scope.equals("REPORT")) {
                Instant start=Instant.parse("2026-10-19T17:00:00Z"),end=Instant.parse("2026-10-30T17:00:00Z"),earliest=first.get(id);
                if(earliest!=null&&earliest.isBefore(start))exceptions.addObject().put("id",id).put("reason","ACTIVITY_BEFORE_WINDOW");
                else {long seconds=Duration.between(start,earliest!=null&&earliest.isBefore(end)?earliest:end.minusSeconds(1)).getSeconds();p.put("reportCreatedAt",start.plusSeconds(Math.floorMod(id*7919,seconds+1)).toString());}
            } else exceptions.addObject().put("id",id).put("reason","OPERATIONAL_REGISTRATION_PRESERVED");
        }validate(plan);return plan;
    }
    private static void remember(Map<Long,Instant> first,JsonNode b) {
        if(b.path("createdAt").isTextual())first.merge(b.path("customerId").asLong(),Instant.parse(b.path("createdAt").asText()),(a,c)->a.isBefore(c)?a:c);
    }
    public static void validate(JsonNode plan) {
        if(plan.path("version").asInt()!=1||!ID.equals(plan.path("id").asText())||!"DISPLAY_PROFILES".equals(plan.path("kind").asText())||!plan.path("profiles").isArray()||!plan.path("returningCustomerIds").isArray())throw new IllegalStateException("Invalid profile patch");
        var ids=new HashSet<Long>();var emails=new HashSet<String>();
        for(var p:plan.path("profiles")) {
            if(!ids.add(p.path("id").asLong())||p.path("id").asLong()<=0||!p.path("email").asText().matches("[a-z0-9]+@gmail\\.com")||!emails.add(canonical(p.path("email").asText()))||p.path("fullName").asText().isBlank()||!Set.of("REPORT","SEED_CUSTOMER","SEED_PARTNER").contains(p.path("source").asText())||!p.path("original").isObject())throw new IllegalStateException("Invalid/duplicate profile");
            if(p.has("reportCreatedAt")){Instant at=Instant.parse(p.path("reportCreatedAt").asText());if(!p.path("source").asText().equals("REPORT")||at.isBefore(Instant.parse("2026-10-19T17:00:00Z"))||!at.isBefore(Instant.parse("2026-10-30T17:00:00Z")))throw new IllegalStateException("Invalid report date");}
        }
        var cohort=new HashSet<Long>();for(var id:plan.path("returningCustomerIds"))if(!id.canConvertToLong()||!cohort.add(id.asLong())||id.asLong()<=0)throw new IllegalStateException("Invalid cohort");if(cohort.size()>71)throw new IllegalStateException("Oversized cohort");
    }
    public static boolean matches(JsonNode p,JsonNode u){return u!=null&&Objects.equals(p.path("original").path("email"),u.path("email"))&&Objects.equals(p.path("original").path("fullName"),u.path("fullName"));}
}
