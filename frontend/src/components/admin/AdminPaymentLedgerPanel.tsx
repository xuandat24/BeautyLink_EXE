import React, { useState } from 'react';
import { adminV2Api, adminRangeError, type AdminRange } from '../../services/adminApi';
import { beautyApi, getAccessToken } from '../../services/beautyApi';
import { adminMoney } from './AdminOverview';
import { BookingDetail } from './AdminDashboardPage';
import { AdminStatusBadge } from './AdminStatusBadge';
import { AdminRegion, AdminPagination, useAdminResource } from './AdminDataRegion';
import type { AdminBooking } from '../../types';
import { ReportingPaymentPanel } from './ReportingPaymentPanel';

export function AdminPaymentLedgerPanel({ salonId, range, active = true }: { salonId?: number; range: AdminRange; active?: boolean }) {
  const [mode, setMode] = useState<'report' | 'verified'>('report');
  return <div className="min-w-0"><div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Nguồn sổ thanh toán">{(['report', 'verified'] as const).map(value => <button type="button" key={value} aria-pressed={mode === value} onClick={() => setMode(value)} className={`min-h-11 rounded-xl px-4 text-sm font-bold ${mode === value ? 'bg-pink-600 text-white' : 'border border-slate-200 bg-white'}`}>{value === 'report' ? 'Thanh toán báo cáo' : 'Đối soát PayOS'}</button>)}</div>{mode === 'report' ? <ReportingPaymentPanel range={range} salonId={salonId} active={active} /> : <VerifiedPaymentLedgerPanel range={range} salonId={salonId} active={active} />}</div>;
}

function VerifiedPaymentLedgerPanel({ salonId, range, active = true }: { salonId?: number; range: AdminRange; active?: boolean }) {
  const scope = `${salonId ?? 'all'}:${range.from}:${range.to}`;
  const [paging, setPaging] = useState({ scope, page: 0 }); const page = paging.scope === scope ? paging.page : 0;
  const [booking, setBooking] = useState<AdminBooking | null>(null); const [detailError, setDetailError] = useState(''); const [opening, setOpening] = useState(false);
  const resource = useAdminResource(`ledger:${scope}:${page}`, async () => { const invalid = adminRangeError(range); if (invalid) throw new Error(invalid); return adminV2Api.paymentLedger({ from: range.from, to: range.to, page, salonId }); }, active);
  const open = async (id: number) => {
    if (opening) return; const token = getAccessToken(); setOpening(true); setDetailError('');
    try { const data = await beautyApi.adminBooking(id); if (token === getAccessToken() && (salonId == null || data.supplierId === salonId)) setBooking(data); }
    catch { if (token === getAccessToken()) setDetailError('Không thể tải lịch liên quan. Vui lòng thử lại.'); }
    finally { if (token === getAccessToken()) setOpening(false); }
  };
  const data = resource.data;
  return <AdminRegion {...resource} retry={resource.reload}>
    <h2 className="mt-4 font-bold">Lượt thanh toán & đối soát</h2>
    <p className="mt-2 text-xs leading-5 text-slate-600">Tiền xác minh theo ngày nhận tiền; lượt thử theo ngày tạo. Số tiền yêu cầu của attempt không tự chứng minh đã nhận tiền. Gross chưa trừ hoàn tiền ngoài ứng dụng; khoản còn tại salon là số ghi nhận lúc thanh toán, không phải tiền BeautyLink đã thu.</p>
    {data && <><dl className="my-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ['Thu online xác minh', adminMoney(data.verifiedOnlineAmount)], ['Tiền cọc 5% / 50%', adminMoney(data.deposits)], ['Thanh toán đủ 100%', adminMoney(data.fullPayments)],
      ['Lượt thử tạo trong kỳ', data.attempts.toLocaleString('vi-VN')], ['Lượt cần đối soát', data.reviewRequiredAttempts.toLocaleString('vi-VN')], ['Lượt thất bại / hết hạn', data.failedAttempts.toLocaleString('vi-VN')],
    ].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-2 overflow-x-auto whitespace-nowrap font-bold tabular-nums">{value}</dd></div>)}</dl>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="admin-table min-w-[1180px]"><thead><tr>{['Mã lượt / orderCode', 'Mã lịch', 'Salon', 'Hình thức', 'Trạng thái attempt', 'Số tiền yêu cầu', 'Ngày nhận tiền', 'Đối soát / xác minh', 'Thao tác'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{data.rows.content.map(row => <tr key={row.id}>
      <td><strong>#{row.id}</strong><span className="block text-xs text-slate-500">{row.orderCode}</span></td><td>{row.bookingCode}</td><td><span className="cell-label" title={row.supplierName}>{row.supplierName}</span></td><td>{row.paymentOption === 'FULL_100' ? 'Thanh toán đủ' : row.paymentOption === 'DEPOSIT_05' ? 'Cọc 5%' : 'Cọc 50% lịch sử'}</td><td><AdminStatusBadge kind="transaction" value={row.status} /></td><td className="numeric">{adminMoney(row.amount)}</td><td className="whitespace-nowrap">{row.paidAt ? new Date(row.paidAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—'}</td><td>{row.requiresManualReview || row.status === 'REVIEW_REQUIRED' ? <AdminStatusBadge kind="paymentReview" value="REVIEW_REQUIRED" /> : <span className="text-xs text-slate-600">{row.canonicalVerified ? 'Tính vào thu online' : 'Chưa tính vào thu online'}</span>}{row.bookingPaymentStatus === 'REFUNDED' && <div><AdminStatusBadge kind="payment" value="REFUNDED" /></div>}</td><td><button className="admin-action" type="button" disabled={opening} onClick={() => void open(row.bookingId)}>Xem lịch</button></td>
    </tr>)}</tbody></table></div>{data.rows.content.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Chưa có lượt thanh toán trong kỳ.</p>}<AdminPagination data={data.rows} page={page} onPage={page => setPaging({ scope, page })} disabled={resource.loading} /></div></>}
    {detailError && <p role="alert" className="mt-3 text-sm text-rose-700">{detailError}</p>}{booking && <BookingDetail booking={booking} onClose={() => setBooking(null)} />}
  </AdminRegion>;
}
