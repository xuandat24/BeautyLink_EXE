package com.example.backend.community;
import com.example.backend.model.UserAccount;
import com.example.backend.service.CurrentAccountService;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import static com.example.backend.community.CommunityDtos.*;
import static com.example.backend.community.CommunityTypes.*;

@RestController @RequestMapping("/api/v1/community")
public class CommunityController {
    private final CommunityService community;private final CurrentAccountService current;
    public CommunityController(CommunityService community,CurrentAccountService current){this.community=community;this.current=current;}
    private UserAccount viewer(Authentication a){return a==null?null:current.require(a);}
    @ModelAttribute void privateCache(jakarta.servlet.http.HttpServletResponse response){response.setHeader("Cache-Control","no-store");response.setHeader("Vary","Authorization");}
    @GetMapping("/config") public Map<String,Object> config(){return Map.of("enabled",community.enabled(),"maxImages",3,"maxContentLength",5000);}
    @GetMapping("/services") public List<ServiceCard> services(@RequestParam(defaultValue="")String q,@RequestParam(defaultValue="20")int size,HttpServletRequest http){community.readRate(http.getRemoteAddr());return community.services(q,size);}
    @GetMapping("/identities") public List<IdentityOption> identities(Authentication a){return community.identities(current.require(a));}
    @GetMapping("/posts") public CursorPage<Post> feed(Authentication a,@RequestParam(required=false)String before,@RequestParam(required=false)Category category,@RequestParam(defaultValue="")String q,@RequestParam(defaultValue="20")int size,HttpServletRequest http){community.readRate(http.getRemoteAddr());return community.feed(viewer(a),before,category,q,size,Visibility.PUBLISHED,false);}
    @GetMapping("/posts/{id}") public Post post(Authentication a,@PathVariable String id,HttpServletRequest http){community.readRate(http.getRemoteAddr());return community.detail(id,viewer(a),false);}
    @GetMapping("/posts/{id}/edit") public PostEdit editInfo(Authentication a,@PathVariable String id){return community.editInfo(id,current.require(a));}
    @PostMapping("/posts") @ResponseStatus(HttpStatus.CREATED) public Post create(Authentication a,@Valid @RequestBody PostWrite r){return community.create(current.require(a),r);}
    @PutMapping("/posts/{id}") public Post edit(Authentication a,@PathVariable String id,@Valid @RequestBody PostWrite r){return community.edit(current.require(a),id,r);}
    @DeleteMapping("/posts/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(Authentication a,@PathVariable String id,@RequestParam Long revision){community.delete(current.require(a),id,revision);}
    @PutMapping("/posts/{id}/reaction") public Post reaction(Authentication a,@PathVariable String id,@Valid @RequestBody LikeWrite r){return community.like(current.require(a),id,r.liked());}
    @PostMapping("/media") @ResponseStatus(HttpStatus.CREATED) public Media upload(Authentication a,@Valid @RequestBody MediaWrite r){return community.upload(current.require(a),r.image());}
    @GetMapping("/posts/{id}/comments") public CursorPage<Comment> comments(Authentication a,@PathVariable String id,@RequestParam(required=false)String parent,@RequestParam(required=false)String before,@RequestParam(defaultValue="20")int size,HttpServletRequest http){community.readRate(http.getRemoteAddr());return community.comments(viewer(a),id,parent,before,size,false);}
    @PostMapping("/posts/{id}/comments") @ResponseStatus(HttpStatus.CREATED) public Comment comment(Authentication a,@PathVariable String id,@Valid @RequestBody CommentWrite r){return community.addComment(current.require(a),id,r);}
    @PutMapping("/posts/{id}/comments/{cid}") public Comment comment(Authentication a,@PathVariable String id,@PathVariable String cid,@Valid @RequestBody CommentWrite r){return community.editComment(current.require(a),id,cid,r,false);}
    @DeleteMapping("/posts/{id}/comments/{cid}") public Comment deleteComment(Authentication a,@PathVariable String id,@PathVariable String cid,@RequestParam Long revision){return community.editComment(current.require(a),id,cid,new CommentWrite(UUID.randomUUID().toString(),"deleted",null,revision),true);}
    @PostMapping("/posts/{id}/reports") public Map<String,String> report(Authentication a,@PathVariable String id,@Valid @RequestBody ReportWrite r){return Map.of("id",community.report(current.require(a),id,r));}
    @GetMapping("/moderation/posts") @PreAuthorize("hasAnyRole('ADMIN','STAFF')") public CursorPage<Post> moderation(Authentication a,@RequestParam(defaultValue="PUBLISHED")Visibility visibility,@RequestParam(required=false)String before,@RequestParam(defaultValue="")String q,@RequestParam(defaultValue="20")int size){return community.feed(current.require(a),before,null,q,size,visibility,true);}
    @GetMapping("/moderation/posts/{id}") @PreAuthorize("hasAnyRole('ADMIN','STAFF')") public Post moderationPost(Authentication a,@PathVariable String id){return community.detail(id,current.require(a),true);}
    @GetMapping("/moderation/posts/{id}/comments") @PreAuthorize("hasAnyRole('ADMIN','STAFF')") public CursorPage<Comment> moderationComments(Authentication a,@PathVariable String id,@RequestParam(required=false)String parent,@RequestParam(required=false)String before,@RequestParam(defaultValue="20")int size){return community.comments(current.require(a),id,parent,before,size,true);}
    @PutMapping("/moderation/posts/{id}") @PreAuthorize("hasAnyRole('ADMIN','STAFF')") public Post moderate(Authentication a,@PathVariable String id,@Valid @RequestBody ModerationWrite r){return community.moderate(current.require(a),id,r);}
    @GetMapping("/moderation/posts/{id}/history") @PreAuthorize("hasAnyRole('ADMIN','STAFF')") public List<Audit> history(Authentication a,@PathVariable String id){return community.history(current.require(a),id);}
    @GetMapping("/moderation/reports") @PreAuthorize("hasAnyRole('ADMIN','STAFF')") public CursorPage<Report> reports(Authentication a,@RequestParam(defaultValue="false")boolean resolved,@RequestParam(required=false)String before,@RequestParam(defaultValue="20")int size){return community.reports(current.require(a),resolved,before,size);}
}
