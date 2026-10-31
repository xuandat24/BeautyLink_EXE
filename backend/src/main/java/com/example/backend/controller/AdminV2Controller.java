package com.example.backend.controller;

import com.example.backend.dto.AdminV2Dtos.*;
import com.example.backend.dto.AdminDashboardDtos.AdminPageResponse;
import com.example.backend.model.DomainEnums.Role;
import com.example.backend.model.DomainEnums.BookingStatus;
import com.example.backend.dto.AdminDetailDtos.*;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import com.example.backend.service.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;

@RestController @RequestMapping("/api/v1/admin") @PreAuthorize("hasRole('ADMIN')")
public class AdminV2Controller {
    private final AdminInsightsService insights; private final AdminDirectoryService directory;
    private final AdminDetailService details; private final CurrentAccountService current;
    public AdminV2Controller(AdminInsightsService insights,AdminDirectoryService directory,AdminDetailService details,CurrentAccountService current) { this.insights=insights;this.directory=directory;this.details=details;this.current=current; }
    @GetMapping("/dashboard/insights") public Insights insights(
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue="false") boolean includeDemo,@RequestParam(defaultValue="DAY") Granularity granularity) {
        return insights.insights(from,to,includeDemo,granularity);
    }
    @GetMapping("/users") public AdminPageResponse<UserRow> users(@RequestParam(required=false) String query,@RequestParam(required=false) Role role,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size,@RequestParam(defaultValue="false") boolean forEdit) { return directory.users(query,role,page,size,forEdit); }
    @GetMapping("/salons") public AdminPageResponse<SalonRow> salons(@RequestParam(required=false) String query,@RequestParam(defaultValue="false") boolean includeDemo,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) { return directory.salons(query,includeDemo,page,size); }
    @GetMapping("/salons/{id}") public SalonDetail salon(@PathVariable Long id,@RequestParam(defaultValue="false") boolean includeDemo,@RequestParam(defaultValue="false") boolean headerOnly) { return headerOnly?details.salonHeader(id):directory.salon(id,includeDemo); }
    @GetMapping("/reviews") public AdminPageResponse<ReviewRow> reviews(@RequestParam(defaultValue="false") boolean includeDemo,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) { return directory.reviews(includeDemo,page,size); }
    @GetMapping("/users/{id}") public AccountDetail account(@PathVariable Long id) { return details.account(id); }
    @PatchMapping("/users/{id}/profile") public AccountDetail update(Authentication auth,@PathVariable Long id,@Valid @RequestBody ProfilePatch request) { return details.update(current.require(auth),id,request); }
    @GetMapping("/salons/{id}/services") public AdminPageResponse<ServiceDetail> services(@PathVariable Long id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) { return details.services(id,page,size); }
    @GetMapping("/salons/{id}/practitioners") public AdminPageResponse<PractitionerRow> people(@PathVariable Long id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) { return details.practitioners(id,page,size); }
    @GetMapping("/salons/{id}/practitioners/{personId}/schedule") public java.util.List<ScheduleRow> schedule(@PathVariable Long id,@PathVariable Long personId) { return details.schedule(id,personId); }
    @GetMapping("/salons/{id}/bookings") public AdminPageResponse<com.example.backend.dto.AdminDashboardDtos.AdminBookingResponse> bookings(@PathVariable Long id,@RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,@RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,@RequestParam(required=false) BookingStatus status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) { return details.bookings(id,from,to,status,page,size); }
    @GetMapping("/payments") public PaymentLedger payments(@RequestParam(required=false) Long salonId,@RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,@RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) { return details.payments(salonId,from,to,page,size); }
}
