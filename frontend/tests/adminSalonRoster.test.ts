import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { AdminSalonRoster } from '../src/components/admin/AdminSalonRoster';
import { AdminModulesPage } from '../src/components/admin/AdminModulesPage';
import { adminV2Api } from '../src/services/adminApi';
import { clearSession, installToken } from '../src/lib/authSession';
import { sessionToken } from './sessionFixtures';
import type { SalonRoster, SalonRosterRow } from '../src/types/adminV2';
const snapshot = (): SalonRoster => ({ owners:14,practitioners:26,excludedCatalogProfiles:10,sharedOwnerProfiles:3,rows:Array.from({length:40},(_,i)=>({key:`${i<14?'OWNER':'PRACTITIONER'}:${i+1}`,kind:i<14?'OWNER':'PRACTITIONER',accountId:i<14?i+1:null,practitionerId:i<14?null:i+1,salonId:i%14+1,salonName:`Salon ${i%14+1}`,fullName:`Đặng An ${40-i}`,email:i<14?`owner${i+1}@gmail.com`:null,accountRole:i<14?'SUPPLIER':null,active:true,alsoPractitioner:i<3} as SalonRosterRow)) });
function env(){const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage});Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,configurable:true});clearSession(false);installToken(sessionToken(crypto.randomUUID()));return dom;}
const button=(text:string)=>[...document.querySelectorAll('button')].find(node=>node.textContent===text)!;

test('roster displays14 owners/26 profiles, A–Z and STT across two pages, actual salon links and no invented employee email',async()=>{
 const dom=env(),root=createRoot(document.getElementById('root')!),api=adminV2Api.salonRoster;let calls=0;adminV2Api.salonRoster=async()=>{calls++;return snapshot();};
 try{await act(async()=>{root.render(React.createElement(AdminSalonRoster));});assert.doesNotMatch(document.body.textContent!,/Đây là danh sách hồ sơ|demo|catalog/);assert.equal(document.querySelectorAll('tbody tr').length,20);assert.equal(document.querySelector('tbody tr td:nth-child(2)')?.textContent,'Đặng An 1');assert.equal(document.querySelector('tbody tr td:nth-child(3)')?.textContent,'—');assert.match(document.querySelector('tbody tr')!.textContent!,/Chưa có tài khoản/);
 await act(async()=>{button('Trang sau').click();});assert.equal(document.querySelector('tbody tr td')?.textContent,'21');assert.equal(document.querySelector('tbody tr td:nth-child(2)')?.textContent,'Đặng An 21');assert.equal(calls,1);
 await act(async()=>{const select=document.querySelector('select')!;select.value='OWNER';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});assert.equal(document.querySelectorAll('tbody tr').length,14);assert.equal(document.querySelector('tbody tr td')?.textContent,'1');assert.equal(calls,1);button('Xem tài khoản').click();assert.match(dom.window.location.hash,/^#admin-users\/[1-9]/);
 await act(async()=>{const select=document.querySelector('select')!;select.value='PRACTITIONER';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});button('Xem tại salon').click();assert.match(dom.window.location.hash,/^#admin-salons\/[1-9].*\/practitioners$/);
 }finally{await act(async()=>root.unmount());adminV2Api.salonRoster=api;clearSession(false);dom.window.close();}
});

test('roster CSV exports the complete filtered snapshot and leaves absent emails empty; UI has loading and retry',async()=>{
 const dom=env(),root=createRoot(document.getElementById('root')!),api=adminV2Api.salonRoster,create=URL.createObjectURL,revoke=URL.revokeObjectURL,click=dom.window.HTMLAnchorElement.prototype.click;let blob!:Blob,downloaded=0;let fail=true;
 adminV2Api.salonRoster=async()=>{if(fail)throw new Error('isolated failure');return snapshot();};URL.createObjectURL=(value)=>{blob=value as Blob;return 'blob:roster';};URL.revokeObjectURL=()=>{};dom.window.HTMLAnchorElement.prototype.click=function(){downloaded++;};
 try{await act(async()=>root.render(React.createElement(AdminSalonRoster)));assert.match(document.querySelector('[role="alert"]')!.textContent!,/isolated failure/);fail=false;await act(async()=>button('Thử lại').click());await act(async()=>button('Tải danh sách hồ sơ (CSV)').click());assert.equal(downloaded,1);assert.equal((await blob.text()).split('\r\n').length,41);assert.deepEqual([...new Uint8Array(await blob.arrayBuffer()).slice(0,3)],[239,187,191]);
 await act(async()=>{const select=document.querySelector('select')!;select.value='PRACTITIONER';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});await act(async()=>button('Tải danh sách hồ sơ (CSV)').click());const lines=(await blob.text()).split('\r\n');assert.equal(lines.length,27);assert.match(lines[1],/"","Chuyên viên"/);assert.doesNotMatch(lines[0],/mật khẩu|token|tiền|booking/i);
 }finally{await act(async()=>root.unmount());adminV2Api.salonRoster=api;URL.createObjectURL=create;URL.revokeObjectURL=revoke;dom.window.HTMLAnchorElement.prototype.click=click;clearSession(false);dom.window.close();}
});

test('old-account roster response is ignored after switching sessions or logout',async()=>{
 const dom=env(),root=createRoot(document.getElementById('root')!),api=adminV2Api.salonRoster;let resolve!:(value:SalonRoster)=>void;let calls=0;adminV2Api.salonRoster=async()=>{calls++;return new Promise<SalonRoster>(r=>{resolve=r;});};
 try{await act(async()=>root.render(React.createElement(AdminSalonRoster)));const old=resolve;await act(async()=>installToken(sessionToken(crypto.randomUUID())));assert.equal(calls,2);await act(async()=>old(snapshot()));assert.equal(document.querySelectorAll('tbody tr').length,0);await act(async()=>resolve(snapshot()));assert.equal(document.querySelectorAll('tbody tr').length,20);await act(async()=>clearSession(false));assert.equal(document.querySelectorAll('tbody tr').length,0);assert.equal(button('Tải danh sách hồ sơ (CSV)').disabled,true);
 }finally{await act(async()=>root.unmount());adminV2Api.salonRoster=api;clearSession(false);dom.window.close();}
});

test('user management offers the roster tab without changing the existing account dataset or raw editor',async()=>{
 const dom=env(),root=createRoot(document.getElementById('root')!),roster=adminV2Api.salonRoster,users=adminV2Api.users;adminV2Api.salonRoster=async()=>snapshot();let userCalls=0;adminV2Api.users=async()=>{userCalls++;return{content:[],page:0,size:20,totalElements:0,totalPages:0};};
 const props={section:'customers' as const,adminName:'Admin',onNavigate(){},onHome(){},onLogout(){}};
 try{await act(async()=>root.render(React.createElement(AdminModulesPage,props)));assert.equal(userCalls,1);await act(async()=>button('Salon & chuyên viên').click());assert.equal(document.querySelectorAll('tbody tr').length,20);assert.equal(userCalls,1);await act(async()=>button('Tất cả tài khoản').click());assert.equal(userCalls,2);await act(async()=>root.render(React.createElement(AdminModulesPage,{...props,editProfiles:true})));assert.equal([...document.querySelectorAll('button')].some(n=>n.textContent==='Salon & chuyên viên'),false);
 }finally{await act(async()=>root.unmount());adminV2Api.salonRoster=roster;adminV2Api.users=users;clearSession(false);dom.window.close();}
});
