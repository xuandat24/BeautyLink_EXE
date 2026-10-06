package com.example.backend.service;

import com.example.backend.exception.ApiException;
import com.example.backend.model.PaymentTransaction;
import com.example.backend.model.UserAccount;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

import static com.example.backend.model.DomainEnums.PaymentProvider.VNPAY;

@Component
public class VnPayPaymentProvider implements PaymentProviderAdapter {
    private static final String VERSION = "2.1.0";
    private static final ZoneId VNPAY_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter VNPAY_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final BigDecimal VNPAY_SCALE = new BigDecimal("100");

    private final String tmnCode;
    private final String hashSecret;
    private final String payUrl;
    private final String returnUrl;
    private final String queryUrl;
    private final String serverIp;
    private final ObjectMapper objectMapper;
    private volatile HttpClient httpClient;

    public VnPayPaymentProvider(
            @Value("${app.vnpay.tmn-code:}") String tmnCode,
            @Value("${app.vnpay.hash-secret:}") String hashSecret,
            @Value("${app.vnpay.pay-url:https://sandbox.vnpayment.vn/paymentv2/vpcpay.html}") String payUrl,
            @Value("${app.vnpay.return-url:}") String returnUrl,
            @Value("${app.vnpay.query-url:https://sandbox.vnpayment.vn/merchant_webapi/api/transaction}") String queryUrl,
            @Value("${app.vnpay.server-ip:127.0.0.1}") String serverIp,
            ObjectMapper objectMapper) {
        this.tmnCode = tmnCode;
        this.hashSecret = hashSecret;
        this.payUrl = payUrl;
        this.returnUrl = returnUrl;
        this.queryUrl = queryUrl;
        this.serverIp = serverIp;
        this.objectMapper = objectMapper;
    }

    @Override public com.example.backend.model.DomainEnums.PaymentProvider provider() { return VNPAY; }
    @Override public boolean isConfigured() {
        return StringUtils.hasText(tmnCode) && StringUtils.hasText(hashSecret)
                && StringUtils.hasText(payUrl) && StringUtils.hasText(returnUrl);
    }

    @Override
    public CheckoutSession createCheckout(PaymentTransaction payment, UserAccount customer, String clientIp) {
        ensureConfigured();
        Instant createdAt = Instant.now();
        payment.setProviderCreatedAt(createdAt);
        Map<String, String> fields = new TreeMap<>();
        fields.put("vnp_Version", VERSION);
        fields.put("vnp_Command", "pay");
        fields.put("vnp_TmnCode", tmnCode);
        fields.put("vnp_Amount", vnpAmount(payment.getAmount()));
        fields.put("vnp_CurrCode", "VND");
        fields.put("vnp_TxnRef", payment.getMerchantReference());
        fields.put("vnp_OrderInfo", "Thanh toan " + payment.getBooking().getBookingCode());
        fields.put("vnp_OrderType", "other");
        fields.put("vnp_ReturnUrl", returnUrl);
        fields.put("vnp_IpAddr", validIp(clientIp));
        fields.put("vnp_Locale", "vn");
        fields.put("vnp_CreateDate", format(createdAt));
        fields.put("vnp_ExpireDate", format(payment.getExpiresAt()));
        String query = canonical(fields);
        return new CheckoutSession(null, payUrl + "?" + query + "&vnp_SecureHash=" + hmac(query), createdAt);
    }

