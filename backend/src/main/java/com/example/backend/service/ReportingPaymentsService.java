package com.example.backend.service;

import com.example.backend.dto.ReportingPaymentDtos.*;
import com.example.backend.dto.AdminDashboardDtos.AdminPageResponse;
import com.example.backend.model.DomainEnums.*;
import com.example.backend.repository.AdminReadRepository;
import com.example.backend.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static com.example.backend.repository.AdminReadRepository.*;

@Service @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
public class ReportingPaymentsService {
    private final AdminReadRepository read;
    private final AdminDashboardService dashboard;
    private final PresentationRecoveryService recovery;
    private final PresentationDisplayProfiles profiles;
    public ReportingPaymentsService(AdminReadRepository read, AdminDashboardService dashboard, PresentationRecoveryService recovery, PresentationDisplayProfiles profiles) {
        this.read=read; this.dashboard=dashboard; this.recovery=recovery; this.profiles=profiles;
    }
    public Summary summary(LocalDate from, LocalDate to, Long supplierId, int page, int size) {
        if(page<0 || page>100000 || size<1 || size>100) throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_PAGE","Kích thước trang từ 1 đến 100.");
        var requested=dashboard.range(from,to,false); var asOf=Instant.now();
        var cutoff=requested.to().isBefore(asOf)?requested.to():asOf;
        var range=new AdminDashboardService.Range(requested.fromDate(),requested.toDate(),requested.from(),cutoff,false);
        var rows=new ArrayList<Row>();
        var mapping=profiles.profiles();
        read.rows("select p.id,b.id,b.bookingCode,b.customer.id,b.customer.fullName,b.supplier.id,b.supplier.name,b.service.id,b.service.name,b.practitioner.id,b.practitioner.displayName,b.appointmentDate,b.startTime,b.endTime,b.status,b.createdAt,b.totalAmount,p.paymentOption,p.amount,p.remainingAmount,p.paidAt from PaymentTransaction p join p.booking b where "+PAYMENT_PERIOD+" and "+PAID,range,Integer.MAX_VALUE)
            .forEach(r->{ if(supplierId==null || supplierId.equals(r[5])) rows.add(new Row("payos:"+r[0],"VERIFIED",null,(Long)r[1],(String)r[2],(Long)r[3],mapping.containsKey((Long)r[3])?mapping.get((Long)r[3]).path("fullName").asText():(String)r[4],(Long)r[5],(String)r[6],(Long)r[7],(String)r[8],(Long)r[9],(String)r[10],(LocalDate)r[11],(LocalTime)r[12],(LocalTime)r[13],(BookingStatus)r[14],(Instant)r[15],(BigDecimal)r[16],(PaymentOption)r[17],(BigDecimal)r[18],(BigDecimal)r[19],(Instant)r[20])); });
        var reportSuppliers=new HashSet<Long>();
        for(Object id:read.query("select s.id from Supplier s where s.demoData=false",range).getResultList()) reportSuppliers.add(((Number)id).longValue());
        recovery.reportingPayments().stream().filter(p->reportSuppliers.contains(p.supplierId()) && !p.paidAt().isBefore(range.from()) && p.paidAt().isBefore(range.to()) && (supplierId==null || supplierId.equals(p.supplierId()))).forEach(rows::add);
        rows.sort(Comparator.comparing(Row::paidAt).reversed().thenComparing(Row::id));
        BigDecimal total=BigDecimal.ZERO,deposits=BigDecimal.ZERO,full=BigDecimal.ZERO,verified=BigDecimal.ZERO,simulated=BigDecimal.ZERO,remaining=BigDecimal.ZERO;
        var bookings=new HashSet<Long>();
        for(var row:rows) {
            total=total.add(row.amount()); bookings.add(row.bookingId());
            if(row.paymentOption()==PaymentOption.FULL_100) full=full.add(row.amount()); else { deposits=deposits.add(row.amount()); remaining=remaining.add(row.remainingAmount()); }
            if(row.source().equals("VERIFIED")) verified=verified.add(row.amount()); else simulated=simulated.add(row.amount());
        }
        int start=Math.min(page*size,rows.size()),end=Math.min(start+size,rows.size());
        return new Summary(total,deposits,full,verified,simulated,remaining,rows.size(),bookings.size(),asOf,
                new AdminPageResponse<>(List.copyOf(rows.subList(start,end)),rows.size(),(rows.size()+size-1)/size,page,size));
    }
}
