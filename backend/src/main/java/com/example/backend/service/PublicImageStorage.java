package com.example.backend.service;

import com.example.backend.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class PublicImageStorage {
    private static final Logger log = LoggerFactory.getLogger(PublicImageStorage.class);
    private final CloudinaryImageGateway gateway;
    private final RateLimitBackend limits;
    private final boolean enabled;

    public PublicImageStorage(CloudinaryImageGateway gateway, RateLimitBackend limits,
                              @Value("${app.cloudinary.enabled:false}") boolean enabled) {
        this.gateway = gateway;
        this.limits = limits;
        this.enabled = enabled;
    }

    // Caller must validate raster content before sending. Never used for identity/KYC documents.
    public String storeValidatedImage(String dataImage, Long ownerId) {
        if (!enabled) return dataImage; // Explicit legacy mode for staged deployment, not failure fallback.
        gateway.requireConfigured();
        if (!limits.consume("public-image:" + ownerId, 20, 3600)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "IMAGE_UPLOAD_LIMIT",
                    "Bạn đã tải quá nhiều ảnh. Vui lòng thử lại sau.");
        }
        var uploaded = gateway.upload(dataImage);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status == STATUS_ROLLED_BACK) {
                        try {
                            gateway.destroy(uploaded);
                        } catch (RuntimeException ex) {
                            // No throwable/provider body, image content, credentials, or user information in logs.
                            log.warn("Public image rollback cleanup failed; orphan asset requires storage reconciliation");
                        }
                    }
                }
            });
        }
        return uploaded.secureUrl();
    }
}
