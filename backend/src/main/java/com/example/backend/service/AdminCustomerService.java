package com.example.backend.service;

import com.example.backend.dto.ApiDtos.AdminCustomerResponse;
import com.example.backend.model.DomainEnums.Gender;
import com.example.backend.model.DomainEnums.Role;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.UserAccountRepository;
import com.example.backend.repository.BookingRepository;
import com.example.backend.repository.PaymentTransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Set;
import java.util.HashSet;
import java.time.Instant;
import java.time.LocalDate;
import java.math.BigDecimal;
import static com.example.backend.model.DomainEnums.*;

@Service
public class AdminCustomerService {
    private final UserAccountRepository users;
    private final BookingRepository bookings;
    private final PaymentTransactionRepository payments;
    private final AdminDashboardService dashboard;

    public AdminCustomerService(UserAccountRepository users, BookingRepository bookings,
            PaymentTransactionRepository payments, AdminDashboardService dashboard) {
        this.users = users;
        this.bookings = bookings;
        this.payments = payments;
        this.dashboard = dashboard;
    }

    @Transactional(readOnly = true)
    public List<AdminCustomerResponse> listCustomers() {
        return listCustomers(null, null, false, false);
    }

    @Transactional(readOnly = true)
    public List<AdminCustomerResponse> listCustomers(LocalDate from, LocalDate to,
            boolean bookedOnly, boolean includeDemo) {
        Map<Long, BookingStats> bookingStats = new HashMap<>();
        bookings.findAdminCustomerBookingStats(BookingStatus.COMPLETED, Role.CUSTOMER, includeDemo)
                .forEach(row -> bookingStats.put((Long) row[0], new BookingStats(number(row[1]),
                        number(row[2]), (Instant) row[3])));
        Map<Long, Long> paidStats = new HashMap<>();
        bookings.findAdminCustomerPaidBookingStats(PaymentTransactionStatus.PAID, Role.CUSTOMER, includeDemo)
                .forEach(row -> paidStats.put((Long) row[0], number(row[1])));
        Map<Long, BigDecimal> verifiedAmounts = new HashMap<>();
        payments.findAdminCustomerVerifiedAmounts(PaymentTransactionStatus.PAID, Role.CUSTOMER, includeDemo)
                .forEach(row -> verifiedAmounts.put((Long) row[0], (BigDecimal) row[1]));
        Set<Long> bookedIds = null;
        if (bookedOnly) {
            AdminDashboardService.Range range = dashboard.range(from, to, includeDemo);
            bookedIds = new HashSet<>(bookings.findAdminCustomerIdsBookedInRange(range.from(), range.to(),
                    Role.CUSTOMER, includeDemo));
        }
        Set<Long> filterIds = bookedIds;
        return users.findByRoleOrderByIdAsc(Role.CUSTOMER).stream()
                .filter(user -> filterIds == null || filterIds.contains(user.getId()))
                .map(user -> toResponse(user, bookingStats.get(user.getId()), paidStats.getOrDefault(user.getId(), 0L),
                        verifiedAmounts.getOrDefault(user.getId(), BigDecimal.ZERO)))
                .toList();
    }

    @Transactional(readOnly = true)
    public byte[] exportCustomersCsv() {
        List<AdminCustomerResponse> customers = listCustomers();
        StringBuilder csv = new StringBuilder("\uFEFF");
        csv.append("STT,Tên người dùng,Giới tính,Ngày sinh,Số điện thoại,Email,Lịch đã đặt,Lịch đã thanh toán,Lịch hoàn thành,Lần đặt gần nhất,Đã thu online xác minh\r\n");
        for (int index = 0; index < customers.size(); index++) {
            AdminCustomerResponse customer = customers.get(index);
            csv.append(index + 1).append(',')
                    .append(csvCell(customer.fullName())).append(',')
                    .append(csvCell(genderLabel(customer.gender()))).append(',')
                    .append(csvCell(customer.dateOfBirth() == null ? "" : customer.dateOfBirth().toString())).append(',')
                    // A leading apostrophe keeps the initial zero when Google Sheets imports the CSV.
                    .append(csvCell(customer.phone() == null ? "" : "'" + customer.phone())).append(',')
                    .append(csvCell(customer.email())).append(',')
                    .append(customer.bookingsPlaced()).append(',')
                    .append(customer.paidBookings()).append(',')
                    .append(customer.completedBookings()).append(',')
                    .append(csvCell(customer.lastBookingAt() == null ? "" : customer.lastBookingAt().toString())).append(',')
                    .append(customer.totalVerifiedOnlineAmount())
                    .append("\r\n");
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private AdminCustomerResponse toResponse(UserAccount user, BookingStats stats, long paidBookings,
            BigDecimal verifiedAmount) {
        BookingStats safe = stats == null ? new BookingStats(0, 0, null) : stats;
        return new AdminCustomerResponse(user.getId(), user.getFullName(), user.getGender(),
                user.getDateOfBirth(), user.getPhone(), user.getEmail(), safe.bookings(), paidBookings,
                safe.completed(), safe.lastBooking(), verifiedAmount);
    }

    private long number(Object value) { return value == null ? 0 : ((Number) value).longValue(); }
    private record BookingStats(long bookings, long completed, Instant lastBooking) {}

    private String genderLabel(Gender gender) {
        if (gender == null) return "Chưa cập nhật";
        return switch (gender) {
            case MALE -> "Nam";
            case FEMALE -> "Nữ";
            case OTHER -> "Khác";
        };
    }

    private String csvCell(String value) {
        String safe = value == null ? "" : value;
        if (!safe.isEmpty() && "=+-@".indexOf(safe.charAt(0)) >= 0) safe = "'" + safe;
        return "\"" + safe.replace("\"", "\"\"") + "\"";
    }
}
