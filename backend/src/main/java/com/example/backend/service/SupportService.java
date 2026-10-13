package com.example.backend.service;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.exception.ApiException;
import com.example.backend.model.*;
import com.example.backend.repository.SupportReportRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
public class SupportService {
    private final SupportReportRepository reports;
    public SupportService(SupportReportRepository reports) { this.reports = reports; }
    @Transactional public ReportResponse create(UserAccount reporter, CreateReportRequest request) {
        if (request.reason().trim().toUpperCase(Locale.ROOT).startsWith("PMT-AUDIT:"))
            throw new ApiException(HttpStatus.BAD_REQUEST, "RESERVED_REPORT_REASON", "Tiêu đề này dành cho nhật ký đối soát nội bộ.");
        SupportReport report = new SupportReport(); report.setReporter(reporter); report.setTargetType(request.targetType()); report.setTargetId(request.targetId()); report.setReason(request.reason()); report.setDetails(request.details()); return response(reports.save(report));
    }
    @Transactional(readOnly = true) public List<ReportResponse> list() { return reports.findAllByOrderByCreatedAtDesc().stream().map(this::response).toList(); }
    @Transactional public ReportResponse update(UserAccount staff, Long id, UpdateReportRequest request) {
        SupportReport report = reports.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "REPORT_NOT_FOUND", "Không tìm thấy báo cáo"));
        if (report.getReason().startsWith("PMT-AUDIT:"))
            throw new ApiException(HttpStatus.CONFLICT, "PAYMENT_AUDIT_IMMUTABLE", "Nhật ký đối soát không được sửa qua API báo cáo.");
        report.setStatus(request.status()); report.setAssignedStaff(staff); report.setResolutionNote(request.resolutionNote());
        if (request.status() == com.example.backend.model.DomainEnums.ReportStatus.RESOLVED || request.status() == com.example.backend.model.DomainEnums.ReportStatus.REJECTED) report.setResolvedAt(Instant.now());
        return response(report);
    }
    private ReportResponse response(SupportReport r) { return new ReportResponse(r.getId(), r.getTargetType(), r.getTargetId(), r.getReason(), r.getDetails(), r.getStatus(), r.getReporter().getFullName(), r.getAssignedStaff() == null ? null : r.getAssignedStaff().getFullName(), r.getResolutionNote(), r.getCreatedAt()); }
}
