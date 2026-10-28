import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { freshObservation, rememberPaymentObservation } from '../src/lib/payosCheckout';
import { sessionCredentialEpoch } from '../src/lib/authSession';
import { beautyApi, getAccessToken, setAccessToken, clearAccessToken } from '../src/services/beautyApi';
import { PayOSCheckoutPage } from '../src/components/PayOSCheckoutPage';
import { PaymentContinuationDialog } from '../src/components/PaymentContinuationDialog';
import { sessionToken } from './sessionFixtures';
import { testQr } from './payosQrFixture';
import type { BackendBooking, PayOSPayment } from '../src/types/beauty';
const payment: PayOSPayment={bookingId:42,bookingCode:'PERF-42',orderCode:123,paymentLinkId:'test-42',checkoutUrl:null,amount:25000,remainingAmount:475000,paymentOption:'DEPOSIT_05',status:'PENDING',requiresManualReview:false,expiresAt:new Date(Date.now()+600000).toISOString(),qrCode:testQr(25000),checkoutAllowed:true,verificationPending:false,instructionsFreshForMs:15000};
function env(){const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});Object.assign(globalThis,{window:dom.window,document:dom.window.document,sessionStorage:dom.window.sessionStorage,localStorage:dom.window.localStorage});Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,configurable:true});setAccessToken(sessionToken());return {dom,root:createRoot(document.getElementById('root')!)};}

test('freshness is memory-only, credential-bound, and deducts whole HTTP latency from the server lease',async()=>{
 const {dom,root}=env();try{
  const token=getAccessToken(),epoch=sessionCredentialEpoch();
  rememberPaymentObservation(payment,100,token,epoch,1100);
  assert.equal(freshObservation(payment,token,15099),true);assert.equal(freshObservation(payment,token,15100),false);
  assert.equal(freshObservation({...payment},token,1200),false,'JSON/storage copies cannot restore trust');
  assert.equal(freshObservation(payment,'different-account',1200),false);
  rememberPaymentObservation(payment,100,token,epoch,15100);assert.equal(freshObservation(payment,token,15100),false,'slow response has no fast path');
  rememberPaymentObservation(payment,100,token,epoch,101);clearAccessToken();setAccessToken(token!);
  assert.equal(freshObservation(payment,token,102),false,'even reinstalling the same token cannot reuse a pre-logout observation');
 }finally{await act(async()=>root.unmount());dom.window.close();}
});

test('live verified create renders immediately with no blocking status GET; polling remains scheduled and failure locks QR',async()=>{
 const {dom,root}=env();const old=beautyApi.payOSPaymentStatus;let calls=0,callback!:()=>Promise<void>;
 window.setTimeout=((cb:()=>Promise<void>)=>{callback=cb;return 1;}) as typeof window.setTimeout;window.clearTimeout=(()=>{}) as typeof window.clearTimeout;
 rememberPaymentObservation(payment,performance.now(),getAccessToken(),sessionCredentialEpoch());
 beautyApi.payOSPaymentStatus=async()=>{calls++;throw new Error('temporary upstream error');};
 try{
  await act(async()=>root.render(React.createElement(PayOSCheckoutPage,{initialPayment:payment,onBack(){}})));
  assert.equal(calls,0);assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'),'PENDING');
  assert.ok(document.body.textContent?.includes('Quét mã để thanh toán'));
  await act(async()=>{await callback();});assert.equal(calls,1);
  assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'),'NETWORK_ERROR');
  assert.equal(document.querySelector('[aria-label="Sao chép số tiền"]'),null);
 }finally{await act(async()=>root.unmount());beautyApi.payOSPaymentStatus=old;dom.window.close();}
});

test('a timestamp or copied payload alone never bypasses initial status verification',async()=>{
 const {dom,root}=env();const old=beautyApi.payOSPaymentStatus;let finish!:(p:PayOSPayment)=>void,calls=0;
 beautyApi.payOSPaymentStatus=async()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
 try{
  await act(async()=>root.render(React.createElement(PayOSCheckoutPage,{initialPayment:{...payment},onBack(){}})));
  assert.equal(calls,1);assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'),'INITIALIZING');
  assert.equal(document.querySelector('[aria-label="Sao chép số tiền"]'),null);
  await act(async()=>{finish({...payment,status:'PAID',checkoutAllowed:false});});
  assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'),'PAID');
 }finally{await act(async()=>root.unmount());beautyApi.payOSPaymentStatus=old;dom.window.close();}
});

test('payment click opens branded preparation shell before validation/POST finishes; double click and close never duplicate payment',async()=>{
 const {dom,root}=env();const old={read:beautyApi.myBooking,quote:beautyApi.bookingPaymentQuote,create:beautyApi.createPayOSPayment};
 const booking={id:42,bookingCode:'PERF-42',serviceName:'Synthetic service',supplierName:'Synthetic salon',status:'PENDING',paymentStatus:'UNPAID',paymentEligible:true,paymentAttemptActive:false,appointmentDate:'2030-01-01',startTime:'10:00',endTime:'11:00',totalAmount:500000} as BackendBooking;
 let reads=0,posts=0,finish!:(b:BackendBooking)=>void;
 beautyApi.myBooking=async()=>++reads===1?booking:new Promise(resolve=>{finish=resolve;});
 beautyApi.bookingPaymentQuote=async()=>({originalAmount:500000,discountAmount:0,payableAmount:500000,amount:25000,remainingAmount:475000,paymentOption:'DEPOSIT_05',paymentAvailable:true,unavailableReason:null});
 beautyApi.createPayOSPayment=async()=>{posts++;return payment;};
 try{
  await act(async()=>root.render(React.createElement(PaymentContinuationDialog,{bookingId:42,onClose(){root.render(null);}})));
  const open=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Mở thanh toán QR'))!;
  await act(async()=>{open.click();open.click();});
  assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'),'PREPARING');
  assert.ok(document.querySelector('[data-checkout-brand]'));assert.ok(document.body.textContent?.includes('Synthetic service'));
  assert.equal(document.querySelector('img[src^="data:"]'),null);assert.equal(posts,0);assert.equal(reads,2);
  await act(async()=>{[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Quay lại lịch hẹn'))!.click();});
  await act(async()=>{finish(booking);});assert.equal(posts,0);assert.equal(document.querySelector('[role="dialog"]'),null);
 }finally{await act(async()=>root.unmount());Object.assign(beautyApi,{myBooking:old.read,bookingPaymentQuote:old.quote,createPayOSPayment:old.create});dom.window.close();}
});
