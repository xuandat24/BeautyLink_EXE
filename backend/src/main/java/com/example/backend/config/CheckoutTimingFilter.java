package com.example.backend.config;

import com.example.backend.service.CheckoutTrace;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class CheckoutTimingFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(CheckoutTimingFilter.class);
    @Override protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/v1/payments/payos/") || request.getMethod().equals("OPTIONS");
    }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        var sample = CheckoutTrace.start();
        var buffered = new ContentCachingResponseWrapper(response);
        // Generated here, not taken from arbitrary client input or a booking identifier.
        buffered.setHeader("X-Checkout-Request-ID", sample.id);
        buffered.addHeader("Access-Control-Expose-Headers", "X-Checkout-Request-ID, Server-Timing, X-Checkout-SQL-Count");
        String operation = request.getMethod().equals("POST") ? "post" : "get";
        try { chain.doFilter(request, buffered); }
        finally {
            CheckoutTrace.finish();
            buffered.setHeader("Server-Timing", sample.header());
            buffered.setHeader("X-Checkout-SQL-Count", Integer.toString(sample.sqlCount()));
            log.info("checkout_timing correlation={} operation={} status={} sql_count={} timings={}", sample.id, operation, buffered.getStatus(), sample.sqlCount(), sample.header());
            CheckoutTrace.clear();
            buffered.copyBodyToResponse();
        }
    }
}
