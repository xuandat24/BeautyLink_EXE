import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { CommunityPostCard } from '../src/components/community/CommunityPostCard';
import { CommunityPostComposer } from '../src/components/community/CommunityPostComposer';
import { CommunityPage } from '../src/components/community/CommunityPage';
import { CommunityShareDialog } from '../src/components/community/CommunityShareDialog';
import { communityApi } from '../src/services/communityApi';
import { communityRoute, goCommunity } from '../src/lib/communityNavigation';
import { installToken, clearSession, initializeSession } from '../src/lib/authSession';
import { apiClient } from '../src/services/beautyApi';
import { sessionToken } from './sessionFixtures';
import { renderCommunityShare, publicCommunityPost } from '../server/communityShare';
import type { CommunityPost, CommunityPostWrite } from '../src/types/community';
const id='11111111-1111-4111-8111-111111111111';
const fixture=():CommunityPost=>({id,author:{name:'Thành viên <script>',avatar:null,identity:'ACCOUNT',salonName:null,salonSlug:null,specialty:null,verifiedSalon:false},content:'<img src=x onerror="alert(1)"> Chia sẻ thật',category:'GENERAL',visibility:'PUBLISHED',media:[],service:{id:42,name:'Dịch vụ thật',salonName:'Salon thật',image:null,price:123000,durationMinutes:60,rating:0,reviewCount:0},likeCount:0,commentCount:0,liked:false,owned:true,revision:0,createdAt:'2026-10-30T00:00:00Z',updatedAt:'2026-10-30T00:00:00Z',canonicalUrl:`https://beautylink.cloud/community/posts/${id}`});
function env(path='/community') {
 const dom=new JSDOM('<div id="root"></div>',{url:`https://beautylink.cloud${path}`});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,PopStateEvent:dom.window.PopStateEvent,IS_REACT_ACT_ENVIRONMENT:true});
 const root=createRoot(document.getElementById('root')!);clearSession(false);
 return {dom,root,close:async()=>{await act(async()=>root.unmount());clearSession(false);dom.window.close();}};
}
const click=async(text:string)=>act(async()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,`Missing button: ${text}`);b.click();});
const input=async(text:string)=>act(async()=>{const el=document.querySelector('textarea')!;Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value')!.set!.call(el,text);el.dispatchEvent(new window.Event('input',{bubbles:true}));el.dispatchEvent(new window.Event('change',{bubbles:true}));});

test('Community path routing is bounded, public and does not inherit payment/admin queries',()=>{
 const e=env('/?bookingPayment=99#admin');try{assert.equal(communityRoute(),null);assert.deepEqual(communityRoute('/community'),{});assert.deepEqual(communityRoute(`/community/posts/${id}`),{id});for(const p of ['/community/posts/42','/community/posts/../admin','/community/posts/'+id+'/edit'])assert.deepEqual(communityRoute(p),{invalid:true});goCommunity(id);assert.equal(window.location.pathname,`/community/posts/${id}`);assert.equal(window.location.search,'');assert.equal(window.location.hash,'');goCommunity();assert.equal(window.location.pathname,'/community');}finally{e.dom.window.close();}
});
test('public Community request is anonymous while session checking; writes remain gated',async()=>{
 const e=env();const prior=apiClient.defaults.adapter;const headers:string[]=[];
 apiClient.defaults.adapter=async config=>{headers.push(String(config.headers.Authorization??''));return {data:{},status:200,statusText:'OK',headers:{},config};};
 try{installToken(sessionToken());initializeSession();await apiClient.get('/v1/community/posts');assert.equal(headers[0],'');await assert.rejects(apiClient.post('/v1/community/posts',{}));assert.equal(headers.length,1);}finally{apiClient.defaults.adapter=prior;await e.close();}
});
test('post uses escaped UGC, honest identity and existing catalog/booking callbacks',async()=>{
 const e=env();let view=0,book=0,login=0;
 try{await act(async()=>e.root.render(React.createElement(CommunityPostCard,{post:fixture(),actions:{authenticated:false,onNeedLogin:()=>login++,onLike(){},onShare(){},onReport(){},onEdit(){},onDelete(){},onOpen(){},onViewService:n=>view=n,onBookService:n=>book=n}})));assert.equal(document.querySelector('script'),null);assert.equal(document.querySelector('img[onerror]'),null);assert.match(document.body.textContent!,/<img src=x/);assert.doesNotMatch(document.body.textContent!,/Đã trải nghiệm|Salon đã duyệt/);await click('Xem dịch vụ');await click('Đặt lịch');await click('Thích');assert.equal(view,42);assert.equal(book,42);assert.equal(login,1);}finally{await e.close();}
});
test('locked authentication keeps public feed visible without Login flash or private information',async()=>{
 const e=env();const originals={config:communityApi.config,feed:communityApi.feed};communityApi.config=async()=>({enabled:true,maxImages:3,maxContentLength:5000});communityApi.feed=async()=>({items:[fixture()],nextCursor:null});
 try{await act(async()=>e.root.render(React.createElement(CommunityPage,{user:null,authPending:true,authLocked:true,onRetrySession(){},onHome(){},onNeedLogin(){},onAccount(){},onLogout(){},onViewService(){},onBookService(){},onModerate(){}})));assert.ok(document.querySelector('[data-community-post]'));assert.equal([...document.querySelectorAll('nav button')].some(b=>b.textContent==='Đăng nhập'),false);assert.match(document.body.textContent!,/Thử xác minh lại/);}finally{Object.assign(communityApi,originals);await e.close();}
});
test('composer preserves an ambiguous edit payload and suppresses duplicate submits',async()=>{
 const e=env();installToken(sessionToken());const originals={identities:communityApi.identities,edit:communityApi.edit,editInfo:communityApi.editInfo};const bodies:CommunityPostWrite[]=[];let saved=0;
 const fields:CommunityPostWrite={requestKey:id,content:fixture().content,category:'GENERAL',identity:'ACCOUNT',salonId:null,practitionerId:null,serviceId:42,media:[],revision:0};
 let reads=0;communityApi.identities=async()=>[{identity:'ACCOUNT',salonId:null,practitionerId:null,label:'Thành viên'}];communityApi.editInfo=async()=>{reads++;if(reads>1)throw new Error('Network unavailable');return {post:fixture(),fields};};
 let fail!:(error:Error)=>void;communityApi.edit=async(_id,body)=>{bodies.push(structuredClone(body));if(bodies.length===1)return new Promise((_ok,reject)=>{fail=reject;});return fixture();};
 try{await act(async()=>e.root.render(React.createElement(CommunityPostComposer,{initial:fixture(),onSaved:()=>saved++,onClose(){}})));
  await act(async()=>{const form=document.querySelector('form')!;form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));});assert.equal(bodies.length,1);assert.equal(saved,0);
  await act(async()=>fail(new Error('Lost response')));assert.match(document.querySelector('[role="alert"]')!.textContent!,/Kết quả gửi chưa rõ/);assert.equal(document.querySelector('textarea')!.disabled,true);
  await click('Kiểm tra lại cùng lần gửi');assert.equal(bodies.length,2);assert.deepEqual(bodies[0],bodies[1]);assert.equal(saved,1);
 }finally{Object.assign(communityApi,originals);await e.close();}
});
test('server HTML contains escaped real OG metadata and canonical URL without hydration',()=>{
 const template='<html><head><title>Old</title><meta property="og:title" content="old"><link rel="canonical" href="old"></head><body><div id="root"></div><script type="module" src="/assets/index.js"></script></body></html>';
 const html=renderCommunityShare(template,fixture());const doc=new JSDOM(html).window.document;assert.equal(doc.querySelectorAll('title').length,1);assert.equal(doc.querySelectorAll('[property="og:title"]').length,1);assert.equal(doc.querySelector('[property="og:description"]')!.getAttribute('content'),fixture().content);assert.equal(doc.querySelector('[rel="canonical"]')!.getAttribute('href'),fixture().canonicalUrl);assert.equal(doc.querySelectorAll('img').length,0);assert.equal(doc.querySelectorAll('script').length,1);assert.throws(()=>renderCommunityShare(template,{...fixture(),visibility:'HIDDEN'}));
});
test('OG fetch is fixed to trusted public API and fails closed for hidden, mismatched and unavailable responses',async()=>{
 let requested='';const fake:typeof fetch=async (url,options)=>{requested=String(url);assert.equal(options?.redirect,'error');assert.equal(options?.cache,'no-store');return new Response(JSON.stringify(fixture()),{status:200});};assert.equal((await publicCommunityPost(id,undefined,fake)).status,200);assert.equal(requested,`https://api.beautylink.cloud/api/v1/community/posts/${id}`);assert.equal((await publicCommunityPost('bad',undefined,fake)).status,404);
 for(const value of [{...fixture(),visibility:'HIDDEN'},{...fixture(),id:'other'}])assert.equal((await publicCommunityPost(id,undefined,async()=>new Response(JSON.stringify(value)))).status,404);
 assert.equal((await publicCommunityPost(id,undefined,async()=>new Response('',{status:500}))).status,503);await assert.rejects(publicCommunityPost(id,'http://untrusted.test',fake));
});
test('social fallback only copies canonical post URL and never claims automatic publishing',async()=>{
 const e=env('/?bookingCode=PRIVATE#bookings');let copied='';Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async(v:string)=>{copied=v;}}}});
 try{await act(async()=>e.root.render(React.createElement(CommunityShareDialog,{post:fixture(),onClose(){}})));const b=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Sao chép'));assert.ok(b);await act(async()=>b.click());assert.equal(copied,fixture().canonicalUrl);assert.doesNotMatch(document.body.textContent!,/đã đăng lên|PRIVATE/);}finally{await e.close();}
});

