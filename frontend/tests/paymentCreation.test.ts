import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWithRecovery, PAYMENT_HTTP_TIMEOUT } from '../src/lib/paymentCreation';
import { apiClient, beautyApi, getPaymentErrorMessage } from '../src/services/beautyApi';
import type { PayOSPayment } from '../src/types/beauty';
const payment = { bookingId:42, orderCode:123, status:'PENDING', paymentLinkId:'test-link', requiresManualReview:false } as PayOSPayment;
const timeout = { code:'ECONNABORTED' };
const wait = async () => {};

test('normal create needs only one POST; scoped HTTP deadline exceeds old 10 second cutoff', async()=>{
 const adapter=apiClient.defaults.adapter; const calls:Array<{method?:string;timeout?:number;url?:string}>=[];
 apiClient.defaults.adapter=async config=>{calls.push(config);return {config,status:200,statusText:'OK',headers:{},data:payment};};
 try {
  assert.equal(await beautyApi.createPayOSPayment(42,{paymentOption:'FULL_100'}),payment);
  assert.equal(calls.length,1);assert.equal(calls[0].method,'post');assert.equal(calls[0].timeout,PAYMENT_HTTP_TIMEOUT);
  assert.equal(apiClient.defaults.timeout,10000,'unrelated endpoints retain their deadline');
 } finally {apiClient.defaults.adapter=adapter;}
});

test('lost create response opens the existing pending observer without waiting for another POST',async()=>{
 let posts=0,reads=0;const delays:number[]=[];
 const result=await createWithRecovery(42,async()=>{posts++;throw timeout;},async()=>{
  reads++;return reads===1?{...payment,paymentLinkId:null,verificationPending:true}:payment;
 },()=>true,async ms=>{delays.push(ms);});
 assert.equal(result.paymentLinkId,null);assert.equal(result.verificationPending,true);assert.equal(posts,1);assert.equal(reads,1);assert.deepEqual(delays,[]);
});

test('network, 429, 5xx and reconciling recover the existing attempt, never repeat POST',async()=>{
 for(const error of [timeout,{code:'ERR_NETWORK'},{response:{status:429}},{response:{status:503}},{response:{status:409,data:{code:'PAYMENT_RECONCILING'}}}]) {
  let posts=0,reads=0;
  assert.equal(await createWithRecovery(42,async()=>{posts++;throw error;},async()=>{reads++;return payment;},()=>true,wait),payment);
  assert.equal(posts,1);assert.equal(reads,1);
 }
});

test('401/403/contact/option conflicts never retry or start recovery',async()=>{
 for(const status of [400,401,403,409]) {
  const error={response:{status}};let reads=0;
  await assert.rejects(createWithRecovery(42,async()=>{throw error;},async()=>{reads++;return payment;},()=>true,wait), e=>e===error);
  assert.equal(reads,0);
 }
});

test('recovery is bounded, reports uncertainty and never creates a replacement',async()=>{
 let reads=0,posts=0;
 await assert.rejects(createWithRecovery(42,async()=>{posts++;throw timeout;},async()=>{reads++;throw {response:{status:404}};},()=>true,wait),/Lịch hẹn được giữ nguyên/);
 assert.equal(posts,1);assert.equal(reads,3);
});

test('account changes and mismatched booking responses cannot recover private instructions',async()=>{
 let active=true,reads=0;
 await assert.rejects(createWithRecovery(42,async()=>{active=false;throw timeout;},async()=>{reads++;return payment;},()=>active,wait),/đăng nhập/);
 assert.equal(reads,0);
 await assert.rejects(createWithRecovery(42,async()=>{throw timeout;},async()=>({...payment,bookingId:99}),()=>true,wait),/không khớp/);
 active=true;
 await assert.rejects(createWithRecovery(42,async()=>{throw timeout;},async()=>{active=false;return payment;},()=>active,wait),/đăng nhập/);
});

test('recovery preserves paid/manual/terminal outcomes for the locked QR state machine',async()=>{
 for(const status of ['PAID','REVIEW_REQUIRED','CANCELLED','EXPIRED'] as const) {
  const value={...payment,status,requiresManualReview:status==='REVIEW_REQUIRED'};
  assert.equal(await createWithRecovery(42,async()=>{throw timeout;},async()=>value,()=>true,wait),value);
 }
});

test('HTTP client lost-response recovery uses the new owned GET contract without repeating create',async()=>{
 const adapter=apiClient.defaults.adapter;const calls:string[]=[];
 apiClient.defaults.adapter=async config=>{
  calls.push(`${config.method} ${config.url}`);
  if(config.method==='post')throw timeout;
  return {config,status:200,statusText:'OK',headers:{},data:payment};
 };
 try {
  assert.equal(await beautyApi.createPayOSPayment(42,{paymentOption:'FULL_100'}),payment);
  assert.deepEqual(calls,['post /v1/payments/payos/bookings/42','get /v1/payments/payos/bookings/42/current']);
 } finally {apiClient.defaults.adapter=adapter;}
});

test('checkout timeout feedback does not leak a raw Axios exception or invite duplicate payment',()=>{
 const message=getPaymentErrorMessage({isAxiosError:true,code:'ECONNABORTED',message:'timeout of 10000ms exceeded'},'fallback');
 assert.match(message,/không tạo đơn mới/);assert.doesNotMatch(message,/10000ms/);
});
