import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const label=process.env.PERF_LABEL||'after', n=Number(process.env.PERF_SAMPLES||30);
assert.ok(n>=20 && n<=35);
const samples={},errors=[];const add=(key,value)=>{if(Number.isFinite(value)) (samples[key]??=[]).push(value);};
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1366,height:900}});
page.on('pageerror',error=>errors.push(error.message));
let phase='warmup', requests=[];
page.on('response',async response=>{
 const path=new URL(response.url()).pathname;
 if(!path.includes('/api/v1/payments/payos/'))return;
 const observedPhase=phase;
 await response.finished(); const timing=response.request().timing();
 requests.push({phase:observedPhase,path,method:response.request().method(),rtt:timing.responseEnd,headers:await response.allHeaders()});
});
try {
 await page.goto('http://localhost:5173/tests/payos-performance.html');await page.getByText('PERF-0',{exact:true}).waitFor();
 for(let i=0;i<n;i++){
  for(const mode of ['fresh','reuse']){
   phase=mode;
   await page.getByText(`PERF-${i}`,{exact:true}).click();
   const open=page.getByRole('button',{name:'Mở thanh toán QR',exact:true});await open.waitFor();await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Mở thanh toán QR'));return b&&!b.disabled;});
   await page.evaluate(()=>{performance.clearMeasures('beautylink-qr-render');window.__perfClick=0;document.addEventListener('click',()=>{window.__perfClick=performance.now();},{once:true,capture:true});});
   await open.click();
   await page.locator('[data-checkout-state]').waitFor();
   add(`${mode}_shell_ms`,await page.evaluate(()=>performance.now()-window.__perfClick));
   if(label==='after'&&i===0&&mode==='fresh')await page.screenshot({path:'backend/target/payos-preparation-desktop.png'});
   await page.getByRole('img',{name:/Mã QR PayOS/}).waitFor();
   add(`${mode}_qr_ms`,await page.evaluate(()=>performance.now()-window.__perfClick));
   const qrMs=await page.evaluate(()=>performance.getEntriesByName('beautylink-qr-render').at(-1)?.duration);add('qr_encoding_ms',qrMs);
   const id=await page.getByText(`PERF-${i}`,{exact:true}).getAttribute('data-perf-booking');
   if(mode==='fresh'){
    phase='recovery';
    const recovery=await page.evaluate(async id=>{const start=performance.now();const token=sessionStorage.getItem('beautylink_access_token');const r=await fetch(`/api/v1/payments/payos/bookings/${id}/current`,{headers:{Authorization:`Bearer ${token}`}});if(r.status!==200)throw new Error(`Recovery ${r.status}`);await r.json();return performance.now()-start;},id);
    add('recovery_ms',recovery);
   }
   await page.getByRole('button',{name:'Quay lại lịch hẹn',exact:true}).click();
   await page.getByRole('dialog').waitFor({state:'hidden'});
  }
 }
 // drain response listeners without timing a new business operation
 await page.waitForTimeout(100);
 for(const request of requests){
  if(request.method==='POST'){
   add(`${request.phase}_post_rtt_ms`,request.rtt);
   const entries=(request.headers['server-timing']||'').split(',');
   for(const entry of entries){const match=entry.trim().match(/^([a-z_]+);dur=([\d.]+)/);if(match)add(`${request.phase}_${match[1]}_ms`,Number(match[2]));}
   const count=Number(request.headers['x-checkout-sql-count']);if(Number.isFinite(count))add(`${request.phase}_sql_statements`,count);
  }
 }
 assert.deepEqual(errors,[]);
 const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];
 const summary=Object.fromEntries(Object.entries(samples).map(([key,values])=>[key,{n:values.length,p50:percentile(values,.50),p95:percentile(values,.95),p99:percentile(values,.99)}]));
 const out={label,provider:'TEST-ONLY deterministic fake create350ms/get250ms',database:'isolated H2 MySQL mode',samples:n,summary,requests:{post:requests.filter(r=>r.method==='POST').length,status:requests.filter(r=>/\/\d+$/.test(r.path)&&r.method==='GET').length},raw:samples};
 writeFileSync(`backend/target/payos-performance-${label}.json`,JSON.stringify(out,null,2));console.log(JSON.stringify({label,summary,requests:out.requests}));
 if(label==='after')assert.ok(summary.fresh_shell_ms.p95<300,'controlled shell P95 target');
}finally{await browser.close();}
