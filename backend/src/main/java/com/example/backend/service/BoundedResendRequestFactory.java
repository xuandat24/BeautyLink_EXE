package com.example.backend.service;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import org.springframework.http.*;
import org.springframework.http.client.*;
import java.io.*;
import java.net.URI;
import java.util.concurrent.TimeUnit;

/** Existing OkHttp dependency; one cancellable deadline includes reading the entire provider body. */
final class BoundedResendRequestFactory implements ClientHttpRequestFactory, AutoCloseable {
    private static final int MAX_RESPONSE_BYTES = 64 * 1024;
    private final OkHttpClient client;
    BoundedResendRequestFactory(long connectMs, long readMs) {
        if (connectMs <= 0 || readMs <= 0) throw new IllegalArgumentException("Resend timeouts must be positive");
        long connect = Math.min(connectMs, 15_000), read = Math.min(readMs, 15_000);
        client = new OkHttpClient.Builder().connectTimeout(connect, TimeUnit.MILLISECONDS)
                .readTimeout(read, TimeUnit.MILLISECONDS).writeTimeout(read, TimeUnit.MILLISECONDS)
                .callTimeout(Math.min(15_000, connect + read), TimeUnit.MILLISECONDS)
                .retryOnConnectionFailure(false).followRedirects(false).followSslRedirects(false).build();
    }
    @Override public ClientHttpRequest createRequest(URI uri, HttpMethod method) {
        return new AbstractClientHttpRequest() {
            private final ByteArrayOutputStream body = new ByteArrayOutputStream();
            @Override public URI getURI() { return uri; }
            @Override public HttpMethod getMethod() { return method; }
            @Override protected OutputStream getBodyInternal(HttpHeaders headers) { return body; }
            @Override protected ClientHttpResponse executeInternal(HttpHeaders headers) throws IOException {
                var request = new Request.Builder().url(uri.toString());
                headers.forEach((key, values) -> values.forEach(value -> request.addHeader(key, value)));
                var mediaType = okhttp3.MediaType.parse(headers.getFirst(HttpHeaders.CONTENT_TYPE) == null ? "application/json" : headers.getFirst(HttpHeaders.CONTENT_TYPE));
                request.method(method.name(), method == HttpMethod.GET || method == HttpMethod.HEAD ? null : RequestBody.create(body.toByteArray(), mediaType));
                try (var response = client.newCall(request.build()).execute()) {
                    // Buffer under the call deadline, not later during Jackson extraction after headers.
                    byte[] bytes = response.body() == null ? new byte[0] : response.body().byteStream().readNBytes(MAX_RESPONSE_BYTES + 1);
                    if (bytes.length > MAX_RESPONSE_BYTES) throw new IOException("Resend response exceeds safe size");
                    HttpHeaders resultHeaders = new HttpHeaders();
                    response.headers().toMultimap().forEach(resultHeaders::put);
                    var status = HttpStatusCode.valueOf(response.code()); var text = response.message();
                    return new ClientHttpResponse() {
                        private final InputStream input = new ByteArrayInputStream(bytes);
                        @Override public HttpStatusCode getStatusCode() { return status; }
                        @Override public String getStatusText() { return text; }
                        @Override public HttpHeaders getHeaders() { return HttpHeaders.readOnlyHttpHeaders(resultHeaders); }
                        @Override public InputStream getBody() { return input; }
                        @Override public void close() { /* network body already closed */ }
                    };
                }
            }
        };
    }
    @Override public void close() { client.dispatcher().executorService().shutdown(); client.connectionPool().evictAll(); }
}
