package com.example.backend.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import static com.example.backend.model.DomainEnums.*;

@Entity
@Table(name = "bookings", uniqueConstraints = {
        @UniqueConstraint(name = "uk_booking_code", columnNames = "booking_code"),
        @UniqueConstraint(name = "uk_practitioner_slot", columnNames = {"practitioner_id", "appointment_date", "start_time"})
}, indexes = {@Index(name = "idx_booking_customer", columnList = "customer_id"), @Index(name = "idx_booking_supplier_date", columnList = "supplier_id,appointment_date")})
public class Booking {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, unique = true, length = 24) private String bookingCode;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "customer_id", nullable = false) private UserAccount customer;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "supplier_id", nullable = false) private Supplier supplier;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "service_id", nullable = false) private ServiceOffering service;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "practitioner_id", nullable = false) private Practitioner practitioner;
    @Column(nullable = false) private LocalDate appointmentDate;
    @Column(nullable = false) private LocalTime startTime;
    @Column(nullable = false) private LocalTime endTime;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal totalAmount;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private BookingStatus status = BookingStatus.CONFIRMED;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private PaymentStatus paymentStatus = PaymentStatus.UNPAID;
    @Column(length = 500) private String customerNote;
    @Column(nullable = false, updatable = false) private Instant createdAt = Instant.now();
    public Long getId() { return id; } public void setId(Long id) { this.id = id; }
    public String getBookingCode() { return bookingCode; } public void setBookingCode(String bookingCode) { this.bookingCode = bookingCode; }
    public UserAccount getCustomer() { return customer; } public void setCustomer(UserAccount customer) { this.customer = customer; }
    public Supplier getSupplier() { return supplier; } public void setSupplier(Supplier supplier) { this.supplier = supplier; }
    public ServiceOffering getService() { return service; } public void setService(ServiceOffering service) { this.service = service; }
    public Practitioner getPractitioner() { return practitioner; } public void setPractitioner(Practitioner practitioner) { this.practitioner = practitioner; }
    public LocalDate getAppointmentDate() { return appointmentDate; } public void setAppointmentDate(LocalDate appointmentDate) { this.appointmentDate = appointmentDate; }
    public LocalTime getStartTime() { return startTime; } public void setStartTime(LocalTime startTime) { this.startTime = startTime; }
    public LocalTime getEndTime() { return endTime; } public void setEndTime(LocalTime endTime) { this.endTime = endTime; }
    public BigDecimal getTotalAmount() { return totalAmount; } public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public BookingStatus getStatus() { return status; } public void setStatus(BookingStatus status) { this.status = status; }
    public PaymentStatus getPaymentStatus() { return paymentStatus; } public void setPaymentStatus(PaymentStatus paymentStatus) { this.paymentStatus = paymentStatus; }
    public String getCustomerNote() { return customerNote; } public void setCustomerNote(String customerNote) { this.customerNote = customerNote; }
    public Instant getCreatedAt() { return createdAt; }
}
