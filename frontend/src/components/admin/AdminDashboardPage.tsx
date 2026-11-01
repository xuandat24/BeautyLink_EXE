import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Download, Loader2, RefreshCw, Search, X,
} from 'lucide-react';
import type { AdminBooking, AdminPaymentSummary, AdminRevenueRow } from '../../types';
import { beautyApi, getAccessToken, getApiErrorMessage } from '../../services/beautyApi';
import { AdminNav, type AdminSection } from './AdminNav';
import { AdminOverview } from './AdminOverview';
import { adminRangeError } from '../../services/adminApi';
import { AdminStatusBadge } from './AdminStatusBadge';
import { AdminPaymentLedgerPanel } from './AdminPaymentLedgerPanel';
import { adminStatusGroups } from './adminStatus';
import { BOOKING_TABLE_COLUMNS, bookingAppointment, bookingOnlineAmount } from '../../lib/adminBookingCsv';

type DashboardMode = 'overview' | 'bookings' | 'payments';

interface AdminDashboardPageProps {
  mode: DashboardMode;
  adminName: string;
  onNavigate: (section: AdminSection, query?: string) => void;
  onHome: () => void;
  onLogout: () => void;
  onOpenBookedCustomers: (from: string, to: string) => void;
  onOpenSalon?: (id: number, includeDemo: boolean) => void;
  initialSearch?: string;
}

export const daysAgo = (days: number) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const date = new Date(Date.UTC(value('year'), value('month') - 1, value('day') - days));
  return date.toISOString().slice(0, 10);
};
const money = (value: number | null | undefined) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value ?? 0);
const dateTime = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

const bookingLabels = Object.fromEntries(Object.entries(adminStatusGroups.booking).map(([value, p]) => [value, p.label]));
const paymentLabels = Object.fromEntries(Object.entries(adminStatusGroups.payment).map(([value, p]) => [value, p.label]));

