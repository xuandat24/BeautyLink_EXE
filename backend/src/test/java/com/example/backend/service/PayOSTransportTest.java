package com.example.backend.service;

import com.example.backend.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.*;
import java.net.*;
import java.nio.file.*;
import java.security.*;
import javax.net.ssl.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import okhttp3.*;
import okhttp3.EventListener;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import vn.payos.PayOS;
import vn.payos.core.ClientOptions;
import vn.payos.crypto.CryptoProviderImpl;
import static org.junit.jupiter.api.Assertions.*;

/** Actual SDK + signed local HTTPS responses. Never contacts a live merchant. */
class PayOSTransportTest {
    @TempDir Path directory;
    private HttpsServer server;
    private ExecutorService workers;
    private SSLSocketFactory sockets;
    private X509TrustManager trust;
    private final ObjectMapper json = new ObjectMapper();
    private final AtomicInteger requests = new AtomicInteger();
    private final java.util.concurrent.atomic.AtomicBoolean corrupt = new java.util.concurrent.atomic.AtomicBoolean();
    private final java.util.concurrent.atomic.AtomicBoolean trickle = new java.util.concurrent.atomic.AtomicBoolean();
    private static final String KEY = "synthetic-checksum-only";

    @BeforeEach void start() throws Exception {
        Path store = directory.resolve("test.p12");
        var keytool = Path.of(System.getProperty("java.home"), "bin", "keytool").toString();
        var process = new ProcessBuilder(keytool, "-genkeypair", "-alias", "local", "-keyalg", "RSA", "-keysize", "2048", "-validity", "2", "-storetype", "PKCS12",
                "-keystore", store.toString(), "-storepass", "test-password", "-dname", "CN=localhost", "-ext", "SAN=dns:localhost,ip:127.0.0.1")
                .redirectOutput(ProcessBuilder.Redirect.DISCARD).redirectError(ProcessBuilder.Redirect.DISCARD).start();
        assertTrue(process.waitFor(30, TimeUnit.SECONDS)); assertEquals(0, process.exitValue());
        var keys = KeyStore.getInstance("PKCS12"); try (var input = Files.newInputStream(store)) { keys.load(input, "test-password".toCharArray()); }
        var km = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm()); km.init(keys, "test-password".toCharArray());
        var tm = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm()); tm.init(keys); trust = (X509TrustManager) tm.getTrustManagers()[0];
        var context = SSLContext.getInstance("TLS"); context.init(km.getKeyManagers(), tm.getTrustManagers(), null); sockets = context.getSocketFactory();
        server = HttpsServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0); server.setHttpsConfigurator(new HttpsConfigurator(context));
        workers = Executors.newFixedThreadPool(8); server.setExecutor(workers);
        server.createContext("/v2/payment-requests", exchange -> {
            requests.incrementAndGet();
            long order = Long.parseLong(exchange.getRequestURI().getPath().substring(exchange.getRequestURI().getPath().lastIndexOf('/') + 1));
            Map<String, Object> data = new LinkedHashMap<>(); data.put("id", "test-" + order); data.put("orderCode", order); data.put("amount", 11000); data.put("amountPaid", 0); data.put("status", "PENDING");
            String signature = corrupt.get() ? "invalid-test-signature" : new CryptoProviderImpl().createSignatureFromObj(data, KEY);
            byte[] body = json.writeValueAsBytes(Map.of("code", "00", "desc", "synthetic", "data", data, "signature", signature));
            exchange.getRequestBody().close(); exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length); try (var output = exchange.getResponseBody()) {
                if (trickle.get()) for (byte value : body) {
                    output.write(value); output.flush();
                    try { Thread.sleep(40); } catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); break; }
                } else output.write(body);
            } exchange.close();
        }); server.start();
    }
    @AfterEach void stop() { if(server != null) server.stop(0); if(workers != null) workers.shutdownNow(); }
    private ClientOptions options(EventListener listener) {
        var http = PayOSGateway.clientOptions("test-client", "test-api", KEY).getHttpClient().newBuilder().sslSocketFactory(sockets, trust).retryOnConnectionFailure(false)
                .connectTimeout(Duration.ofSeconds(15)).readTimeout(Duration.ofSeconds(15)).writeTimeout(Duration.ofSeconds(15)).eventListener(listener).build();
        return ClientOptions.builder().clientId("test-client").apiKey("test-api").checksumKey(KEY).baseURL("https://localhost:" + server.getAddress().getPort())
                .timeoutMs(15000).maxRetries(0).httpClient(http).build();
    }
    @Test void sdkWrappersShareConnectionsWithoutSharingMutableRequestStateAndCloseOnlyAtShutdown() throws Exception {
        var handshakes = new AtomicInteger();
        var options = options(new EventListener() { @Override public void secureConnectStart(Call call) { handshakes.incrementAndGet(); } });
        try(var gateway = new PayOSGateway(options)) {
            for(long order = 1; order <= 6; order++) assertEquals(order, gateway.get(order).getOrderCode());
            assertEquals(1, handshakes.get(), "sequential calls must reuse the authenticated TLS connection");
            try(var pool = Executors.newFixedThreadPool(8)) {
                var futures = new ArrayList<Future<Long>>();
                for(long order = 20; order < 36; order++) { final long expected = order; futures.add(pool.submit(() -> gateway.get(expected).getOrderCode())); }
                for(int i=0;i<futures.size();i++) assertEquals(20L+i, futures.get(i).get(10,TimeUnit.SECONDS));
            }
            assertFalse(options.getHttpClient().dispatcher().executorService().isShutdown());
        }
        assertTrue(options.getHttpClient().dispatcher().executorService().isShutdown());
        assertEquals(22, requests.get());
    }
    @Test void wholeCallDeadlineStopsAStreamingResponseEvenWhenEveryReadArrivesInTime() {
        var normal = options(new EventListener() {});
        var bounded = ClientOptions.builder().clientId("test-client").apiKey("test-api").checksumKey(KEY)
                .baseURL("https://localhost:" + server.getAddress().getPort()).timeoutMs(2000).maxRetries(0)
                .httpClient(normal.getHttpClient().newBuilder().readTimeout(Duration.ofMillis(200))
                        .callTimeout(Duration.ofMillis(400)).build()).build();
        try (var warmup = new PayOSGateway(normal); var gateway = new PayOSGateway(bounded)) {
            warmup.get(1L); // shared pool: establish TLS outside the small scaled test deadline
            trickle.set(true); long started = System.nanoTime();
            assertThrows(ApiException.class, () -> gateway.get(2L));
            assertTrue(Duration.ofNanos(System.nanoTime() - started).toMillis() < 1800);
            assertEquals(2, requests.get(), "deadline must not cause an implicit provider retry");
        }
    }
    @Test void pooledTransportStillRejectsInvalidProviderSignaturesWithoutRetry() {
        var options = options(new EventListener() {});
        try(var gateway = new PayOSGateway(options)) {
            corrupt.set(true);
            var failure = assertThrows(ApiException.class, () -> gateway.get(99L));
            assertEquals("PAYOS_RECONCILIATION_FAILED", failure.getCode());
            assertEquals(1, requests.get(), "signature failure must not cause another provider request");
            corrupt.set(false); assertEquals(100L, gateway.get(100L).getOrderCode());
        }
    }
    @Test void compareThirtyColdSdkCallsWithThirtyPooledSignedHttpsCalls() throws Exception {
        var report = new LinkedHashMap<String,Object>();
        for(boolean pooled : List.of(false,true)) {
            var tlsCount = new AtomicInteger(); var tls = Collections.synchronizedList(new ArrayList<Double>()); var starts = new ConcurrentHashMap<Call,Long>();
            var listener = new EventListener() {
                @Override public void secureConnectStart(Call call) { tlsCount.incrementAndGet(); starts.put(call,System.nanoTime()); }
                @Override public void secureConnectEnd(Call call, Handshake handshake) { tls.add((System.nanoTime()-starts.remove(call))/1_000_000d); }
            };
            var values = new ArrayList<Double>(); var shared = pooled ? options(listener) : null;
            try {
                for(long order=100;order<130;order++) {
                    var current = pooled ? shared : options(listener);
                    long started = System.nanoTime();
                    var client = new PayOS(current);
                    assertEquals(order,client.paymentRequests().get(order).getOrderCode());
                    values.add((System.nanoTime()-started)/1_000_000d);
                    if(!pooled)client.close();
                }
            } finally { if(shared!=null)shared.close(); }
            values.sort(Double::compare);
            // Per-request TLS cost: a reused connection performs no handshake (zero cost).
            while(tls.size()<30)tls.add(0d);tls.sort(Double::compare);
            report.put(pooled?"pooled":"per_operation",Map.of("n",30,"p50_ms",values.get(14),"p95_ms",values.get(28),"p99_ms",values.get(29),"tls_handshakes",tlsCount.get(),"tls_p50_ms",tls.get(14),"tls_p95_ms",tls.get(28),"tls_p99_ms",tls.get(29)));
            assertEquals(pooled?1:30,tlsCount.get());
        }
        Path output = Path.of("target/payos-transport-performance.json"); Files.createDirectories(output.getParent()); json.writerWithDefaultPrettyPrinter().writeValue(output.toFile(),report);
        System.out.println("PAYOS_TRANSPORT_PERF " + json.writeValueAsString(report));
    }
}
