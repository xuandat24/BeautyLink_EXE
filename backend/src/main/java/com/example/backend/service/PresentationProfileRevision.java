package com.example.backend.service;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.text.Normalizer;
import java.time.*;
import java.util.*;

/** Explicitly requested display contacts/dates. No operational email or registration writes. */
public final class PresentationProfileRevision {
    public static final String ID="beautylink-display-profiles-20261101-v2";
    public static final Instant START=Instant.parse("2026-09-19T17:00:00Z"),END=Instant.parse("2026-10-30T17:00:00Z");
    public static final Set<String> DOMAINS=Set.of("beautylink.local","seed.beautylink.test","outlook.com","maxxspace.com","yahoo.com");
    private static final ObjectMapper JSON=new ObjectMapper();
    private PresentationProfileRevision() {}
    public static String domain(JsonNode user){String email=user.path("email").asText("").strip().toLowerCase(Locale.ROOT);int at=email.lastIndexOf('@');return at<0?"":email.substring(at+1);}
    public static String source(JsonNode user,Set<Long> owners){String scope=PresentationProfilePatch.source(user,owners);return scope.equals("REAL")&&DOMAINS.contains(domain(user))?"CONTACT_DISPLAY":scope;}
    /** Canonical JSON for v2 approval artifacts: field order and decimal scale are not business changes. */
    public static String hash(JsonNode value) { return PresentationProfilePatch.hash(canonicalNode(value)); }
    private static JsonNode canonicalNode(JsonNode value) {
        if(value.isObject()) {var out=JSON.createObjectNode();var keys=new TreeSet<String>();value.fieldNames().forEachRemaining(keys::add);for(String key:keys)out.set(key,canonicalNode(value.get(key)));return out;}
        if(value.isArray()) {var out=JSON.createArrayNode();value.forEach(v->out.add(canonicalNode(v)));return out;}
        if(value.isNumber())return DecimalNode.valueOf(value.decimalValue().stripTrailingZeros());
        return value;
    }
    public static ObjectNode planningBaseline(JsonNode source) {
        ObjectNode baseline=source.deepCopy();baseline.remove("paymentObservationDiagnostics");
        if(baseline.path("integrity").isObject())((ObjectNode)baseline.path("integrity")).remove("payment_transactions");
        return baseline;
    }
    public static ObjectNode plan(JsonNode source) {
        var out=JSON.createObjectNode().put("version",2).put("kind","DISPLAY_PROFILES").put("purpose","DISPLAY_ONLY").put("id",ID).put("sourceHash",hash(planningBaseline(source)));
        var owners=new HashSet<Long>();source.path("salons").forEach(s->owners.add(s.path("ownerUserId").asLong()));
        var all=new TreeMap<Long,JsonNode>();source.path("data").path("users").forEach(u->all.put(u.path("id").asLong(),u));source.path("users").forEach(u->all.put(u.path("id").asLong(),u));
        var old=new HashMap<Long,JsonNode>();var prior=source.path("priorProfilePlan");
        if(!prior.isMissingNode()&&!prior.isNull()) {PresentationProfilePatch.validate(prior);prior.path("profiles").forEach(p->{if(PresentationProfilePatch.matches(p,all.get(p.path("id").asLong())))old.put(p.path("id").asLong(),p);});}
        out.set("returningCustomerIds",prior.has("returningCustomerIds")?prior.path("returningCustomerIds").deepCopy():freezeCohort(all.values()));
        var profiles=out.putArray("profiles");var exceptions=out.putArray("exceptions");var used=new HashSet<String>();
        for(var u:all.values())if(source(u,owners).equals("REAL")){String email=PresentationProfilePatch.canonical(u.path("email").asText());if(!email.isBlank()&&!used.add(email))exceptions.addObject().put("id",u.path("id").asLong()).put("reason","EXISTING_REAL_CANONICAL_COLLISION");}
        for(var p:old.values())if(!used.add(PresentationProfilePatch.canonical(p.path("email").asText())))throw new IllegalStateException("Existing stable alias conflicts; review before creating revision");
        var first=new HashMap<Long,Instant>();var invalid=new HashSet<Long>();
        for(String key:List.of("bookings","activity"))for(var activity:source.path(key))remember(first,invalid,activity);
        for(var b:source.path("data").path("bookings"))remember(first,invalid,b);
        var beforeDates=new HashMap<Long,Instant>();var afterDates=new HashMap<Long,Instant>();
        for(var u:all.values()) {
            long id=u.path("id").asLong();var previous=old.get(id);String scope=source(u,owners);
            Instant original=instant(u.path("createdAt"));if(original==null)throw new IllegalStateException("Account registration timestamp missing or malformed");
            beforeDates.put(id,previous!=null&&previous.has("reportCreatedAt")?instant(previous.path("reportCreatedAt")):original);afterDates.put(id,beforeDates.get(id));
            if(scope.equals("REAL")){exceptions.addObject().put("id",id).put("reason","REAL_CONTACT_AND_REGISTRATION_PRESERVED");continue;}
            String name=previous!=null?previous.path("fullName").asText():scope.equals("CONTACT_DISPLAY")?VietnameseDirectoryOrder.clean(u.path("fullName").asText()):PresentationProfilePatch.name(u.path("fullName").asText());
            if(name.isBlank()){exceptions.addObject().put("id",id).put("reason","MISSING_NAME");continue;}
            String email=previous==null?null:previous.path("email").asText();
            if(email==null) {
                String stem=Normalizer.normalize(name,Normalizer.Form.NFD).replaceAll("\\p{M}","").replace('đ','d').replace('Đ','D').toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]","").replaceAll("demoowner$","");
                if(stem.isBlank())throw new IllegalStateException("Unsupported name");if(stem.length()>48)stem=stem.substring(0,48);
                long suffix=1000+Math.floorMod(id*31,9000);do{email=stem+(suffix++)+"@gmail.com";}while(!used.add(PresentationProfilePatch.canonical(email)));
            }
            var p=profiles.addObject().put("id",id).put("source",scope).put("emailIsDisplayOnly",true).put("fullName",name).put("email",email);
            var baseline=p.putObject("original");for(String key:List.of("fullName","email","createdAt"))baseline.set(key,u.path(key));
            Instant earliest=first.get(id);
            if(invalid.contains(id))exceptions.addObject().put("id",id).put("reason","ACTIVITY_TIMESTAMP_UNVERIFIABLE");
            else if(earliest!=null&&earliest.isBefore(START))exceptions.addObject().put("id",id).put("reason","ACTIVITY_BEFORE_WINDOW");
            else {
                Instant upper=earliest!=null&&earliest.isBefore(END)?earliest:END.minusSeconds(1);
                Instant previousDate=previous==null?null:instant(previous.path("reportCreatedAt"));
                Instant chosen=previousDate!=null&&!previousDate.isBefore(START)&&!previousDate.isAfter(upper)?previousDate:START.plusSeconds(Math.floorMod(id*7919,Duration.between(START,upper).getSeconds()+1));
                p.put("reportCreatedAt",chosen.toString());afterDates.put(id,chosen);
            }
        }
        var changes=out.putArray("registrationCohortImpact");
        for(int month=9;month<=11;month++){
            Instant from=LocalDate.of(2026,month,1).atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant(),to=LocalDate.of(2026,month,1).plusMonths(1).atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();
            long before=beforeDates.values().stream().filter(d->!d.isBefore(from)&&d.isBefore(to)).count(),after=afterDates.values().stream().filter(d->!d.isBefore(from)&&d.isBefore(to)).count();
            changes.addObject().put("month",String.format("2026-%02d",month)).put("before",before).put("after",after).put("delta",after-before);
        }
        validate(out);return out;
    }
    private static ArrayNode freezeCohort(Collection<JsonNode> users) {
        var ordered=new ArrayList<>(users);ordered.sort(Comparator.comparing((JsonNode u)->u.path("createdAt").asText()).reversed().thenComparing(Comparator.comparingLong((JsonNode u)->u.path("id").asLong()).reversed()));
        var ids=JSON.createArrayNode();ordered.stream().skip(85).filter(u->u.path("role").asText().equals("CUSTOMER")).limit(71).forEach(u->ids.add(u.path("id").asLong()));return ids;
    }
    private static Instant instant(JsonNode n){try{return n.isTextual()?Instant.parse(n.asText()):null;}catch(java.time.format.DateTimeParseException e){return null;}}
    private static void remember(Map<Long,Instant> first,Set<Long> invalid,JsonNode b){long id=b.path("customerId").asLong();Instant at=instant(b.path("createdAt"));if(at==null)invalid.add(id);else first.merge(id,at,(a,c)->a.isBefore(c)?a:c);}
    public static void validate(JsonNode p) {
        if(p.path("version").asInt()!=2||!ID.equals(p.path("id").asText())||!"DISPLAY_PROFILES".equals(p.path("kind").asText())||!"DISPLAY_ONLY".equals(p.path("purpose").asText())||!p.path("profiles").isArray()||!p.path("returningCustomerIds").isArray())throw new IllegalStateException("Invalid profile revision");
        var ids=new HashSet<Long>();var keys=new HashSet<String>();
        for(var row:p.path("profiles")) {
            if(!row.path("id").isIntegralNumber()||row.path("id").asLong()<=0||!ids.add(row.path("id").asLong())||!row.path("emailIsDisplayOnly").asBoolean()||row.path("fullName").asText().isBlank()||!row.path("email").asText().matches("[a-z0-9]{1,64}@gmail\\.com")||!keys.add(PresentationProfilePatch.canonical(row.path("email").asText()))||!Set.of("REPORT","SEED_CUSTOMER","SEED_PARTNER","CONTACT_DISPLAY").contains(row.path("source").asText())||!row.path("original").isObject()||instant(row.path("original").path("createdAt"))==null)throw new IllegalStateException("Invalid revision profile");
            if(row.path("source").asText().equals("CONTACT_DISPLAY")&&!DOMAINS.contains(domain(row.path("original"))))throw new IllegalStateException("Unrequested contact domain");
            if(row.has("reportCreatedAt")){Instant at=instant(row.path("reportCreatedAt"));if(at==null||at.isBefore(START)||!at.isBefore(END))throw new IllegalStateException("Invalid revision date");}
        }
        var cohort=new HashSet<Long>();for(var id:p.path("returningCustomerIds"))if(!id.isIntegralNumber()||id.asLong()<=0||!cohort.add(id.asLong()))throw new IllegalStateException("Invalid frozen cohort");if(cohort.size()>71)throw new IllegalStateException("Oversized cohort");
    }
    public static boolean matches(JsonNode p,JsonNode original){return PresentationProfilePatch.matches(p,original)&&Objects.equals(instant(p.path("original").path("createdAt")),original==null?null:instant(original.path("createdAt")));}
}