    @Override
    public ProviderOutcome query(PaymentTransaction payment) {
        ensureConfigured();
        if (payment.getProviderCreatedAt() == null) {
            throw new ApiException(HttpStatus.CONFLICT, "VNPAY_MISSING_CREATE_DATE", "Giao dịch thiếu thời điểm tạo để đối soát VNPAY");
        }
        String requestId = UUID.randomUUID().toString().replace("-", "").substring(0, 32);
        String createDate = format(Instant.now());
        String transactionDate = format(payment.getProviderCreatedAt());
        String orderInfo = "Doi soat " + payment.getMerchantReference();
        String signData = String.join("|", requestId, VERSION, "querydr", tmnCode,
                payment.getMerchantReference(), transactionDate, createDate, serverIp, orderInfo);
        Map<String, String> requestBody = new LinkedHashMap<>();
        requestBody.put("vnp_RequestId", requestId);
        requestBody.put("vnp_Version", VERSION);
        requestBody.put("vnp_Command", "querydr");
        requestBody.put("vnp_TmnCode", tmnCode);
        requestBody.put("vnp_TxnRef", payment.getMerchantReference());
        requestBody.put("vnp_OrderInfo", orderInfo);
        requestBody.put("vnp_TransactionDate", transactionDate);
        requestBody.put("vnp_CreateDate", createDate);
        requestBody.put("vnp_IpAddr", serverIp);
        requestBody.put("vnp_SecureHash", hmac(signData));
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(queryUrl))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                    .build();
            HttpResponse<String> response = httpClient().send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() / 100 != 2) throw reconciliationFailed();
            Map<String, Object> data = objectMapper.readValue(response.body(), new TypeReference<>() {});
            verifyQueryResponse(data);
            if (!"00".equals(value(data, "vnp_ResponseCode"))) throw reconciliationFailed();
            return outcome(data);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw reconciliationFailed();
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw reconciliationFailed();
        }
    }

    public VerifiedCallback verifyCallback(Map<String, String> parameters) {
        ensureConfigured();
        verifySignature(parameters);
        if (!MessageDigest.isEqual(tmnCode.getBytes(StandardCharsets.UTF_8),
                required(parameters, "vnp_TmnCode").getBytes(StandardCharsets.UTF_8))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VNPAY_TMN_MISMATCH", "Mã merchant VNPAY không khớp");
        }
        String reference = required(parameters, "vnp_TxnRef");
        BigDecimal amount = fromVnpAmount(required(parameters, "vnp_Amount"));
        String responseCode = required(parameters, "vnp_ResponseCode");
        String transactionStatus = required(parameters, "vnp_TransactionStatus");
        OutcomeStatus status = mapStatus(responseCode, transactionStatus);
        Instant paidAt = parseTime(parameters.get("vnp_PayDate"));
        ProviderOutcome outcome = new ProviderOutcome(status, amount, parameters.get("vnp_TransactionNo"),
                parameters.get("vnp_BankTranNo"), responseCode, transactionStatus,
                parameters.get("vnp_BankCode"), parameters.get("vnp_CardType"), paidAt);
        return new VerifiedCallback(reference, outcome);
    }

    public String verifyReturnReference(Map<String, String> parameters) {
        return verifyCallback(parameters).merchantReference();
    }

    @Override public void cancel(PaymentTransaction payment, String reason) {
        // VNPAY PAY 2.1.0 has no per-checkout cancellation API. Closed attempts
        // remain immutable locally and any late payment is routed to manual review.
    }

    public record VerifiedCallback(String merchantReference, ProviderOutcome outcome) {}

    private ProviderOutcome outcome(Map<String, Object> data) {
        String responseCode = value(data, "vnp_ResponseCode");
        String transactionStatus = value(data, "vnp_TransactionStatus");
        return new ProviderOutcome(mapStatus(responseCode, transactionStatus),
                fromVnpAmount(value(data, "vnp_Amount")), value(data, "vnp_TransactionNo"), null,
                responseCode, transactionStatus, value(data, "vnp_BankCode"), null,
                parseTime(value(data, "vnp_PayDate")));
    }

    private OutcomeStatus mapStatus(String responseCode, String transactionStatus) {
        if ("00".equals(responseCode) && "00".equals(transactionStatus)) return OutcomeStatus.PAID;
        if ("24".equals(responseCode)) return OutcomeStatus.CANCELLED;
        if ("11".equals(responseCode)) return OutcomeStatus.EXPIRED;
        if ("04".equals(transactionStatus) || "07".equals(transactionStatus)) return OutcomeStatus.REVIEW_REQUIRED;
        if ("01".equals(transactionStatus)) return OutcomeStatus.PENDING;
        return OutcomeStatus.FAILED;
    }

    private void verifySignature(Map<String, String> parameters) {
        String supplied = required(parameters, "vnp_SecureHash").toLowerCase(Locale.ROOT);
        Map<String, String> signed = new TreeMap<>();
        parameters.forEach((key, value) -> {
            if (key.startsWith("vnp_") && !"vnp_SecureHash".equals(key) && !"vnp_SecureHashType".equals(key)
                    && value != null && !value.isEmpty()) signed.put(key, value);
        });
        String expected = hmac(canonical(signed));
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII), supplied.getBytes(StandardCharsets.US_ASCII))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VNPAY_INVALID_SIGNATURE", "Chữ ký VNPAY không hợp lệ");
        }
    }

    private void verifyQueryResponse(Map<String, Object> data) {
        String supplied = value(data, "vnp_SecureHash").toLowerCase(Locale.ROOT);
        String signData = String.join("|",
                value(data, "vnp_ResponseId"), value(data, "vnp_Command"), value(data, "vnp_ResponseCode"),
                value(data, "vnp_Message"), value(data, "vnp_TmnCode"), value(data, "vnp_TxnRef"),
                value(data, "vnp_Amount"), value(data, "vnp_BankCode"), value(data, "vnp_PayDate"),
                value(data, "vnp_TransactionNo"), value(data, "vnp_TransactionType"),
                value(data, "vnp_TransactionStatus"), value(data, "vnp_OrderInfo"),
                value(data, "vnp_PromotionCode"), value(data, "vnp_PromotionAmount"));
        String expected = hmac(signData);
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII), supplied.getBytes(StandardCharsets.US_ASCII))) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "VNPAY_INVALID_QUERY_SIGNATURE", "Chữ ký đối soát VNPAY không hợp lệ");
        }
    }

    private String canonical(Map<String, String> fields) {
        return fields.entrySet().stream()
                .filter(entry -> entry.getValue() != null && !entry.getValue().isEmpty())
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .reduce((left, right) -> left + "&" + right).orElse("");
    }

    private String hmac(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(hashSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("HmacSHA512 is required", exception);
        }
    }

    private String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
    private String format(Instant instant) { return VNPAY_TIME.format(instant.atZone(VNPAY_ZONE)); }
    private String vnpAmount(BigDecimal amount) { return amount.setScale(0, RoundingMode.UNNECESSARY).multiply(VNPAY_SCALE).toBigIntegerExact().toString(); }
    private BigDecimal fromVnpAmount(String amount) {
        try { return new BigDecimal(amount).divide(VNPAY_SCALE, 0, RoundingMode.UNNECESSARY); }
        catch (Exception exception) { throw new ApiException(HttpStatus.BAD_REQUEST, "VNPAY_INVALID_AMOUNT", "Số tiền VNPAY không hợp lệ"); }
    }
    private String validIp(String ip) {
        String candidate = ip == null ? "127.0.0.1" : ip.trim();
        return candidate.length() <= 45 && candidate.matches("^[0-9A-Fa-f:.]+$") ? candidate : "127.0.0.1";
    }
    private String required(Map<String, String> values, String key) {
        String value = values.get(key);
        if (!StringUtils.hasText(value)) throw new ApiException(HttpStatus.BAD_REQUEST, "VNPAY_INVALID_CALLBACK", "Callback VNPAY thiếu " + key);
        return value;
    }
    private String value(Map<String, Object> values, String key) {
        Object value = values.get(key);
        return value == null ? "" : String.valueOf(value);
    }
    private Instant parseTime(String raw) {
        if (!StringUtils.hasText(raw)) return null;
        try { return LocalDateTime.parse(raw, VNPAY_TIME).atZone(VNPAY_ZONE).toInstant(); }
        catch (Exception ignored) { return null; }
    }
    private void ensureConfigured() {
        if (!isConfigured()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "VNPAY_NOT_CONFIGURED", "Cổng VNPAY chưa được cấu hình trên máy chủ");
    }
    private HttpClient httpClient() {
        HttpClient current = httpClient;
        if (current == null) {
            synchronized (this) {
                current = httpClient;
                if (current == null) httpClient = current = HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(5)).build();
            }
        }
        return current;
    }
    private ApiException reconciliationFailed() {
        return new ApiException(HttpStatus.BAD_GATEWAY, "VNPAY_RECONCILIATION_FAILED", "Không thể đối soát giao dịch với VNPAY. Vui lòng thử lại");
    }
}
