package com.example.backend.service;

import com.example.backend.community.*;
import com.example.backend.model.*;
import com.example.backend.repository.*;
import com.example.backend.exception.ApiException;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.util.*;
import java.util.concurrent.*;
import java.io.ByteArrayOutputStream;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.math.BigDecimal;
import static com.example.backend.model.DomainEnums.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"app.community.enabled=true","app.cloudinary.enabled=true","app.demo-data.enabled=false","app.partner-catalog.enabled=false"})
@AutoConfigureMockMvc @ActiveProfiles("test") @DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class CommunityIntegrationTest {
    @org.springframework.test.context.DynamicPropertySource
    static void mysql(org.springframework.test.context.DynamicPropertyRegistry properties) {
        String url = System.getenv("REVIEW_TEST_JDBC_URL");
        if (url == null) return;
        if (!url.equals("jdbc:mysql://127.0.0.1:3306/beautylink_review_test")) throw new IllegalStateException("Isolated MySQL only");
        properties.add("spring.datasource.url", () -> url);
        properties.add("spring.datasource.driver-class-name", () -> "com.mysql.cj.jdbc.Driver");
        properties.add("spring.datasource.username", () -> System.getenv("REVIEW_TEST_USERNAME"));
        properties.add("spring.datasource.password", () -> System.getenv("REVIEW_TEST_PASSWORD"));
    }

    @Autowired CommunityService community;
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired UserAccountRepository users;
    @Autowired SupplierRepository suppliers; @Autowired ServiceOfferingRepository services; @Autowired PractitionerRepository practitioners;
    @Autowired ServiceCategoryRepository categories; @Autowired PasswordEncoder passwords;
    @Autowired CommunityPostRepository posts; @Autowired CommunityMediaRepository media; @Autowired CommunityReactionRepository reactions;
    @Autowired CommunityModerationRepository audits; @Autowired AuthenticationSessionRepository sessions;
    @MockitoBean CloudinaryImageGateway gateway;
    record Member(UserAccount account,String token){}
    private static final String API="/api/v1/community";
    private Member member(Role role)throws Exception{
        String email="community-"+UUID.randomUUID()+"@example.com";
        var u=new UserAccount();u.setFullName("Người dùng Community");u.setEmail(email);u.setPasswordHash(passwords.encode("Synthetic Community123!"));u.setRole(role);users.saveAndFlush(u);
        String token=json.readTree(mvc.perform(post("/api/v1/auth/login").with(r->{r.setRemoteAddr("test-"+email);return r;}).contentType("application/json").content(json.writeValueAsString(Map.of("identifier",email,"password","Synthetic Community123!")))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("accessToken").asText();
        assertFalse(token.isBlank());return new Member(u,token);
    }
    private Map<String,Object> postBody(String content){var r=new HashMap<String,Object>();r.put("requestKey",UUID.randomUUID().toString());r.put("content",content);r.put("category","GENERAL");r.put("identity","ACCOUNT");r.put("media",List.of());return r;}
    private JsonNode create(Member m,Map<String,Object> body)throws Exception{return result(mvc.perform(post(API+"/posts").header("Authorization","Bearer "+m.token()).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isCreated()));}
    private JsonNode result(ResultActions action)throws Exception{return json.readTree(action.andReturn().getResponse().getContentAsString());}
    private Supplier salon(Member owner){var s=new Supplier();s.setOwner(owner.account());s.setName("Salon thật");s.setSlug("community-"+UUID.randomUUID());s.setAddressLine("Hà Nội");s.setVerificationStatus(VerificationStatus.VERIFIED);return suppliers.saveAndFlush(s);}
    private ServiceOffering service(Supplier salon){var c=new ServiceCategory();c.setName("Nail");c.setSlug("community-"+UUID.randomUUID());categories.saveAndFlush(c);var s=new ServiceOffering();s.setSupplier(salon);s.setCategory(c);s.setName("Nail art");s.setPrice(BigDecimal.valueOf(200000));s.setDurationMinutes(60);return services.saveAndFlush(s);}
    @Test void guestReadPrivateWritesAndModerationAreProtected()throws Exception{
        var m=member(Role.CUSTOMER);var p=create(m,postBody("Câu hỏi chăm sóc tóc"));
        mvc.perform(get(API+"/posts/"+p.path("id").asText())).andExpect(status().isOk()).andExpect(jsonPath("owned").value(false));
        for(String suffix:List.of("/posts","/posts/"+p.path("id").asText()+"/comments","/posts/"+p.path("id").asText()+"/reports"))mvc.perform(post(API+suffix).contentType("application/json").content("{}")).andExpect(status().isUnauthorized());
        mvc.perform(put(API+"/posts/"+p.path("id").asText()+"/reaction").contentType("application/json").content("{\"liked\":true}")).andExpect(status().isUnauthorized());
        for(Role role:List.of(Role.CUSTOMER,Role.SUPPLIER)){var other=member(role);mvc.perform(get(API+"/moderation/reports").header("Authorization","Bearer "+other.token())).andExpect(status().isForbidden());}
        var staff=member(Role.STAFF);mvc.perform(get(API+"/moderation/reports").header("Authorization","Bearer "+staff.token())).andExpect(status().isOk());
        String publicJson=mvc.perform(get(API+"/posts/"+p.path("id").asText())).andReturn().getResponse().getContentAsString();
        assertFalse(publicJson.contains(m.account().getEmail()));for(String key:List.of("password","phone","dateOfBirth","authorId","customerId","bookingCode","accessToken"))assertFalse(publicJson.contains("\""+key+"\""));
    }
    @Test void idempotentCreateStaleRevisionOwnershipAndSoftDelete()throws Exception{
        var m=member(Role.CUSTOMER);var other=member(Role.CUSTOMER);var body=postBody("Mẫu tóc mới");var p=create(m,body);assertEquals(p.path("id"),create(m,body).path("id"));
        body.put("content","Yêu cầu khác");mvc.perform(post(API+"/posts").header("Authorization","Bearer "+m.token()).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isConflict());
        body.put("revision",p.path("revision").asLong());String path=API+"/posts/"+p.path("id").asText();
        mvc.perform(put(path).header("Authorization","Bearer "+other.token()).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isForbidden());
        var updated=result(mvc.perform(put(path).header("Authorization","Bearer "+m.token()).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isOk()));assertEquals("Yêu cầu khác",updated.path("content").asText());
        mvc.perform(put(path).header("Authorization","Bearer "+m.token()).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isConflict());
        mvc.perform(delete(path).param("revision",updated.path("revision").asText()).header("Authorization","Bearer "+m.token())).andExpect(status().isNoContent());mvc.perform(get(path)).andExpect(status().isNotFound());
    }
    @Test void inputBoundsAndSuspendedAccountsFailClosed()throws Exception{
        var m=member(Role.CUSTOMER);for(String value:List.of(" ","x".repeat(5001))){var body=postBody(value);mvc.perform(post(API+"/posts").header("Authorization","Bearer "+m.token()).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isBadRequest());}
        mvc.perform(get(API+"/posts").param("size","51")).andExpect(status().isBadRequest());mvc.perform(get(API+"/posts").param("before","not-uuid")).andExpect(status().isBadRequest());
        mvc.perform(post(API+"/media").header("Authorization","Bearer "+m.token()).contentType("application/json").content("{\"image\":\""+"a".repeat(1_200_001)+"\"}")).andExpect(status().isPayloadTooLarge());
        var u=users.findById(m.account().getId()).orElseThrow();u.setStatus(AccountStatus.SUSPENDED);users.saveAndFlush(u);
        mvc.perform(post(API+"/posts").header("Authorization","Bearer "+m.token()).contentType("application/json").content(json.writeValueAsString(postBody("blocked")))) .andExpect(status().isUnauthorized());
    }
    @Test void professionalAndServiceOwnershipAreServerDerived()throws Exception{
        var owner=member(Role.SUPPLIER);var other=member(Role.SUPPLIER);var a=salon(owner);var b=salon(other);var s=service(a);var wrong=service(b);
        var body=postBody("Tác phẩm nail");body.put("identity","SALON");body.put("salonId",a.getId());body.put("serviceId",s.getId());
        var p=create(owner,body);assertTrue(p.path("author").path("verifiedSalon").asBoolean());assertEquals(200000,p.path("service").path("price").asInt());assertEquals(s.getId(),p.path("service").path("id").asLong());
        body.put("requestKey",UUID.randomUUID().toString());body.put("salonId",b.getId());mvc.perform(post(API+"/posts").header("Authorization","Bearer "+owner.token()).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isForbidden());
        body.put("salonId",a.getId());body.put("serviceId",wrong.getId());mvc.perform(post(API+"/posts").header("Authorization","Bearer "+owner.token()).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isForbidden());
        var customer=member(Role.CUSTOMER);var person=new Practitioner();person.setDisplayName("Chuyên viên liên kết");person.setSupplier(a);person.setUser(customer.account());practitioners.saveAndFlush(person);
        body=postBody("Chia sẻ nghề");body.put("identity","PRACTITIONER");body.put("salonId",a.getId());body.put("practitionerId",person.getId());body.put("serviceId",s.getId());var professional=create(customer,body);assertEquals("PRACTITIONER",professional.path("author").path("identity").asText());
        body.put("requestKey",UUID.randomUUID().toString());mvc.perform(post(API+"/posts").header("Authorization","Bearer "+owner.token()).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isForbidden());
        var recommendation=create(customer,postWithService(s.getId()));assertEquals("ACCOUNT",recommendation.path("author").path("identity").asText());assertFalse(recommendation.path("author").path("verifiedSalon").asBoolean());
        s.setActive(false);services.saveAndFlush(s);mvc.perform(get(API+"/posts/"+p.path("id").asText())).andExpect(status().isOk()).andExpect(jsonPath("service").doesNotExist());
    }
    private Map<String,Object> postWithService(Long id){var body=postBody("Gợi ý dịch vụ");body.put("serviceId",id);return body;}
    @Test void commentReplyIdempotencyAndDeletedContext()throws Exception{
        var m=member(Role.CUSTOMER);var other=member(Role.CUSTOMER);var p=create(m,postBody("Thảo luận"));String path=API+"/posts/"+p.path("id").asText()+"/comments";
        var body=new HashMap<String,Object>();body.put("requestKey",UUID.randomUUID().toString());body.put("content","Câu hỏi");var c=result(mvc.perform(post(path).header("Authorization","Bearer "+m.token()).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isCreated()));
        assertEquals(c.path("id"),result(mvc.perform(post(path).header("Authorization","Bearer "+m.token()).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isCreated())).path("id"));
        var reply=new HashMap<>(body);reply.put("requestKey",UUID.randomUUID().toString());reply.put("parent",c.path("id").asText());reply.put("content","Trả lời");var r=result(mvc.perform(post(path).header("Authorization","Bearer "+other.token()).contentType("application/json").content(json.writeValueAsString(reply))).andExpect(status().isCreated()));
        reply.put("requestKey",UUID.randomUUID().toString());reply.put("parent",r.path("id").asText());mvc.perform(post(path).header("Authorization","Bearer "+m.token()).contentType("application/json").content(json.writeValueAsString(reply))).andExpect(status().isBadRequest());
        body.put("revision",c.path("revision").asLong());body.put("content","Câu hỏi cập nhật");mvc.perform(put(path+"/"+c.path("id").asText()).header("Authorization","Bearer "+other.token()).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isForbidden());
        c=result(mvc.perform(put(path+"/"+c.path("id").asText()).header("Authorization","Bearer "+m.token()).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isOk()));
        assertEquals("Câu hỏi cập nhật",c.path("content").asText());
        mvc.perform(delete(path+"/"+c.path("id").asText()).param("revision",c.path("revision").asText()).header("Authorization","Bearer "+m.token())).andExpect(status().isOk());
        mvc.perform(get(path)).andExpect(status().isOk()).andExpect(jsonPath("items[0].visibility").value("DELETED")).andExpect(jsonPath("items[0].content").doesNotExist());mvc.perform(get(path).param("parent",c.path("id").asText())).andExpect(status().isOk()).andExpect(jsonPath("items[0].content").value("Trả lời"));
        mvc.perform(get(API+"/posts/"+p.path("id").asText())).andExpect(jsonPath("commentCount").value(1));
    }
    @Test void concurrentReactionsAndCreateRetriesHaveOneEffect()throws Exception{
        var m=member(Role.CUSTOMER);var other=member(Role.CUSTOMER);var body=postBody("Đăng đồng thời");var start=new CountDownLatch(1);try(var pool=Executors.newFixedThreadPool(2)){
            Callable<JsonNode> create=()->{start.await();return create(m,body);};var a=pool.submit(create);var b=pool.submit(create);start.countDown();var p=a.get(15,TimeUnit.SECONDS);assertEquals(p.path("id"),b.get(15,TimeUnit.SECONDS).path("id"));String path=API+"/posts/"+p.path("id").asText()+"/reaction";
            var latch=new CountDownLatch(1);List<Future<?>> calls=new ArrayList<>();for(var member:List.of(m,other))calls.add(pool.submit(()->{latch.await();mvc.perform(put(path).header("Authorization","Bearer "+member.token()).contentType("application/json").content("{\"liked\":true}")).andExpect(status().isOk());return null;}));latch.countDown();for(var f:calls)f.get(15,TimeUnit.SECONDS);
            mvc.perform(put(path).header("Authorization","Bearer "+m.token()).contentType("application/json").content("{\"liked\":true}")).andExpect(jsonPath("likeCount").value(2));
            mvc.perform(put(path).header("Authorization","Bearer "+m.token()).contentType("application/json").content("{\"liked\":false}")).andExpect(jsonPath("likeCount").value(1));mvc.perform(put(path).header("Authorization","Bearer "+m.token()).contentType("application/json").content("{\"liked\":false}")).andExpect(jsonPath("likeCount").value(1));
        }
    }
    @Test void keysetPaginationStaysStableAcrossEditsAndDeletion()throws Exception{
        var m=member(Role.CUSTOMER);String marker="pagination-"+UUID.randomUUID();var a=create(m,postBody(marker+" first"));var b=create(m,postBody(marker+" second"));var c=create(m,postBody(marker+" third"));
        var first=result(mvc.perform(get(API+"/posts").param("q",marker).param("size","1")).andExpect(status().isOk()));assertEquals(c.path("id"),first.path("items").get(0).path("id"));String cursor=first.path("nextCursor").asText();
        mvc.perform(delete(API+"/posts/"+c.path("id").asText()).param("revision",c.path("revision").asText()).header("Authorization","Bearer "+m.token())).andExpect(status().isNoContent());
        var second=result(mvc.perform(get(API+"/posts").param("q",marker).param("size","1").param("before",cursor)).andExpect(status().isOk()));assertEquals(b.path("id"),second.path("items").get(0).path("id"));
        mvc.perform(get(API+"/posts").param("q",marker).param("before",second.path("nextCursor").asText())).andExpect(jsonPath("items[0].id").value(a.path("id").asText()));mvc.perform(get(API+"/posts").param("q","no-result-"+UUID.randomUUID())).andExpect(jsonPath("items").isEmpty());
    }
    @Test void reportsModerationAuditAndRestrictionsAreScoped()throws Exception{
        var m=member(Role.CUSTOMER);var staff=member(Role.STAFF);var admin=member(Role.ADMIN);var p=create(m,postBody("Nội dung cần xem xét"));String path=API+"/posts/"+p.path("id").asText();
        String report=mvc.perform(post(path+"/reports").header("Authorization","Bearer "+m.token()).contentType("application/json").content("{\"reason\":\"Thông tin sai\"}")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();assertEquals(report,mvc.perform(post(path+"/reports").header("Authorization","Bearer "+m.token()).contentType("application/json").content("{\"reason\":\"Lặp\"}")).andReturn().getResponse().getContentAsString());
        var action=Map.of("action","HIDE","reason","Vi phạm nội dung","revision",p.path("revision").asLong());var hidden=result(mvc.perform(put(API+"/moderation/posts/"+p.path("id").asText()).header("Authorization","Bearer "+staff.token()).contentType("application/json").content(json.writeValueAsString(action))).andExpect(status().isOk()));mvc.perform(get(path)).andExpect(status().isNotFound());
        mvc.perform(get(API+"/moderation/posts/"+p.path("id").asText()+"/history").header("Authorization","Bearer "+admin.token())).andExpect(status().isOk()).andExpect(jsonPath("[0].action").value("HIDE"));
        var block=Map.of("action","RESTRICT_AUTHOR","reason","Tạm hạn chế spam","revision",hidden.path("revision").asLong());mvc.perform(put(API+"/moderation/posts/"+p.path("id").asText()).header("Authorization","Bearer "+staff.token()).contentType("application/json").content(json.writeValueAsString(block))).andExpect(status().isForbidden());mvc.perform(put(API+"/moderation/posts/"+p.path("id").asText()).header("Authorization","Bearer "+admin.token()).contentType("application/json").content(json.writeValueAsString(block))).andExpect(status().isOk());
        mvc.perform(post(API+"/posts").header("Authorization","Bearer "+m.token()).contentType("application/json").content(json.writeValueAsString(postBody("blocked")))).andExpect(status().isForbidden());
        assertEquals(AccountStatus.ACTIVE,users.findById(m.account().getId()).orElseThrow().getStatus());assertEquals(Role.CUSTOMER,users.findById(m.account().getId()).orElseThrow().getRole());
    }
    @Test void imagesAreValidatedOwnedAndNeverPersistedAsBase64()throws Exception{
        var m=member(Role.CUSTOMER);var other=member(Role.CUSTOMER);String url="https://res.cloudinary.com/test/image/upload/v1/beautylink/public/"+UUID.randomUUID()+".webp";when(gateway.upload(any())).thenReturn(new CloudinaryImageGateway.UploadedImage("beautylink/public/"+UUID.randomUUID(),url));
        var bytes=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(20,20,BufferedImage.TYPE_INT_RGB),"png",bytes);String image="data:image/png;base64,"+Base64.getEncoder().encodeToString(bytes.toByteArray());
        var uploaded=result(mvc.perform(post(API+"/media").header("Authorization","Bearer "+m.token()).contentType("application/json").content(json.writeValueAsString(Map.of("image",image)))).andExpect(status().isCreated()));
        var body=postBody("Ảnh trải nghiệm");body.put("media",List.of(uploaded.path("id").asText()));mvc.perform(post(API+"/posts").header("Authorization","Bearer "+other.token()).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isForbidden());var p=create(m,body);assertEquals(url,p.path("media").get(0).path("url").asText());assertTrue(media.findAll().stream().noneMatch(x->x.getUrl().startsWith("data:")));
        mvc.perform(post(API+"/media").header("Authorization","Bearer "+m.token()).contentType("application/json").content("{\"image\":\"data:image/png;base64,PHNjcmlwdD4=\"}")).andExpect(status().isBadRequest());
        when(gateway.upload(any())).thenThrow(new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"IMAGE_STORAGE_UNAVAILABLE","Ảnh chưa được lưu"));long count=media.count();mvc.perform(post(API+"/media").header("Authorization","Bearer "+m.token()).contentType("application/json").content(json.writeValueAsString(Map.of("image",image)))).andExpect(status().isServiceUnavailable());assertEquals(count,media.count());
        mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+m.token())).andExpect(status().isOk());mvc.perform(post("/api/v1/auth/session/logout").header("Authorization","Bearer "+m.token())).andExpect(status().isNoContent());mvc.perform(post(API+"/posts").header("Authorization","Bearer "+m.token()).contentType("application/json").content(json.writeValueAsString(postBody("revoked")))).andExpect(status().isUnauthorized());
    }
    @Test void ownerEditIsPrivateAndReportsFollowContentRevision() throws Exception {
        var owner=member(Role.CUSTOMER);var other=member(Role.CUSTOMER);var admin=member(Role.ADMIN);
        var p=create(owner,postBody("Bản ban đầu"));String path=API+"/posts/"+p.path("id").asText();
        mvc.perform(get(path+"/edit")).andExpect(status().isUnauthorized());
        mvc.perform(get(path+"/edit").header("Authorization","Bearer "+other.token())).andExpect(status().isForbidden());
        mvc.perform(get(path+"/edit").header("Authorization","Bearer "+owner.token())).andExpect(status().isOk()).andExpect(jsonPath("fields.identity").value("ACCOUNT"));
        var report=Map.of("reason","Kiểm tra nội dung");
        String first=mvc.perform(post(path+"/reports").header("Authorization","Bearer "+other.token()).contentType("application/json").content(json.writeValueAsString(report))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var dismissed=result(mvc.perform(put(API+"/moderation/posts/"+p.path("id").asText()).header("Authorization","Bearer "+admin.token()).contentType("application/json").content(json.writeValueAsString(Map.of("action","DISMISS_REPORT","reason","Không vi phạm","revision",p.path("revision").asLong())))).andExpect(status().isOk()));
        assertEquals("PUBLISHED",dismissed.path("visibility").asText());
        var body=postBody("Nội dung mới");body.put("revision",dismissed.path("revision").asLong());
        mvc.perform(put(path).header("Authorization","Bearer "+owner.token()).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isOk());
        String second=mvc.perform(post(path+"/reports").header("Authorization","Bearer "+other.token()).contentType("application/json").content(json.writeValueAsString(report))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertNotEquals(first,second);
    }
    @Test void crossPostRepliesUnlinkedPractitionerAndPostRateAreRejected() throws Exception {
        var owner=member(Role.CUSTOMER);var salon=salon(member(Role.SUPPLIER));
        var person=new Practitioner();person.setDisplayName("Chưa liên kết");person.setSupplier(salon);practitioners.saveAndFlush(person);
        var bad=postBody("Không được mạo danh");bad.put("identity","PRACTITIONER");bad.put("salonId",salon.getId());bad.put("practitionerId",person.getId());
        mvc.perform(post(API+"/posts").header("Authorization","Bearer "+owner.token()).contentType("application/json").content(json.writeValueAsString(bad))).andExpect(status().isForbidden());
        var a=create(owner,postBody("Bài thứ nhất"));var b=create(owner,postBody("Bài thứ hai"));
        var comment=Map.of("requestKey",UUID.randomUUID().toString(),"content","Gốc");
        var c=result(mvc.perform(post(API+"/posts/"+a.path("id").asText()+"/comments").header("Authorization","Bearer "+owner.token()).contentType("application/json").content(json.writeValueAsString(comment))).andExpect(status().isCreated()));
        mvc.perform(post(API+"/posts/"+b.path("id").asText()+"/comments").header("Authorization","Bearer "+owner.token()).contentType("application/json").content(json.writeValueAsString(Map.of("requestKey",UUID.randomUUID().toString(),"content","Sai bài","parent",c.path("id").asText())))).andExpect(status().isBadRequest());
        var limited=member(Role.CUSTOMER);
        for(int i=0;i<5;i++)create(limited,postBody("Giới hạn "+i));
        mvc.perform(post(API+"/posts").header("Authorization","Bearer "+limited.token()).contentType("application/json").content(json.writeValueAsString(postBody("Quá giới hạn")))).andExpect(status().isTooManyRequests());
    }

    @Test void disabledFeatureFailsBeforeReadingOrWritingCommunity() throws Exception {
        var customer=member(Role.CUSTOMER);long before=posts.count();
        org.springframework.test.util.ReflectionTestUtils.setField(community,"enabled",false);
        try {
            mvc.perform(get(API+"/config")).andExpect(status().isOk()).andExpect(jsonPath("enabled").value(false));
            mvc.perform(get(API+"/posts")).andExpect(status().isNotFound());
            mvc.perform(post(API+"/posts").header("Authorization","Bearer "+customer.token()).contentType("application/json").content(json.writeValueAsString(postBody("Disabled")))).andExpect(status().isNotFound());
            assertEquals(before,posts.count());
        } finally {org.springframework.test.util.ReflectionTestUtils.setField(community,"enabled",true);}
    }

    @Test void commentModerationKeepsCountsAndDeletedContextConsistent() throws Exception {
        var owner=member(Role.CUSTOMER);var staff=member(Role.STAFF);var p=create(owner,postBody("Kiểm duyệt thảo luận"));String id=p.path("id").asText();
        var c=result(mvc.perform(post(API+"/posts/"+id+"/comments").header("Authorization","Bearer "+owner.token()).contentType("application/json").content(json.writeValueAsString(Map.of("requestKey",UUID.randomUUID().toString(),"content","Bình luận")))).andExpect(status().isCreated()));
        for(String action:List.of("HIDE","RESTORE","REMOVE")) {
            mvc.perform(put(API+"/moderation/posts/"+id).header("Authorization","Bearer "+staff.token()).contentType("application/json").content(json.writeValueAsString(Map.of("action",action,"comment",c.path("id").asText(),"revision",c.path("revision").asLong(),"reason","Kiểm tra trạng thái bình luận")))).andExpect(status().isOk());
            c=result(mvc.perform(get(API+"/moderation/posts/"+id+"/comments").header("Authorization","Bearer "+staff.token())).andExpect(status().isOk())).path("items").get(0);
            mvc.perform(get(API+"/posts/"+id)).andExpect(jsonPath("commentCount").value(action.equals("RESTORE")?1:0));
        }
        mvc.perform(get(API+"/posts/"+id+"/comments")).andExpect(jsonPath("items[0].visibility").value("DELETED")).andExpect(jsonPath("items[0].content").doesNotExist());
        mvc.perform(put(API+"/moderation/posts/"+id).header("Authorization","Bearer "+staff.token()).contentType("application/json").content(json.writeValueAsString(Map.of("action","RESTORE","comment",c.path("id").asText(),"revision",c.path("revision").asLong(),"reason","Không hồi sinh nội dung đã xóa")))).andExpect(status().isConflict());
    }

}