export const BookingDetail = ({ booking, onClose }: { booking: AdminBooking; onClose: () => void }) => (
  <div className="fixed inset-0 z-[120] flex justify-end bg-slate-950/50" role="dialog" aria-modal="true" aria-label="Chi tiết lịch hẹn">
    <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Đóng chi tiết" />
    <aside className="relative h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-wider text-pink-600">{booking.bookingCode}</p><h2 className="mt-2 text-2xl font-black">Chi tiết lịch hẹn</h2></div>
        <button type="button" onClick={onClose} aria-label="Đóng" className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100"><X className="h-5 w-5" /></button>
      </div>
      <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
        {[
          ['Khách hàng', `${booking.customerName} · ${booking.customerPhone}`],
          ['Nhà cung cấp', booking.supplierName], ['Dịch vụ', booking.serviceName], ['Chuyên viên', booking.practitionerName],
          ['Ngày hẹn', `${booking.appointmentDate} · ${booking.startTime.slice(0, 5)}–${booking.endTime.slice(0, 5)}`],
          ['Ngày tạo', dateTime(booking.createdAt)], ['Giá trị lịch', money(booking.totalAmount)],
          ['Đã thu online xác minh', booking.verifiedOnlineAmount == null ? 'Chưa có' : money(booking.verifiedOnlineAmount)],
          ['Còn lại tại salon', booking.remainingAtSalon == null ? '—' : money(booking.remainingAtSalon)],
          ['Hình thức đã xác minh', booking.verifiedPaymentOption || '—'],
        ].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-bold text-slate-400">{label}</dt><dd className="mt-1 font-black text-slate-800">{value}</dd></div>)}
      </dl>
      {booking.batchId && booking.simulatedPaidAt && <section className="mt-4 rounded-2xl border border-slate-200 p-4 text-sm"><h3 className="font-bold">Thanh toán báo cáo</h3><p className="mt-2">Cọc ghi nhận: {money(booking.simulatedOnlineAmount)} · {dateTime(booking.simulatedPaidAt)}</p><p className="mt-2 text-xs leading-5 text-slate-600">Khoản cọc mô phỏng liên kết hồ sơ báo cáo này, không phải biên nhận PayOS đã xác minh.</p></section>}
      <div className="mt-5 flex flex-wrap gap-2">
        <AdminStatusBadge kind="booking" value={booking.status} />
        <AdminStatusBadge kind="payment" value={booking.paymentStatus} />
        {booking.paymentReviewRequired && <AdminStatusBadge kind="paymentReview" value="REVIEW_REQUIRED" />}
      </div>
      <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">Trang quản trị chỉ đọc. Trạng thái thanh toán và lịch hẹn chỉ thay đổi qua chính sách nghiệp vụ hiện có.</p>
    </aside>
  </div>
);

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ mode, adminName, onNavigate, onHome, onLogout, onOpenBookedCustomers, onOpenSalon, initialSearch = '' }) => {
  const [from, setFrom] = useState(() => `${daysAgo(0).slice(0, 7)}-01`);
  const [to, setTo] = useState(daysAgo(0));
  const [payments, setPayments] = useState<AdminPaymentSummary | null>(null);
  const [revenuePage, setRevenuePage] = useState<{ content: AdminRevenueRow[]; totalElements: number; totalPages: number } | null>(null);
  const [revenuePageIndex, setRevenuePageIndex] = useState(0);
  const [exportingRevenue, setExportingRevenue] = useState(false);
  const [exportingBookings, setExportingBookings] = useState(false);
  const [bookingExportError, setBookingExportError] = useState('');
  const [bookingPage, setBookingPage] = useState<{ content: AdminBooking[]; totalElements: number; totalPages: number; page: number } | null>(null);
  const [query, setQuery] = useState(initialSearch);
  const [overviewRefresh, setOverviewRefresh] = useState(0);
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AdminBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0); const summaryCache = useRef<{ key: string; value: AdminPaymentSummary } | null>(null);
  const deferredQuery = useDeferredValue(query);

  const requestParams = useMemo(() => ({ from, to, includeDemo: false }), [from, to]);
  const exportMounted = useRef(true), exportRun = useRef(0), exportBusy = useRef(false);
  const exportScope = useRef({ key: '', version: 0 });
  const exportKey = JSON.stringify([mode, from, to, query, status, paymentStatus]);
  if (exportScope.current.key !== exportKey) exportScope.current = { key: exportKey, version: exportScope.current.version + 1 };
  useEffect(() => { exportMounted.current = true; return () => { exportMounted.current = false; exportRun.current++; }; }, []);
  useEffect(() => { setBookingExportError(''); }, [exportKey]);
  const downloadBookings = async () => {
    if (exportBusy.current || loading || error || !bookingPage || query !== deferredQuery) return;
    const run = ++exportRun.current, scope = exportScope.current.version, token = getAccessToken();
    const current = () => exportMounted.current && run === exportRun.current && scope === exportScope.current.version && token === getAccessToken();
    exportBusy.current = true; setExportingBookings(true); setBookingExportError('');
    try {
      const blob = await beautyApi.exportAdminBookingsCsv({ from, to, query: query.trim() || undefined, status: status || undefined, paymentStatus: paymentStatus || undefined }, current);
      if (!current()) return;
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      try { anchor.href = url; anchor.download = `beautylink-lich-dat-${from}-den-${to}.csv`; document.body.appendChild(anchor); anchor.click(); }
      finally { anchor.remove(); URL.revokeObjectURL(url); }
    } catch (err) { if (current()) setBookingExportError(getApiErrorMessage(err, 'Không thể tải đầy đủ lịch đặt.')); }
    finally { exportBusy.current = false; if (exportMounted.current && run === exportRun.current) setExportingBookings(false); }
  };

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current; const token = getAccessToken();
    setLoading(true); setError('');
    try {

      const invalid = adminRangeError(requestParams); if (invalid) throw new Error(invalid);
      if (mode === 'payments') {
        const [data, rows] = await Promise.all([
          summaryCache.current?.key === JSON.stringify(requestParams) ? Promise.resolve(summaryCache.current.value) : beautyApi.adminPaymentSummary(requestParams),
          beautyApi.adminRevenue({ ...requestParams, page: revenuePageIndex, size: 20 }),
        ]);
        if (requestId === requestSequence.current && token === getAccessToken()) { summaryCache.current = { key: JSON.stringify(requestParams), value: data }; setPayments(data); setRevenuePage(rows); }
      }
      if (mode === 'bookings') { const data = await beautyApi.adminBookings({ ...requestParams, query: deferredQuery.trim() || undefined, status: status || undefined, paymentStatus: paymentStatus || undefined, page, size: 20 }); if (requestId === requestSequence.current && token === getAccessToken()) setBookingPage(data); }
    } catch (err) {
      if (requestId === requestSequence.current && token === getAccessToken()) setError(getApiErrorMessage(err, 'Không thể tải dữ liệu quản trị.'));
    } finally { if (requestId === requestSequence.current && token === getAccessToken()) setLoading(false); }
  }, [mode, requestParams, deferredQuery, status, paymentStatus, page, revenuePageIndex]);

  useEffect(() => { void load(); return () => { requestSequence.current++; }; }, [load]);
  useEffect(() => { setQuery(initialSearch); }, [initialSearch]);
  useEffect(() => { setPage(0); }, [from, to, query, status, paymentStatus]);
  useEffect(() => { setRevenuePageIndex(0); }, [from, to]);

  const downloadRevenue = async () => {
    const token = getAccessToken();
    setExportingRevenue(true);
    setError('');
    try {
      const blob = await beautyApi.exportAdminRevenueCsv(requestParams);
      if (token !== getAccessToken()) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `beautylink-revenue-${from}-to-${to}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể tải CSV doanh thu.'));
    } finally {
      setExportingRevenue(false);
    }
  };

  const preset = (days: number) => { setFrom(daysAgo(days - 1)); setTo(daysAgo(0)); };
  const active: AdminSection = mode;

  const filters = (
      <section aria-label="Bộ lọc báo cáo" className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
        <div role="group" aria-label="Khoảng ngày nhanh" className="flex flex-wrap gap-2">{[[1, 'Hôm nay'], [7, '7 ngày'], [30, '30 ngày']].map(([days, label]) => {
          const selected = from === daysAgo(Number(days) - 1) && to === daysAgo(0);
          return <button key={days} type="button" aria-pressed={selected} onClick={() => preset(Number(days))} className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-600 focus-visible:ring-offset-2 ${selected ? 'bg-pink-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-pink-50 hover:text-pink-800'}`}>{label}</button>;
        })}</div>
        <label className="text-xs font-bold text-slate-500">Từ ngày<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-bold text-slate-500">Đến ngày<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>

      </section>
  );
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <AdminNav active={active} adminName={adminName} onNavigate={onNavigate} onHome={onHome} onLogout={onLogout} controls={filters} />
    <main className="min-w-0 px-4 py-5 lg:ml-60 lg:px-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div><h1 className="text-2xl font-extrabold">{mode === 'overview' ? 'Tổng quan kinh doanh' : mode === 'bookings' ? 'Lịch hẹn toàn hệ thống' : 'Thanh toán'}</h1></div>
        <button type="button" onClick={() => mode === 'overview' ? setOverviewRefresh(v => v + 1) : (summaryCache.current = null, void load())} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black hover:border-pink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-600 focus-visible:ring-offset-2"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới</button>
      </div>



      {error && <div role="alert" className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700"><span>{error}</span><button onClick={() => void load()} className="underline">Thử lại</button></div>}
      {loading && !error && mode !== 'overview' && !bookingPage && !payments ? <div className="grid min-h-80 place-items-center"><div className="text-center text-sm font-bold text-slate-500"><Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-pink-600" />Đang tổng hợp dữ liệu...</div></div> : null}

      {!error && mode === 'overview' && <AdminOverview params={requestParams} refreshKey={overviewRefresh} onNavigate={(section, bookingStatus, customerTab) => { if (section === 'bookings') { setStatus(bookingStatus ?? ''); setPaymentStatus(''); setQuery(''); setPage(0); } onNavigate(section, customerTab); }} renderBookings={rows => <BookingTable title="Đơn đặt lịch gần đây" bookings={rows} onSelect={setSelected} onViewAll={() => { setStatus(''); setPaymentStatus(''); setPage(0); setQuery(''); onNavigate('bookings'); }} />} onSalon={id => onOpenSalon?.(id, false)} onBookedCustomers={() => onOpenBookedCustomers(from, to)} />}
      {mode === 'bookings' && <>
        <section className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
          <label className="relative md:col-span-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mã lịch, khách, salon, dịch vụ" className="min-h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm" /></label>
          <select aria-label="Trạng thái lịch" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 text-sm font-bold"><option value="">Mọi trạng thái lịch</option>{Object.entries(bookingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select aria-label="Trạng thái thanh toán" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 text-sm font-bold"><option value="">Mọi trạng thái thanh toán</option>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </section>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
          <button type="button" onClick={() => void downloadBookings()} disabled={exportingBookings || loading || Boolean(error) || !bookingPage || query !== deferredQuery} title="CSV mở bằng Excel · toàn bộ kết quả đang lọc" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-2 text-sm font-bold text-white hover:bg-pink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600 disabled:opacity-50">{exportingBookings ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}{exportingBookings ? 'Đang tải lịch đặt…' : 'Tải danh sách lịch đặt (CSV)'}</button>
        </div>
        {bookingExportError && <p role="alert" className="mt-3 text-sm text-rose-700">{bookingExportError}</p>}
        {loading && <p role="status" className="mt-3 text-xs text-slate-500">Đang cập nhật danh sách lịch…</p>}{bookingPage && <><BookingTable title={`${bookingPage.totalElements.toLocaleString('vi-VN')} lịch phù hợp`} bookings={bookingPage.content} onSelect={setSelected} />
        <div className="mt-4 flex justify-end gap-2"><button disabled={page === 0} onClick={() => setPage((v) => Math.max(0, v - 1))} className="rounded-xl border bg-white px-4 py-2 text-xs font-black disabled:opacity-40">Trang trước</button><span className="px-3 py-2 text-xs font-bold">{page + 1}/{Math.max(bookingPage.totalPages, 1)}</span><button disabled={page + 1 >= bookingPage.totalPages} onClick={() => setPage((v) => v + 1)} className="rounded-xl border bg-white px-4 py-2 text-xs font-black disabled:opacity-40">Trang sau</button></div></>}
      </>}

      {mode === 'payments' && <><AdminPaymentLedgerPanel range={requestParams} />{loading && <p role="status" className="mt-3 text-xs text-slate-500">Đang cập nhật báo cáo thanh toán…</p>}{payments && <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-bold">Biên nhận PayOS xác minh và CSV riêng</summary><p className="mt-3 text-xs leading-5 text-slate-600">Phần này chỉ chứa tiền được PayOS xác minh, không bao gồm khoản mô phỏng. Tổng hợp cả hai nguồn nằm ở bảng Thanh toán báo cáo phía trên. Booking hoàn thành không tự tạo giao dịch PayOS.</p>
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Đã thu online xác minh', money(payments.verifiedOnlineCollected), `${payments.verifiedPaymentBookings} lịch`],
            ['Tiền cọc xác minh', money(payments.verifiedDeposits), `${payments.depositBookings} lịch · gồm 5% và 50% lịch sử`],
            ['Thanh toán 100%', money(payments.verifiedFullPayments), `${payments.fullPaymentBookings} lịch`],
            ['Còn lại tại salon', money(payments.remainingAtSalon), 'Không phải doanh thu BeautyLink'],
          ].map(([label, value, note]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-pink-700">{value}</p><p className="mt-3 text-[11px] font-semibold text-slate-400">{note}</p></article>)}
        </section>
        <section className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><div className="flex gap-3"><AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" /><div><h2 className="font-black text-amber-950">{payments.reconciliationIssues} giao dịch cần đối soát</h2><p className="mt-2 text-sm leading-6 text-amber-900">Khoản đang chờ hoặc cần xem xét không được cộng vào tiền đã thu. Dùng quy trình Payment Review hiện có để xử lý.</p></div></div></div><div className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-black">Quy ước kế toán</h2><p className="mt-2 text-sm leading-6 text-slate-600">Số tiền dùng giao dịch PAID xác minh đầu tiên của mỗi booking theo <strong>paidAt</strong> trong kỳ. Webhook lặp và lần thử lại không được cộng trùng. Không hiển thị “lợi nhuận” vì hệ thống chưa mô hình hóa hoa hồng và quyết toán.</p><p className="mt-3 text-[11px] text-slate-400">Cập nhật {dateTime(payments.generatedAt)}</p></div></section>
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div><h2 className="font-black">Biên nhận thu online PayOS đã xác minh</h2><p className="mt-1 text-xs text-slate-500">{(revenuePage?.totalElements || 0).toLocaleString('vi-VN')} giao dịch · theo ngày thanh toán · chưa trừ hoàn tiền · không bao gồm tiền trả tại salon hoặc khoản từ hồ sơ báo cáo</p></div>
            <button type="button" onClick={() => void downloadRevenue()} disabled={exportingRevenue} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-pink-600 px-4 text-sm font-black text-white hover:bg-pink-700 disabled:opacity-50"><Download className="h-4 w-4" />{exportingRevenue ? 'Đang xuất CSV...' : 'Tải CSV'}</button>
          </div>
          {revenuePage?.content.length ? <div className="overflow-x-auto"><table className="admin-table min-w-[1100px]"><thead className="bg-slate-50 text-xs font-black text-slate-600"><tr><th scope="col">Mã thanh toán</th><th scope="col" className="px-4 py-3">Ngày thanh toán</th><th scope="col" className="px-4 py-3">Mã lịch</th><th scope="col">Salon</th><th scope="col">Dịch vụ</th><th scope="col">Trạng thái</th><th scope="col" className="px-4 py-3">Hình thức</th><th scope="col" className="px-4 py-3 text-right">Đã thu online</th><th scope="col" className="px-4 py-3 text-right">Còn lại tại salon</th></tr></thead><tbody className="divide-y divide-slate-100">{revenuePage.content.map((row) => <tr key={row.paymentId}><td>#{row.paymentId}</td><td className="whitespace-nowrap px-4 py-3">{dateTime(row.paidAt)}</td><td className="px-4 py-3 font-bold">{row.bookingCode}</td><td className="px-4 py-3"><strong className="cell-label" title={row.supplierName}>{row.supplierName}</strong></td><td><span className="cell-label" title={row.serviceName}>{row.serviceName}</span></td><td><AdminStatusBadge kind="payment" value="PAID" /></td><td className="px-4 py-3">{row.paymentOption === 'FULL_100' ? 'Thanh toán 100%' : row.paymentOption === 'DEPOSIT_05' ? 'Đặt cọc 5%' : 'Đặt cọc 50%'}</td><td className="px-4 py-3 text-right whitespace-nowrap tabular-nums font-black text-pink-700">{money(row.amount)}</td><td className="px-4 py-3 text-right">{money(row.remainingAtSalon)}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-slate-500">Chưa có giao dịch đã xác minh trong khoảng ngày này.</p>}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4"><button type="button" disabled={revenuePageIndex === 0} onClick={() => setRevenuePageIndex((value) => Math.max(0, value - 1))} className="rounded-xl border px-4 py-2 text-xs font-black disabled:opacity-40">Trang trước</button><span className="px-2 text-xs font-bold">{revenuePageIndex + 1}/{Math.max(revenuePage?.totalPages || 0, 1)}</span><button type="button" disabled={revenuePageIndex + 1 >= (revenuePage?.totalPages || 0)} onClick={() => setRevenuePageIndex((value) => value + 1)} className="rounded-xl border px-4 py-2 text-xs font-black disabled:opacity-40">Trang sau</button></div>
        </section>
      </details>}</>}
    </main>
    {selected && <BookingDetail booking={selected} onClose={() => setSelected(null)} />}
  </div>;
};

export const BookingTable = ({ title, bookings, onSelect, onViewAll }: { title: string; bookings: AdminBooking[]; onSelect: (booking: AdminBooking) => void; onViewAll?: () => void }) => <section className="mt-4 min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4"><h2 className="font-bold">{title}</h2>{onViewAll && <button type="button" onClick={onViewAll} className="admin-action">Xem tất cả lịch đặt →</button>}</div>
  {bookings.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Không có lịch hẹn trong khoảng này.</p> : <div className="overflow-x-auto"><table className="admin-table min-w-[1280px]"><thead><tr>{BOOKING_TABLE_COLUMNS.map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{bookings.map(booking => <tr key={booking.id}>
    <td><strong>{booking.bookingCode}</strong></td><td><span className="cell-label" title={booking.customerName}>{booking.customerName}</span></td><td><span className="cell-label" title={booking.supplierName}>{booking.supplierName}</span></td><td><span className="cell-label" title={booking.serviceName}>{booking.serviceName}</span></td><td>{booking.practitionerName || '—'}</td><td className="whitespace-nowrap">{bookingAppointment(booking)}</td><td><AdminStatusBadge kind="booking" value={booking.status} /></td><td><AdminStatusBadge kind="payment" value={booking.paymentStatus} />{booking.paymentReviewRequired && <div className="mt-1"><AdminStatusBadge kind="paymentReview" value="REVIEW_REQUIRED" /></div>}</td><td className="numeric">{bookingOnlineAmount(booking.verifiedOnlineAmount)}</td><td><button type="button" className="admin-action" aria-label={`Chi tiết ${booking.bookingCode}`} onClick={() => onSelect(booking)}>Xem chi tiết</button></td>
  </tr>)}</tbody></table></div>}
</section>;
