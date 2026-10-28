package com.example.backend;

import com.example.backend.auth.JwtService;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import com.example.backend.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.locks.LockSupport;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import vn.payos.model.v2.paymentRequests.*;
import static com.example.backend.model.DomainEnums.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
 "spring.datasource.url=${REVIEW_TEST_JDBC_URL:jdbc:h2:mem:checkout-perf;MODE=MySQL;DB_CLOSE_DELAY=-1}",
 "spring.datasource.driver-class-name=${REVIEW_TEST_DRIVER:org.h2.Driver}",
 "spring.datasource.username=${REVIEW_TEST_USERNAME:sa}", "spring.datasource.password=${REVIEW_TEST_PASSWORD:}"
})
@ActiveProfiles("test") @AutoConfigureMockMvc
class CheckoutPerformanceIntegrationTest {
 @Autowired MockMvc mvc; @Autowired BookingRepository bookings; @Autowired ServiceOfferingRepository services;
 @Autowired PractitionerRepository practitioners; @Autowired UserAccountRepository users; @Autowired JwtService jwt;
 @Autowired PlatformTransactionManager manager; @Autowired ObjectMapper json;
 @MockitoBean PayOSGateway gateway;
 @BeforeAll static void guard() { String url=System.getenv("REVIEW_TEST_JDBC_URL"); if(url!=null&&!url.equals("jdbc:mysql://127.0.0.1:3306/beautylink_review_test"))throw new IllegalStateException("Isolated test DB only"); }
 @Test void thirtyRealJwtRequestsAttributeDatabaseTransactionsAndProviderLatency() throws Exception {
  when(gateway.create(any())).thenAnswer(invocation->{
   LockSupport.parkNanos(20_000_000L); CreatePaymentLinkRequest request=invocation.getArgument(0);
   var result=new CreatePaymentLinkResponse();result.setOrderCode(request.getOrderCode());result.setAmount(request.getAmount());
   result.setPaymentLinkId("perf-"+request.getOrderCode());result.setStatus(PaymentLinkStatus.PENDING);
   result.setQrCode(TestPayOSQr.payload(request.getAmount()));return result;
  });
  var customer=users.findByPhone("0900000001").orElseThrow();String token=jwt.createToken(customer);
  var samples=new LinkedHashMap<String,List<Double>>();String lastId=null;
  for(int i=0;i<30;i++) {
   final int index=i;
   Booking fixture=new TransactionTemplate(manager).execute(tx->{
    var service=services.findAll().stream().filter(s->!practitioners.findBySupplierIdAndActiveTrue(s.getSupplier().getId()).isEmpty()).findFirst().orElseThrow();
    Booking b=new Booking();b.setBookingCode("PERF-API-"+UUID.randomUUID().toString().substring(0,12));b.setCustomer(users.findById(customer.getId()).orElseThrow());
    b.setService(service);b.setSupplier(service.getSupplier());b.setPractitioner(practitioners.findBySupplierIdAndActiveTrue(service.getSupplier().getId()).getFirst());
    b.setAppointmentDate(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(3+index/8));b.setStartTime(LocalTime.of(9+index%8,0));b.setEndTime(b.getStartTime().plusHours(1));
    b.setTotalAmount(new BigDecimal("500000"));return bookings.saveAndFlush(b);
   });
   var response=mvc.perform(post("/api/v1/payments/payos/bookings/{id}",fixture.getId()).header("Authorization","Bearer "+token)
      .header("X-Checkout-Request-ID","untrusted-secret-marker").contentType("application/json").content("{\"paymentOption\":\"DEPOSIT_05\"}"))
      .andExpect(status().isOk()).andReturn().getResponse();
   String id=response.getHeader("X-Checkout-Request-ID");assertNotNull(id);assertDoesNotThrow(()->UUID.fromString(id));assertNotEquals(lastId,id);lastId=id;
   String timing=response.getHeader("Server-Timing");assertNotNull(timing);assertFalse(timing.contains("secret"));assertFalse(timing.contains("PERF-API"));
   for(String value:timing.split(",")){String[] pair=value.trim().split(";dur=");samples.computeIfAbsent(pair[0],key->new ArrayList<>()).add(Double.parseDouble(pair[1]));}
   int count=Integer.parseInt(response.getHeader("X-Checkout-SQL-Count"));assertTrue(count>0);samples.computeIfAbsent("sql_count",key->new ArrayList<>()).add((double)count);
   assertTrue(json.readTree(response.getContentAsString()).get("instructionsFreshForMs").asLong()>0);
  }
  var summary=new LinkedHashMap<String,Object>();samples.forEach((key,values)->{values.sort(Double::compare);summary.put(key,Map.of("n",values.size(),"p50",values.get(14),"p95",values.get(28),"p99",values.get(29)));});
  String db=System.getenv("REVIEW_TEST_JDBC_URL")==null?"H2":"MySQL8.4";
  json.writerWithDefaultPrettyPrinter().writeValue(Path.of("target/payos-jdbc-performance-"+db+".json").toFile(),summary);
  System.out.println("CHECKOUT_JDBC_PERF database="+db+" provider=synthetic20ms "+json.writeValueAsString(summary));
  verify(gateway,times(30)).create(any());verify(gateway,never()).get(any());
 }
}
