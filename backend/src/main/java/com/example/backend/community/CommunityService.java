package com.example.backend.community;

import com.example.backend.model.*;
import com.example.backend.repository.*;
import com.example.backend.service.*;
import com.example.backend.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import java.time.Instant;
import java.util.*;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import static com.example.backend.model.DomainEnums.*;
import static com.example.backend.community.CommunityTypes.*;
import static com.example.backend.community.CommunityDtos.*;

@Service @Transactional(readOnly=true,isolation=Isolation.READ_COMMITTED)
public class CommunityService {
    private final CommunityPostRepository posts; private final CommunityMediaRepository media;
    private final CommunityCommentRepository comments; private final CommunityReactionRepository reactions;
    private final CommunityReportRepository reports; private final CommunityModerationRepository audit;
    private final CommunityRestrictionRepository restrictions; private final UserAccountRepository users;
    private final CommunityCatalog catalog; private final EntityManager em; private final CommunityImageStorage images;
    private final RateLimitBackend limits; private final ObjectMapper json; private final TransactionTemplate tx; private final boolean enabled;
    public CommunityService(CommunityPostRepository posts,CommunityMediaRepository media,CommunityCommentRepository comments,
        CommunityReactionRepository reactions,CommunityReportRepository reports,CommunityModerationRepository audit,
        CommunityRestrictionRepository restrictions,UserAccountRepository users,CommunityCatalog catalog,EntityManager em,
        CommunityImageStorage images,RateLimitBackend limits,ObjectMapper json,PlatformTransactionManager manager,
        @Value("${app.community.enabled:false}")boolean enabled){
        this.posts=posts;this.media=media;this.comments=comments;this.reactions=reactions;this.reports=reports;this.audit=audit;this.restrictions=restrictions;
        this.users=users;this.catalog=catalog;this.em=em;this.images=images;this.limits=limits;this.json=json;this.tx=new TransactionTemplate(manager);this.enabled=enabled;
        tx.setIsolationLevel(org.springframework.transaction.TransactionDefinition.ISOLATION_READ_COMMITTED);
    }
    public boolean enabled(){return enabled;}
    public void requireEnabled(){if(!enabled)throw error(HttpStatus.NOT_FOUND,"COMMUNITY_DISABLED","Community chưa được mở.");}
    private UserAccount actor(UserAccount auth){
        requireEnabled();if(auth==null)throw error(HttpStatus.UNAUTHORIZED,"UNAUTHORIZED","Vui lòng đăng nhập.");
        var u=users.findLockedById(auth.getId()).orElseThrow(CommunityService::missing);
        if(u.getStatus()!=AccountStatus.ACTIVE || !u.getUpdatedAt().equals(auth.getUpdatedAt()))throw error(HttpStatus.UNAUTHORIZED,"SESSION_CHANGED","Phiên đã thay đổi. Vui lòng đăng nhập lại.");
        if(restrictions.findById(u.getId()).map(CommunityRestriction::getBlocked).orElse(false))throw error(HttpStatus.FORBIDDEN,"COMMUNITY_RESTRICTED","Tài khoản đang bị hạn chế tương tác Community.");
        return u;
    }
    private void rate(Long id,String operation,int max,int seconds){if(!limits.consume("community:"+operation+":"+id,max,seconds))throw error(HttpStatus.TOO_MANY_REQUESTS,"COMMUNITY_RATE_LIMIT","Bạn thao tác quá nhanh. Vui lòng thử lại sau.");}
    public void readRate(String address){requireEnabled();if(!limits.consume("community:read:"+address,300,60))throw error(HttpStatus.TOO_MANY_REQUESTS,"COMMUNITY_RATE_LIMIT","Vui lòng thử lại sau.");}
    private void mod(UserAccount u){requireEnabled();if(u==null || u.getStatus()!=AccountStatus.ACTIVE || !Set.of(Role.ADMIN,Role.STAFF).contains(u.getRole()))throw error(HttpStatus.FORBIDDEN,"FORBIDDEN","Không có quyền kiểm duyệt.");}
    public List<IdentityOption> identities(UserAccount auth){
        requireEnabled();var result=new ArrayList<IdentityOption>();result.add(new IdentityOption(Identity.ACCOUNT,null,null,"Thành viên"));
        if(auth.getRole()==Role.SUPPLIER)em.createQuery("select s from Supplier s join fetch s.owner where s.owner.id=:id",Supplier.class).setParameter("id",auth.getId()).getResultStream().filter(catalog::verified).forEach(s->result.add(new IdentityOption(Identity.SALON,s.getId(),null,s.getName())));
        em.createQuery("select p from Practitioner p join fetch p.user join fetch p.supplier s join fetch s.owner where p.user.id=:id and p.active=true order by p.id",Practitioner.class).setParameter("id",auth.getId()).setMaxResults(20).getResultStream().filter(p->catalog.verified(p.getSupplier())).forEach(p->result.add(new IdentityOption(Identity.PRACTITIONER,p.getSupplier().getId(),p.getId(),p.getDisplayName()+" · "+p.getSupplier().getName())));
        return result;
    }
    public List<ServiceCard> services(String q,int size){requireEnabled();var result=catalog.search(text(q,100,true),size(size));var cards=catalog.cards(result);return result.stream().map(s->cards.get(s.getId())).toList();}
    public CursorPage<Post> feed(UserAccount viewer,String before,Category category,String query,int size,Visibility visibility,boolean moderation){
        requireEnabled();if(moderation)mod(viewer);else visibility=Visibility.PUBLISHED;
        String q=text(query,100,true);long cursor=before==null?Long.MAX_VALUE:posts.findByPublicId(uuid(before)).orElseThrow(CommunityService::missing).getId();
        int n=size(size);var found=posts.feed(visibility,cursor,category,q.isBlank()?"":CommunityCatalog.like(q),PageRequest.of(0,n+1));
        boolean more=found.size()>n;var page=found.stream().limit(n).toList();return new CursorPage<>(views(page,viewer),more?page.getLast().getPublicId():null);
    }
    public Post detail(String id,UserAccount viewer,boolean moderation){
        requireEnabled();if(moderation)mod(viewer);var p=posts.detail(uuid(id)).orElseThrow(CommunityService::missing);
        if(!moderation && p.getVisibility()!=Visibility.PUBLISHED && !owns(p,viewer))throw missing();return views(List.of(p),viewer).getFirst();
    }
    private boolean owns(CommunityPost p,UserAccount u){return u!=null && p.getAuthor().getId().equals(u.getId());}
    public PostEdit editInfo(String id,UserAccount user){requireEnabled();var p=posts.detail(uuid(id)).orElseThrow(CommunityService::missing);if(!owns(p,user))throw error(HttpStatus.FORBIDDEN,"FORBIDDEN","Chỉ chủ bài viết được sửa.");published(p);var view=views(List.of(p),user).getFirst();return new PostEdit(view,new PostWrite(UUID.randomUUID().toString(),p.getContent(),p.getCategory(),p.getIdentity(),p.getSalon()==null?null:p.getSalon().getId(),p.getPractitioner()==null?null:p.getPractitioner().getId(),p.getService()==null?null:p.getService().getId(),view.media().stream().map(Media::id).toList(),p.getRevision()));}
    private CommunityPost lock(String id){return posts.lock(uuid(id)).orElseThrow(CommunityService::missing);}
    private void published(CommunityPost p){if(p.getVisibility()!=Visibility.PUBLISHED)throw missing();}
    private void revision(long current,Long supplied){if(supplied==null || current!=supplied)throw error(HttpStatus.CONFLICT,"COMMUNITY_STALE_REVISION","Nội dung vừa thay đổi. Hãy tải lại trước khi lưu.");}
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Post create(UserAccount auth,PostWrite r){
        var u=actor(auth);String key=uuid(r.requestKey()),body=text(r.content(),5000,false);
        String fingerprint=hash(List.of(body,r.category(),r.identity(),Objects.toString(r.salonId(),""),Objects.toString(r.practitionerId(),""),Objects.toString(r.serviceId(),""),r.media()));
        var prior=posts.findByAuthorIdAndRequestKey(u.getId(),key);
        if(prior.isPresent()){var p=prior.get();if(!fingerprint.equals(p.getFingerprint()) || p.getVisibility()!=Visibility.PUBLISHED)throw error(HttpStatus.CONFLICT,"COMMUNITY_REQUEST_CONFLICT","Lần gửi này đã được xử lý với nội dung hoặc trạng thái khác.");return views(List.of(p),u).getFirst();}
        rate(u.getId(),"post",5,60);rate(u.getId(),"post-day",50,86400);
        var p=new CommunityPost();p.setPublicId(UUID.randomUUID().toString());p.setAuthor(u);p.setRequestKey(key);p.setFingerprint(fingerprint);p.setVisibility(Visibility.PUBLISHED);
        assign(p,u,r,body);posts.saveAndFlush(p);attach(p,u,r.media());return views(List.of(p),u).getFirst();
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Post edit(UserAccount auth,String id,PostWrite r){var u=actor(auth);var p=lock(id);if(!owns(p,u))throw error(HttpStatus.FORBIDDEN,"FORBIDDEN","Chỉ chủ bài viết được sửa.");published(p);revision(p.getRevision(),r.revision());rate(u.getId(),"edit",20,60);assign(p,u,r,text(r.content(),5000,false));attach(p,u,r.media());p.setUpdatedAt(Instant.now());posts.flush();return views(List.of(p),u).getFirst();}
    private void assign(CommunityPost p,UserAccount u,PostWrite r,String content){
        if(r.category()==null || r.identity()==null)throw error(HttpStatus.BAD_REQUEST,"COMMUNITY_INVALID","Chọn chủ đề và tư cách đăng.");
        var option=identities(u).stream().filter(o->o.identity()==r.identity() && Objects.equals(o.salonId(),r.salonId()) && Objects.equals(o.practitionerId(),r.practitionerId())).findFirst().orElseThrow(()->error(HttpStatus.FORBIDDEN,"COMMUNITY_IDENTITY_INVALID","Không được đại diện salon hoặc chuyên viên này."));
        var service=catalog.service(r.serviceId());
        if(service!=null && ((r.identity()!=Identity.ACCOUNT && !service.getSupplier().getId().equals(option.salonId())) || (u.getRole()==Role.SUPPLIER && !service.getSupplier().getOwner().getId().equals(u.getId()))))throw error(HttpStatus.FORBIDDEN,"COMMUNITY_SERVICE_OWNER","Không được đại diện dịch vụ của đối tác khác.");
        p.setContent(content);p.setCategory(r.category());p.setIdentity(r.identity());p.setSalon(option.salonId()==null?null:em.find(Supplier.class,option.salonId()));p.setPractitioner(option.practitionerId()==null?null:em.find(Practitioner.class,option.practitionerId()));p.setService(service);
    }
    private void attach(CommunityPost p,UserAccount u,List<String> ids){
        if(ids==null || ids.size()>3 || new HashSet<>(ids).size()!=ids.size())throw error(HttpStatus.BAD_REQUEST,"COMMUNITY_MEDIA_INVALID","Tối đa 3 ảnh khác nhau.");
        ids.forEach(CommunityService::uuid);var found=ids.isEmpty()?List.<CommunityMedia>of():media.lock(ids);
        if(found.size()!=ids.size() || found.stream().anyMatch(m->!m.getOwner().getId().equals(u.getId()) || (m.getPost()!=null && !m.getPost().getId().equals(p.getId()))))throw error(HttpStatus.FORBIDDEN,"COMMUNITY_MEDIA_OWNER","Ảnh không thuộc lần đăng này.");
        for(var old:media.findByPostId(p.getId()))if(!ids.contains(old.getPublicId()))old.setPost(null);
        found.forEach(m->m.setPost(p));media.flush();
    }
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public Media upload(UserAccount auth,String image){
        Long owner=tx.execute(s->{var u=actor(auth);rate(u.getId(),"upload",10,60);return u.getId();});
        var stored=images.upload(image,owner);
        try{return tx.execute(s->{var u=actor(auth);var m=new CommunityMedia();m.setPublicId(UUID.randomUUID().toString());m.setOwner(u);m.setUrl(stored.url());media.saveAndFlush(m);return new Media(m.getPublicId(),m.getUrl());});}
        catch(RuntimeException ex){try{images.discard(stored);}catch(RuntimeException ignored){org.slf4j.LoggerFactory.getLogger(getClass()).warn("Community upload DB rollback cleanup failed; reconcile orphan media");}throw ex;}
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public void delete(UserAccount auth,String id,Long rev){var u=actor(auth);var p=lock(id);if(!owns(p,u))throw error(HttpStatus.FORBIDDEN,"FORBIDDEN","Chỉ chủ bài viết được xóa.");if(p.getVisibility()==Visibility.DELETED)return;revision(p.getRevision(),rev);p.setVisibility(Visibility.DELETED);p.setUpdatedAt(Instant.now());}
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Post like(UserAccount auth,String id,boolean liked){var u=actor(auth);rate(u.getId(),"like",60,60);var p=lock(id);published(p);var prior=reactions.findByPostIdAndAuthorId(p.getId(),u.getId());if(liked && prior.isEmpty()){var r=new CommunityReaction();r.setPost(p);r.setAuthor(u);reactions.save(r);p.setLikeCount(p.getLikeCount()+1);}else if(!liked && prior.isPresent()){reactions.delete(prior.get());p.setLikeCount(Math.max(0,p.getLikeCount()-1));}posts.flush();return views(List.of(p),u).getFirst();}
    public CursorPage<Comment> comments(UserAccount viewer,String id,String parent,String before,int size,boolean moderation){
        requireEnabled();if(moderation)mod(viewer);var p=posts.findByPublicId(uuid(id)).orElseThrow(CommunityService::missing);if(!moderation)published(p);
        if(parent!=null){var root=comments.findByPublicId(uuid(parent)).orElseThrow(CommunityService::missing);if(!root.getPost().getId().equals(p.getId()) || root.getParent()!=null)throw missing();}
        long cursor=Long.MAX_VALUE;if(before!=null){var c=comments.findByPublicId(uuid(before)).orElseThrow(CommunityService::missing);if(!c.getPost().getId().equals(p.getId()) || !Objects.equals(c.getParent()==null?null:c.getParent().getPublicId(),parent))throw missing();cursor=c.getId();}
        int n=size(size);var found=comments.thread(p.getId(),parent,cursor,PageRequest.of(0,n+1));var page=found.stream().limit(n).map(c->comment(c,viewer,moderation)).toList();return new CursorPage<>(page,found.size()>n?found.get(n-1).getPublicId():null);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Comment addComment(UserAccount auth,String id,CommentWrite r){var u=actor(auth);var p=lock(id);published(p);String key=uuid(r.requestKey()),body=text(r.content(),2000,false),fingerprint=hash(List.of(body,Objects.toString(r.parent(),"")));var prior=comments.findByPostIdAndAuthorIdAndRequestKey(p.getId(),u.getId(),key);if(prior.isPresent()){if(!fingerprint.equals(prior.get().getFingerprint()) || prior.get().getVisibility()!=Visibility.PUBLISHED)throw error(HttpStatus.CONFLICT,"COMMUNITY_REQUEST_CONFLICT","Lần gửi bình luận đã được xử lý.");return comment(prior.get(),u,false);}rate(u.getId(),"comment",15,60);rate(u.getId(),"comment-day",200,86400);
        CommunityComment parent=null;if(r.parent()!=null){parent=comments.findByPublicId(uuid(r.parent())).orElseThrow(CommunityService::missing);if(!parent.getPost().getId().equals(p.getId()) || parent.getParent()!=null)throw error(HttpStatus.BAD_REQUEST,"COMMUNITY_REPLY_DEPTH","Chỉ trả lời một cấp trong cùng bài viết.");}
        var c=new CommunityComment();c.setPublicId(UUID.randomUUID().toString());c.setAuthor(u);c.setPost(p);c.setParent(parent);c.setRequestKey(key);c.setFingerprint(fingerprint);c.setContent(body);c.setVisibility(Visibility.PUBLISHED);comments.save(c);p.setCommentCount(p.getCommentCount()+1);comments.flush();return comment(c,u,false);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Comment editComment(UserAccount auth,String id,String cid,CommentWrite r,boolean delete){var u=actor(auth);var p=lock(id);published(p);var c=comments.lock(uuid(cid)).orElseThrow(CommunityService::missing);if(!c.getPost().getId().equals(p.getId()) || !c.getAuthor().getId().equals(u.getId()))throw error(HttpStatus.FORBIDDEN,"FORBIDDEN","Chỉ chủ bình luận được sửa hoặc xóa.");if(delete && c.getVisibility()==Visibility.DELETED)return comment(c,u,false);revision(c.getRevision(),r.revision());if(!delete && c.getVisibility()!=Visibility.PUBLISHED)throw missing();if(delete){if(c.getVisibility()==Visibility.PUBLISHED)p.setCommentCount(Math.max(0,p.getCommentCount()-1));c.setVisibility(Visibility.DELETED);}else c.setContent(text(r.content(),2000,false));c.setUpdatedAt(Instant.now());comments.flush();return comment(c,u,false);}
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public String report(UserAccount auth,String id,ReportWrite r){var u=actor(auth);var p=lock(id);published(p);CommunityComment c=null;if(r.comment()!=null){c=comments.findByPublicId(uuid(r.comment())).orElseThrow(CommunityService::missing);if(!c.getPost().getId().equals(p.getId()) || c.getVisibility()!=Visibility.PUBLISHED)throw missing();}String key=c==null?p.getPublicId():c.getPublicId();var old=reports.findByReporterIdAndTargetKeyAndTargetRevision(u.getId(),key,c==null?p.getRevision():c.getRevision());if(old.isPresent())return old.get().getPublicId();rate(u.getId(),"report",5,3600);var report=new CommunityReport();report.setPublicId(UUID.randomUUID().toString());report.setPost(p);report.setComment(c);report.setReporter(u);report.setTargetKey(key);report.setTargetRevision(c==null?p.getRevision():c.getRevision());report.setReason(text(r.reason(),500,false));reports.saveAndFlush(report);return report.getPublicId();}
    public CursorPage<Report> reports(UserAccount moderator,boolean resolved,String before,int size){mod(moderator);long cursor=before==null?Long.MAX_VALUE:reports.findByPublicId(uuid(before)).orElseThrow(CommunityService::missing).getId();int n=size(size);var found=reports.queue(resolved,cursor,PageRequest.of(0,n+1));return new CursorPage<>(found.stream().limit(n).map(r->new Report(r.getPublicId(),r.getPost().getPublicId(),r.getComment()==null?null:r.getComment().getPublicId(),r.getReason(),r.getResolved(),r.getCreatedAt())).toList(),found.size()>n?found.get(n-1).getPublicId():null);}
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Post moderate(UserAccount auth,String id,ModerationWrite r){var moderator=actor(auth);mod(moderator);String reason=text(r.reason(),500,false);
        boolean restrict=r.action()==Action.RESTRICT_AUTHOR || r.action()==Action.ALLOW_AUTHOR;
        if(restrict){if(moderator.getRole()!=Role.ADMIN)throw error(HttpStatus.FORBIDDEN,"FORBIDDEN","Chỉ ADMIN được hạn chế tài khoản Community.");var target=posts.findByPublicId(uuid(id)).orElseThrow(CommunityService::missing).getAuthor();if(!Set.of(Role.CUSTOMER,Role.SUPPLIER).contains(target.getRole()))throw error(HttpStatus.FORBIDDEN,"FORBIDDEN","Không thay quyền tài khoản quản trị.");users.findLockedById(target.getId()).orElseThrow(CommunityService::missing);}
        var p=lock(id);CommunityComment c=null;if(r.comment()!=null){c=comments.lock(uuid(r.comment())).orElseThrow(CommunityService::missing);if(!c.getPost().getId().equals(p.getId()) || restrict)throw missing();revision(c.getRevision(),r.revision());}else revision(p.getRevision(),r.revision());
        if(restrict){var restriction=restrictions.findById(p.getAuthor().getId()).orElseGet(CommunityRestriction::new);restriction.setId(p.getAuthor().getId());restriction.setBlocked(r.action()==Action.RESTRICT_AUTHOR);restriction.setUpdatedAt(Instant.now());restrictions.save(restriction);}
        else if(r.action()!=Action.DISMISS_REPORT) {var old=c==null?p.getVisibility():c.getVisibility();if(old==Visibility.DELETED && r.action()!=Action.REMOVE)throw error(HttpStatus.CONFLICT,"COMMUNITY_REMOVED","Nội dung đã xóa không được khôi phục.");var next=switch(r.action()){case HIDE->Visibility.HIDDEN;case RESTORE->Visibility.PUBLISHED;case REMOVE->Visibility.DELETED;default->throw error(HttpStatus.BAD_REQUEST,"COMMUNITY_ACTION_INVALID","Thao tác không hợp lệ.");};if(c==null)p.setVisibility(next);else{if(old==Visibility.PUBLISHED && next!=Visibility.PUBLISHED)p.setCommentCount(Math.max(0,p.getCommentCount()-1));if(old!=Visibility.PUBLISHED && next==Visibility.PUBLISHED)p.setCommentCount(p.getCommentCount()+1);c.setVisibility(next);c.setUpdatedAt(Instant.now());}}
        if(c!=null)c.setUpdatedAt(Instant.now());p.setUpdatedAt(Instant.now());var action=new CommunityModerationAction();action.setPost(p);action.setComment(c);action.setModerator(moderator);action.setAction(r.action());action.setReason(reason);audit.save(action);reports.resolve(c==null?p.getPublicId():c.getPublicId());posts.flush();return views(List.of(p),moderator).getFirst();
    }
    public List<Audit> history(UserAccount moderator,String id){mod(moderator);var p=posts.findByPublicId(uuid(id)).orElseThrow(CommunityService::missing);return audit.findByPostIdOrderByIdDesc(p.getId(),PageRequest.of(0,50)).stream().map(a->new Audit(a.getAction().name(),a.getComment()==null?null:a.getComment().getPublicId(),a.getModerator().getFullName(),a.getReason(),a.getCreatedAt())).toList();}
    private Comment comment(CommunityComment c,UserAccount viewer,boolean moderation){boolean visible=c.getVisibility()==Visibility.PUBLISHED || moderation;return new Comment(c.getPublicId(),c.getParent()==null?null:c.getParent().getPublicId(),visible?author(c.getAuthor(),null,null,Identity.ACCOUNT):null,visible?c.getContent():null,c.getVisibility(),viewer!=null && c.getAuthor().getId().equals(viewer.getId()),c.getRevision(),c.getCreatedAt());}
    private Author author(UserAccount u,Supplier salon,Practitioner practitioner,Identity requested){boolean professional=requested==Identity.PRACTITIONER && practitioner!=null && practitioner.isActive() && practitioner.getUser()!=null && practitioner.getUser().getId().equals(u.getId()) && catalog.verified(practitioner.getSupplier());boolean owner=requested==Identity.SALON && u.getRole()==Role.SUPPLIER && catalog.verified(salon) && salon.getOwner().getId().equals(u.getId());var represented=professional?practitioner.getSupplier():owner?salon:null;return new Author(professional?practitioner.getDisplayName():u.getFullName(),CommunityCatalog.image(professional?practitioner.getAvatarUrl():u.getAvatarUrl()),professional?Identity.PRACTITIONER:owner?Identity.SALON:Identity.ACCOUNT,represented==null?null:represented.getName(),represented==null?null:represented.getSlug(),professional?practitioner.getSpecialty():null,represented!=null);}
    private List<Post> views(List<CommunityPost> list,UserAccount viewer){if(list.isEmpty())return List.of();var ids=list.stream().map(CommunityPost::getId).toList();var attachments=media.findByPostIdInOrderByIdAsc(ids).stream().collect(java.util.stream.Collectors.groupingBy(m->m.getPost().getId()));var liked=viewer==null?Set.<Long>of():reactions.findByAuthorIdAndPostIdIn(viewer.getId(),ids).stream().map(r->r.getPost().getId()).collect(java.util.stream.Collectors.toSet());var services=catalog.cards(list.stream().map(CommunityPost::getService).filter(Objects::nonNull).toList());return list.stream().map(p->new Post(p.getPublicId(),author(p.getAuthor(),p.getSalon(),p.getPractitioner(),p.getIdentity()),p.getContent(),p.getCategory(),p.getVisibility(),attachments.getOrDefault(p.getId(),List.of()).stream().map(m->new Media(m.getPublicId(),m.getUrl())).toList(),p.getService()==null?null:services.get(p.getService().getId()),p.getLikeCount(),p.getCommentCount(),liked.contains(p.getId()),owns(p,viewer),p.getRevision(),p.getCreatedAt(),p.getUpdatedAt(),"https://beautylink.cloud/community/posts/"+p.getPublicId())).toList();}
    static int size(int n){if(n<1 || n>50)throw error(HttpStatus.BAD_REQUEST,"INVALID_PAGINATION","Mỗi trang từ 1 đến 50 mục.");return n;}
    static String uuid(String value){try{if(value==null || !UUID.fromString(value).toString().equals(value.toLowerCase(Locale.ROOT)))throw new IllegalArgumentException();return value.toLowerCase(Locale.ROOT);}catch(IllegalArgumentException ex){throw error(HttpStatus.BAD_REQUEST,"COMMUNITY_ID_INVALID","Mã nội dung không hợp lệ.");}}
    static String text(String value,int max,boolean empty){String clean=value==null?"":value.trim();if(clean.length()>max || (!empty && clean.isBlank()) || clean.indexOf(0)>=0)throw error(HttpStatus.BAD_REQUEST,"COMMUNITY_CONTENT_INVALID","Nội dung trống hoặc quá dài.");return clean;}
    private String hash(Object value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsString(value).getBytes(StandardCharsets.UTF_8)));}catch(Exception ex){throw new IllegalStateException("Cannot fingerprint community request",ex);}}
    static ApiException missing(){return error(HttpStatus.NOT_FOUND,"COMMUNITY_NOT_FOUND","Không tìm thấy nội dung công khai.");}
    static ApiException error(HttpStatus code,String key,String message){return new ApiException(code,key,message);}
}
