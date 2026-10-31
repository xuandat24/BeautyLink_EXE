package com.example.backend.service;

import com.example.backend.dto.AdminV2Dtos.*;
import com.example.backend.dto.AdminDashboardDtos.AdminPageResponse;
import com.example.backend.exception.ApiException;
import com.example.backend.model.DomainEnums.*;
import com.example.backend.repository.*;
import jakarta.persistence.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@Service @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class AdminDirectoryService {
    @PersistenceContext private EntityManager em;
    private final BookingRepository bookings;
    private final BookingReviewRepository reviews;
    private final AdminDashboardService dashboard;
    private final PresentationDisplayProfiles profiles;
    public AdminDirectoryService(BookingRepository bookings, BookingReviewRepository reviews, AdminDashboardService dashboard, PresentationDisplayProfiles profiles) {
        this.bookings = bookings; this.reviews = reviews; this.dashboard = dashboard; this.profiles = profiles;
    }
    private static void page(int page, int size) {
        if (page < 0 || size < 1 || size > 100 || page > 100000) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGE", "Trang phải từ 0 và kích thước từ 1 đến 100.");
    }
    private static String search(String value) {
        if (value != null && value.length() > 120) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SEARCH", "Tìm kiếm tối đa 120 ký tự.");
        return "%" + (value == null ? "" : value.strip().toLowerCase(Locale.ROOT)) + "%";
    }
    public AdminPageResponse<UserRow> users(String query, Role role, int page, int size) {
        return users(query,role,page,size,false);
    }
    public AdminPageResponse<UserRow> users(String query, Role role, int page, int size, boolean forEdit) {
        page(page,size);search(query);var mapping=forEdit?Map.<Long,com.fasterxml.jackson.databind.JsonNode>of():profiles.profiles();
        List<Object[]> rows=userRows(role);
        var result=rows.stream().map(r->{var p=mapping.get((Long)r[0]);return new UserRow((Long)r[0],p==null?(String)r[1]:p.path("fullName").asText(),p==null?(String)r[2]:p.path("email").asText(),(Role)r[3],(AccountStatus)r[4],(Instant)r[5]);})
            .filter(u->matches(u.fullName()+" "+u.email(),query)).sorted((a,b)->{int c=VietnameseDirectoryOrder.compare(a.fullName(),b.fullName());return c!=0?c:a.id().compareTo(b.id());}).toList();
        return slice(result,page,size);
    }
    @SuppressWarnings("unchecked") private List<Object[]> userRows(Role role) {
        var q=em.createQuery("select u.id,u.fullName,u.email,u.role,u.status,u.createdAt from UserAccount u"+(role==null?"":" where u.role=:role"));if(role!=null)q.setParameter("role",role);return q.getResultList();
    }
    private static boolean matches(String value,String query){return fold(value).contains(fold(query));}
    private static String fold(String value){return java.text.Normalizer.normalize(VietnameseDirectoryOrder.clean(value),java.text.Normalizer.Form.NFD).replaceAll("\\p{M}","").replace('đ','d').replace('Đ','D').toLowerCase(Locale.ROOT);}
    private static <T> AdminPageResponse<T> slice(List<T> rows,int page,int size){int start=Math.min(page*size,rows.size());return paged(rows.subList(start,Math.min(start+size,rows.size())),rows.size(),page,size);}
    private static final String SALON = "select s.id,s.name,s.owner.fullName,s.owner.email,s.businessType,l.name,s.addressLine,s.verificationStatus,s.owner.status,"
            + "(select count(o) from ServiceOffering o where o.supplier=s), (select count(p) from Practitioner p where p.supplier=s), (select count(b) from Booking b where b.supplier=s),s.owner.id from Supplier s left join s.location l";
    private SalonRow salon(Object[] r) {
        return new SalonRow((Long)r[0],(String)r[1],(String)r[2],(String)r[3],(String)r[4],(String)r[5],(String)r[6],(VerificationStatus)r[7],r[7] == VerificationStatus.VERIFIED && r[8] == AccountStatus.ACTIVE,
                ((Number)r[9]).longValue(),((Number)r[10]).longValue(),((Number)r[11]).longValue(),(Long)r[12]);
    }
    public AdminPageResponse<SalonRow> salons(String query, boolean demo, int page, int size) {
        page(page,size);search(query);
        @SuppressWarnings("unchecked") List<Object[]> rows=em.createQuery(SALON+" where (:demo=true or s.demoData=false)").setParameter("demo",demo).getResultList();
        var mapping=profiles.profiles();var result=rows.stream().map(this::salon).map(s->{var p=mapping.get(s.ownerUserId());return p==null?s:new SalonRow(s.id(),s.name(),p.path("fullName").asText(),p.path("email").asText(),s.businessType(),s.location(),s.address(),s.approvalStatus(),s.active(),s.serviceCount(),s.practitionerCount(),s.bookingCount(),s.ownerUserId());})
            .filter(s->matches(s.name()+" "+s.ownerName()+" "+s.ownerEmail(),query)).sorted((a,b)->{int c=VietnameseDirectoryOrder.compare(a.name(),b.name());return c!=0?c:a.id().compareTo(b.id());}).toList();return slice(result,page,size);
    }
    public SalonDetail salon(Long id, boolean demo) {
        @SuppressWarnings("unchecked") List<Object[]> result=em.createQuery(SALON+" where s.id=:id and (:demo=true or s.demoData=false)").setParameter("id",id).setParameter("demo",demo).getResultList();
        if(result.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND,"SALON_NOT_FOUND","Không tìm thấy salon.");
        List<ServiceRow> services=em.createQuery("select new com.example.backend.dto.AdminV2Dtos$ServiceRow(s.id,s.name,s.price,s.durationMinutes,s.active) from ServiceOffering s where s.supplier.id=:id order by s.id",ServiceRow.class).setParameter("id",id).setMaxResults(100).getResultList();
        List<PractitionerRow> people=em.createQuery("select new com.example.backend.dto.AdminV2Dtos$PractitionerRow(p.id,p.displayName,p.specialty,p.active) from Practitioner p where p.supplier.id=:id order by p.id",PractitionerRow.class).setParameter("id",id).setMaxResults(100).getResultList();
        List<ScheduleRow> schedules=people.isEmpty()?List.of():em.createQuery("select new com.example.backend.dto.AdminV2Dtos$ScheduleRow(a.practitioner.id,a.dayOfWeek,a.startTime,a.endTime,a.breakStart,a.breakEnd,a.active) from AvailabilityRule a where a.practitioner.id in :ids order by a.practitioner.id,a.dayOfWeek",ScheduleRow.class).setParameter("ids",people.stream().map(PractitionerRow::id).toList()).setMaxResults(700).getResultList();
        return new SalonDetail(displaySalon(salon(result.getFirst())),services,people,schedules,dashboard.mapBookings(bookings.findAdminSalonRecent(id,Role.CUSTOMER,PageRequest.of(0,10))));
    }
    public SalonRow salonsById(Long id) {
        @SuppressWarnings("unchecked") List<Object[]> rows=em.createQuery(SALON+" where s.id=:id and s.demoData=false").setParameter("id",id).getResultList();
        if(rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND,"SALON_NOT_FOUND","Không tìm thấy salon.");
        return displaySalon(salon(rows.getFirst()));
    }
    private SalonRow displaySalon(SalonRow s) {
        var p=profiles.profiles().get(s.ownerUserId());return p==null?s:new SalonRow(s.id(),s.name(),p.path("fullName").asText(),p.path("email").asText(),s.businessType(),s.location(),s.address(),s.approvalStatus(),s.active(),s.serviceCount(),s.practitionerCount(),s.bookingCount(),s.ownerUserId());
    }
    public AdminPageResponse<ReviewRow> reviews(boolean demo,int page,int size) {
        page(page,size); var data=reviews.findAdminValid(demo,PageRequest.of(page,size));
        return paged(data.getContent().stream().map(r->new ReviewRow(r.getId(),r.getTargetType(),r.getSupplier().getName(),r.getService().getName(),r.getRating(),r.getComment(),r.getCreatedAt())).toList(),data.getTotalElements(),page,size);
    }
    private static <T> AdminPageResponse<T> paged(List<T> rows,long total,int page,int size) { return new AdminPageResponse<>(rows,total,(int)((total+size-1)/size),page,size); }
}
