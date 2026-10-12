package com.example.backend.auth;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final AccountDetailsService accountDetailsService;
    public JwtAuthenticationFilter(JwtService jwtService, AccountDetailsService accountDetailsService) {
        this.jwtService = jwtService; this.accountDetailsService = accountDetailsService;
    }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ") && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                String token = header.substring(7);
                UserDetails details = accountDetailsService.loadUserForToken(jwtService.extractClaims(token), jwtService);
                if (details.isEnabled() && details.isAccountNonLocked() && details.isAccountNonExpired()) {
                    SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities()));
                }
            } catch (JwtException | IllegalArgumentException | UsernameNotFoundException ignored) { }
        }
        chain.doFilter(request, response);
    }
}
