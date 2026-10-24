package com.example.backend.controller;

import com.example.backend.dto.ApiDtos.*;
import com.example.backend.service.CurrentAccountService;
import com.example.backend.service.CustomerAvatarService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth/me/avatar")
public class CustomerAvatarController {
    private final CustomerAvatarService avatars;
    private final CurrentAccountService current;
    public CustomerAvatarController(CustomerAvatarService avatars, CurrentAccountService current) {
        this.avatars = avatars; this.current = current;
    }
    @PatchMapping
    public AuthResponse update(Authentication authentication, @Valid @RequestBody UpdateAvatarRequest request) {
        return avatars.update(current.require(authentication), request.image());
    }
}
