package com.example.backend.community;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.*;

/** Bounds chunked bodies too, before JSON/Base64 deserialization. Other modules are untouched. */
@Component @Order(20)
public class CommunityBodyLimitFilter extends OncePerRequestFilter {
    static final int MAX_BODY=1_200_000;
    @Override protected boolean shouldNotFilter(HttpServletRequest r){return !r.getRequestURI().startsWith("/api/v1/community/") || !(r.getMethod().equals("POST") || r.getMethod().equals("PUT"));}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws IOException,ServletException{
        if(request.getContentLengthLong()>MAX_BODY){reject(response);return;}
        byte[] bytes=request.getInputStream().readNBytes(MAX_BODY+1);
        if(bytes.length>MAX_BODY){reject(response);return;}
        chain.doFilter(new HttpServletRequestWrapper(request){
            @Override public ServletInputStream getInputStream(){var input=new ByteArrayInputStream(bytes);return new ServletInputStream(){public int read(){return input.read();}public int read(byte[] b,int off,int len){return input.read(b,off,len);}public boolean isFinished(){return input.available()==0;}public boolean isReady(){return true;}public void setReadListener(ReadListener listener){throw new UnsupportedOperationException("Synchronous community body");}};}
            @Override public BufferedReader getReader(){return new BufferedReader(new InputStreamReader(getInputStream(),java.nio.charset.StandardCharsets.UTF_8));}
        },response);
    }
    private void reject(HttpServletResponse response)throws IOException{response.setStatus(413);response.setContentType("application/json");response.getWriter().write("{\"code\":\"COMMUNITY_PAYLOAD_TOO_LARGE\",\"message\":\"Nội dung hoặc ảnh quá lớn.\"}");}
}
