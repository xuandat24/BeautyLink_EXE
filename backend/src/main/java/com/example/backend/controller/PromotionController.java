package com.example.backend.controller;
import com.example.backend.dto.PromotionDtos.*;import com.example.backend.service.*;import jakarta.validation.Valid;import org.springframework.security.access.prepost.PreAuthorize;import org.springframework.security.core.Authentication;import org.springframework.web.bind.annotation.*;import java.util.List;
@RestController @RequestMapping("/api/v1")
public class PromotionController {
 @ExceptionHandler({org.springframework.dao.DataIntegrityViolationException.class,org.springframework.dao.PessimisticLockingFailureException.class,org.springframework.orm.ObjectOptimisticLockingFailureException.class})
 @ResponseStatus(org.springframework.http.HttpStatus.CONFLICT) public java.util.Map<String,String> conflict(RuntimeException ignored){return java.util.Map.of("code","PROMOTION_CHANGED","message","Mã đã tồn tại hoặc chương trình vừa thay đổi. Mở lại trước khi lưu.");}
 private final PromotionService promotions;private final CurrentAccountService current;
 public PromotionController(PromotionService promotions,CurrentAccountService current){this.promotions=promotions;this.current=current;}
 @GetMapping("/catalog/promotions") public List<View> active(){return promotions.active();}
 @GetMapping("/admin/promotions") @PreAuthorize("hasRole('ADMIN')") public List<View> list(){return promotions.list();}
 @PostMapping("/admin/promotions") @PreAuthorize("hasRole('ADMIN')") public View create(Authentication auth,@Valid @RequestBody Write request){return promotions.save(current.require(auth),null,request,true);}
 @PutMapping("/admin/promotions/{code}") @PreAuthorize("hasRole('ADMIN')") public View update(Authentication auth,@PathVariable String code,@Valid @RequestBody Write request){return promotions.save(current.require(auth),code,request,false);}
}
