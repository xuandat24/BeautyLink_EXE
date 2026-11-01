import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { adminV2Api } from '../../services/adminApi';
import { getAccessToken, getApiErrorMessage } from '../../services/beautyApi';
import { sessionCredentialEpoch, sessionSnapshot, subscribeSession } from '../../lib/authSession';
import { csvRowsBlob, presentationSearch } from '../../lib/presentationAdminData';
import { compareNames } from '../../lib/adminDisplayProfiles';
import { adminDetailHash } from './adminRoutes';
import type { SalonRoster } from '../../types/adminV2';

export function AdminSalonRoster() {
  const auth = useSyncExternalStore(subscribeSession, () => `${sessionCredentialEpoch()}:${sessionSnapshot().phase}`);
  const [result, setResult] = useState<{ token: string; epoch: number; data: SalonRoster } | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [query, setQuery] = useState(''), [kind, setKind] = useState(''), [page, setPage] = useState(0);
  const identity = useRef({ token: null as string | null, epoch: -1 });
  const data = result?.token === getAccessToken() && result.epoch === sessionCredentialEpoch() && sessionSnapshot().phase === 'verified' ? result.data : null;
  useEffect(() => {
    let current = true; const token = getAccessToken(), epoch = sessionCredentialEpoch(); setResult(null); setError('');
    if (!token || sessionSnapshot().phase !== 'verified') return;
    adminV2Api.salonRoster().then(result => { if (current && token === getAccessToken() && epoch === sessionCredentialEpoch()) { identity.current = { token, epoch }; setResult({ token, epoch, data: result }); } }).catch(e => { if (current && token === getAccessToken() && epoch === sessionCredentialEpoch()) setError(getApiErrorMessage(e, 'Không thể tải hồ sơ salon và chuyên viên.')); });
    return () => { current = false; };
  }, [retry, auth]);
  const rows = [...(data?.rows ?? [])].filter(row => (!kind || row.kind === kind) && presentationSearch(`${row.fullName} ${row.email ?? ''} ${row.salonName}`, query)).sort((a,b) => compareNames(a.fullName,b.fullName) || (a.accountId ?? a.practitionerId ?? 0) - (b.accountId ?? b.practitionerId ?? 0) || a.key.localeCompare(b.key));
  const size = 20, visible = rows.slice(page * size, (page + 1) * size);
  const download = () => {
    if (!data || !identity.current.token || identity.current.token !== getAccessToken() || identity.current.epoch !== sessionCredentialEpoch() || sessionSnapshot().phase !== 'verified') return;
    const blob = csvRowsBlob([['STT', 'Họ tên', 'Email', 'Vai trò trong salon', 'Salon', 'Tài khoản đăng nhập'], ...rows.map((row,index) => [index+1,row.fullName,row.email ?? '',row.kind === 'OWNER' ? 'Chủ salon' : 'Chuyên viên',row.salonName,row.accountId == null ? 'Chưa có tài khoản' : 'Có tài khoản'])]);
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    try { anchor.href = url; anchor.download = 'beautylink-salon-chuyen-vien.csv'; document.body.appendChild(anchor); anchor.click(); }
    finally { anchor.remove(); URL.revokeObjectURL(url); }
  };
  return <section data-testid="admin-salon-roster" aria-label="Hồ sơ salon và chuyên viên" className="mt-4 min-w-0">
    <div className="mt-3 flex flex-wrap gap-3"><input aria-label="Tìm hồ sơ salon và chuyên viên" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="Tìm họ tên, email hoặc salon" className="min-h-11 w-full rounded-xl border px-3 text-sm sm:w-72" /><select aria-label="Vai trò trong salon" value={kind} onChange={e => { setKind(e.target.value); setPage(0); }} className="min-h-11 rounded-xl border px-3 text-sm"><option value="">Tất cả vai trò</option><option value="OWNER">Chủ salon</option><option value="PRACTITIONER">Chuyên viên</option></select><button type="button" onClick={download} disabled={!data || Boolean(error)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-pink-600 px-4 text-sm font-bold text-white hover:bg-pink-700 focus-visible:ring-2 focus-visible:ring-pink-600 focus-visible:ring-offset-2 disabled:opacity-50"><Download className="h-4 w-4" aria-hidden="true" />Tải danh sách hồ sơ (CSV)</button></div>
    {error ? <p role="alert" className="mt-4 text-sm text-rose-700">{error} <button type="button" onClick={() => setRetry(v => v+1)} className="underline">Thử lại</button></p> : !data ? <p role="status" className="flex items-center gap-2 py-8 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Đang tải hồ sơ…</p> : <>
      <div className="mt-4 overflow-hidden rounded-2xl border bg-white"><p className="border-b p-4 text-sm font-semibold">{rows.length} kết quả</p><div className="overflow-x-auto"><table className="admin-table min-w-[920px]"><thead><tr>{['STT', 'Họ tên', 'Email', 'Vai trò trong salon', 'Salon', 'Tài khoản đăng nhập', 'Thao tác'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{visible.map((row,index) => <tr key={row.key}><td className="text-center tabular-nums">{page*size+index+1}</td><td className="font-semibold">{row.fullName}</td><td>{row.email || '—'}</td><td><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${row.kind === 'OWNER' ? 'border-purple-200 bg-purple-100 text-purple-900' : 'border-teal-200 bg-teal-100 text-teal-900'}`}>{row.kind === 'OWNER' ? 'Chủ salon' : 'Chuyên viên'}</span>{row.alsoPractitioner && <span className="mt-1 block text-xs text-slate-500">Kiêm chuyên viên</span>}</td><td>{row.salonName}</td><td>{row.accountId == null ? 'Chưa có tài khoản' : 'Có tài khoản'}</td><td><button type="button" className="admin-action" onClick={() => { window.location.hash = row.kind === 'OWNER' && row.accountId != null ? adminDetailHash('account', row.accountId) : adminDetailHash('salon', row.salonId, 'practitioners'); }}>{row.kind === 'OWNER' ? 'Xem tài khoản' : 'Xem tại salon'}</button></td></tr>)}</tbody></table>{!rows.length && <p className="p-8 text-center text-sm text-slate-500">Không có hồ sơ phù hợp.</p>}</div><div className="flex items-center justify-end gap-3 border-t p-4 text-sm"><button type="button" disabled={page === 0} onClick={() => setPage(v => v-1)} className="min-h-10 rounded-lg border px-3 disabled:opacity-40">Trang trước</button><span>{page+1}/{Math.max(1,Math.ceil(rows.length/size))}</span><button type="button" disabled={(page+1)*size >= rows.length} onClick={() => setPage(v => v+1)} className="min-h-10 rounded-lg border px-3 disabled:opacity-40">Trang sau</button></div></div>
    </>}
  </section>;
}
