package com.example.backend.service;

import com.example.backend.exception.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

/** Signed, server-side uploads only. Never fetch arbitrary user-supplied URLs. */
@Component
public class CloudinaryImageGateway {
    private final RestClient client;
    private final String cloudName;
    private final String apiKey;
    private final String apiSecret;
    private final Clock clock;

    @Autowired
    public CloudinaryImageGateway(RestClient.Builder builder,
            @Value("${app.cloudinary.cloud-name:}") String cloudName,
            @Value("${app.cloudinary.api-key:}") String apiKey,
            @Value("${app.cloudinary.api-secret:}") String apiSecret,
            @Value("${app.cloudinary.connect-timeout-ms:3000}") int connectTimeout,
            @Value("${app.cloudinary.read-timeout-ms:6000}") int readTimeout) {
        this(client(builder, connectTimeout, readTimeout), cloudName, apiKey, apiSecret, Clock.systemUTC());
    }

    // Package-private seam for HTTP tests; production has no configurable upload host.
    CloudinaryImageGateway(RestClient client, String cloudName, String apiKey, String apiSecret, Clock clock) {
        this.client = client;
        this.cloudName = cloudName;
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.clock = clock;
    }

    private static RestClient client(RestClient.Builder builder, int connectTimeout, int readTimeout) {
        var http = HttpClient.newBuilder().connectTimeout(Duration.ofMillis(Math.max(100, connectTimeout)))
                .followRedirects(HttpClient.Redirect.NEVER).build();
        var factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(Duration.ofMillis(Math.max(100, readTimeout)));
        return builder.baseUrl("https://api.cloudinary.com").requestFactory(factory).build();
    }

    void requireConfigured() {
        if (!cloudName.matches("[a-zA-Z0-9_-]{1,100}") || apiKey.isBlank() || apiSecret.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "IMAGE_STORAGE_NOT_CONFIGURED",
                    "Máy chủ chưa cấu hình dịch vụ lưu ảnh. Vui lòng liên hệ hỗ trợ.");
        }
    }

    UploadedImage upload(String validatedDataImage) {
        requireConfigured();
        String publicId = "beautylink/public/" + UUID.randomUUID();
        Map<String, String> parameters = new TreeMap<>();
        parameters.put("public_id", publicId);
        parameters.put("timestamp", Long.toString(clock.instant().getEpochSecond()));
        parameters.put("overwrite", "false");
        parameters.put("allowed_formats", "jpg,png,webp");
        parameters.put("transformation", "c_limit,w_2048,h_2048/f_webp");
        var body = signedBody(parameters);
        body.add("file", validatedDataImage);
        JsonNode result = post("upload", body);
        try {
            String version = result.path("version").asText();
            String signature = result.path("signature").asText();
            String secureUrl = result.path("secure_url").asText();
            URI uri = URI.create(secureUrl);
            boolean validSignature = (signature.length() == 40 || signature.length() == 64)
                    && MessageDigest.isEqual(signature.getBytes(StandardCharsets.US_ASCII),
                    sign(Map.of("public_id", publicId, "version", version), signature.length() == 40 ? "SHA-1" : "SHA-256")
                            .getBytes(StandardCharsets.US_ASCII));
            if (!publicId.equals(result.path("public_id").asText()) || !version.matches("[1-9][0-9]*")
                    || !validSignature || !"image".equals(result.path("resource_type").asText())
                    || !"upload".equals(result.path("type").asText()) || !"webp".equals(result.path("format").asText())
                    || result.path("bytes").asLong() <= 0 || result.path("bytes").asLong() > 2_000_000
                    || !"https".equals(uri.getScheme()) || !"res.cloudinary.com".equals(uri.getHost())
                    || uri.getRawUserInfo() != null || uri.getPort() != -1 || uri.getQuery() != null || uri.getFragment() != null
                    || !uri.getPath().equals("/" + cloudName + "/image/upload/v" + version + "/" + publicId + ".webp")) {
                throw invalidResponse();
            }
            return new UploadedImage(publicId, secureUrl);
        } catch (IllegalArgumentException ex) {
            throw invalidResponse();
        }
    }

    void destroy(UploadedImage image) {
        if (!image.publicId().matches("beautylink/public/[0-9a-f-]{36}")) throw invalidResponse();
        JsonNode result = post("destroy", signedBody(Map.of("public_id", image.publicId(),
                "timestamp", Long.toString(clock.instant().getEpochSecond()))));
        if (!"ok".equals(result.path("result").asText()) && !"not found".equals(result.path("result").asText())) {
            throw invalidResponse();
        }
    }

    private LinkedMultiValueMap<String, Object> signedBody(Map<String, String> parameters) {
        var body = new LinkedMultiValueMap<String, Object>();
        parameters.forEach(body::add);
        body.add("api_key", apiKey);
        body.add("signature", sign(parameters, "SHA-256"));
        return body;
    }

    private JsonNode post(String operation, LinkedMultiValueMap<String, Object> body) {
        try {
            JsonNode result = client.post().uri("/v1_1/{cloud}/image/{operation}", cloudName, operation)
                    .contentType(MediaType.MULTIPART_FORM_DATA).body(body).retrieve().body(JsonNode.class);
            if (result == null) throw invalidResponse();
            return result;
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 429) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "IMAGE_PROVIDER_RATE_LIMITED",
                        "Dịch vụ ảnh đang bận. Vui lòng thử lại sau.");
            }
            // Deliberately discard provider body/message: it can echo signed request parameters.
            throw unavailable();
        } catch (ApiException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            throw unavailable();
        }
    }

    private String sign(Map<String, String> parameters, String algorithm) {
        String input = new TreeMap<>(parameters).entrySet().stream()
                .map(entry -> entry.getKey() + "=" + entry.getValue()).collect(Collectors.joining("&")) + apiSecret;
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance(algorithm).digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException ex) {
            throw new IllegalStateException("Required digest unavailable");
        }
    }

    private static ApiException unavailable() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "IMAGE_STORAGE_UNAVAILABLE",
                "Chưa thể lưu ảnh. Vui lòng thử lại; thay đổi chưa được lưu.");
    }

    private static ApiException invalidResponse() {
        return new ApiException(HttpStatus.BAD_GATEWAY, "IMAGE_STORAGE_INVALID_RESPONSE",
                "Không xác minh được kết quả lưu ảnh. Vui lòng thử lại sau.");
    }

    record UploadedImage(String publicId, String secureUrl) {}
}
