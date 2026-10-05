package com.example.backend.config;

import com.example.backend.exception.ApiException;
import com.example.backend.service.AuthAbuseGuard;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Set;

@Component
public class RequestSizeLimitFilter extends OncePerRequestFilter {
    private static final long DEFAULT_JSON_LIMIT = 2 * 1024 * 1024L;
    private static final long SUPPLIER_REGISTRATION_LIMIT = 4 * 1024 * 1024L;
    private static final Set<String> METHODS_WITH_BODY = Set.of("POST", "PUT", "PATCH");
    private static final Set<String> REGISTRATION_PATHS = Set.of(
            "/api/v1/auth/register", "/api/v1/auth/register-supplier");
    private final AuthAbuseGuard abuseGuard;

    public RequestSizeLimitFilter(AuthAbuseGuard abuseGuard) {
        this.abuseGuard = abuseGuard;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long contentLength = request.getContentLengthLong();
        long limit = "/api/v1/auth/register-supplier".equals(request.getRequestURI())
                ? SUPPLIER_REGISTRATION_LIMIT
                : DEFAULT_JSON_LIMIT;
        if (contentLength > limit) {
            reject(response);
            return;
        }
        if ("POST".equals(request.getMethod()) && REGISTRATION_PATHS.contains(request.getRequestURI())) {
            try {
                abuseGuard.checkRegistration(request.getRemoteAddr());
            } catch (ApiException ex) {
                response.setStatus(ex.getStatus().value());
                response.setHeader("Retry-After", "60");
                response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                response.setContentType("application/json");
                response.getWriter().write("{\"code\":\"RATE_LIMITED\",\"message\":\"Bạn đã thử quá nhiều lần. Vui lòng đợi rồi thử lại\"}");
                return;
            }
        }
        if (!METHODS_WITH_BODY.contains(request.getMethod()) || contentLength == 0) {
            chain.doFilter(request, response);
            return;
        }

        // Content-Length is optional for chunked requests, so enforce the same cap while reading.
        byte[] body = request.getInputStream().readNBytes(Math.toIntExact(limit) + 1);
        if (body.length > limit) {
            reject(response);
            return;
        }
        chain.doFilter(new CachedBodyRequest(request, body), response);
    }

    private void reject(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json");
        response.getWriter().write("{\"code\":\"REQUEST_TOO_LARGE\",\"message\":\"Dữ liệu gửi lên vượt quá giới hạn cho phép\"}");
    }

    private static final class CachedBodyRequest extends HttpServletRequestWrapper {
        private final byte[] body;

        private CachedBodyRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream input = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override public boolean isFinished() { return input.available() == 0; }
                @Override public boolean isReady() { return true; }
                @Override public void setReadListener(ReadListener listener) {
                    try {
                        if (input.available() > 0) listener.onDataAvailable();
                        if (input.available() == 0) listener.onAllDataRead();
                    } catch (IOException ex) {
                        listener.onError(ex);
                    }
                }
                @Override public int read() { return input.read(); }
                @Override public int read(byte[] target, int offset, int length) { return input.read(target, offset, length); }
            };
        }

        @Override
        public BufferedReader getReader() {
            String encoding = getCharacterEncoding();
            Charset charset = encoding == null ? StandardCharsets.UTF_8 : Charset.forName(encoding);
            return new BufferedReader(new InputStreamReader(getInputStream(), charset));
        }

        @Override public int getContentLength() { return body.length; }
        @Override public long getContentLengthLong() { return body.length; }
    }
}
