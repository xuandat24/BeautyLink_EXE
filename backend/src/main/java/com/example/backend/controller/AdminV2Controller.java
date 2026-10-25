package com.example.backend.controller;

import com.example.backend.dto.AdminV2Dtos.*;
import com.example.backend.dto.AdminDashboardDtos.AdminPageResponse;
import com.example.backend.model.DomainEnums.Role;
import com.example.backend.service.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;

@RestController @RequestMapping("/api/v1/admin") @PreAuthorize("hasRole('ADMIN')")
public class AdminV2Controller {
    private final AdminInsightsService insights; private final AdminDirectoryService directory;
    public AdminV2Controller(AdminInsightsService insights,AdminDirectoryService directory) { this.insights=insights;this.directory=directory; }
    @GetMapping("/dashboard/insights") public Insights insights(
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue="false") boolean includeDemo,@RequestParam(defaultValue="DAY") Granularity granularity) {
        return insights.insights(from,to,includeDemo,granularity);
    }
    @GetMapping("/users") public AdminPageResponse<UserRow> users(@RequestParam(required=false) String query,@RequestParam(required=false) Role role,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) { return directory.users(query,role,page,size); }
    @GetMapping("/salons") public AdminPageResponse<SalonRow> salons(@RequestParam(required=false) String query,@RequestParam(defaultValue="false") boolean includeDemo,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) { return directory.salons(query,includeDemo,page,size); }
    @GetMapping("/salons/{id}") public SalonDetail salon(@PathVariable Long id,@RequestParam(defaultValue="false") boolean includeDemo) { return directory.salon(id,includeDemo); }
    @GetMapping("/reviews") public AdminPageResponse<ReviewRow> reviews(@RequestParam(defaultValue="false") boolean includeDemo,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) { return directory.reviews(includeDemo,page,size); }
}
