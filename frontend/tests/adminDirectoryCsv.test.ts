import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { adminV2Api } from '../src/services/adminApi';
import { apiClient } from '../src/services/beautyApi';
import { installToken, clearSession } from '../src/lib/authSession';
import { sessionToken } from './sessionFixtures';
import { accountRowsCsv, customerRowsCsv, presentationPage } from '../src/lib/presentationAdminData';
import { AdminModulesPage } from '../src/components/admin/AdminModulesPage';
import type { AdminUserRow } from '../src/types/adminV2';
const rows=(n:number)=>Array.from({length:n},(_,i)=>({id:n-i,fullName:`Đặng An ${n-i}`,email:`dangan${n-i}@gmail.com`,role:'CUSTOMER',status:'ACTIVE',createdAt:'2026-09-20T02:00:00Z'} as AdminUserRow));
function env(){const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage});Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,configurable:true});clearSession(false);installToken(sessionToken(crypto.randomUUID()));return dom;}

test('directory CSV reuses BOM/injection escaping, dates and A–Z/STT; no invented history or credential columns',async()=>{
 const input=rows(45);input.push({...input[0],id:1000,fullName:'=HYPERLINK("bad")'});const snapshot=structuredClone(input);const csv=accountRowsCsv(input);const text=await csv.text();const lines=text.split('\r\n');
 assert.deepEqual([...new Uint8Array(await csv.arrayBuffer()).slice(0,3)],[239,187,191]);assert.equal(lines.length,47);assert.match(text,/"'=/);assert.ok(text.includes('20/9/2026'));assert.doesNotMatch(lines[0],/mật khẩu|token|booking|Lịch đã|tiền|ngân hàng/i);assert.deepEqual(input,snapshot);
 const body=(await accountRowsCsv(rows(45)).text()).split('\r\n');assert.match(body[1],/^"1","Đặng An 1",/);assert.match(body[21],/^"21","Đặng An 21",/);assert.match(body[45],/^"45","Đặng An 45",/);
 const phones=await customerRowsCsv([{...rows(1)[0],email:'phone@example.test',phone:'0391234567',gender:null,dateOfBirth:null,bookingsPlaced:0,paidBookings:0,completedBookings:0,lastBookingAt:null,totalVerifiedOnlineAmount:0}]).text();assert.match(phones,/"'0391234567"/);
});

test('fallback export loads all205 filtered rows in bulk pages; partial, duplicate and failed pages abort',async()=>{
 const dom=env(),get=apiClient.get,users=adminV2Api.users;let calls:number[]=[];const data=rows(205);
 apiClient.get=(async()=>({status:204,data:null})) as typeof apiClient.get;adminV2Api.users=async(p)=>{calls.push(p.page);assert.equal(p.role,'CUSTOMER');return presentationPage(data,p.page,p.size);};
 try{const text=await(await adminV2Api.exportDirectory({role:'CUSTOMER'},()=>true)).text();assert.equal(text.split('\r\n').length,206);assert.match(text,/"205","Đặng An 205",/);assert.deepEqual(calls,[0,1,2]);
  adminV2Api.users=async(p)=>{const result=presentationPage(data,p.page,p.size);return p.page===1?{...result,content:result.content.slice(1)}:result;};await assert.rejects(adminV2Api.exportDirectory({role:'CUSTOMER'},()=>true),/thiếu|đầy đủ/);
  adminV2Api.users=async(p)=>{if(p.page===1)throw new Error('isolated API500');return presentationPage(data,p.page,p.size);};await assert.rejects(adminV2Api.exportDirectory({role:'CUSTOMER'},()=>true),/API500/);
  adminV2Api.users=async(p)=>presentationPage(data.map(u=>({...u,id:1})),p.page,p.size);await assert.rejects(adminV2Api.exportDirectory({role:'CUSTOMER'},()=>true),/trùng/);
 }finally{apiClient.get=get;adminV2Api.users=users;clearSession(false);dom.window.close();}
});

test('cached snapshot uses exact frozen membership and filters without fetching account details',async()=>{
 const dom=env(),get=apiClient.get;const all=rows(145);const selected=all.slice(30,101).map(u=>u.id);const requests:string[]=[];
 apiClient.get=(async(path:string,config?:{params?:{page?:number;size?:number}})=>{requests.push(path);if(path.endsWith('/presentation'))return{status:200,data:{users:all,bookings:[],salons:[],originalCustomers:[],returningCustomerIds:selected}};if(path.endsWith('/customers'))return{status:200,data:[]};return{status:200,data:path.endsWith('/users')?presentationPage(all,config?.params?.page??0,100):presentationPage([],0,100)};}) as typeof apiClient.get;
 try{const csv=await(await adminV2Api.exportDirectory({returning:true},()=>true)).text();assert.equal(csv.split('\r\n').length,72);for(const id of selected)assert.ok(csv.includes(`dangan${id}@gmail.com`));assert.equal(requests.some(url=>/users\/\d+/.test(url)),false);
  requests.length=0;const filtered=await(await adminV2Api.exportDirectory({returning:true,query:'dangan100@gmail.com'},()=>true)).text();assert.equal(filtered.split('\r\n').length,2);assert.match(filtered,/"1","Đặng An 100"/);assert.equal(requests.length,0,'same loaded snapshot is reused');
 }finally{apiClient.get=get;clearSession(false);dom.window.close();}
});

test('filter cancellation and logout/reinstall of the same token reject pending export',async()=>{
 const dom=env(),get=apiClient.get,users=adminV2Api.users;let finish!:(v:ReturnType<typeof presentationPage<AdminUserRow>>)=>void;let current=true;
 apiClient.get=(async()=>({status:204,data:null})) as typeof apiClient.get;adminV2Api.users=()=>new Promise(resolve=>finish=resolve);
 try{let pending=adminV2Api.exportDirectory({},()=>current);await new Promise(resolve=>setTimeout(resolve,0));current=false;finish(presentationPage(rows(1),0,100));await assert.rejects(pending,/hủy/);
  current=true;pending=adminV2Api.exportDirectory({},()=>current);await new Promise(resolve=>setTimeout(resolve,0));const token=sessionStorage.getItem('beautylink_access_token')!;clearSession(false);installToken(token);finish(presentationPage(rows(1),0,100));await assert.rejects(pending,/hủy/);
 }finally{apiClient.get=get;adminV2Api.users=users;clearSession(false);dom.window.close();}
});

test('visible main/returning toolbar actions cancel download when filters change mid-export',async()=>{
 const dom=env(),root=createRoot(document.getElementById('root')!),users=adminV2Api.users,returning=adminV2Api.returningUsers,exporter=adminV2Api.exportDirectory;const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL;let downloads=0,finish!:(b:Blob)=>void;
 adminV2Api.users=async()=>presentationPage(rows(40),0,20);adminV2Api.returningUsers=async()=>presentationPage(rows(71),0,20);adminV2Api.exportDirectory=()=>new Promise(resolve=>finish=resolve);URL.createObjectURL=()=>{downloads++;return'blob:isolated';};URL.revokeObjectURL=()=>{};
 const props={section:'customers' as const,adminName:'Admin',onHome(){},onLogout(){},onNavigate(){}};
 try{await act(async()=>root.render(React.createElement(AdminModulesPage,props)));const button=()=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Tải danh sách tài khoản')!;assert.ok(button());await act(async()=>button().click());const role=document.querySelector<HTMLSelectElement>('[aria-label="Lọc vai trò"]')!;await act(async()=>{role.value='CUSTOMER';role.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});await act(async()=>finish(new Blob(['not-downloaded'])));assert.equal(downloads,0);
  await act(async()=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Khách hàng quay lại')!.click());assert.ok([...document.querySelectorAll('button')].some(b=>b.textContent==='Tải danh sách khách'));
 }finally{adminV2Api.users=users;adminV2Api.returningUsers=returning;adminV2Api.exportDirectory=exporter;URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;await act(async()=>root.unmount());clearSession(false);dom.window.close();}
});


test('an incomplete bulk API page cannot become a partial presentation snapshot export',async()=>{
 const dom=env(),get=apiClient.get;const users=rows(145);
 apiClient.get=(async(path:string,config?:{params?:{page?:number}})=>{if(path.endsWith('/presentation'))return{status:200,data:{users:[],bookings:[],salons:[],originalCustomers:[]}};if(path.endsWith('/customers'))return{status:200,data:[]};if(path.endsWith('/users')){const result=presentationPage(users,config?.params?.page??0,100);return{status:200,data:{...result,content:result.content.slice(0,20)}};}return{status:200,data:presentationPage([],0,100)};}) as typeof apiClient.get;
 try{await assert.rejects(adminV2Api.exportDirectory({},()=>true),/thiếu|đầy đủ|thay đổi/);}finally{apiClient.get=get;clearSession(false);dom.window.close();}
});
