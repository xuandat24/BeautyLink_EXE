package com.example.backend.community;
import com.example.backend.model.*;
import com.example.backend.repository.BookingReviewRepository;
import com.example.backend.exception.ApiException;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import java.util.*;
import java.net.URI;
import static com.example.backend.model.DomainEnums.*;
import static com.example.backend.community.CommunityDtos.*;

@Component
public class CommunityCatalog {
    private final EntityManager em; private final BookingReviewRepository reviews;
    public CommunityCatalog(EntityManager em,BookingReviewRepository reviews){this.em=em;this.reviews=reviews;}
    public boolean visible(ServiceOffering s){return s!=null && s.isActive() && verified(s.getSupplier());}
    public boolean verified(Supplier s){return s!=null && !s.isDemoData() && s.getVerificationStatus()==VerificationStatus.VERIFIED && s.getOwner().getStatus()==AccountStatus.ACTIVE;}
    public ServiceOffering service(Long id){
        if(id==null)return null;
        return em.createQuery("select s from ServiceOffering s join fetch s.supplier sup join fetch sup.owner join fetch s.category where s.id=:id",ServiceOffering.class)
                .setParameter("id",id).getResultStream().filter(this::visible).findFirst().orElseThrow(()->new ApiException(HttpStatus.BAD_REQUEST,"COMMUNITY_SERVICE_INVALID","Dịch vụ không còn công khai hoặc chưa được duyệt."));
    }
    public List<ServiceOffering> search(String q,int size){
        return em.createQuery("select s from ServiceOffering s join fetch s.supplier sup join fetch sup.owner join fetch s.category where s.active=true and sup.demoData=false and sup.verificationStatus=:verified and sup.owner.status=:active and (lower(s.name) like :q escape '!' or lower(sup.name) like :q escape '!') order by s.id desc",ServiceOffering.class)
                .setParameter("verified",VerificationStatus.VERIFIED).setParameter("active",AccountStatus.ACTIVE).setParameter("q",like(q)).setMaxResults(size).setHint("jakarta.persistence.query.timeout",3000).getResultList();
    }
    public Map<Long,ServiceCard> cards(Collection<ServiceOffering> offerings){
        var available=offerings.stream().filter(this::visible).collect(java.util.stream.Collectors.toMap(ServiceOffering::getId,s->s,(a,b)->a));
        if(available.isEmpty())return Map.of();
        var ratings=reviews.publicStatsByServiceIds(available.keySet(),ReviewTargetType.SERVICE);
        Map<Long,Object[]> stats=new HashMap<>();ratings.forEach(r->stats.put((Long)r[0],r));
        Map<Long,ServiceCard> result=new HashMap<>();available.forEach((id,s)->{var r=stats.get(id);result.put(id,new ServiceCard(id,s.getName(),s.getSupplier().getName(),image(s.getImageUrl()),s.getPrice(),s.getDurationMinutes(),r==null?0:Math.round(((Number)r[2]).doubleValue()*10)/10.0,r==null?0:((Number)r[1]).longValue()));});return result;
    }
    static String like(String q){return "%"+q.trim().toLowerCase(Locale.ROOT).replace("!","!!").replace("%","!%").replace("_","!_")+"%";}
    public static String image(String value){
        if(value==null || value.length()>1000)return null;
        try{var uri=URI.create(value);return "https".equals(uri.getScheme()) && uri.getRawUserInfo()==null && uri.getPort()==-1 && Set.of("res.cloudinary.com","images.unsplash.com","lh3.googleusercontent.com","beautylink.cloud").contains(uri.getHost()) ? value:null;}catch(IllegalArgumentException ex){return null;}
    }
}
