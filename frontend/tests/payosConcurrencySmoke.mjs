import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const browser=await chromium.launch({headless:true});const contexts=[await browser.newContext(),await browser.newContext()];
const pages=await Promise.all(contexts.map(c=>c.newPage()));const failures=[],observations=[],work=[];
try{
 for(const page of pages){
  page.on('pageerror',error=>failures.push(error.message));
  page.on('response',response=>{
   const path=new URL(response.url()).pathname;
   if(!/\/payments\/payos\/bookings\/\d+(?:\/current)?$/.test(path))return;
   work.push((async()=>{const data=await response.json();const headers=await response.allHeaders();
    if(response.status()===409){assert.equal(data.code,'PAYMENT_RECONCILING');return;}
    assert.equal(response.status(),200);observations.push({order:data.orderCode,booking:data.bookingId,providerCreate:Boolean(headers['server-timing']?.includes('provider_create')),method:response.request().method()});
   })());
  });
  await page.goto('http://localhost:5173/tests/payos-performance.html');await page.getByText('PERF-30',{exact:true}).click();
  await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Mở thanh toán QR'));return b&&!b.disabled;});
 }
 // Independent browser storage partitions exercise the DB lock even when Web Locks cannot coordinate.
 await Promise.all(pages.map(page=>page.getByRole('button',{name:'Mở thanh toán QR',exact:true}).click()));
 await Promise.all(pages.map(page=>page.getByRole('img',{name:/Mã QR PayOS/}).waitFor({timeout:20000})));
 await Promise.all(work);assert.deepEqual(failures,[]);assert.ok(observations.length>=2);
 assert.equal(new Set(observations.map(x=>x.order)).size,1);assert.equal(new Set(observations.map(x=>x.booking)).size,1);
 assert.equal(observations.filter(x=>x.providerCreate).length,1,'only one provider create for the two explicit clicks');
 for(const page of pages)assert.equal(new URL(page.url()).hostname,'localhost');
 const report={contexts:2,concurrentClicks:2,uniqueAttempts:1,providerCreates:1,automaticReplacementPosts:0,result:'PASS',provider:'test-only gateway; no real bank transfer'};
 writeFileSync('backend/target/payos-concurrency-smoke.json',JSON.stringify(report,null,2));console.log('PASS QR concurrency: '+JSON.stringify(report));
}finally{await browser.close();}
