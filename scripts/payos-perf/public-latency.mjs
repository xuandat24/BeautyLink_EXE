// Read-only network probe: no auth, no booking/payment endpoints, no response bodies saved.
import https from 'node:https';
import {writeFileSync} from 'node:fs';
const agent=new https.Agent({keepAlive:true,maxSockets:1});const rows=[];
for(let i=0;i<30;i++){
 const value=await new Promise((resolve,reject)=>{
  const start=performance.now();const r={};
  const request=https.get('https://api.beautylink.cloud/api/v1/categories',{agent},response=>{
   r.ttfb=performance.now()-start;response.resume();response.on('end',()=>{r.total=performance.now()-start;if(response.statusCode!==200)reject(new Error(`HTTP ${response.statusCode}`));else resolve(r);});
  });request.on('socket',socket=>{if(!socket.connecting){r.connect=0;r.tls=0;return;}socket.once('connect',()=>{r.connect=performance.now()-start;});socket.once('secureConnect',()=>{r.tls=performance.now()-start-(r.connect||0);});});
  request.setTimeout(10000,()=>request.destroy(new Error('probe timeout')));request.on('error',reject);
 });rows.push(value);await new Promise(r=>setTimeout(r,150));
}
agent.destroy();const pct=(values,p)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];
const summary=Object.fromEntries(['connect','tls','ttfb','total'].map(key=>{const values=rows.map(r=>r[key]);return [key,{n:values.length,p50:pct(values,.5),p95:pct(values,.95),p99:pct(values,.99)}];}));
const report={scope:'read-only public categories, from this workstation; not authenticated checkout or PayOS timing',region:'SFO (read-only Railway metadata)',samples:30,summary,raw:rows};
writeFileSync('backend/target/payos-public-latency.json',JSON.stringify(report,null,2));console.log(JSON.stringify({scope:report.scope,summary}));
