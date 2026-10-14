package com.example.backend.service;

import com.example.backend.dto.ApiDtos.AdminCustomerResponse;
import com.example.backend.model.DomainEnums.Gender;
import com.example.backend.model.DomainEnums.Role;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.UserAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.List;

@Service
public class AdminCustomerService {
    private final UserAccountRepository users;

    public AdminCustomerService(UserAccountRepository users) {
        this.users = users;
    }

    @Transactional(readOnly = true)
    public List<AdminCustomerResponse> listCustomers() {
        return users.findByRoleOrderByIdAsc(Role.CUSTOMER).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public byte[] exportCustomersCsv() {
        List<AdminCustomerResponse> customers = listCustomers();
        StringBuilder csv = new StringBuilder("\uFEFF");
        csv.append("STT,Tên người dùng,Giới tính,Ngày sinh,Số điện thoại,Email\r\n");
        for (int index = 0; index < customers.size(); index++) {
            AdminCustomerResponse customer = customers.get(index);
            csv.append(index + 1).append(',')
                    .append(csvCell(customer.fullName())).append(',')
                    .append(csvCell(genderLabel(customer.gender()))).append(',')
                    .append(csvCell(customer.dateOfBirth() == null ? "" : customer.dateOfBirth().toString())).append(',')
                    // A leading apostrophe keeps the initial zero when Google Sheets imports the CSV.
                    .append(csvCell(customer.phone() == null ? "" : "'" + customer.phone())).append(',')
                    .append(csvCell(customer.email()))
                    .append("\r\n");
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private AdminCustomerResponse toResponse(UserAccount user) {
        return new AdminCustomerResponse(user.getId(), user.getFullName(), user.getGender(),
                user.getDateOfBirth(), user.getPhone(), user.getEmail());
    }

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
