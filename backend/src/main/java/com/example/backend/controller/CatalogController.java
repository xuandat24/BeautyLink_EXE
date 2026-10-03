package com.example.backend.controller;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.service.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController @RequestMapping("/api/v1")
public class CatalogController {
    private final CatalogService catalog; private final AvailabilityService availability;
    public CatalogController(CatalogService catalog, AvailabilityService availability) { this.catalog = catalog; this.availability = availability; }
    @GetMapping("/locations") public List<LocationResponse> locations(@RequestParam(required = false) Long parentId) { return catalog.locations(parentId); }
    @GetMapping("/categories") public List<CategoryResponse> categories() { return catalog.categories(); }
    @GetMapping("/categories/{slug}/services") public List<ServiceResponse> services(@PathVariable String slug, @RequestParam(required = false) Long locationId) { return catalog.services(slug, locationId); }
    @GetMapping("/services/{id}") public ServiceResponse service(@PathVariable Long id) { return catalog.service(id); }
    @GetMapping("/suppliers/{id}") public PublicSupplierShopResponse supplier(@PathVariable Long id) { return catalog.supplierShop(id); }
    @GetMapping("/homepage/services") public List<ServiceResponse> homepage(@RequestParam(required = false) Long locationId) { return catalog.homepage(locationId); }
    @GetMapping("/services/{serviceId}/availability") public AvailabilityResponse availability(@PathVariable Long serviceId, @RequestParam Long practitionerId, @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) { return availability.availability(serviceId, practitionerId, date); }
}
