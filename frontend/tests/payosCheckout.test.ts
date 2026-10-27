import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { PayOSCheckoutPage } from '../src/components/PayOSCheckoutPage';
import { beautyApi, setAccessToken, clearAccessToken } from '../src/services/beautyApi';
import type { PayOSPayment } from '../src/types/beauty';
import { sessionToken } from './sessionFixtures';
import { testQr } from './payosQrFixture';
import { payableAttempt, retryDelay, usableProviderQr } from '../src/lib/payosCheckout';
const payment: PayOSPayment = { checkoutAllowed: true, verificationPending: false, bookingId: 42, bookingCode: 'TEST-42', orderCode: 123, paymentLinkId: 'test-link', checkoutUrl: 'https://pay.payos.vn/web/test-link', amount: 11000, remainingAmount: 209000, paymentOption: 'DEPOSIT_05', status: 'PENDING', requiresManualReview: false, expiresAt: new Date(Date.now()+600000).toISOString(), qrCode: testQr(11000), bankBin: '970422', bankAccountNumber: 'TEST-ACCOUNT', bankAccountName: 'TEST MERCHANT', transferDescription: 'TEST ONLY' };
async function run(status: PayOSPayment | (()=>Promise<PayOSPayment>), check: () => Promise<void> | void, setup?:()=>void) {
 const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
 Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
 Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,configurable:true});
 setup?.();
 setAccessToken(sessionToken());
 const original = beautyApi.payOSPaymentStatus; beautyApi.payOSPaymentStatus=typeof status==='function'?status:async()=>status;
 const root=createRoot(document.getElementById('root')!);
 try { await act(async()=>root.render(React.createElement(PayOSCheckoutPage,{initialPayment:payment,onBack(){}}))); await check(); }
 finally { await act(async()=>root.unmount()); beautyApi.payOSPaymentStatus=original; dom.window.close(); }
}
test('custom checkout renders exact provider transfer details and copies unformatted amount', async()=> {
 let copied=''; Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async(v:string)=>{copied=v;}}}});
 await run(payment,async()=>{
  assert.match(document.body.textContent??'',/TEST MERCHANT/); assert.match(document.body.textContent??'',/TEST-ACCOUNT/);
  assert.match(document.body.textContent??'',/TEST ONLY/); assert.equal(document.querySelector('a[href^="https://pay.payos.vn"]'),null);
  await act(async()=>{(document.querySelector('[aria-label="Sao chép số tiền"]') as HTMLButtonElement).click();}); assert.equal(copied,'11000');
 });
});
test('valid QR remains available without optional metadata or a hosted checkout URL',async()=>{
 await run({...payment,checkoutAllowed:true,checkoutUrl:null,bankBin:null,bankAccountNumber:null,bankAccountName:null,transferDescription:null},()=>{
  assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'),'PENDING');
  assert.equal(document.querySelector('[aria-label="Sao chép số tài khoản"]'),null);
  assert.equal(document.querySelector('a[href^="https://pay.payos.vn"]'),null);
  assert.match(document.body.textContent??'',/Quét mã để thanh toán/);
 });
});
test('initial data stays locked until verification; stale response after an account switch cannot unlock it',async()=>{
 let finish!:(p:PayOSPayment)=>void;
 await run(()=>new Promise(resolve=>{finish=resolve;}),async()=>{
  assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'),'INITIALIZING');
  assert.equal(document.querySelector('[aria-label="Sao chép số tài khoản"]'),null);
  clearAccessToken();
  await act(async()=>{finish(payment);});
  assert.equal(document.querySelector('[aria-label="Sao chép số tài khoản"]'),null);
  assert.doesNotMatch(document.body.textContent??'',/Thanh toán thành công/);
 });
});
test('temporary 429/500/network failures hide instructions and explicit retry recovers the same attempt',async()=>{
 for(const failure of [{response:{status:429,headers:{'retry-after':'2'}}},{response:{status:500}},new Error('offline')]){
  let calls=0;
  await run(async()=>{if(++calls===1)throw failure;return payment;},async()=>{
   assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'),'NETWORK_ERROR');
   assert.equal(document.querySelector('[aria-label="Sao chép số tài khoản"]'),null);
   await act(async()=>{(Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('Kiểm tra trạng thái')) as HTMLButtonElement).click();});
   assert.equal(calls,2);assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'),'PENDING');
  });
 }
});
test('legacy missing/malformed QR uses only a verified safe fallback, not a new payment',async()=>{
 for(const qrCode of [null,'TEST-QR-NOT-PAYABLE','https://attacker.invalid/qr'])await run({...payment,qrCode},()=>{
  assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'),'QR_UNAVAILABLE');
  assert.equal(document.querySelector('a[href^="https://pay.payos.vn"]')?.getAttribute('href'),payment.checkoutUrl);
 });
 await run({...payment,checkoutAllowed:false,qrCode:null},()=>{assert.equal(document.querySelector('a[href^="https://pay.payos.vn"]'),null);});
});
test('temporary failures stop after five requests; network reconnect resumes the same order with no overlapping timer',async()=>{
 let calls=0, recovered=false, sequence=0;const tasks=new Map<number,()=>Promise<void>>();
 await run(async()=>{calls++;if(!recovered)throw new Error('offline');return payment;},async()=>{
  for(let attempt=0;attempt<4;attempt++){
   assert.equal(tasks.size,1);const [id,callback]=[...tasks.entries()][0];tasks.delete(id);
   await act(async()=>{await callback();});
  }
  assert.equal(calls,5);assert.equal(tasks.size,0);
  recovered=true;await act(async()=>{window.dispatchEvent(new window.Event('online'));});
  assert.equal(calls,6);assert.equal(tasks.size,1);
  assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'),'PENDING');
 },()=>{
  window.setTimeout=((callback:()=>Promise<void>)=>{tasks.set(++sequence,callback);return sequence;}) as typeof window.setTimeout;
  window.clearTimeout=((id:unknown)=>{if(typeof id==='number')tasks.delete(id);}) as typeof window.clearTimeout;
 });
});
test('a late pending response cannot overwrite a newer paid response after reconnect',async()=>{
 let calls=0, old!:(p:PayOSPayment)=>void;
 await run(async()=>{if(++calls===1)return new Promise(resolve=>{old=resolve;});return {...payment,status:'PAID'};},async()=>{
  await act(async()=>{window.dispatchEvent(new window.Event('online'));});
  assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'),'PAID');
  await act(async()=>{old(payment);});
  assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'),'PAID');
  assert.equal(document.querySelector('[aria-label="Sao chép số tài khoản"]'),null);
 });
});
test('401 and 403 lock instructions and do not restart polling on network events',async()=>{
 for(const status of [401,403]){let calls=0;await run(async()=>{calls++;throw {response:{status}};},async()=>{
  await act(async()=>{window.dispatchEvent(new window.Event('online'));});assert.equal(calls,1);
  assert.equal(document.querySelector('[aria-label="Sao chép số tài khoản"]'),null);
 });}
});
test('local countdown does not assert provider expiry; confirmed terminal states and verification deferral hide QR',async()=>{
 await run({...payment,expiresAt:new Date(0).toISOString()},()=>{
  assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'),'VERIFYING');
  assert.doesNotMatch(document.body.textContent??'',/PayOS đã xác nhận hết hạn/);
 });
 for(const status of ['EXPIRED','CANCELLED'] as const)await run({...payment,status},()=>{
  assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'),status);
  assert.equal(document.querySelector('[aria-label="Sao chép số tài khoản"]'),null);
 });
 await run({...payment,checkoutAllowed:false,verificationPending:true},()=>assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'),'NETWORK_ERROR'));
});
test('QR CRC and fixed amount are validated; eligibility accepts explicit capability independently of hosted URL',()=>{
 assert.equal(usableProviderQr(testQr(11000),11000),true);
 assert.equal(usableProviderQr(testQr(11000),11001),false);
 assert.equal(usableProviderQr(testQr(11000).slice(0,-4)+'0000',11000),false);
 assert.equal(payableAttempt({...payment,checkoutAllowed:true,checkoutUrl:null},42),true);
 assert.equal(payableAttempt({...payment,checkoutAllowed:false},42),false);
 assert.equal(payableAttempt({...payment,checkoutAllowed:undefined},42),false);
 assert.equal(payableAttempt(payment,99),false);
 for(const failures of [1,2,3,4,9])assert.ok(retryDelay({},failures)<=30000);
 assert.equal(retryDelay({response:{headers:{'retry-after':'120'}}},1),60000);
});
test('older backend without verification capabilities fails closed even with a hosted URL and QR',async()=>{
 await run({...payment,checkoutAllowed:undefined,verificationPending:undefined},()=>{
  assert.equal(document.querySelector('[aria-label="Sao chép số tài khoản"]'),null);
  assert.equal(document.querySelector('a[href^="https://pay.payos.vn"]'),null);
  assert.match(document.body.textContent??'',/Máy chủ chưa hỗ trợ xác minh/);
 });
});
test('verified paid and manual states remove QR and transfer details',async()=>{
 for(const status of [{...payment,status:'PAID' as const},{...payment,status:'REVIEW_REQUIRED' as const,requiresManualReview:true},{...payment,status:'REVIEW_REQUIRED' as const,requiresManualReview:true,verificationPending:true}]) await run(status,()=>{
  assert.equal(document.querySelector('[aria-label="Sao chép số tài khoản"]'),null);
  assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'),status.status==='PAID'?'PAID':'REVIEW_REQUIRED');
  assert.match(document.body.textContent??'', status.status==='PAID'?/Thanh toán thành công/:/không thanh toán lại/);
 });
});
test('mismatched provider identity hides transfer details and never claims success',async()=>{
 await run({...payment,bookingId:99},()=>{assert.equal(document.querySelector('[aria-label="Sao chép số tài khoản"]'),null);assert.doesNotMatch(document.body.textContent??'',/Thanh toán thành công/);});
});
