package com.example.backend.service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/** Validate the exact provider payload; never synthesize bank transfer instructions. */
final class PayOSQrInstructions {
    private PayOSQrInstructions() {}
    static boolean usable(String value, BigDecimal amount) {
        if (value == null || amount == null) return false;
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 20 || bytes.length > 2048 || !value.matches("(?s).*6304[0-9A-Fa-f]{4}$")) return false;
        int crc = 0xffff;
        for (int i = 0; i < bytes.length - 4; i++) {
            crc ^= (bytes[i] & 255) << 8;
            for (int bit = 0; bit < 8; bit++) crc = ((crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
        }
        try {
            if (crc != Integer.parseInt(value.substring(value.length() - 4), 16)) return false;
            Map<String,String> fields = new HashMap<>();
            for (int offset = 0; offset < bytes.length;) {
                if (offset + 4 > bytes.length) return false;
                String tag = new String(bytes, offset, 2, StandardCharsets.US_ASCII);
                String length = new String(bytes, offset + 2, 2, StandardCharsets.US_ASCII);
                if (!tag.matches("[0-9]{2}") || !length.matches("[0-9]{2}")) return false;
                int size = Integer.parseInt(length); offset += 4;
                if (offset + size > bytes.length || fields.containsKey(tag)) return false;
                fields.put(tag, new String(bytes, offset, size, StandardCharsets.UTF_8)); offset += size;
            }
            return "01".equals(fields.get("00")) && "704".equals(fields.get("53")) && "VN".equals(fields.get("58"))
                    && fields.getOrDefault("38", "").contains("A000000727")
                    && new BigDecimal(fields.getOrDefault("54", "-1")).compareTo(amount) == 0;
        } catch (IllegalArgumentException error) { return false; }
    }
}
