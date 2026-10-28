package com.example.backend.service;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

class ResendTransportDeadlineTest {
    @Test void entireStreamingBodyIsBoundedAndAmbiguousRetryKeepsExactPayloadAndKey() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var executor = Executors.newCachedThreadPool(); server.setExecutor(executor);
        var payloads = new ConcurrentHashMap<String, String>();
        var calls = new CopyOnWriteArrayList<String>(); var chunks = new AtomicInteger();
        server.createContext("/emails", exchange -> {
            String key = exchange.getRequestHeaders().getFirst("Idempotency-Key");
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            calls.add(key); String prior = payloads.putIfAbsent(key, body);
            assertEquals("POST", exchange.getRequestMethod());
            assertEquals("Bearer test-only", exchange.getRequestHeaders().getFirst("Authorization"));
            if (prior != null) assertEquals(prior, body);
            byte[] response = "{\"id\":\"local-test-accepted\"}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json"); exchange.sendResponseHeaders(200, 0);
            try (var out = exchange.getResponseBody()) {
                if (key.equals("reminder-test") && prior == null) {
                    for (byte value : response) { out.write(value); out.flush(); chunks.incrementAndGet();
                        try { Thread.sleep(40); } catch (InterruptedException e) { Thread.currentThread().interrupt(); break; } }
                } else out.write(response);
            } catch (java.io.IOException ignored) { /* deadline closes the first response */ }
            finally { exchange.close(); }
        });
        server.start();
        try (var resources = ResendTransactionalEmailSender.buildClient(200, 200)) {
            var client = resources.client().mutate().baseUrl("http://127.0.0.1:" + server.getAddress().getPort()).build();
            try (var sender = new ResendTransactionalEmailSender(client, "test-only")) {
                sender.sendReminder(message("warmup"));
                long start = System.nanoTime();
                var failure = assertThrows(TransactionalEmailSender.EmailDeliveryException.class, () -> sender.sendReminder(message("reminder-test")));
                assertEquals(TransactionalEmailSender.FailureKind.AMBIGUOUS, failure.getKind());
                assertEquals("EMAIL_PROVIDER_RESULT_AMBIGUOUS", failure.getSafeCode());
                assertTrue(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start) < 2_000);
                assertTrue(chunks.get() >= 2, "bytes arrive inside each read timeout; only the whole-call deadline stops this stream");
                assertEquals("local-test-accepted", sender.sendReminder(message("reminder-test")).providerMessageId());
                assertEquals(List.of("warmup", "reminder-test", "reminder-test"), calls, "no implicit POST retry");
                assertEquals(2, payloads.size(), "fake provider accepts one logical email per stable key");
            }
        } finally { server.stop(0); executor.shutdownNow(); }
    }
    @Test void unboundedTimeoutConfigurationIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> ResendTransactionalEmailSender.buildClient(0, 10_000));
        assertThrows(IllegalArgumentException.class, () -> ResendTransactionalEmailSender.buildClient(5_000, -1));
    }
    private TransactionalEmailSender.EmailMessage message(String key) {
        return new TransactionalEmailSender.EmailMessage("test@example.test", "", "recipient@example.test", "test", "test", "<p>test</p>", key);
    }
}
