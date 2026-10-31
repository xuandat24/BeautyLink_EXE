package com.example.backend.service;
import java.text.*;
import java.util.*;
/** Whole-name Vietnamese ordering; natural numbers; empty last; caller adds ID tie-breaker. */
public final class VietnameseDirectoryOrder {
    private VietnameseDirectoryOrder() {}
    public static String clean(String value) {return value==null?"":Normalizer.normalize(value,Normalizer.Form.NFC).strip().replaceAll("\\s+"," ");}
    public static int compare(String left,String right) {
        String a=clean(left),b=clean(right);if(a.isEmpty()||b.isEmpty())return a.isEmpty()?(b.isEmpty()?0:1):-1;
        Collator c=Collator.getInstance(Locale.forLanguageTag("vi"));c.setStrength(Collator.PRIMARY);
        int i=0,j=0;
        while(i<a.length()&&j<b.length()) {
            boolean d=Character.isDigit(a.charAt(i)),e=Character.isDigit(b.charAt(j));int x=i+1,y=j+1;
            while(x<a.length()&&Character.isDigit(a.charAt(x))==d)x++;
            while(y<b.length()&&Character.isDigit(b.charAt(y))==e)y++;
            int r=d&&e?new java.math.BigInteger(a.substring(i,x)).compareTo(new java.math.BigInteger(b.substring(j,y))):c.compare(a.substring(i,x),b.substring(j,y));
            if(r!=0)return r;i=x;j=y;
        }return Integer.compare(a.length()-i,b.length()-j);
    }
}
