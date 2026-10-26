package com.example.backend.controller;
import com.example.backend.dto.AdminPartnerEditDtos.*;
import com.example.backend.dto.ApiDtos.*;
import com.example.backend.service.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController @RequestMapping("/api/v1/admin/salons/{sid}") @PreAuthorize("hasRole('ADMIN')")
public class AdminPartnerEditController {
    private final AdminPartnerEditService edits;private final CurrentAccountService current;
    public AdminPartnerEditController(AdminPartnerEditService edits,CurrentAccountService current){this.edits=edits;this.current=current;}
    @GetMapping("/edit") public Snapshot<SupplierResponse> profile(Authentication a,@PathVariable Long sid){return edits.profile(current.require(a),sid);}
    @PutMapping("/edit") public Snapshot<SupplierResponse> profile(Authentication a,@PathVariable Long sid,@Valid @RequestBody ProfileWrite r){return edits.profile(current.require(a),sid,r);}
    @GetMapping("/services/{id}/edit") public Snapshot<SupplierServiceResponse> service(Authentication a,@PathVariable Long sid,@PathVariable Long id){return edits.service(current.require(a),sid,id);}
    @PutMapping("/services/{id}/edit") public Snapshot<SupplierServiceResponse> service(Authentication a,@PathVariable Long sid,@PathVariable Long id,@Valid @RequestBody ServiceWrite r){return edits.service(current.require(a),sid,id,r);}
    @GetMapping("/practitioners/{id}/edit") public Snapshot<SupplierPractitionerResponse> person(Authentication a,@PathVariable Long sid,@PathVariable Long id){return edits.person(current.require(a),sid,id);}
    @PutMapping("/practitioners/{id}/edit") public Snapshot<SupplierPractitionerResponse> person(Authentication a,@PathVariable Long sid,@PathVariable Long id,@Valid @RequestBody PersonWrite r){return edits.person(current.require(a),sid,id,r);}
    @GetMapping("/practitioners/{id}/schedule/edit") public Snapshot<List<ScheduleRuleResponse>> schedule(Authentication a,@PathVariable Long sid,@PathVariable Long id){return edits.schedule(current.require(a),sid,id);}
    @PutMapping("/practitioners/{id}/schedule/edit") public Snapshot<List<ScheduleRuleResponse>> schedule(Authentication a,@PathVariable Long sid,@PathVariable Long id,@Valid @RequestBody ScheduleWrite r){return edits.schedule(current.require(a),sid,id,r);}
}
