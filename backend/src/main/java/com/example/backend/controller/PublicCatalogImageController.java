package com.example.backend.controller;

import com.example.backend.repository.ServiceOfferingRepository;
import com.example.backend.repository.SupplierRepository;
import com.example.backend.service.PublicCatalogImages;
import org.springframework.http.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.time.Duration;
import java.util.Arrays;

@RestController
@RequestMapping("/api/v1")
@Transactional(readOnly = true)
public class PublicCatalogImageController {
    private final ServiceOfferingRepository services;
    private final SupplierRepository suppliers;
    public PublicCatalogImageController(ServiceOfferingRepository services, SupplierRepository suppliers) {
        this.services = services;
        this.suppliers = suppliers;
    }

    @GetMapping("/services/{id}/cover/{hash}")
    public ResponseEntity<byte[]> service(@PathVariable Long id, @PathVariable String hash,
            @RequestHeader(value = "If-None-Match", required = false) String etag) {
        return image(services.publicCover(id).orElse(null), hash, etag);
    }

    @GetMapping("/suppliers/{id}/cover/{hash}")
    public ResponseEntity<byte[]> supplier(@PathVariable Long id, @PathVariable String hash,
            @RequestHeader(value = "If-None-Match", required = false) String etag) {
        return image(suppliers.publicCover(id).orElse(null), hash, etag);
    }

    private ResponseEntity<byte[]> image(String source, String hash, String conditional) {
        var image = PublicCatalogImages.decode(source, hash);
        if (image == null) return ResponseEntity.status(404).cacheControl(CacheControl.noStore()).build();
        String etag = "\"" + hash + "\"";
        var cache = CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable();
        if (conditional != null && Arrays.stream(conditional.split(",")).map(String::strip)
                .anyMatch(v -> v.equals(etag) || v.equals("W/" + etag) || v.equals("*"))) {
            return ResponseEntity.status(304).eTag(etag).cacheControl(cache).build();
        }
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.type()))
                .header("X-Content-Type-Options", "nosniff").eTag(etag).cacheControl(cache).body(image.bytes());
    }
}
