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
    private final AuthenticationSessions sessions;
    public JwtAuthenticationFilter(JwtService jwtService, AccountDetailsService accountDetailsService, AuthenticationSessions sessions) {
        this.jwtService = jwtService; this.accountDetailsService = accountDetailsService;
        this.sessions = sessions;
    }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ") && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                String token = header.substring(7);
                var claims = jwtService.extractClaims(token);
                UserDetails details = accountDetailsService.loadUserForToken(claims, jwtService);
                var principal = (AccountDetailsService.AccountPrincipal) details;
                String sessionId = claims.get("sid", String.class);
                sessions.require(sessionId, principal.getAccountId());
                if (details.isEnabled() && details.isAccountNonLocked() && details.isAccountNonExpired()) {
                    var authenticated = new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities());
                    authenticated.setDetails(new JwtService.SessionIdentity(sessionId));
                    SecurityContextHolder.getContext().setAuthentication(authenticated);
                }
            } catch (JwtException | IllegalArgumentException | UsernameNotFoundException ignored) { }
        }
        chain.doFilter(request, response);
    }
}
