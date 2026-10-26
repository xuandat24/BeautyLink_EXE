package com.example.backend.service;

import com.example.backend.dto.AdminDetailDtos.*;
import com.example.backend.dto.AdminDashboardDtos.*;
import com.example.backend.dto.AdminV2Dtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.model.DomainEnums.*;
import com.example.backend.repository.*;
import jakarta.persistence.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.*;
import org.slf4j.LoggerFactory;
import java.time.*;
import java.math.BigDecimal;
import java.util.*;

@Service @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
public class AdminDetailService {
    @PersistenceContext private EntityManager em;
    private final AdminDirectoryService directory;
    private final AdminDashboardService dashboard;
    private final UserAccountRepository users;
    public AdminDetailService(AdminDirectoryService directory, AdminDashboardService dashboard, UserAccountRepository users) {
        this.directory=directory; this.dashboard=dashboard; this.users=users;
    }
    private static void page(int page,int size) {
        if(page<0||page>100000||size<1||size>100) throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_PAGE","Kích thước trang từ 1 đến 100.");
    }
    private static <T> AdminPageResponse<T> paged(List<T> rows,long total,int page,int size) { return new AdminPageResponse<>(rows,total,(int)((total+size-1)/size),page,size); }
    public AccountDetail account(Long id) {
        UserAccount u=users.findById(id).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"USER_NOT_FOUND","Không tìm thấy tài khoản."));
        List<OwnedSalon> salons=em.createQuery("select new com.example.backend.dto.AdminDetailDtos$OwnedSalon(s.id,s.name,s.verificationStatus) from Supplier s where s.owner.id=:id and s.demoData=false order by s.id",OwnedSalon.class).setParameter("id",id).setMaxResults(100).getResultList();
        return new AccountDetail(u.getId(),u.getFullName(),u.getEmail(),u.getPhone(),u.getGender(),u.getDateOfBirth(),u.getRole(),u.getStatus(),u.getCreatedAt(),u.getUpdatedAt(),salons);
    }
    @Transactional
    public AccountDetail update(UserAccount actor,Long id,ProfilePatch request) {
        if(actor.getRole()!=Role.ADMIN||actor.getStatus()!=AccountStatus.ACTIVE) throw new ApiException(HttpStatus.FORBIDDEN,"ADMIN_REQUIRED","Chỉ quản trị viên được phép sửa hồ sơ.");
        UserAccount u=users.findLockedById(id).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"USER_NOT_FOUND","Không tìm thấy tài khoản."));
        em.refresh(u,LockModeType.PESSIMISTIC_WRITE);
        if(u.getRole()!=Role.CUSTOMER) throw new ApiException(HttpStatus.FORBIDDEN,"CUSTOMER_PROFILE_ONLY","Chỉ được chỉnh sửa hồ sơ khách hàng.");
        if(!u.getUpdatedAt().equals(request.expectedUpdatedAt())) throw new ApiException(HttpStatus.CONFLICT,"PROFILE_CHANGED","Hồ sơ đã thay đổi. Vui lòng tải lại trước khi lưu.");
        String name=request.fullName().strip().replaceAll("\\s+"," ");
        if(name.length()<2||(request.dateOfBirth()!=null&&request.dateOfBirth().getYear()<1900)) throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_PROFILE","Tên tối thiểu 2 ký tự; năm sinh từ 1900.");
        List<String> fields=new ArrayList<>();
        if(!Objects.equals(name,u.getFullName())) { u.setFullName(name); fields.add("fullName"); }
        if(request.gender()!=null&&request.gender()!=u.getGender()) { u.setGender(request.gender()); fields.add("gender"); }
        if(request.dateOfBirth()!=null&&!Objects.equals(request.dateOfBirth(),u.getDateOfBirth())) { u.setDateOfBirth(request.dateOfBirth()); fields.add("dateOfBirth"); }
        em.flush();
        if(!fields.isEmpty()) {
            SupportReport audit=new SupportReport(); audit.setReporter(em.getReference(UserAccount.class,actor.getId())); audit.setAssignedStaff(em.getReference(UserAccount.class,actor.getId()));
            audit.setTargetType(ReportTargetType.USER); audit.setTargetId(id); audit.setReason("ADMIN-PROFILE-AUDIT:UPDATE");
            audit.setDetails("actorId="+actor.getId()+"; targetId="+id+"; fields="+String.join(",",fields)+"; previousUpdatedAt="+request.expectedUpdatedAt()+"; updatedAt="+u.getUpdatedAt());
            audit.setStatus(ReportStatus.RESOLVED); audit.setResolutionNote("Scoped customer profile update"); audit.setResolvedAt(Instant.now()); em.persist(audit); em.flush();
        }
        if(!fields.isEmpty()) TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { LoggerFactory.getLogger(AdminDetailService.class).info("ADMIN_CUSTOMER_PROFILE_UPDATED actorId={} targetId={} fields={}",actor.getId(),id,String.join(",",fields)); }
        });
        return account(id);
    }
    public SalonDetail salonHeader(Long id) {
        // Existing endpoint/shape, without eager loading every tab's collections.
        var row=directory.salonsById(id);
        return new SalonDetail(row,List.of(),List.of(),List.of(),List.of());
    }
    private void salon(Long id) { directory.salonsById(id); }
    public AdminPageResponse<ServiceDetail> services(Long id,int page,int size) {
        page(page,size); salon(id);
        var rows=em.createQuery("select new com.example.backend.dto.AdminDetailDtos$ServiceDetail(s.id,s.name,s.category.name,s.price,s.durationMinutes,s.active) from ServiceOffering s where s.supplier.id=:id order by s.id",ServiceDetail.class).setParameter("id",id).setFirstResult(page*size).setMaxResults(size).getResultList();
        long count=em.createQuery("select count(s) from ServiceOffering s where s.supplier.id=:id",Long.class).setParameter("id",id).getSingleResult();
        return paged(rows,count,page,size);
    }
    public AdminPageResponse<PractitionerRow> practitioners(Long id,int page,int size) {
        page(page,size); salon(id);
        var rows=em.createQuery("select new com.example.backend.dto.AdminV2Dtos$PractitionerRow(p.id,p.displayName,p.specialty,p.active) from Practitioner p where p.supplier.id=:id order by p.id",PractitionerRow.class).setParameter("id",id).setFirstResult(page*size).setMaxResults(size).getResultList();
        long count=em.createQuery("select count(p) from Practitioner p where p.supplier.id=:id",Long.class).setParameter("id",id).getSingleResult();
        return paged(rows,count,page,size);
    }
    public List<ScheduleRow> schedule(Long id,Long practitionerId) {
        salon(id);
        long match=em.createQuery("select count(p) from Practitioner p where p.id=:pid and p.supplier.id=:id",Long.class).setParameter("pid",practitionerId).setParameter("id",id).getSingleResult();
        if(match==0) throw new ApiException(HttpStatus.NOT_FOUND,"PRACTITIONER_NOT_FOUND","Không tìm thấy chuyên viên trong salon.");
        return em.createQuery("select new com.example.backend.dto.AdminV2Dtos$ScheduleRow(a.practitioner.id,a.dayOfWeek,a.startTime,a.endTime,a.breakStart,a.breakEnd,a.active) from AvailabilityRule a where a.practitioner.id=:pid order by a.dayOfWeek",ScheduleRow.class).setParameter("pid",practitionerId).setMaxResults(7).getResultList();
    }
    public AdminPageResponse<AdminBookingResponse> bookings(Long id,LocalDate from,LocalDate to,BookingStatus status,int page,int size) {
        page(page,size); salon(id); var range=dashboard.range(from,to,false);
        String where=" where b.supplier.id=:id and b.customer.role=:role and b.createdAt>=:from and b.createdAt<:to"+(status==null?"":" and b.status=:status");
        TypedQuery<Booking> rows=em.createQuery("select b from Booking b join fetch b.customer join fetch b.supplier join fetch b.service join fetch b.practitioner"+where+" order by b.createdAt desc,b.id desc",Booking.class);
        TypedQuery<Long> count=em.createQuery("select count(b) from Booking b"+where,Long.class);
        for(Query q:List.of(rows,count)) { q.setParameter("id",id).setParameter("role",Role.CUSTOMER).setParameter("from",range.from()).setParameter("to",range.to()); if(status!=null) q.setParameter("status",status); }
        return paged(dashboard.mapBookings(rows.setFirstResult(page*size).setMaxResults(size).getResultList()),count.getSingleResult(),page,size);
    }
    public PaymentLedger payments(Long salonId,LocalDate from,LocalDate to,int page,int size) {
        page(page,size); if(salonId!=null) salon(salonId); var range=dashboard.range(from,to,false);
        String scope="b.customer.role=:customer and b.supplier.demoData=false"+(salonId==null?"":" and b.supplier.id=:id");
        String base=" from PaymentTransaction p join p.booking b where "+scope;
        String attempts=base+" and p.createdAt>=:from and p.createdAt<:to";
        String receipt=base+" and "+AdminReadRepository.PAID+" and p.paidAt>=:from and p.paidAt<:to";
        java.util.function.Function<String,Query> query=hql->{ Query q=em.createQuery(hql).setParameter("customer",Role.CUSTOMER).setParameter("from",range.from()).setParameter("to",range.to()); if(salonId!=null) q.setParameter("id",salonId); if(hql.contains(":paid"))q.setParameter("paid",PaymentTransactionStatus.PAID); return q; };
        @SuppressWarnings("unchecked") List<Object[]> rows=query.apply("select p.id,p.orderCode,b.id,b.bookingCode,b.supplier.name,p.paymentOption,p.status,p.amount,p.remainingAmount,p.createdAt,p.paidAt,p.requiresManualReview,case when "+AdminReadRepository.PAID+" then true else false end,b.paymentStatus"+attempts+" order by p.createdAt desc,p.id desc").setFirstResult(page*size).setMaxResults(size).getResultList();
        var result=rows.stream().map(r->new PaymentRow((Long)r[0],(Long)r[1],(Long)r[2],(String)r[3],(String)r[4],(PaymentOption)r[5],(PaymentTransactionStatus)r[6],(BigDecimal)r[7],(BigDecimal)r[8],(Instant)r[9],(Instant)r[10],(Boolean)r[11],(Boolean)r[12],(PaymentStatus)r[13])).toList();
        long total=((Number)query.apply("select count(p)"+attempts).getSingleResult()).longValue();
        BigDecimal verified=(BigDecimal)query.apply("select coalesce(sum(p.amount),0)"+receipt).getSingleResult();
        BigDecimal deposits=BigDecimal.ZERO,full=BigDecimal.ZERO,remaining=BigDecimal.ZERO;
        @SuppressWarnings("unchecked") List<Object[]> options=query.apply("select p.paymentOption,sum(p.amount),sum(p.remainingAmount)"+receipt+" group by p.paymentOption").getResultList();
        for(Object[] r:options) { if(r[0]==PaymentOption.FULL_100) full=full.add((BigDecimal)r[1]); else { deposits=deposits.add((BigDecimal)r[1]); remaining=remaining.add((BigDecimal)r[2]); } }
        long review=((Number)query.apply("select count(p)"+attempts+" and (p.requiresManualReview=true or p.status=com.example.backend.model.DomainEnums$PaymentTransactionStatus.REVIEW_REQUIRED)").getSingleResult()).longValue();
        long failed=((Number)query.apply("select count(p)"+attempts+" and p.status in (com.example.backend.model.DomainEnums$PaymentTransactionStatus.FAILED,com.example.backend.model.DomainEnums$PaymentTransactionStatus.EXPIRED)").getSingleResult()).longValue();
        return new PaymentLedger(verified,deposits,full,remaining,total,review,failed,paged(result,total,page,size));
    }
}
