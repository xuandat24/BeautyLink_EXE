package com.example.backend.repository;
import com.example.backend.model.Booking;
import com.example.backend.model.DomainEnums.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;
public interface BookingRepository extends JpaRepository<Booking, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from Booking b where b.id = :id")
    Optional<Booking> findByIdForUpdate(@Param("id") Long id);
    List<Booking> findByCustomerIdOrderByAppointmentDateDescStartTimeDesc(Long customerId);
    List<Booking> findBySupplierIdOrderByAppointmentDateDescStartTimeDesc(Long supplierId);
    boolean existsByPractitionerIdAndAppointmentDateAndStartTimeAndStatusNot(Long practitionerId, LocalDate date, LocalTime startTime, BookingStatus status);
    boolean existsByPractitionerIdAndAppointmentDateAndStartTimeAndStatusNotAndIdNot(Long practitionerId, LocalDate date, LocalTime startTime, BookingStatus status, Long id);
    List<Booking> findByPractitionerIdAndAppointmentDateAndStatusNot(Long practitionerId, LocalDate date, BookingStatus status);
}
