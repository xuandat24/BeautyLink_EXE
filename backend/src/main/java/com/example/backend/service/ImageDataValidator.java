package com.example.backend.service;

import com.example.backend.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.Iterator;
import java.util.Locale;

@Component
public class ImageDataValidator {
    private static final int MAX_DIMENSION = 4096;
    private static final long MAX_PIXELS = 16_000_000L;

    public String requireValidDataImage(String value, int maxDecodedBytes, String errorCode, String message) {
        if (value == null) throw invalid(errorCode, message);
        int comma = value.indexOf(',');
        if (comma < 0) throw invalid(errorCode, message);
        String mediaType = value.substring(0, comma).toLowerCase();
        if (!mediaType.equals("data:image/jpeg;base64")
                && !mediaType.equals("data:image/png;base64")
                && !mediaType.equals("data:image/webp;base64")) {
            throw invalid(errorCode, message);
        }
        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(value.substring(comma + 1));
        } catch (IllegalArgumentException ex) {
            throw invalid(errorCode, message);
        }
        if (decoded.length == 0 || decoded.length > maxDecodedBytes || !isValidImage(mediaType, decoded)) {
            throw invalid(errorCode, message);
        }
        return value;
    }

    private boolean isValidImage(String mediaType, byte[] bytes) {
        if (mediaType.contains("jpeg")) {
            return bytes.length >= 4 && unsigned(bytes[0]) == 0xff && unsigned(bytes[1]) == 0xd8
                    && unsigned(bytes[bytes.length - 2]) == 0xff && unsigned(bytes[bytes.length - 1]) == 0xd9
                    && imageReaderAccepts(bytes, "JPEG");
        }
        if (mediaType.contains("png")) {
            int[] signature = {0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};
            if (bytes.length < 33 || !hasPngEnd(bytes)) return false;
            for (int i = 0; i < signature.length; i++) if (unsigned(bytes[i]) != signature[i]) return false;
            return imageReaderAccepts(bytes, "PNG");
        }
        return validWebp(bytes);
    }

    private boolean imageReaderAccepts(byte[] bytes, String expectedFormat) {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (input == null) return false;
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) return false;
            ImageReader reader = readers.next();
            try {
                if (!reader.getFormatName().toUpperCase(Locale.ROOT).contains(expectedFormat)) return false;
                reader.setInput(input, true, true);
                return dimensionsAllowed(reader.getWidth(0), reader.getHeight(0));
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException ex) {
            return false;
        }
    }

    private boolean hasPngEnd(byte[] bytes) {
        int typeOffset = bytes.length - 8;
        return typeOffset >= 4 && bytes[typeOffset] == 'I' && bytes[typeOffset + 1] == 'E'
                && bytes[typeOffset + 2] == 'N' && bytes[typeOffset + 3] == 'D';
    }

    private boolean validWebp(byte[] bytes) {
        if (bytes.length < 30 || !ascii(bytes, 0, "RIFF") || !ascii(bytes, 8, "WEBP")) return false;
        long declaredSize = littleEndian(bytes, 4, 4) + 8;
        if (declaredSize != bytes.length) return false;
        String chunk = new String(bytes, 12, 4, java.nio.charset.StandardCharsets.US_ASCII);
        int width;
        int height;
        if ("VP8X".equals(chunk) && bytes.length >= 30) {
            width = 1 + (int) littleEndian(bytes, 24, 3);
            height = 1 + (int) littleEndian(bytes, 27, 3);
        } else if ("VP8L".equals(chunk) && bytes.length >= 25 && unsigned(bytes[20]) == 0x2f) {
            width = 1 + unsigned(bytes[21]) + ((unsigned(bytes[22]) & 0x3f) << 8);
            height = 1 + ((unsigned(bytes[22]) & 0xc0) >> 6) + (unsigned(bytes[23]) << 2)
                    + ((unsigned(bytes[24]) & 0x0f) << 10);
        } else if ("VP8 ".equals(chunk) && bytes.length >= 30 && unsigned(bytes[23]) == 0x9d
                && unsigned(bytes[24]) == 0x01 && unsigned(bytes[25]) == 0x2a) {
            width = (unsigned(bytes[26]) | (unsigned(bytes[27]) << 8)) & 0x3fff;
            height = (unsigned(bytes[28]) | (unsigned(bytes[29]) << 8)) & 0x3fff;
        } else {
            return false;
        }
        return dimensionsAllowed(width, height);
    }

    private boolean dimensionsAllowed(int width, int height) {
        return width > 0 && height > 0 && width <= MAX_DIMENSION && height <= MAX_DIMENSION
                && (long) width * height <= MAX_PIXELS;
    }

    private boolean ascii(byte[] bytes, int offset, String expected) {
        if (offset + expected.length() > bytes.length) return false;
        for (int i = 0; i < expected.length(); i++) if (unsigned(bytes[offset + i]) != expected.charAt(i)) return false;
        return true;
    }

    private long littleEndian(byte[] bytes, int offset, int length) {
        if (offset < 0 || offset + length > bytes.length) return -1;
        long value = 0;
        for (int i = 0; i < length; i++) value |= (long) unsigned(bytes[offset + i]) << (8 * i);
        return value;
    }

    private int unsigned(byte value) { return value & 0xff; }
    private ApiException invalid(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
}
