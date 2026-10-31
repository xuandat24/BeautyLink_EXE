import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { alphabetic, compareNames, displayAccount, rowOrdinal } from '../src/lib/adminDisplayProfiles';
import { mergePersistentPresentationData, presentationBookings, presentationCustomers, presentationCustomerCsv, presentationPage } from '../src/lib/presentationAdminData';
import { selectReturningPresentationCustomers } from '../src/lib/returningPresentationCustomers';
import { AdminModulesPage } from '../src/components/admin/AdminModulesPage';
import { adminV2Api } from '../src/services/adminApi';
import { apiClient } from '../src/services/beautyApi';
import type { PresentationAdminData } from '../src/lib/presentationAdminData';
import type { AdminUserRow } from '../src/types/adminV2';

test('Vietnamese whole names, natural numbers, empty last and stable ID ties across pages', () => {
  const names = ['Salon 10','đặng',' An  ','Đặng','Dương','Salon 2','Ánh','Bình',null,''];
  const rows = names.map((fullName,id)=>({id,fullName}));const original=structuredClone(rows);
  assert.deepEqual(alphabetic(rows,r=>r.fullName).map(r=>r.fullName),[' An  ','Ánh','Bình','Dương','đặng','Đặng','Salon 2','Salon 10',null,'']);
  assert.deepEqual(rows,original);assert.equal(compareNames('  An\u00a0 2 ','An 2'),0);assert.equal(compareNames('ĐẶNG','Đa\u0323\u0306ng'),0);
  const all=alphabetic(Array.from({length:45},(_,i)=>({id:45-i,fullName:i%3===0?'Đặng An':`An ${45-i}`})),r=>r.fullName);
  const first=presentationPage(all,0,20),second=presentationPage(all,1,20);
  assert.equal(new Set([...first.content,...second.content].map(r=>r.id)).size,40);
  assert.equal(rowOrdinal(first.page,first.size,19),20);assert.equal(rowOrdinal(second.page,second.size,0),21);
});

test('one persisted mapping survives merge/reload, aligns salon owner/history/CSV and preserves money/roles/status', async () => {
  const customer={id:1,fullName:'phan.dinh.khoi91',email:'khoi+001@seed.beautylink.test',role:'CUSTOMER',status:'ACTIVE',createdAt:'2026-10-01T00:00:00Z',phone:'0391234567',gender:null,dateOfBirth:null,updatedAt:'2026-10-01T00:00:00Z',salons:[]};
  const owner={...customer,id:2,fullName:'Đặng Mỹ Anh',email:'catalog.anh@beautylink.local',role:'SUPPLIER',status:'DISABLED'};
  const profiles=[{id:1,source:'SEED_CUSTOMER',fullName:'Phan Dinh Khoi',email:'phandinhkhoi91@gmail.com'},{id:2,source:'SEED_PARTNER',fullName:owner.fullName,email:'dangmyanh92@gmail.com'}];
  const data={users:[customer,owner],displayProfiles:profiles,returningCustomerIds:[1],salons:[{id:9,ownerUserId:2,name:'Salon Anh',ownerName:'Old',ownerEmail:owner.email,active:false,approvalStatus:'PENDING',serviceCount:2,practitionerCount:1,bookingCount:1}],bookings:[{id:9000000001,customerId:1,customerName:customer.fullName,supplierId:9,totalAmount:11000,verifiedOnlineAmount:550,remainingAtSalon:10450,status:'CONFIRMED',paymentStatus:'PARTIALLY_PAID',createdAt:'2026-10-21T00:00:00Z',bookingCode:'BL-TEST'}],originalCustomers:[]} as unknown as PresentationAdminData;
  const original=structuredClone(data);const merged=mergePersistentPresentationData(data,{users:[customer,owner] as AdminUserRow[]});
  assert.equal(merged.users.find(u=>u.id===1)!.email,profiles[0].email);assert.equal(merged.salons[0].ownerEmail,profiles[1].email);assert.equal(merged.salons[0].ownerUserId,2);assert.equal(merged.salons[0].active,false);
  assert.equal(presentationBookings(merged)[0].customerName,'Phan Dinh Khoi');assert.equal(presentationCustomers(merged)[0].fullName,'Phan Dinh Khoi');
  assert.match(await presentationCustomerCsv(merged).text(),/phandinhkhoi91@gmail.com/);
  assert.equal(merged.bookings[0].totalAmount,11000);assert.equal(merged.bookings[0].verifiedOnlineAmount,550);assert.equal(merged.users.find(u=>u.id===2)!.status,'DISABLED');
  assert.deepEqual(data,original);assert.deepEqual(mergePersistentPresentationData(structuredClone(data),{users:[customer,owner] as AdminUserRow[]}),merged);
  assert.equal(displayAccount({...customer,id:77,email:'real@company.vn'},data).email,'real@company.vn');
});

