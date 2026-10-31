package com.example.backend.service;
import com.example.backend.model.PresentationRecovery;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service @Transactional(readOnly=true)
public class PresentationDisplayProfiles {
    @PersistenceContext private EntityManager em;
    private final ObjectMapper json;
    public PresentationDisplayProfiles(ObjectMapper json){this.json=json;}
    public ObjectNode metadata() {
        var out=json.createObjectNode();out.putArray("displayProfiles");out.putArray("profileExceptions");
        var row=em.find(PresentationRecovery.class,PresentationProfilePatch.ID);
        if(row==null||em.find(PresentationRecovery.class,PresentationProfilePatch.ID+".rollback")!=null)return out;
        try {
            var plan=json.readTree(row.getPayload());PresentationProfilePatch.validate(plan);
            var originals=new HashMap<Long,JsonNode>();
            var base=em.find(PresentationRecovery.class,"beautylink-presentation-20261031");
            if(base!=null)json.readTree(base.getPayload()).path("data").path("users").forEach(u->originals.put(u.path("id").asLong(),u));
            @SuppressWarnings("unchecked") List<Object[]> live=em.createQuery("select u.id,u.fullName,u.email,u.role from UserAccount u").getResultList();
            for(var u:live)originals.put((Long)u[0],json.createObjectNode().put("id",(Long)u[0]).put("fullName",(String)u[1]).put("email",(String)u[2]).put("role",u[3].toString()));
            var owners=new HashSet<Long>();for(Object id:em.createQuery("select s.owner.id from Supplier s").getResultList())owners.add(((Number)id).longValue());
            var candidates=new HashMap<Long,JsonNode>();
            for(var p:plan.path("profiles")) {
                long id=p.path("id").asLong();var original=originals.get(id);
                if(PresentationProfilePatch.matches(p,original)&&p.path("source").asText().equals(PresentationProfilePatch.source(original,owners)))candidates.put(id,p);
                else out.withArray("profileExceptions").addObject().put("id",id).put("reason","SOURCE_CHANGED");
            }
            // A later real account may claim an alias: keep its real contact and suppress conflicting display aliases.
            boolean changed;
            do {
                changed=false;var keys=new HashMap<String,List<Long>>();
                for(var e:originals.entrySet()) {var profile=candidates.get(e.getKey());String email=(profile==null?e.getValue():profile).path("email").asText("");if(!email.isBlank())keys.computeIfAbsent(PresentationProfilePatch.canonical(email),k->new ArrayList<>()).add(e.getKey());}
                for(var ids:keys.values())if(ids.size()>1)for(Long id:ids)if(candidates.remove(id)!=null){changed=true;out.withArray("profileExceptions").addObject().put("id",id).put("reason","EMAIL_COLLISION");}
            }while(changed);
            candidates.values().stream().sorted(Comparator.comparingLong(p->p.path("id").asLong())).forEach(p->out.withArray("displayProfiles").add(p));
            out.set("returningCustomerIds",plan.path("returningCustomerIds"));out.set("profilePlanExceptions",plan.path("exceptions"));out.put("profileVersion",1);
            return out;
        }catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException("Invalid display profile partition",e);}
    }
    public Map<Long,JsonNode> profiles(){var map=new HashMap<Long,JsonNode>();metadata().path("displayProfiles").forEach(p->map.put(p.path("id").asLong(),p));return map;}
    public void decorate(ObjectNode data) {
        var metadata=metadata();metadata.fields().forEachRemaining(e->data.set(e.getKey(),e.getValue()));
        var profiles=new HashMap<Long,JsonNode>();metadata.path("displayProfiles").forEach(p->profiles.put(p.path("id").asLong(),p));
        var names=new HashMap<Long,String>();
        @SuppressWarnings("unchecked") List<Object[]> live=em.createQuery("select u.id,u.fullName from UserAccount u").getResultList();for(var u:live)names.put((Long)u[0],(String)u[1]);
        for(var node:data.path("users")){var u=(ObjectNode)node;var p=profiles.get(u.path("id").asLong());if(p!=null){u.put("fullName",p.path("fullName").asText());u.put("email",p.path("email").asText());if(p.has("reportCreatedAt"))u.put("createdAt",p.path("reportCreatedAt").asText());}names.putIfAbsent(u.path("id").asLong(),u.path("fullName").asText());}
        profiles.forEach((id,p)->names.put(id,p.path("fullName").asText()));
        for(var node:data.path("bookings")){var b=(ObjectNode)node;String name=names.get(b.path("customerId").asLong());if(name!=null)b.put("customerName",name);}
        // Recovery owner labels are overwritten only via actual suppliers.owner_user_id.
        @SuppressWarnings("unchecked") List<Object[]> owners=em.createQuery("select s.id,s.owner.id,s.owner.fullName,s.owner.email,s.verificationStatus,s.owner.status from Supplier s").getResultList();
        var byId=new HashMap<Long,Object[]>();owners.forEach(o->byId.put((Long)o[0],o));
        for(var node:data.path("salons")){var s=(ObjectNode)node;var owner=byId.get(s.path("id").asLong());if(owner==null)continue;var p=profiles.get((Long)owner[1]);s.put("ownerUserId",(Long)owner[1]);s.put("ownerName",p==null?(String)owner[2]:p.path("fullName").asText());s.put("ownerEmail",p==null?(String)owner[3]:p.path("email").asText());}
    }
}
