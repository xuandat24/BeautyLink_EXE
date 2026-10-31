import React, { useEffect, useState } from 'react';
import { apiClient, getAccessToken, getApiErrorMessage } from '../services/beautyApi';
import type { ReportingPaymentSummary } from '../types/adminV2';

const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
export function SupplierReportingPayments() {
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`), [to, setTo] = useState(today);
  const [data, setData] = useState<ReportingPaymentSummary | null>(null), [error, setError] = useState('');
  const [loading, setLoading] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; const token = getAccessToken(); setLoading(true); setData(null); setError('');
    if (!from || !to || to < from) { setError('Vui lòng chọn khoảng ngày hợp lệ.'); setLoading(false); return; }
    apiClient.get<ReportingPaymentSummary>('/v1/supplier/report-payments', { params: { from, to, page: 0, size: 1 } })
      .then(response => { if (active && token === getAccessToken()) setData(response.data); })
      .catch(e => { if (active && token === getAccessToken()) setError(getApiErrorMessage(e, 'Không thể tải báo cáo thanh toán.')); })
      .finally(() => { if (active && token === getAccessToken()) setLoading(false); });
    return () => { active = false; };
  }, [from, to, retry]);
  return <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5" aria-busy={loading}>
    <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="font-bold">Thanh toán báo cáo của salon</h2><div className="flex flex-wrap gap-3 text-xs"><label>Từ ngày<input aria-label="Thanh toán salon từ ngày" type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 block min-h-10 rounded-lg border p-2" /></label><label>Đến ngày<input aria-label="Thanh toán salon đến ngày" type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 block min-h-10 rounded-lg border p-2" /></label></div></div>
    {loading && <p role="status" className="mt-3 text-sm text-slate-500">Đang cập nhật thanh toán…</p>}{error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}<button type="button" onClick={() => setRetry(v => v + 1)} className="ml-3 underline">Thử lại</button></p>}
    {data && <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Tổng thanh toán báo cáo', money(data.total)], ['Tiền cọc', money(data.deposits)], ['Thanh toán đủ', money(data.fullPayments)], ['Thu online xác minh', money(data.verifiedAmount)]].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-2 overflow-x-auto whitespace-nowrap font-bold">{value}</dd></div>)}</dl>}
    <details className="mt-4 text-xs leading-5 text-slate-500"><summary className="cursor-pointer">Cách tính và nguồn dữ liệu</summary><p>Theo ngày ghi nhận khoản thanh toán, giờ Việt Nam; chỉ dữ liệu của salon thuộc tài khoản đang đăng nhập. Tổng báo cáo gồm PayOS xác minh và khoản cọc mô phỏng trong hồ sơ báo cáo; không phải toàn bộ giá trị dịch vụ. Tiền xác minh vẫn được tách riêng.</p>{data && <p>{data.transactions} khoản / {data.uniqueBookings} booking; khoản từ hồ sơ báo cáo: {money(data.simulatedAmount)}.</p>}</details>
  </section>;
}