test('freeze71 membership before presentation name/date changes; sort only after selection', () => {
  const users=Array.from({length:200},(_,id)=>({id:id+1,fullName:`Khách ${id}`,role:'CUSTOMER',createdAt:'2026-09-01T00:00:00Z'} as AdminUserRow));
  const ids=selectReturningPresentationCustomers(users).map(u=>u.id);
  const changed=users.map(u=>({...u,createdAt:'2026-10-29T00:00:00Z',fullName:`Tên ${201-u.id}`}));
  assert.deepEqual(new Set(alphabetic(changed.filter(u=>ids.includes(u.id)),u=>u.fullName).map(u=>u.id)),new Set(ids));
});

test('view alias never fills or saves operational editor and raw list sends forEdit', async()=>{
  const get=apiClient.get,patch=apiClient.patch;const raw={id:8,fullName:'Real Owner',email:'catalog.real@beautylink.local'};let sent:unknown;
  apiClient.get=(async(path:string,config?:{params?:{forEdit?:boolean}})=>({data:path.endsWith('/profiles')?{displayProfiles:[{...raw,email:'realowner8@gmail.com'}]}:path.endsWith('/users')?(assert.equal(config?.params?.forEdit,true),presentationPage([raw])):raw})) as typeof apiClient.get;
  apiClient.patch=(async(_path:string,data:unknown)=>{sent=data;return {data:raw};}) as typeof apiClient.patch;
  try {assert.equal((await adminV2Api.account(8)).email,'realowner8@gmail.com');assert.equal((await adminV2Api.account(8,true)).email,raw.email);assert.equal((await adminV2Api.users({page:0,size:20},true)).content[0].email,raw.email);
    const request={fullName:'Real Owner',email:raw.email,gender:null,dateOfBirth:null,expectedUpdatedAt:'2026-10-01T00:00:00Z'};await adminV2Api.updateAccount(8,request);assert.deepEqual(sent,request);
  }finally{apiClient.get=get;apiClient.patch=patch;}
});

test('directory STT uses returned page metadata, IDs remain navigation identities',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage});Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,configurable:true});
  const root=createRoot(document.getElementById('root')!);const original=adminV2Api.users;let selected=0;
  adminV2Api.users=async()=>({content:[{id:91,fullName:'Đặng An',email:'an@gmail.com',role:'CUSTOMER',status:'ACTIVE',createdAt:'2026-10-20T00:00:00Z'}],page:1,size:20,totalElements:40,totalPages:2});
  try{await act(async()=>root.render(React.createElement(AdminModulesPage,{section:'customers',adminName:'Admin',onHome(){},onLogout(){},onNavigate(){},onOpenAccount:id=>selected=id})));assert.equal(document.querySelector('tbody td')!.textContent,'21');await act(async()=>document.querySelector<HTMLButtonElement>('tbody button')!.click());assert.equal(selected,91);
  }finally{adminV2Api.users=original;await act(async()=>root.unmount());dom.window.close();}
});
