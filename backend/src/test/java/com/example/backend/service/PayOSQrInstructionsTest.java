package com.example.backend.service;
import com.example.backend.TestPayOSQr;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;
class PayOSQrInstructionsTest {
    @Test void exactProviderPayloadHasCorrectCrcAndAuthoritativeAmount() {
        String qr=TestPayOSQr.payload(25000);
        assertTrue(PayOSQrInstructions.usable(qr,new BigDecimal("25000.00")));
        assertFalse(PayOSQrInstructions.usable(qr,new BigDecimal("25001")));
        assertFalse(PayOSQrInstructions.usable(qr.substring(0,qr.length()-4)+"0000",new BigDecimal("25000")));
        for(String bad:new String[]{"TEST-QR-NOT-PAYABLE","https://pay.payos.vn/qr","<img src=x>","0002016304FFFF"})assertFalse(PayOSQrInstructions.usable(bad,BigDecimal.ONE));
        assertFalse(PayOSQrInstructions.usable(null,BigDecimal.ONE));
    }
}
