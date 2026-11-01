package com.example.backend.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.regex.Pattern;

/** Public catalog cover fields only. No remote fetching and no persistence writes. */
public final class PublicCatalogImages {
    private PublicCatalogImages() {}
    private static final int MAX_DATA_URI_LENGTH = 14_000_000;
    private static final Pattern DATA = Pattern.compile(
            "^data:image/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\\r\\n]+)$", Pattern.CASE_INSENSITIVE);
    public record Image(String type, byte[] bytes) {}

    public static String digest(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public static String reference(String raw, String kind, Long id) {
        if (raw == null || !raw.startsWith("data:")) return raw;
        if (raw.length() > MAX_DATA_URI_LENGTH || !DATA.matcher(raw).matches()) return null;
        return "/api/v1/" + kind + "/" + id + "/cover/" + digest(raw);
    }

    public static Image decode(String raw, String hash) {
        if (raw == null || raw.length() > MAX_DATA_URI_LENGTH || !hash.matches("[a-f0-9]{64}") || !digest(raw).equals(hash)) return null;
        var match = DATA.matcher(raw);
        if (!match.matches()) return null;
        try {
            var bytes = Base64.getMimeDecoder().decode(match.group(2));
            if (bytes.length == 0 || bytes.length > 10_000_000) return null;
            String type = match.group(1).toLowerCase(Locale.ROOT);
            if (type.equals("jpg")) type = "jpeg";
            boolean valid = switch (type) {
                case "png" -> bytes.length >= 8 && (bytes[0] & 255) == 137 && bytes[1] == 80 && bytes[2] == 78 && bytes[3] == 71
                        && bytes[4] == 13 && bytes[5] == 10 && bytes[6] == 26 && bytes[7] == 10;
                case "webp" -> bytes.length >= 12 && new String(bytes, 0, 4, StandardCharsets.US_ASCII).equals("RIFF")
                        && new String(bytes, 8, 4, StandardCharsets.US_ASCII).equals("WEBP");
                default -> bytes.length >= 3 && (bytes[0] & 255) == 255 && (bytes[1] & 255) == 216 && (bytes[2] & 255) == 255;
            };
            return valid ? new Image("image/" + type, bytes) : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
