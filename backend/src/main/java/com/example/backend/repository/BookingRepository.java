package com.example.backend.repository;
import com.example.backend.model.Booking;
import com.example.backend.model.DomainEnums.BookingStatus;
import com.example.backend.model.DomainEnums.PaymentStatus;
import com.example.backend.model.DomainEnums.PaymentTransactionStatus;
import com.example.backend.model.DomainEnums.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
public interface BookingRepository extends JpaRepository<Booking, Long> {
    @Query("select b from Booking b join fetch b.customer join fetch b.supplier join fetch b.service join fetch b.practitioner where b.supplier.id = :supplierId and b.customer.role = :role order by b.createdAt desc, b.id desc")
    List<Booking> findAdminSalonRecent(@Param("supplierId") Long supplierId, @Param("role") Role role, Pageable pageable);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from Booking b where b.id = :id")
    Optional<Booking> findByIdForUpdate(@Param("id") Long id);
    List<Booking> findByCustomerIdOrderByAppointmentDateDescStartTimeDesc(Long customerId);
    boolean existsByCustomerId(Long customerId);
    List<Booking> findBySupplierIdOrderByAppointmentDateDescStartTimeDesc(Long supplierId);
    boolean existsByPractitionerIdAndAppointmentDateAndStartTimeAndStatusNot(Long practitionerId, LocalDate date, LocalTime startTime, BookingStatus status);
    boolean existsByPractitionerIdAndAppointmentDateAndStartTimeAndStatusNotAndIdNot(Long practitionerId, LocalDate date, LocalTime startTime, BookingStatus status, Long id);
    List<Booking> findByPractitionerIdAndAppointmentDateAndStatusNot(Long practitionerId, LocalDate date, BookingStatus status);
    List<Booking> findByPractitionerIdAndAppointmentDateBetweenAndStatusNot(Long practitionerId, LocalDate first, LocalDate last, BookingStatus status);
    List<Booking> findByPractitionerIdAndAppointmentDateGreaterThanEqualAndStatusNot(Long practitionerId, LocalDate date, BookingStatus status);
    @Query("select b.id from Booking b where b.status = :pending and b.paymentStatus = :unpaid " +
            "and b.createdAt < :before and not exists (select p.id from PaymentTransaction p where p.booking = b) order by b.createdAt, b.id")
    List<Long> findUnpaidUnstartedHoldIds(@Param("pending") BookingStatus pending,
            @Param("unpaid") PaymentStatus unpaid, @Param("before") Instant before, Pageable pageable);

    @Query("select count(b) from Booking b where b.createdAt >= :from and b.createdAt < :to " +
            "and b.customer.role = :customerRole and (:includeDemo = true or b.supplier.demoData = false)")
    long countAdminBookings(@Param("from") Instant from, @Param("to") Instant to,
            @Param("customerRole") Role customerRole, @Param("includeDemo") boolean includeDemo);

    @Query("select count(distinct b.customer.id) from Booking b where b.createdAt >= :from and b.createdAt < :to " +
            "and b.customer.role = :customerRole and (:includeDemo = true or b.supplier.demoData = false)")
    long countAdminBookingCustomers(@Param("from") Instant from, @Param("to") Instant to,
            @Param("customerRole") Role customerRole, @Param("includeDemo") boolean includeDemo);

    @Query("select b.customer.id from Booking b where b.createdAt >= :from and b.createdAt < :to " +
            "and b.customer.role = :customerRole and (:includeDemo = true or b.supplier.demoData = false) " +
            "group by b.customer.id having count(b.id) >= 2")
    List<Long> findAdminRepeatCustomerIds(@Param("from") Instant from, @Param("to") Instant to,
            @Param("customerRole") Role customerRole, @Param("includeDemo") boolean includeDemo);

    @Query("select count(b) from Booking b where b.createdAt >= :from and b.createdAt < :to and b.status = :status " +
            "and b.customer.role = :customerRole and (:includeDemo = true or b.supplier.demoData = false)")
    long countAdminBookingsByStatus(@Param("from") Instant from, @Param("to") Instant to,
            @Param("status") BookingStatus status, @Param("customerRole") Role customerRole,
            @Param("includeDemo") boolean includeDemo);

    @Query("select count(b) from Booking b where b.createdAt >= :from and b.createdAt < :to " +
            "and b.customer.role = :customerRole and (:includeDemo = true or b.supplier.demoData = false) " +
            "and exists (select p.id from PaymentTransaction p where p.booking = b and p.status = :paidStatus and p.requiresManualReview = false and p.paidAt is not null and p.id = (select min(p2.id) from PaymentTransaction p2 where p2.booking = b and p2.status = :paidStatus))")
    long countAdminVerifiedPaidBookings(@Param("from") Instant from, @Param("to") Instant to,
            @Param("paidStatus") PaymentTransactionStatus paidStatus, @Param("customerRole") Role customerRole,
            @Param("includeDemo") boolean includeDemo);

    @Query("select count(distinct b.customer.id) from Booking b where b.createdAt >= :from and b.createdAt < :to " +
            "and b.customer.role = :customerRole and (:includeDemo = true or b.supplier.demoData = false) " +
            "and exists (select p.id from PaymentTransaction p where p.booking = b and p.status = :paidStatus and p.requiresManualReview = false and p.paidAt is not null and p.id = (select min(p2.id) from PaymentTransaction p2 where p2.booking = b and p2.status = :paidStatus))")
    long countAdminVerifiedPaidCustomers(@Param("from") Instant from, @Param("to") Instant to,
            @Param("paidStatus") PaymentTransactionStatus paidStatus, @Param("customerRole") Role customerRole,
            @Param("includeDemo") boolean includeDemo);

