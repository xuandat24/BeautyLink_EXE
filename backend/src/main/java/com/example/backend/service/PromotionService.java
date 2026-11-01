package com.example.backend.service;
import com.example.backend.dto.PromotionDtos.*;import com.example.backend.exception.ApiException;import com.example.backend.model.*;import com.example.backend.model.DomainEnums.*;import com.example.backend.repository.*;import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;import org.springframework.transaction.annotation.Transactional;import org.springframework.transaction.support.TransactionSynchronizationManager;import org.springframework.http.HttpStatus;
import java.math.*;import java.time.*;import java.util.*;
@Service @Transactional(readOnly=true)
public class PromotionService {
 private final PromotionRepository rules;private final PromotionAuditRepository audits;private final ObjectMapper json;private Clock clock=Clock.systemUTC();
 public PromotionService(PromotionRepository rules,PromotionAuditRepository audits,ObjectMapper json){this.rules=rules;this.audits=audits;this.json=json;}
 private static Map<String,View> defaults(){var result=new LinkedHashMap<String,View>();
  for(var v:List.of(new View("BEAUTY50","Giảm 50.000đ","FIXED",new BigDecimal("50000"),new BigDecimal("200000"),null,null,null,"ENABLED","ACTIVE",-1),new View("BEAUTY100","Giảm 100.000đ","FIXED",new BigDecimal("100000"),new BigDecimal("500000"),null,null,null,"ENABLED","ACTIVE",-1),new View("PINK15","Giảm 15%, tối đa 150.000đ","PERCENT",new BigDecimal("15"),BigDecimal.ZERO,new BigDecimal("150000"),null,null,"ENABLED","ACTIVE",-1)))result.put(v.code(),v);return result;}
 private View view(Promotion p){var now=clock.instant();String state=!p.status.equals("ENABLED")?p.status:p.endsAt!=null&&!now.isBefore(p.endsAt)?"EXPIRED":p.startsAt!=null&&now.isBefore(p.startsAt)?"SCHEDULED":"ACTIVE";return new View(p.code,p.name,p.discountType,p.discountValue,p.minimumOrder,p.maximumDiscount,p.startsAt,p.endsAt,p.status,state,p.version);}
 public List<View> list(){var all=defaults();rules.findAll().forEach(p->all.put(p.code,view(p)));return all.values().stream().sorted(Comparator.comparing(View::code)).toList();}
 public List<View> active(){return list().stream().filter(v->v.state().equals("ACTIVE")).toList();}
 public BigDecimal discount(BigDecimal total,String rawCode){
  if(rawCode==null||rawCode.isBlank())return BigDecimal.ZERO;String code=rawCode.strip().toUpperCase(Locale.ROOT);
  boolean locked=TransactionSynchronizationManager.isActualTransactionActive()&&!TransactionSynchronizationManager.isCurrentTransactionReadOnly();
  var found=locked?rules.forQuote(code):rules.findByCode(code);var rule=found.map(this::view).orElseGet(()->defaults().get(code));
  if(rule==null||!rule.state().equals("ACTIVE"))throw bad("VOUCHER_INVALID","Mã giảm giá không hợp lệ, chưa bắt đầu hoặc đã ngừng.");
  if(total.compareTo(rule.minimumOrder())<0)throw bad("VOUCHER_MINIMUM_NOT_MET","Đơn hàng chưa đạt giá trị tối thiểu của mã giảm giá.");
  BigDecimal amount=rule.discountType().equals("FIXED")?rule.value():total.multiply(rule.value()).divide(new BigDecimal("100"),0,RoundingMode.HALF_UP);
  if(rule.maximumDiscount()!=null)amount=amount.min(rule.maximumDiscount());return amount.min(total).setScale(0,RoundingMode.HALF_UP);
 }
 @Transactional public View save(UserAccount actor,String pathCode,Write r,boolean create){
  if(actor.getRole()!=Role.ADMIN||actor.getStatus()!=AccountStatus.ACTIVE)throw new ApiException(HttpStatus.FORBIDDEN,"ADMIN_REQUIRED","Chỉ quản trị viên đang hoạt động được phép quản lý khuyến mãi.");
  String code=r.code().strip().toUpperCase(Locale.ROOT);if(pathCode!=null&&!code.equals(pathCode.toUpperCase(Locale.ROOT)))throw bad("CODE_IMMUTABLE","Không thể đổi mã chương trình.");
  if(r.endsAt()!=null&&r.startsAt()!=null&&!r.endsAt().isAfter(r.startsAt()))throw bad("INVALID_PERIOD","Ngày kết thúc phải sau ngày bắt đầu.");
  if(r.discountType().equals("PERCENT")&&(r.value().compareTo(new BigDecimal("100"))>0||r.maximumDiscount()==null))throw bad("INVALID_DISCOUNT","Phần trăm tối đa 100 và cần mức giảm tối đa.");
  if(r.discountType().equals("FIXED")&&r.value().stripTrailingZeros().scale()>0)throw bad("INVALID_DISCOUNT","Số tiền giảm phải là số đồng nguyên.");
  if(r.discountType().equals("FIXED")&&r.maximumDiscount()!=null)throw bad("INVALID_DISCOUNT","Mức giảm tối đa chỉ dùng cho giảm phần trăm.");
  var existing=rules.forUpdate(code);View before=existing.map(this::view).orElseGet(()->defaults().get(code));
  if(create&&before!=null)throw new ApiException(HttpStatus.CONFLICT,"CODE_EXISTS","Mã giảm giá đã tồn tại.");
  if(!create&&before==null)throw new ApiException(HttpStatus.NOT_FOUND,"PROMOTION_NOT_FOUND","Không tìm thấy chương trình.");
  if(r.expectedRevision()!=(before==null?-1:before.revision()))throw new ApiException(HttpStatus.CONFLICT,"PROMOTION_CHANGED","Chương trình đã thay đổi. Mở lại trước khi lưu.");
  Promotion p=existing.orElseGet(Promotion::new);p.code=code;p.name=r.name().strip();p.discountType=r.discountType();p.discountValue=r.value();p.minimumOrder=r.minimumOrder();p.maximumDiscount=r.maximumDiscount();p.startsAt=r.startsAt();p.endsAt=r.endsAt();p.status=r.status();p.updatedAt=clock.instant();rules.saveAndFlush(p);var after=view(p);
  try{var audit=new PromotionAudit();audit.actor=actor;audit.code=code;audit.action=create?"CREATE":"UPDATE";audit.beforeJson=before==null?null:json.writeValueAsString(before);audit.afterJson=json.writeValueAsString(after);audit.createdAt=clock.instant();audits.saveAndFlush(audit);}catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException("Cannot record promotion audit",e);}return after;
 }
 private static ApiException bad(String code,String message){return new ApiException(HttpStatus.BAD_REQUEST,code,message);}
}
