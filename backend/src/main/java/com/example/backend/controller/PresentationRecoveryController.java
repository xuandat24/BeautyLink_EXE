package com.example.backend.controller;

import com.example.backend.service.CurrentAccountService;
import com.example.backend.service.PresentationRecoveryService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class PresentationRecoveryController {
    private final PresentationRecoveryService recovery;
    private final CurrentAccountService accounts;
    public PresentationRecoveryController(PresentationRecoveryService recovery, CurrentAccountService accounts) { this.recovery = recovery; this.accounts = accounts; }
    @GetMapping("/admin/presentation") @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<JsonNode> admin() {
        var data = recovery.data();
        return data == null ? ResponseEntity.noContent().build() : ResponseEntity.ok().header("Cache-Control", "private, no-store").body(data);
    }
    @GetMapping("/supplier/presentation-bookings") @PreAuthorize("hasRole('SUPPLIER')")
    public List<JsonNode> supplier(Authentication auth) { return recovery.supplierBookings(accounts.require(auth)); }
}
