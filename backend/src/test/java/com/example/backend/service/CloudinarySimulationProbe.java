package com.example.backend.service;

import org.springframework.web.client.RestClient;
import java.time.Clock;

/** Optional local Postman simulation probe, excluded from the production JAR. Never uses real keys. */
public class CloudinarySimulationProbe {
    public static void main(String[] args) {
        String base = "http://127.0.0.1:4900/cloudinary";
        var gateway = new CloudinaryImageGateway(RestClient.builder().baseUrl(base).build(),
                "test-cloud", "fake-api-key", "fake-test-secret-not-a-real-provider-secret", Clock.systemUTC());
        var image = gateway.upload("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
        if (!image.secureUrl().startsWith("https://res.cloudinary.com/test-cloud/")) throw new AssertionError("Invalid response");
        gateway.destroy(image);
        System.out.println("PASS: actual Java gateway -> local simulation upload + destroy (not live Cloudinary)");
    }
}
