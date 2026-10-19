package com.example.backend.controller;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import com.example.backend.service.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/v1/supplier") @PreAuthorize("hasRole('SUPPLIER')")
public class SupplierController {
    private final CurrentAccountService current; private final SupplierRepository suppliers; private final PractitionerRepository practitioners; private final ScheduleService schedules; private final SupplierAccountService supplierAccounts; private final WorkforceService workforce;
    public SupplierController(CurrentAccountService current, SupplierRepository suppliers, PractitionerRepository practitioners, ScheduleService schedules, SupplierAccountService supplierAccounts, WorkforceService workforce) { this.current = current; this.suppliers = suppliers; this.practitioners = practitioners; this.schedules = schedules; this.supplierAccounts = supplierAccounts; this.workforce = workforce; }
    @GetMapping("/profile") public SupplierResponse profile(Authentication auth) { return supplierAccounts.profile(current.require(auth)); }
    @PutMapping("/profile") public SupplierResponse updateProfile(Authentication auth, @Valid @RequestBody UpdateSupplierProfileRequest request) { return supplierAccounts.updateProfile(current.require(auth), request); }
    @GetMapping("/services") public List<SupplierServiceResponse> services(Authentication auth) { return supplierAccounts.services(current.require(auth)); }
    @PostMapping("/services") @ResponseStatus(HttpStatus.CREATED) public SupplierServiceResponse createService(Authentication auth, @Valid @RequestBody UpsertSupplierServiceRequest request) { return supplierAccounts.createService(current.require(auth), request); }
    @PutMapping("/services/{id}") public SupplierServiceResponse updateService(Authentication auth, @PathVariable Long id, @Valid @RequestBody UpsertSupplierServiceRequest request) { return supplierAccounts.updateService(current.require(auth), id, request); }
    @DeleteMapping("/services/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void deactivateService(Authentication auth, @PathVariable Long id) { supplierAccounts.deactivateService(current.require(auth), id); }
    @GetMapping("/practitioners") public List<SupplierPractitionerResponse> practitioners(Authentication auth) {
        UserAccount owner = current.require(auth); Supplier supplier = suppliers.findByOwnerId(owner.getId()).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SUPPLIER_NOT_FOUND", "Không tìm thấy nhà cung cấp"));
        return workforce.list(owner, supplier.getId());
    }
    @PutMapping("/practitioners/{id}/assignments") public SupplierPractitionerResponse assignments(Authentication auth, @PathVariable Long id, @Valid @RequestBody UpdatePractitionerAssignmentsRequest request) { return workforce.assign(current.require(auth), id, request); }
    @PutMapping("/practitioners/{id}/status") public SupplierPractitionerResponse status(Authentication auth, @PathVariable Long id, @Valid @RequestBody UpdatePractitionerStatusRequest request) { return workforce.status(current.require(auth), id, request); }
    @GetMapping("/practitioners/{id}/schedule") public List<ScheduleRuleResponse> schedule(Authentication auth, @PathVariable Long id) { return schedules.get(current.require(auth), id); }
    @PostMapping("/practitioners") @ResponseStatus(HttpStatus.CREATED) public PractitionerResponse createPractitioner(Authentication auth, @Valid @RequestBody CreatePractitionerRequest request) { return supplierAccounts.createPractitioner(current.require(auth), request); }
    @PutMapping("/practitioners/{id}") public PractitionerResponse updatePractitioner(Authentication auth, @PathVariable Long id, @Valid @RequestBody CreatePractitionerRequest request) { return supplierAccounts.updatePractitioner(current.require(auth), id, request); }
    @PutMapping("/practitioners/{id}/schedule") public List<ScheduleRuleResponse> replaceSchedule(Authentication auth, @PathVariable Long id, @Valid @RequestBody ReplaceScheduleRequest request) { return schedules.replace(current.require(auth), id, request); }
}
