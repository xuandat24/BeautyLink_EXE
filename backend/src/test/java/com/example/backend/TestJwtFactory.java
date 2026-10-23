package com.example.backend;

import com.example.backend.auth.*;
import com.example.backend.model.AuthenticationSession;
import com.example.backend.repository.AuthenticationSessionRepository;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

/** Unit-test registry only; production always uses the JPA repository. */
public final class TestJwtFactory {
    public static JwtService create(String secret, long ttl) {
        var repository = mock(AuthenticationSessionRepository.class);
        Map<String, AuthenticationSession> rows = new HashMap<>();
        lenient().when(repository.save(any())).thenAnswer(call -> { AuthenticationSession row = call.getArgument(0); rows.put(row.getId(), row); return row; });
        lenient().when(repository.findById(anyString())).thenAnswer(call -> Optional.ofNullable(rows.get(call.getArgument(0))));
        return new JwtService(secret, ttl, new AuthenticationSessions(repository));
    }
}
