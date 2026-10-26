package com.example.backend.service;

import com.example.backend.dto.AdminPartnerEditDtos.*;
import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.model.DomainEnums.*;
import com.example.backend.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

@Service @Transactional(readOnly=true)
public class AdminPartnerEditService {
    @PersistenceContext private EntityManager em;
    private final SupplierAccountService accounts; private final ScheduleService schedules; private final WorkforceService workforce; private final ObjectMapper json;
    public AdminPartnerEditService(SupplierAccountService accounts,ScheduleService schedules,WorkforceService workforce,ObjectMapper json) {this.accounts=accounts;this.schedules=schedules;this.workforce=workforce;this.json=json;}
    private Supplier salon(UserAccount actor,Long id,boolean lock) {
        if(actor.getRole()!=Role.ADMIN||actor.getStatus()!=AccountStatus.ACTIVE) throw new ApiException(HttpStatus.FORBIDDEN,"ADMIN_REQUIRED","Chỉ quản trị viên đang hoạt động được phép chỉnh sửa.");
        Supplier s=em.find(Supplier.class,id); if(s==null||s.isDemoData()||s.getOwner().getRole()!=Role.SUPPLIER) throw new ApiException(HttpStatus.NOT_FOUND,"SUPPLIER_NOT_FOUND","Không tìm thấy đối tác.");
        if(lock) em.refresh(s,LockModeType.PESSIMISTIC_WRITE); return s;
    }
    private String revision(Object data) {
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(data)));} catch(Exception e){throw new IllegalStateException("Cannot produce edit revision",e);}
    }
    private <T> Snapshot<T> snapshot(T data) {return new Snapshot<>(data,revision(data));}
    private void expected(String expected,Object data) {if(!revision(data).equals(expected)) throw new ApiException(HttpStatus.CONFLICT,"PROFILE_CHANGED","Dữ liệu đã thay đổi. Tải lại trước khi lưu.");}
    private void audit(UserAccount actor,Supplier salon,String action,Long entityId) {
        em.flush(); SupportReport r=new SupportReport(); r.setReporter(em.getReference(UserAccount.class,actor.getId()));r.setAssignedStaff(em.getReference(UserAccount.class,actor.getId()));
        r.setTargetType(ReportTargetType.SUPPLIER);r.setTargetId(salon.getId());r.setReason("ADMIN-PROFILE-AUDIT:PARTNER_"+action);
        r.setDetails("actorId="+actor.getId()+"; supplierId="+salon.getId()+"; entityId="+entityId+"; action="+action);r.setStatus(ReportStatus.RESOLVED);r.setResolutionNote("Authorized partner edit");r.setResolvedAt(Instant.now());em.persist(r);em.flush();
    }
    public Snapshot<SupplierResponse> profile(UserAccount actor,Long id) {var s=salon(actor,id,false);return snapshot(accounts.profile(s.getOwner()));}
    @Transactional public Snapshot<SupplierResponse> profile(UserAccount actor,Long id,ProfileWrite request) {
        var s=salon(actor,id,true);var old=accounts.profile(s.getOwner());expected(request.expectedRevision(),old);var p=request.data();
        Location location=p.locationId()==null?null:em.find(Location.class,p.locationId());
        if(p.locationId()!=null&&(location==null||!location.isActive())) throw new ApiException(HttpStatus.BAD_REQUEST,"LOCATION_NOT_FOUND","Khu vực không hợp lệ.");
        s.setName(p.name().strip());s.setBusinessType(p.businessType().strip());s.setDescription(p.description()==null?null:p.description().strip());s.setAddressLine(p.addressLine().strip());s.setLocation(location);s.setLatitude(p.latitude());s.setLongitude(p.longitude());s.setImageUrl(accounts.normalizeImageSource(p.imageUrl(),actor.getId()));
        audit(actor,s,"PROFILE",id);return snapshot(accounts.profile(s.getOwner()));
    }
    private ServiceOffering offering(Supplier s,Long id,boolean lock) {
        var o=em.find(ServiceOffering.class,id);if(o==null||!o.getSupplier().getId().equals(s.getId())) throw new ApiException(HttpStatus.NOT_FOUND,"SERVICE_NOT_FOUND","Dịch vụ không thuộc salon.");if(lock)em.refresh(o,LockModeType.PESSIMISTIC_WRITE);return o;
    }
    public Snapshot<SupplierServiceResponse> service(UserAccount actor,Long sid,Long id) {return snapshot(accounts.serviceResponse(offering(salon(actor,sid,false),id,false)));}
    @Transactional public Snapshot<SupplierServiceResponse> service(UserAccount actor,Long sid,Long id,ServiceWrite request) {
        var s=salon(actor,sid,false);var o=offering(s,id,true);expected(request.expectedRevision(),accounts.serviceResponse(o));boolean featured=o.isFeatured();var approval=s.getVerificationStatus();boolean fresh=s.isNewPartner(),near=s.isNearbyFeatured();
        var saved=accounts.updateService(s.getOwner(),id,request.data());o.setFeatured(featured);s.setVerificationStatus(approval);s.setNewPartner(fresh);s.setNearbyFeatured(near);
        audit(actor,s,"SERVICE",id);em.refresh(o);return snapshot(accounts.serviceResponse(o));
    }
    private Practitioner person(Supplier s,Long id,boolean lock) {
        var p=em.find(Practitioner.class,id);if(p==null||!p.getSupplier().getId().equals(s.getId())) throw new ApiException(HttpStatus.NOT_FOUND,"PRACTITIONER_NOT_FOUND","Chuyên viên không thuộc salon.");if(lock)em.refresh(p,LockModeType.PESSIMISTIC_WRITE);return p;
    }
    private SupplierPractitionerResponse personData(Practitioner p) {return new SupplierPractitionerResponse(p.getId(),p.getDisplayName(),p.getSpecialty(),p.getAvatarUrl(),p.getBio(),p.isActive(),p.isServiceAssignmentsRestricted(),p.getSupportedServices().stream().map(ServiceOffering::getId).collect(java.util.stream.Collectors.toCollection(TreeSet::new)));}
    public Snapshot<SupplierPractitionerResponse> person(UserAccount actor,Long sid,Long id) {return snapshot(personData(person(salon(actor,sid,false),id,false)));}
    @Transactional public Snapshot<SupplierPractitionerResponse> person(UserAccount actor,Long sid,Long id,PersonWrite request) {
        var s=salon(actor,sid,false);var p=person(s,id,true);expected(request.expectedRevision(),personData(p));
        accounts.updatePractitioner(s.getOwner(),id,request.data());if(p.isActive()!=request.active())workforce.status(s.getOwner(),id,new UpdatePractitionerStatusRequest(request.active()));
        if(request.serviceIds()!=null)workforce.assign(s.getOwner(),id,new UpdatePractitionerAssignmentsRequest(request.serviceIds()));
        audit(actor,s,"PRACTITIONER",id);return snapshot(personData(p));
    }
    public Snapshot<List<ScheduleRuleResponse>> schedule(UserAccount actor,Long sid,Long id) {var s=salon(actor,sid,false);person(s,id,false);return snapshot(schedules.get(s.getOwner(),id));}
    @Transactional public Snapshot<List<ScheduleRuleResponse>> schedule(UserAccount actor,Long sid,Long id,ScheduleWrite request) {
        var s=salon(actor,sid,false);person(s,id,true);expected(request.expectedRevision(),schedules.get(s.getOwner(),id));
        var result=schedules.replace(s.getOwner(),id,request.data());audit(actor,s,"SCHEDULE",id);return snapshot(result);
    }
}
