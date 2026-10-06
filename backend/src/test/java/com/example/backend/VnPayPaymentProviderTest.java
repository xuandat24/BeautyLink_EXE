package com.example.backend;

import com.example.backend.exception.ApiException;
import com.example.backend.service.VnPayPaymentProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

import static com.example.backend.service.PaymentProviderAdapter.OutcomeStatus.PAID;
import static org.junit.jupiter.api.Assertions.*;

class VnPayPaymentProviderTest {
    private static final String SECRET = "test-vnpay-hash-secret";

    @Test
    void verifiesHmacAndRequiresBothSuccessCodes() throws Exception {
        VnPayPaymentProvider provider = provider();
        Map<String, String> callback = validCallback();

        VnPayPaymentProvider.VerifiedCallback verified = provider.verifyCallback(callback);

        assertEquals("REF-51", verified.merchantReference());
        assertEquals(PAID, verified.outcome().status());
        assertEquals("250000", verified.outcome().amount().toPlainString());
    }

    @Test
    void rejectsTamperedCallbackBeforeItCanReachPaymentCore() throws Exception {
        VnPayPaymentProvider provider = provider();
        Map<String, String> callback = validCallback();
        callback.put("vnp_Amount", "99999900");

        ApiException error = assertThrows(ApiException.class, () -> provider.verifyCallback(callback));
        assertEquals("VNPAY_INVALID_SIGNATURE", error.getCode());
    }

    private VnPayPaymentProvider provider() {
        return new VnPayPaymentProvider("TMNTEST", SECRET, "https://sandbox.vnpayment.vn/pay",
                "https://api.example/vnpay/return", "https://sandbox.vnpayment.vn/query", "127.0.0.1",
                new ObjectMapper());
    }

    private Map<String, String> validCallback() throws Exception {
        Map<String, String> values = new TreeMap<>();
        values.put("vnp_TmnCode", "TMNTEST");
        values.put("vnp_TxnRef", "REF-51");
        values.put("vnp_Amount", "25000000");
        values.put("vnp_ResponseCode", "00");
        values.put("vnp_TransactionStatus", "00");
        values.put("vnp_TransactionNo", "14123456");
        values.put("vnp_BankCode", "NCB");
        values.put("vnp_PayDate", "20261006101530");
        String canonical = values.entrySet().stream()
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .reduce((left, right) -> left + "&" + right).orElseThrow();
        Mac mac = Mac.getInstance("HmacSHA512");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
        values.put("vnp_SecureHash", HexFormat.of().formatHex(mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8))));
        return values;
    }

    private String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
}
