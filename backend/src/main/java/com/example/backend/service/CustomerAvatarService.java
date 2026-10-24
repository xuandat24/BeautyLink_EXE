package com.example.backend.service;

import com.example.backend.dto.ApiDtos.AuthResponse;
import com.example.backend.exception.ApiException;
import com.example.backend.model.UserAccount;
import com.example.backend.repository.UserAccountRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.net.URI;
import static com.example.backend.model.DomainEnums.Role;

@Service
public class CustomerAvatarService {
    private final UserAccountRepository users;
    private final ImageDataValidator validator;
    private final PublicImageStorage images;
    private final AuthService auth;

    public CustomerAvatarService(UserAccountRepository users, ImageDataValidator validator,
                                 PublicImageStorage images, AuthService auth) {
        this.users = users; this.validator = validator; this.images = images; this.auth = auth;
    }

    @Transactional
    public AuthResponse update(UserAccount current, String image) {
        if (current.getRole() != Role.CUSTOMER) throw new ApiException(HttpStatus.FORBIDDEN,
                "CUSTOMER_PROFILE_ONLY", "Chỉ tài khoản khách hàng có thể cập nhật ảnh đại diện tại đây.");
        UserAccount account = users.findLockedById(current.getId()).orElseThrow(CustomerAvatarService::stale);
        if (!account.getUpdatedAt().equals(current.getUpdatedAt())) throw stale();
        String source = image.trim();
        if (source.startsWith("data:image/")) {
            source = validator.requireValidDataImage(source, 1_100_000, "INVALID_AVATAR",
                    "Ảnh phải là tệp JPG, PNG hoặc WEBP hợp lệ.");
            source = images.storeValidatedImage(source, account.getId());
        } else {
            try {
                URI uri = URI.create(source);
                if (source.length() > 2048 || !"https".equalsIgnoreCase(uri.getScheme())
                        || uri.getHost() == null || uri.getUserInfo() != null) throw new IllegalArgumentException();
            } catch (IllegalArgumentException error) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_AVATAR", "Đường dẫn ảnh phải dùng HTTPS hợp lệ.");
            }
        }
        account.setAvatarUrl(source);
        // Saving touches updatedAt. Rotate the JWT in the same transaction, preserving its sid and deadline.
        return auth.replacementResponse(users.saveAndFlush(account));
    }

    private static ApiException stale() {
        return new ApiException(HttpStatus.CONFLICT, "PROFILE_CHANGED", "Hồ sơ đã thay đổi. Vui lòng tải lại trước khi lưu ảnh.");
    }
}
