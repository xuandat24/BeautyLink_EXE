package com.example.backend.service;

import com.example.backend.exception.ApiException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PublicImageStorageTest {
    CloudinaryImageGateway gateway = mock(CloudinaryImageGateway.class);
    RateLimitBackend limits = mock(RateLimitBackend.class);

    @AfterEach void clear() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.clearSynchronization();
    }

    @Test void legacyModeDoesNotCallProvider() {
        assertEquals("validated-image", new PublicImageStorage(gateway, limits, false).storeValidatedImage("validated-image", 1L));
        verifyNoInteractions(gateway, limits);
    }

    @Test void rollsBackOnlyTheNewUploadAndNeverDeletesOnCommit() {
        when(limits.consume("public-image:1", 20, 3600)).thenReturn(true);
        var uploaded = new CloudinaryImageGateway.UploadedImage("beautylink/public/test", "https://cdn.example/new.webp");
        when(gateway.upload("validated-image")).thenReturn(uploaded);
        TransactionSynchronizationManager.initSynchronization();
        assertEquals(uploaded.secureUrl(), new PublicImageStorage(gateway, limits, true).storeValidatedImage("validated-image", 1L));
        var callback = TransactionSynchronizationManager.getSynchronizations().getFirst();
        callback.afterCompletion(TransactionSynchronization.STATUS_COMMITTED);
        verify(gateway, never()).destroy(any());
        callback.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);
        verify(gateway).destroy(uploaded);
    }

    @Test void uploadLimitDoesNotCallUpload() {
        assertEquals("IMAGE_UPLOAD_LIMIT", assertThrows(ApiException.class,
                () -> new PublicImageStorage(gateway, limits, true).storeValidatedImage("validated-image", 1L)).getCode());
        verify(gateway, never()).upload(any());
    }

    @Test void providerFailureDoesNotFallBackToDataUriOrRegisterCleanup() {
        when(limits.consume(anyString(), anyInt(), anyLong())).thenReturn(true);
        when(gateway.upload(anyString())).thenThrow(new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "IMAGE_STORAGE_UNAVAILABLE", "safe"));
        TransactionSynchronizationManager.initSynchronization();
        assertThrows(ApiException.class, () -> new PublicImageStorage(gateway, limits, true).storeValidatedImage("validated-image", 1L));
        assertTrue(TransactionSynchronizationManager.getSynchronizations().isEmpty());
    }
}
