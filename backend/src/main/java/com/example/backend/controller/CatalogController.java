package com.example.backend.controller;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.service.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;
import com.example.backend.model.DomainEnums.PaymentOption;

@RestController @RequestMapping("/api/v1")
public class CatalogController {
    private final CatalogService catalog; private final AvailabilityService availability; private final PaymentQuoteService paymentQuotes;
    public CatalogController(CatalogService catalog, AvailabilityService availability, PaymentQuoteService paymentQuotes) { this.catalog = catalog; this.availability = availability; this.paymentQuotes = paymentQuotes; }
    @GetMapping("/locations") public List<LocationResponse> locations(@RequestParam(required = false) Long parentId) { return catalog.locations(parentId); }
    @GetMapping("/categories") public List<CategoryResponse> categories() { return catalog.categories(); }
    @GetMapping("/categories/{slug}/services") public List<ServiceResponse> services(@PathVariable String slug, @RequestParam(required = false) Long locationId) { return catalog.services(slug, locationId); }
    @GetMapping("/services/{id}") public ServiceResponse service(@PathVariable Long id) { return catalog.service(id); }
    @GetMapping("/services/{id}/payment-quote") public PaymentQuoteResponse paymentQuote(
            @PathVariable Long id, @RequestParam PaymentOption paymentOption,
            @RequestParam(required = false) String voucherCode) {
        return paymentQuotes.quoteService(id, paymentOption, voucherCode);
    }
    @GetMapping("/suppliers/{id}") public PublicSupplierShopResponse supplier(@PathVariable Long id) { return catalog.supplierShop(id); }
    @GetMapping("/services/{id}/reviews") public PublicReviewPageResponse serviceReviews(@PathVariable Long id, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) { return catalog.serviceReviews(id, page, size); }
    @GetMapping("/suppliers/{id}/reviews") public PublicReviewPageResponse supplierReviews(@PathVariable Long id, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) { return catalog.supplierReviews(id, page, size); }
    @GetMapping("/homepage/services") public List<ServiceResponse> homepage(@RequestParam(required = false) Long locationId) { return catalog.homepage(locationId); }
    @GetMapping("/services/{serviceId}/availability") public AvailabilityResponse availability(@PathVariable Long serviceId, @RequestParam Long practitionerId, @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) { return availability.availability(serviceId, practitionerId, date); }
    @GetMapping("/services/{serviceId}/capacity") public ServiceCapacityResponse capacity(@PathVariable Long serviceId, @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) { return availability.capacity(serviceId, date); }
}
