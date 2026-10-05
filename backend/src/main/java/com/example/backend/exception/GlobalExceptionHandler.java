package com.example.backend.exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    public record ErrorResponse(String code, String message, Map<String, String> fields, Instant timestamp) {}
    @ExceptionHandler(ApiException.class) ResponseEntity<ErrorResponse> api(ApiException ex) {
        return ResponseEntity.status(ex.getStatus()).body(new ErrorResponse(ex.getCode(), ex.getMessage(), Map.of(), Instant.now()));
    }
    @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(e -> fields.putIfAbsent(e.getField(), e.getDefaultMessage()));
        return ResponseEntity.badRequest().body(new ErrorResponse("VALIDATION_ERROR", "Dữ liệu không hợp lệ", fields, Instant.now()));
    }
    @ExceptionHandler(DataIntegrityViolationException.class) ResponseEntity<ErrorResponse> conflict(DataIntegrityViolationException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse("CONFLICT", "Dữ liệu đã tồn tại hoặc khung giờ vừa được đặt", Map.of(), Instant.now()));
    }
    @ExceptionHandler(ConstraintViolationException.class) ResponseEntity<ErrorResponse> constraint(ConstraintViolationException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getConstraintViolations().forEach(v -> fields.putIfAbsent(v.getPropertyPath().toString(), v.getMessage()));
        return ResponseEntity.badRequest().body(new ErrorResponse("VALIDATION_ERROR", "Dữ liệu không hợp lệ", fields, Instant.now()));
    }
    @ExceptionHandler(HttpMessageNotReadableException.class) ResponseEntity<ErrorResponse> unreadable() {
        return ResponseEntity.badRequest().body(new ErrorResponse("INVALID_REQUEST", "Dữ liệu gửi lên sai định dạng hoặc chứa lựa chọn không hợp lệ", Map.of(), Instant.now()));
    }
    @ExceptionHandler(AccessDeniedException.class) ResponseEntity<ErrorResponse> denied() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ErrorResponse("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này", Map.of(), Instant.now()));
    }
    @ExceptionHandler(Exception.class) ResponseEntity<ErrorResponse> other(Exception ex) {
        log.error("Unhandled API exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ErrorResponse("INTERNAL_ERROR", "Đã xảy ra lỗi hệ thống", Map.of(), Instant.now()));
    }
}
