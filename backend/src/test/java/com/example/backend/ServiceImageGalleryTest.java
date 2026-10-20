package com.example.backend;

import com.example.backend.model.ImageUrlsConverter;
import com.example.backend.model.ServiceOffering;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class ServiceImageGalleryTest {
    @Test void jsonRoundTripAndNullBackwardsCompatibility() {
        var converter = new ImageUrlsConverter();
        var images = List.of("https://example.com/a.jpg", "https://example.com/b.webp");
        assertEquals(images, converter.convertToEntityAttribute(converter.convertToDatabaseColumn(images)));
        assertNull(converter.convertToDatabaseColumn(List.of()));
        assertEquals(List.of(), converter.convertToEntityAttribute(null));
        assertThrows(IllegalArgumentException.class, () -> converter.convertToEntityAttribute("not-json"));
        var service = new ServiceOffering();
        assertEquals(List.of(), service.getImageUrls());
        service.setImageUrl(images.getFirst());
        assertEquals(List.of(images.getFirst()), service.getImageUrls());
        service.setImageUrls(images);
        assertEquals(images, service.getImageUrls());
    }
}
