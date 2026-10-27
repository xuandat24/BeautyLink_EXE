package com.example.backend;

/** Intentionally unbankable TESTONLY merchant. Test classpath only. */
public final class TestPayOSQr {
    public static String payload(long amount) {
        String value=Long.toString(amount);
        String body="00020101021238260010A0000007270108TESTONLY530370454"+String.format("%02d",value.length())+value+"5802VN62120108TESTONLY6304";
        int crc=0xffff;
        for(byte b:body.getBytes(java.nio.charset.StandardCharsets.UTF_8)){
            crc^=(b&255)<<8;
            for(int bit=0;bit<8;bit++)crc=((crc&0x8000)!=0?(crc<<1)^0x1021:crc<<1)&0xffff;
        }
        return body+String.format("%04X",crc);
    }
}