    @Query("select count(b) from Booking b where b.createdAt >= :from and b.createdAt < :to " +
            "and b.customer.role = :customerRole and (:includeDemo = true or b.supplier.demoData = false) " +
            "and b.status in :statuses and (b.appointmentDate > :today or (b.appointmentDate = :today and b.startTime >= :now))")
    long countAdminUpcomingBookings(@Param("from") Instant from, @Param("to") Instant to,
            @Param("today") LocalDate today, @Param("now") LocalTime now,
            @Param("statuses") Collection<BookingStatus> statuses, @Param("customerRole") Role customerRole,
            @Param("includeDemo") boolean includeDemo);

    @EntityGraph(attributePaths = {"customer", "supplier", "service", "practitioner"})
    @Query("select b from Booking b where b.createdAt >= :from and b.createdAt < :to " +
            "and b.customer.role = :customerRole and (:includeDemo = true or b.supplier.demoData = false) " +
            "order by b.createdAt desc, b.id desc")
    List<Booking> findAdminRecent(@Param("from") Instant from, @Param("to") Instant to,
            @Param("customerRole") Role customerRole, @Param("includeDemo") boolean includeDemo, Pageable pageable);

    @EntityGraph(attributePaths = {"customer", "supplier", "service", "practitioner"})
    @Query(value = "select b from Booking b where b.createdAt >= :from and b.createdAt < :to " +
            "and b.customer.role = :customerRole and (:includeDemo = true or b.supplier.demoData = false) " +
            "and (:bookingStatus is null or b.status = :bookingStatus) " +
            "and (:paymentStatus is null or b.paymentStatus = :paymentStatus) " +
            "and (:query is null or lower(b.bookingCode) like lower(concat('%', :query, '%')) " +
            "or lower(b.customer.fullName) like lower(concat('%', :query, '%')) " +
            "or lower(b.supplier.name) like lower(concat('%', :query, '%')) " +
            "or lower(b.service.name) like lower(concat('%', :query, '%')))",
            countQuery = "select count(b) from Booking b where b.createdAt >= :from and b.createdAt < :to " +
            "and b.customer.role = :customerRole and (:includeDemo = true or b.supplier.demoData = false) " +
            "and (:bookingStatus is null or b.status = :bookingStatus) " +
            "and (:paymentStatus is null or b.paymentStatus = :paymentStatus) " +
            "and (:query is null or lower(b.bookingCode) like lower(concat('%', :query, '%')) " +
            "or lower(b.customer.fullName) like lower(concat('%', :query, '%')) " +
            "or lower(b.supplier.name) like lower(concat('%', :query, '%')) " +
            "or lower(b.service.name) like lower(concat('%', :query, '%')))")
    Page<Booking> searchAdminBookings(@Param("from") Instant from, @Param("to") Instant to,
            @Param("bookingStatus") BookingStatus bookingStatus, @Param("paymentStatus") PaymentStatus paymentStatus,
            @Param("query") String query, @Param("customerRole") Role customerRole,
            @Param("includeDemo") boolean includeDemo, Pageable pageable);

    @EntityGraph(attributePaths = {"customer", "supplier", "service", "practitioner"})
    @Query("select b from Booking b where b.id = :id and b.customer.role = :customerRole")
    Optional<Booking> findAdminBookingById(@Param("id") Long id, @Param("customerRole") Role customerRole);

    @Query("select b.customer.id, count(b.id), sum(case when b.status = :completed then 1 else 0 end), max(b.createdAt) " +
            "from Booking b where b.customer.role = :customerRole and (:includeDemo = true or b.supplier.demoData = false) group by b.customer.id")
    List<Object[]> findAdminCustomerBookingStats(@Param("completed") BookingStatus completed,
            @Param("customerRole") Role customerRole, @Param("includeDemo") boolean includeDemo);

    @Query("select b.customer.id, count(distinct b.id) from Booking b where b.customer.role = :customerRole " +
            "and (:includeDemo = true or b.supplier.demoData = false) " +
            "and exists (select p.id from PaymentTransaction p where p.booking = b and p.status = :paidStatus and p.requiresManualReview = false and p.paidAt is not null and p.id = (select min(p2.id) from PaymentTransaction p2 where p2.booking = b and p2.status = :paidStatus)) group by b.customer.id")
    List<Object[]> findAdminCustomerPaidBookingStats(@Param("paidStatus") PaymentTransactionStatus paidStatus,
            @Param("customerRole") Role customerRole, @Param("includeDemo") boolean includeDemo);

    @Query("select distinct b.customer.id from Booking b where b.createdAt >= :from and b.createdAt < :to " +
            "and b.customer.role = :customerRole and (:includeDemo = true or b.supplier.demoData = false)")
    List<Long> findAdminCustomerIdsBookedInRange(@Param("from") Instant from, @Param("to") Instant to,
            @Param("customerRole") Role customerRole, @Param("includeDemo") boolean includeDemo);

    @EntityGraph(attributePaths = {"customer", "supplier", "service", "practitioner"})
    @Query(value = "select b from Booking b where b.customer.id = :customerId and b.customer.role = :customerRole " +
            "and (:includeDemo = true or b.supplier.demoData = false)",
            countQuery = "select count(b) from Booking b where b.customer.id = :customerId and b.customer.role = :customerRole " +
            "and (:includeDemo = true or b.supplier.demoData = false)")
    Page<Booking> findAdminCustomerBookings(@Param("customerId") Long customerId,
            @Param("customerRole") Role customerRole, @Param("includeDemo") boolean includeDemo, Pageable pageable);
}
