package com.example.backend.service;

import com.example.backend.exception.ApiException;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

class CloudinaryImageGatewayTest {
    static final String SECRET = "fake-test-secret-not-a-real-provider-secret";
    HttpServer server;
    CloudinaryImageGateway gateway;
    AtomicInteger requests = new AtomicInteger();
    int status = 200;
    String mutation = "";
    volatile String signedRequest;

    @BeforeEach void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1_1/test-cloud/image/", exchange -> {
            requests.incrementAndGet();
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            signedRequest = body;
            var id = Pattern.compile("name=\"public_id\".*?\\r\\n\\r\\n([^\\r]+)", Pattern.DOTALL).matcher(body);
            String publicId = id.find() ? id.group(1) : "missing";
            String response;
            if (exchange.getRequestURI().getPath().endsWith("destroy")) {
                response = "{\"result\":\"ok\"}";
            } else if (status != 200) {
                response = "{\"error\":{\"message\":\"DO-NOT-LEAK-THIS-PROVIDER-BODY\"}}";
            } else {
                String signature = digest("public_id=" + publicId + "&version=123" + SECRET,
                        mutation.equals("sha256") ? "SHA-256" : "SHA-1");
                response = """
                    {"public_id":"%s","version":123,"signature":"%s","resource_type":"image",
                     "type":"upload","format":"webp","bytes":42,
                     "secure_url":"https://res.cloudinary.com/test-cloud/image/upload/v123/%s.webp"}
                    """.formatted(publicId, signature, publicId);
                if (mutation.equals("signature")) response = response.replace(signature, "0".repeat(40));
                if (mutation.equals("host")) response = response.replace("res.cloudinary.com", "attacker.example");
                if (mutation.equals("identity")) response = response.replace("\"public_id\":\"" + publicId, "\"public_id\":\"other");
                if (mutation.equals("json")) response = "not-json";
                if (mutation.equals("timeout")) {
                    try { Thread.sleep(1500); } catch (InterruptedException ex) { Thread.currentThread().interrupt(); }
                }
            }
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            try {
                exchange.sendResponseHeaders(status, bytes.length);
                exchange.getResponseBody().write(bytes);
            } finally { exchange.close(); }
        });
        server.start();
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(1)).build());
        factory.setReadTimeout(Duration.ofMillis(1000));
        gateway = new CloudinaryImageGateway(RestClient.builder()
                .baseUrl("http://127.0.0.1:" + server.getAddress().getPort()).requestFactory(factory).build(),
                "test-cloud", "fake-api-key", SECRET, Clock.fixed(Instant.ofEpochSecond(123456), ZoneOffset.UTC));
    }

    @AfterEach void stop() { if (server != null) server.stop(0); }

    @Test void uploadsWithSignedMultipartAndVerifiesResponseThenSupportsRollbackCleanup() throws Exception {
        var result = gateway.upload("data:image/png;base64,validated-test-content");
        assertTrue(result.secureUrl().startsWith("https://res.cloudinary.com/test-cloud/image/upload/v123/beautylink/public/"));
        String expected = digest("allowed_formats=jpg,png,webp&overwrite=false&public_id=" + result.publicId()
                + "&timestamp=123456&transformation=c_limit,w_2048,h_2048/f_webp" + SECRET, "SHA-256");
        assertTrue(signedRequest.contains(expected));
        assertFalse(signedRequest.contains(SECRET));
        assertTrue(signedRequest.contains("data:image/png;base64,validated-test-content"));
        gateway.destroy(result);
        assertEquals(2, requests.get());
    }

    @ParameterizedTest @ValueSource(ints = {400, 401, 403, 413, 429, 500, 503})
    void providerErrorsAreSafeAndNeverRetried(int code) {
        status = code;
        ApiException error = assertThrows(ApiException.class, () -> gateway.upload("data:image/png;base64,test"));
        assertEquals(code == 429 ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.SERVICE_UNAVAILABLE, error.getStatus());
        assertFalse(error.getMessage().contains("DO-NOT-LEAK"));
        assertNull(error.getCause());
        assertEquals(1, requests.get());
    }

    @ParameterizedTest @ValueSource(strings = {"signature", "host", "identity", "json", "timeout"})
    void rejectsUntrustedResponsesAndTimeout(String kind) {
        mutation = kind;
        assertThrows(ApiException.class, () -> gateway.upload("data:image/png;base64,test"));
        assertEquals(1, requests.get());
    }

    @Test void missingConfigurationMakesNoRequest() {
        gateway = new CloudinaryImageGateway(RestClient.create(), "", "", "", Clock.systemUTC());
        assertEquals("IMAGE_STORAGE_NOT_CONFIGURED", assertThrows(ApiException.class,
                () -> gateway.upload("data:image/png;base64,test")).getCode());
        assertEquals(0, requests.get());
    }

    @Test void verifiesSha256ProviderResponse() {
        mutation = "sha256";
        assertNotNull(gateway.upload("data:image/png;base64,test"));
    }

    @Test void networkFailureIsSafeAndDoesNotRetry() {
        server.stop(0);
        ApiException error = assertThrows(ApiException.class, () -> gateway.upload("data:image/png;base64,test"));
        assertEquals("IMAGE_STORAGE_UNAVAILABLE", error.getCode());
        assertNull(error.getCause());
        assertEquals(0, requests.get());
    }

    static String digest(String input, String algorithm) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance(algorithm).digest(input.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception ex) { throw new AssertionError(ex); }
    }
}
