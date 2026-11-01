import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { BOOKING_TABLE_COLUMNS, bookingRowsCsv, bookingOnlineAmount } from '../src/lib/adminBookingCsv';
import { apiClient, beautyApi } from '../src/services/beautyApi';
import { clearSession, installToken } from '../src/lib/authSession';
import { presentationPage } from '../src/lib/presentationAdminData';
import { AdminDashboardPage } from '../src/components/admin/AdminDashboardPage';
import { sessionToken } from './sessionFixtures';
import type { AdminBooking } from '../src/types';
const range = { from: '2026-10-01', to: '2026-10-31' };
const row = (id = 1): AdminBooking => ({ id, bookingCode: `BL-${id}`, customerId: 21, customerName: 'Đặng Ánh', customerPhone: '0391234567', supplierId: 4, supplierName: 'Salon An', serviceName: 'Chăm sóc tóc', practitionerName: 'Nguyễn Hân', appointmentDate: '2026-10-25', startTime: '09:30:00', endTime: '10:30:00', totalAmount: 200000, status: 'CONFIRMED', paymentStatus: 'PARTIALLY_PAID', createdAt: '2026-10-20T02:00:00Z', verifiedPaymentOption: 'DEPOSIT_05', verifiedOnlineAmount: 10000, remainingAtSalon: 190000, verifiedPaidAt: '2026-10-20T02:01:00Z', paymentReviewRequired: false });
function env() { const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' }); Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage }); Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true }); clearSession(false); installToken(sessionToken(crypto.randomUUID())); return dom; }
const lines = async (blob: Blob) => (await blob.text()).split('\r\n');

test('CSV matches all10 screenshot columns, visible values and deposit/review/null/zero semantics', async () => {
 const input = [row(), { ...row(2), status: 'CANCELLED' as const, paymentStatus: 'UNPAID' as const, verifiedOnlineAmount: null, practitionerName: '', paymentReviewRequired: true }, { ...row(3), verifiedOnlineAmount: 0 }], before = structuredClone(input);
 const blob = bookingRowsCsv(input), exported = await lines(blob);
 assert.deepEqual(BOOKING_TABLE_COLUMNS, ['Mã lịch', 'Khách hàng', 'Salon', 'Dịch vụ', 'Chuyên viên', 'Lịch hẹn', 'Trạng thái lịch', 'Thanh toán', 'Thu online xác minh', 'Thao tác']);
 assert.equal(exported[0], BOOKING_TABLE_COLUMNS.map(value => `"${value}"`).join(','));
 assert.equal(exported[1], ['BL-1', 'Đặng Ánh', 'Salon An', 'Chăm sóc tóc', 'Nguyễn Hân', '2026-10-25 · 09:30', 'Đã xác nhận', 'Đã đặt cọc', bookingOnlineAmount(10000), 'Xem chi tiết'].map(value => `"${value}"`).join(','));
 assert.ok(exported[2].includes('"Đã hủy","Chưa thanh toán · Cần đối soát","—"')); assert.ok(exported[3].includes(bookingOnlineAmount(0))); assert.deepEqual([...new Uint8Array(await blob.arrayBuffer()).slice(0,3)], [239,187,191]); assert.deepEqual(input,before); assert.equal((await lines(bookingRowsCsv([]))).length,1);
});

test('CSV escapes formulas/quotes and excludes hidden phone, prices, simulated receipts and credentials', async () => {
 const text = await bookingRowsCsv([{ ...row(), customerName: '=HYPERLINK("bad")', serviceName: 'Tóc, "đẹp"', simulatedOnlineAmount: 999999 }]).text();
 assert.ok(text.includes('"\'=HYPERLINK(""bad"")"')); assert.ok(text.includes('"Tóc, ""đẹp"""')); assert.doesNotMatch(text,/0391234567|190000|200000|999999|customerId|paidAt|token/);
 assert.throws(()=>bookingRowsCsv([row(),row()]),/trùng/); assert.throws(()=>bookingRowsCsv([{...row(),verifiedOnlineAmount:NaN}]),/không đầy đủ/);
});

test('export reads all205 filtered rows in bulk pages and rejects partial, duplicate or failed pages', async () => {
 const dom=env(),get=apiClient.get,rows=Array.from({length:205},(_,i)=>row(i+1));let variant='ok';const calls:number[]=[];
 apiClient.get=(async(path:string,config?:{params?:Record<string,unknown>})=>{if(path.endsWith('/presentation'))return{status:204,data:null};assert.equal(path,'/v1/admin/bookings');const p=config!.params!;assert.equal(p.includeDemo,false);assert.equal(p.status,'CONFIRMED');assert.equal(p.paymentStatus,'PARTIALLY_PAID');assert.equal(p.query,'Salon');assert.equal(p.from,range.from);assert.equal(p.to,range.to);const page=p.page as number;calls.push(page);if(variant==='error'&&page===1)throw new Error('isolated API500');const result=presentationPage(rows,page,100);if(page===1&&variant==='partial')result.content.pop();if(page===1&&variant==='duplicate')result.content[0]=rows[0];return{status:200,data:result};}) as typeof apiClient.get;
 const params={...range,status:'CONFIRMED',paymentStatus:'PARTIALLY_PAID',query:'Salon'};
 try{assert.equal((await lines(await beautyApi.exportAdminBookingsCsv(params,()=>true))).length,206);assert.deepEqual(calls,[0,1,2]);for(variant of ['partial','duplicate','error'])await assert.rejects(beautyApi.exportAdminBookingsCsv(params,()=>true),/thiếu|thay đổi|trùng|API500/);}finally{apiClient.get=get;clearSession(false);dom.window.close();}
});

test('export and table share display profile, report snapshot, filters and order', async()=>{
 const dom=env(),get=apiClient.get,raw={...row(9000000001),customerName:'old handle',serviceId:1,commissionAmount:0};
 apiClient.get=(async(path:string,config?:{params?:{page?:number}})=>{if(path.endsWith('/presentation'))return{status:200,data:{users:[{id:21,fullName:'old handle',email:'seed@example.test',createdAt:'2026-09-21T00:00:00Z',salons:[]}],salons:[],bookings:[raw,{...raw,id:9000000002,status:'CANCELLED'}],originalCustomers:[],displayProfiles:[{id:21,fullName:'Phan Đình Khôi',email:'phandinhkhoi91@gmail.com',source:'REPORT'}]}};if(path.endsWith('/customers'))return{status:200,data:[]};return{status:200,data:presentationPage([],config?.params?.page??0,100)};}) as typeof apiClient.get;
 try{const params={...range,status:'CONFIRMED',query:'Phan Dinh Khoi'};const visible=await beautyApi.adminBookings({...params,includeDemo:false,page:0,size:20}),csv=await lines(await beautyApi.exportAdminBookingsCsv(params,()=>true));assert.equal(visible.totalElements,1);assert.equal(csv.length,2);assert.ok(csv[1].includes(visible.content[0].customerName));assert.ok(csv[1].startsWith(`"${visible.content[0].bookingCode}"`));}finally{apiClient.get=get;clearSession(false);dom.window.close();}
});

test('filter change, logout or same-token replacement cancels export before requesting another page',async()=>{
 const dom=env(),get=apiClient.get;let pending!:()=>void,requested!:()=>void,count=0;
 apiClient.get=(async(path:string)=>{if(path.endsWith('/presentation'))return{status:204,data:null};count++;requested();await new Promise<void>(resolve=>{pending=resolve;});return{status:200,data:presentationPage(Array.from({length:101},(_,i)=>row(i+1)),0,100)};}) as typeof apiClient.get;
 try{for(const mode of ['filter','logout','replace']){const token=sessionToken(crypto.randomUUID());installToken(token);let current=true;const started=new Promise<void>(resolve=>{requested=resolve;});const promise=beautyApi.exportAdminBookingsCsv(range,()=>current);await started;if(mode==='filter')current=false;else if(mode==='logout')clearSession(false);else installToken(token);pending();await assert.rejects(promise,/hủy tải/);}assert.equal(count,3);}finally{apiClient.get=get;clearSession(false);dom.window.close();}
});

test('toolbar downloads table columns and discards in-flight export when a filter changes',async()=>{
 const dom=env(),root=createRoot(document.getElementById('root')!),list=beautyApi.adminBookings,download=beautyApi.exportAdminBookingsCsv,createUrl=URL.createObjectURL,revokeUrl=URL.revokeObjectURL,click=dom.window.HTMLAnchorElement.prototype.click;const files:string[]=[];let guard!:()=>boolean,finish!:(blob:Blob)=>void;
 beautyApi.adminBookings=async()=>presentationPage([row()],0,20);beautyApi.exportAdminBookingsCsv=async(_params,current)=>{guard=current;return new Promise<Blob>(resolve=>{finish=resolve;});};URL.createObjectURL=()=> 'blob:isolated';URL.revokeObjectURL=()=>{};dom.window.HTMLAnchorElement.prototype.click=function(){files.push(this.download);};const button=()=>[...document.querySelectorAll('button')].find(node=>node.textContent==='Tải danh sách lịch đặt (CSV)')!;
 try{await act(async()=>{root.render(React.createElement(AdminDashboardPage,{mode:'bookings',adminName:'Admin',onNavigate(){},onHome(){},onLogout(){},onOpenBookedCustomers(){}}));});assert.deepEqual([...document.querySelectorAll('th')].map(n=>n.textContent),BOOKING_TABLE_COLUMNS);await act(async()=>{button().click();});assert.ok(guard());await act(async()=>{const select=document.querySelector('select[aria-label="Trạng thái lịch"]') as HTMLSelectElement;select.value='COMPLETED';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});assert.equal(guard(),false);await act(async()=>{finish(bookingRowsCsv([row()]));});assert.equal(files.length,0);await act(async()=>{button().click();});assert.ok(guard());await act(async()=>{finish(bookingRowsCsv([row()]));});assert.equal(files.length,1);assert.match(files[0],/^beautylink-lich-dat-.*\.csv$/);}finally{await act(async()=>root.unmount());beautyApi.adminBookings=list;beautyApi.exportAdminBookingsCsv=download;URL.createObjectURL=createUrl;URL.revokeObjectURL=revokeUrl;dom.window.HTMLAnchorElement.prototype.click=click;clearSession(false);dom.window.close();}
});
