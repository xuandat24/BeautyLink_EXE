import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { PayOSCheckoutPage } from '../src/components/PayOSCheckoutPage';
import { beautyApi, setAccessToken } from '../src/services/beautyApi';
import type { PayOSPayment } from '../src/types/beauty';
import { sessionToken } from './sessionFixtures';
const payment: PayOSPayment = { bookingId: 42, bookingCode: 'TEST-42', orderCode: 123, paymentLinkId: 'test-link', checkoutUrl: 'https://pay.payos.vn/web/test-link', amount: 11000, remainingAmount: 209000, paymentOption: 'DEPOSIT_05', status: 'PENDING', requiresManualReview: false, expiresAt: new Date(Date.now()+600000).toISOString(), qrCode: 'TEST-QR-NOT-PAYABLE', bankBin: '970422', bankAccountNumber: 'TEST-ACCOUNT', bankAccountName: 'TEST MERCHANT', transferDescription: 'TEST ONLY' };
async function run(status: PayOSPayment, check: () => Promise<void> | void) {
 const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
 Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
 Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,configurable:true});
 setAccessToken(sessionToken());
 const original = beautyApi.payOSPaymentStatus; beautyApi.payOSPaymentStatus=async()=>status;
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
test('verified paid and manual states remove QR and transfer details',async()=>{
 for(const status of [{...payment,status:'PAID' as const},{...payment,status:'REVIEW_REQUIRED' as const,requiresManualReview:true}]) await run(status,()=>{
  assert.equal(document.querySelector('[aria-label="Sao chép số tài khoản"]'),null);
  assert.match(document.body.textContent??'', status.status==='PAID'?/Thanh toán thành công/:/không thanh toán lại/);
 });
});
test('mismatched provider identity hides transfer details and never claims success',async()=>{
 await run({...payment,bookingId:99},()=>{assert.equal(document.querySelector('[aria-label="Sao chép số tài khoản"]'),null);assert.doesNotMatch(document.body.textContent??'',/Thanh toán thành công/);});
});
