package com.example.backend.dto;

import com.example.backend.dto.ApiDtos.*;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Set;

public final class AdminPartnerEditDtos {
    private AdminPartnerEditDtos() {}
    public record Snapshot<T>(T data,String revision) {}
    public record Profile(@NotBlank @Size(min=2,max=160) String name,@NotBlank @Size(max=120) String businessType,
        @Size(max=1500) String description,@NotBlank @Size(max=255) String addressLine,
        @Size(max=1500000) String imageUrl,@Positive Long locationId,
        @DecimalMin("-90") @DecimalMax("90") Double latitude,@DecimalMin("-180") @DecimalMax("180") Double longitude) {
        @JsonAnySetter public void reject(String field,Object value) {throw new IllegalArgumentException("Unsupported salon field");}
    }
    public record ProfileWrite(@NotNull @Valid Profile data,@NotBlank @Size(min=64,max=64) String expectedRevision) {
        @JsonAnySetter public void reject(String field,Object value) {throw new IllegalArgumentException("Unsupported edit field");}
    }
    public record ServiceWrite(@NotNull @Valid UpsertSupplierServiceRequest data,@NotBlank @Size(min=64,max=64) String expectedRevision) {
        @JsonAnySetter public void reject(String field,Object value) {throw new IllegalArgumentException("Unsupported edit field");}
    }
    public record PersonWrite(@NotNull @Valid CreatePractitionerRequest data,boolean active,Set<@Positive Long> serviceIds,@NotBlank @Size(min=64,max=64) String expectedRevision) {
        @JsonAnySetter public void reject(String field,Object value) {throw new IllegalArgumentException("Unsupported edit field");}
    }
    public record ScheduleWrite(@NotNull @Valid ReplaceScheduleRequest data,@NotBlank @Size(min=64,max=64) String expectedRevision) {
        @JsonAnySetter public void reject(String field,Object value) {throw new IllegalArgumentException("Unsupported edit field");}
    }
}
