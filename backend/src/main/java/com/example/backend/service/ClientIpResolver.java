package com.example.backend.service;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.InetAddress;

/** Resolves the VNPAY customer IP without trusting caller-controlled proxy headers by default. */
@Component
public class ClientIpResolver {
    private final boolean trustProxyClientIp;

    public ClientIpResolver(@Value("${app.network.trust-proxy-client-ip:false}") boolean trustProxyClientIp) {
        this.trustProxyClientIp = trustProxyClientIp;
    }

    public String resolve(HttpServletRequest request) {
        if (trustProxyClientIp) {
            String railwayIp = normalizeLiteral(request.getHeader("X-Real-IP"));
            if (railwayIp != null) return railwayIp;
        }
        String remoteIp = normalizeLiteral(request.getRemoteAddr());
        return remoteIp == null ? "127.0.0.1" : remoteIp;
    }

    static String normalizeLiteral(String raw) {
        if (!StringUtils.hasText(raw)) return null;
        String value = raw.trim();
        if (value.length() > 45 || value.contains(",") || !value.matches("^[0-9A-Fa-f:.]+$")) return null;
        if (value.indexOf(':') < 0) {
            String[] parts = value.split("\\.", -1);
            if (parts.length != 4) return null;
            for (String part : parts) {
                if (part.isEmpty() || part.length() > 3) return null;
                try { if (Integer.parseInt(part) > 255) return null; }
                catch (NumberFormatException exception) { return null; }
            }
        }
        try { return InetAddress.getByName(value).getHostAddress(); }
        catch (Exception exception) { return null; }
    }
}