test('switching accounts clears pending reaction UI and discards prior-account responses',async()=>{
 const e=env();const originals={config:communityApi.config,feed:communityApi.feed,like:communityApi.like};let old!:(p:CommunityPost)=>void;let likes=0;
 communityApi.config=async()=>({enabled:true,maxImages:3,maxContentLength:5000});communityApi.feed=async()=>({items:[{...fixture(),owned:false}],nextCursor:null});communityApi.like=async()=>{likes++;if(likes===1)return new Promise(resolve=>{old=resolve;});return {...fixture(),liked:true,likeCount:1,revision:1};};
 const props={onHome(){},onNeedLogin(){},onAccount(){},onLogout(){},onViewService(){},onBookService(){},onModerate(){}};
 try{installToken(sessionToken());await act(async()=>e.root.render(React.createElement(CommunityPage,{...props,user:{id:1,name:'One',role:'CUSTOMER'} as any})));await click('Thích');assert.equal(document.querySelector<HTMLButtonElement>('[aria-label="Thích bài viết"]')!.disabled,true);
  await act(async()=>{installToken(sessionToken('22222222-2222-4222-8222-222222222222'));e.root.render(React.createElement(CommunityPage,{...props,user:{id:2,name:'Two',role:'CUSTOMER'} as any}));});assert.equal(document.querySelector<HTMLButtonElement>('[aria-label="Thích bài viết"]')!.disabled,false);
  await act(async()=>old({...fixture(),liked:true,likeCount:99,revision:99}));assert.doesNotMatch(document.body.textContent!,/99 lượt thích/);await click('Thích');assert.equal(likes,2);assert.match(document.body.textContent!,/1 lượt thích/);
 }finally{Object.assign(communityApi,originals);await e.close();}
});
