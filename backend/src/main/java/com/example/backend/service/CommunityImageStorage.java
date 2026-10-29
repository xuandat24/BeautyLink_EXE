package com.example.backend.service;

import com.example.backend.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Community never uses the legacy Base64 persistence mode. No DB locks during upload. */
@Service
public class CommunityImageStorage {
    private final CloudinaryImageGateway gateway; private final ImageDataValidator validator;
    private final RateLimitBackend limits; private final boolean enabled;
    public record Stored(String publicId,String url) {}
    public CommunityImageStorage(CloudinaryImageGateway gateway,ImageDataValidator validator,RateLimitBackend limits,
                                 @Value("${app.cloudinary.enabled:false}")boolean enabled) {
        this.gateway=gateway;this.validator=validator;this.limits=limits;this.enabled=enabled;
    }
    public Stored upload(String image,Long owner) {
        validator.requireValidDataImage(image,800_000,"COMMUNITY_IMAGE_INVALID","Ảnh JPG, PNG, WEBP không hợp lệ hoặc quá lớn.");
        if(!enabled) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"IMAGE_STORAGE_NOT_CONFIGURED","Chưa thể lưu ảnh Community. Vui lòng thử lại sau.");
        gateway.requireConfigured();
        if(!limits.consume("public-image:"+owner,20,3600)) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,"IMAGE_UPLOAD_LIMIT","Bạn đã tải quá nhiều ảnh. Vui lòng thử lại sau.");
        var result=gateway.upload(image);return new Stored(result.publicId(),result.secureUrl());
    }
    public void discard(Stored stored) { gateway.destroy(new CloudinaryImageGateway.UploadedImage(stored.publicId(),stored.url())); }
}
