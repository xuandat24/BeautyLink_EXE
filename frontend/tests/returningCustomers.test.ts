import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { alphabetic } from '../src/lib/adminDisplayProfiles';
import { selectReturningPresentationCustomers } from '../src/lib/returningPresentationCustomers';
import { presentationPage } from '../src/lib/presentationAdminData';
import { adminV2Api } from '../src/services/adminApi';
import { beautyApi } from '../src/services/beautyApi';
import { AdminModulesPage } from '../src/components/admin/AdminModulesPage';
import { AdminDashboardPage } from '../src/components/admin/AdminDashboardPage';
import { insightsFixture, metricFixture, paymentFixture } from './adminV2Fixtures';
import type { AdminUserRow } from '../src/types/adminV2';

const users:AdminUserRow[]=Array.from({length:200},(_,i)=>({id:200-i,fullName:`Khách ${200-i}`,email:`customer${200-i}@example.com`,role:(200-i)%31===0?'SUPPLIER':'CUSTOMER',status:'ACTIVE',createdAt:'2026-10-01T00:00:00Z'}));
function environment() {
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/#admin-customers'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage});
  Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,configurable:true});
  return {dom,root:createRoot(document.getElementById('root')!)};
}
test('presentation cohort starts at position86, is stable, unique and customer-only without modifying users',()=>{
  const before=JSON.stringify(users), selected=selectReturningPresentationCustomers([...users].reverse());
  assert.equal(selected.length,71);assert.equal(selected[0].id,115);assert.ok(selected.every(u=>u.role==='CUSTOMER'));
  assert.equal(new Set(selected.map(u=>u.id)).size,71);assert.deepEqual(selectReturningPresentationCustomers([...users,...users]),selected);
  assert.equal(JSON.stringify(users),before);assert.deepEqual(selectReturningPresentationCustomers(users.slice(0,30)),[]);
});
test('returning search and pagination operate on the same selected71, not different raw account pages',async()=>{
  const original=adminV2Api.users;const requests:number[]=[];
  adminV2Api.users=async p=>{assert.equal(p.query,undefined);assert.equal(p.role,undefined);requests.push(p.page);return presentationPage(users,p.page,p.size);};
  try {
    const all=[];for(let page=0;page<4;page++){const r=await adminV2Api.returningUsers({page,size:20});assert.equal(r.totalElements,71);assert.equal(r.totalPages,4);all.push(...r.content);}
    assert.deepEqual(all,alphabetic(selectReturningPresentationCustomers(users), u=>u.fullName));assert.deepEqual(requests.slice(0,2),[0,1]);
    assert.equal((await adminV2Api.returningUsers({query:'customer115@',page:0,size:20})).content[0].id,115);
    assert.equal((await adminV2Api.returningUsers({query:'customer200@',page:0,size:20})).totalElements,0);
  }finally{adminV2Api.users=original;}
});
test('returning tab opens directly, lists71 over4 pages, navigates to existing account details and preserves all-users tab',async()=>{
  const env=environment(),original=adminV2Api.users;let selected=0;
  adminV2Api.users=async p=>presentationPage(users,p.page,p.size);
  const button=(name:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===name)!;
  try {
    await act(async()=>env.root.render(React.createElement(AdminModulesPage,{section:'customers',initialReturning:true,adminName:'Admin',onNavigate(){},onHome(){},onLogout(){},onOpenAccount:id=>{selected=id;}})));
    assert.equal(button('Khách hàng quay lại').getAttribute('aria-pressed'),'true');assert.match(document.body.textContent!,/71 kết quả/);assert.equal(document.querySelectorAll('tbody tr').length,20);
    assert.equal(document.querySelector('[aria-label="Lọc vai trò"]'),null);
    await act(async()=>document.querySelector<HTMLButtonElement>('tbody button')!.click());assert.equal(selected,43);
    for(let i=0;i<3;i++)await act(async()=>button('Trang sau').click());
    assert.equal(document.querySelectorAll('tbody tr').length,11);assert.equal(button('Trang sau').disabled,true);
    await act(async()=>button('Tất cả tài khoản').click());assert.match(document.body.textContent!,/200 kết quả/);assert.equal(document.querySelector('tbody tr td:nth-child(2)')!.textContent,'Khách 200');
    assert.ok(document.querySelector('[aria-label="Lọc vai trò"]'));
    await act(async()=>button('Khách hàng quay lại').click());assert.equal(document.querySelector('tbody tr td:nth-child(2)')!.textContent,'Khách 43');
  }finally{adminV2Api.users=original;await act(async()=>env.root.unmount());env.dom.window.close();}
});
test('dashboard returning detail passes returning tab through the existing admin navigation',async()=>{
  const env=environment(),original={insights:adminV2Api.insights,payments:beautyApi.adminPaymentSummary,bookings:beautyApi.adminBookings};const destination:unknown[]=[];
  const data=insightsFixture();data.returningCustomers=metricFixture(0);data.reportPayments=metricFixture(3043208,'VND');
  adminV2Api.insights=async()=>data;beautyApi.adminPaymentSummary=async()=>paymentFixture();beautyApi.adminBookings=async()=>presentationPage([],0,5);
  try{
    await act(async()=>env.root.render(React.createElement(AdminDashboardPage,{mode:'overview',adminName:'Admin',onNavigate:(section,query)=>{destination.push(section,query);},onHome(){},onLogout(){},onOpenBookedCustomers(){}})));
    const card=[...document.querySelectorAll('article')].find(c=>c.querySelector('h2')?.textContent==='Khách hàng quay lại')!;
    assert.equal(card.querySelector('[data-admin-value]')!.textContent,'71');
    await act(async()=>card.querySelector<HTMLButtonElement>('button')!.click());assert.deepEqual(destination,['customers','returning']);
  }finally{adminV2Api.insights=original.insights;beautyApi.adminPaymentSummary=original.payments;beautyApi.adminBookings=original.bookings;await act(async()=>env.root.unmount());env.dom.window.close();}
});
