import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { beautyApi } from '../src/services/beautyApi';
import { PaymentContinuationDialog } from '../src/components/PaymentContinuationDialog';
import '../src/index.css';
if (!['localhost','127.0.0.1'].includes(location.hostname)) throw new Error('Local performance server only');
await beautyApi.login('0900000001','BeautyLinkTest123!');
const fixtures=(await beautyApi.myBookings()).filter(b=>b.bookingCode.startsWith('PERF-')).sort((a,b)=>a.bookingCode.localeCompare(b.bookingCode,undefined,{numeric:true}));
if(fixtures.length!==35)throw new Error('Use isolated SMOKE_PERF_MODE fixture');
function Harness(){const [id,setId]=useState<number|null>(null);return <>{fixtures.map(b=><button key={b.id} data-perf-booking={b.id} onClick={()=>setId(b.id)}>{b.bookingCode}</button>)}{id!==null&&<PaymentContinuationDialog bookingId={id} onClose={()=>setId(null)}/>}</>;}
createRoot(document.getElementById('root')!).render(<Harness/>);
