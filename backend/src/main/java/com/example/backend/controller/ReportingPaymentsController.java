package com.example.backend.controller;

import com.example.backend.dto.ReportingPaymentDtos.Summary;
import com.example.backend.service.*;
import com.example.backend.repository.SupplierRepository;
import com.example.backend.exception.ApiException;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;

@RestController @RequestMapping("/api/v1")
public class ReportingPaymentsController {
    private final ReportingPaymentsService payments; private final CurrentAccountService accounts; private final SupplierRepository suppliers;
    public ReportingPaymentsController(ReportingPaymentsService payments, CurrentAccountService accounts, SupplierRepository suppliers) { this.payments=payments;this.accounts=accounts;this.suppliers=suppliers; }
    @GetMapping("/admin/report-payments") @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Summary> admin(@RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required=false) Long salonId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(payments.summary(from,to,salonId,page,size));
    }
    @GetMapping("/supplier/report-payments") @PreAuthorize("hasRole('SUPPLIER')")
    public ResponseEntity<Summary> supplier(Authentication auth,@RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        var supplier=suppliers.findByOwnerId(accounts.require(auth).getId()).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"SUPPLIER_NOT_FOUND","Không tìm thấy đối tác."));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(payments.summary(from,to,supplier.getId(),page,size));
    }
}
