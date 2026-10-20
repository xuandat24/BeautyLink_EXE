package com.example.backend.model;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.List;

/** Nullable JSON text, separate from the legacy single cover URL. */
@Converter
public class ImageUrlsConverter implements AttributeConverter<List<String>, String> {
    private static final ObjectMapper JSON = new ObjectMapper();
    @Override public String convertToDatabaseColumn(List<String> value) {
        if (value == null || value.isEmpty()) return null;
        try { return JSON.writeValueAsString(value); }
        catch (Exception e) { throw new IllegalArgumentException("Cannot encode service gallery", e); }
    }
    @Override public List<String> convertToEntityAttribute(String value) {
        if (value == null || value.isBlank()) return List.of();
        try { return List.copyOf(JSON.readValue(value, new TypeReference<List<String>>() {})); }
        catch (Exception e) { throw new IllegalArgumentException("Invalid service gallery storage", e); }
    }
}
