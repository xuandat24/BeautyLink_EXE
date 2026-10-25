import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Download, Loader2, RefreshCw, Search, X,
} from 'lucide-react';
import type { AdminBooking, AdminPaymentSummary, AdminRevenueRow } from '../../types';
import { beautyApi, getAccessToken, getApiErrorMessage } from '../../services/beautyApi';
import { AdminNav, type AdminSection } from './AdminNav';
import { AdminOverview } from './AdminOverview';
import { adminRangeError } from '../../services/adminApi';

type DashboardMode = 'overview' | 'bookings' | 'payments';

interface AdminDashboardPageProps {
  mode: DashboardMode;
  adminName: string;
  onNavigate: (section: AdminSection) => void;
  onHome: () => void;
  onLogout: () => void;
  onOpenBookedCustomers: (from: string, to: string) => void;
  onOpenSalon?: (id: number, includeDemo: boolean) => void;
  initialSearch?: string;
}

const daysAgo = (days: number) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const date = new Date(Date.UTC(value('year'), value('month') - 1, value('day') - days));
  return date.toISOString().slice(0, 10);
};
const money = (value: number | null | undefined) => `${new Intl.NumberFormat('vi-VN').format(value || 0)}đ`;
const dateTime = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

const bookingLabels: Record<AdminBooking['status'], string> = {
  PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy',
};
const paymentLabels: Record<AdminBooking['paymentStatus'], string> = {
  UNPAID: 'Chưa thanh toán', PARTIALLY_PAID: 'Đã đặt cọc', PAID: 'Đã thanh toán', REFUNDED: 'Đã hoàn tiền',
};

const StatusPill = ({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'pink' | 'green' | 'amber' | 'rose' }) => {
  const colors = { slate: 'bg-slate-100 text-slate-700', pink: 'bg-pink-100 text-pink-700', green: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-800', rose: 'bg-rose-100 text-rose-700' };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${colors[tone]}`}>{children}</span>;
};

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
      <div className="mt-5 flex flex-wrap gap-2">
        <StatusPill tone={booking.status === 'CANCELLED' ? 'rose' : booking.status === 'COMPLETED' ? 'green' : 'pink'}>{bookingLabels[booking.status]}</StatusPill>
        <StatusPill tone={booking.paymentStatus === 'PAID' ? 'green' : booking.paymentStatus === 'UNPAID' ? 'slate' : 'amber'}>{paymentLabels[booking.paymentStatus]}</StatusPill>
        {booking.paymentReviewRequired && <StatusPill tone="rose">Cần đối soát</StatusPill>}
      </div>
      <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">Trang quản trị chỉ đọc. Trạng thái thanh toán và lịch hẹn chỉ thay đổi qua chính sách nghiệp vụ hiện có.</p>
    </aside>
  </div>
);

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ mode, adminName, onNavigate, onHome, onLogout, onOpenBookedCustomers, onOpenSalon, initialSearch = '' }) => {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(daysAgo(0));
  const [includeDemo, setIncludeDemo] = useState(false);
  const [payments, setPayments] = useState<AdminPaymentSummary | null>(null);
  const [revenuePage, setRevenuePage] = useState<{ content: AdminRevenueRow[]; totalElements: number; totalPages: number } | null>(null);
  const [revenuePageIndex, setRevenuePageIndex] = useState(0);
  const [exportingRevenue, setExportingRevenue] = useState(false);
  const [bookingPage, setBookingPage] = useState<{ content: AdminBooking[]; totalElements: number; totalPages: number; page: number } | null>(null);
  const [query, setQuery] = useState(initialSearch);
  const [overviewRefresh, setOverviewRefresh] = useState(0);
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AdminBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);
  const deferredQuery = useDeferredValue(query);

  const requestParams = useMemo(() => ({ from, to, includeDemo }), [from, to, includeDemo]);
  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true); setError('');
    try {
      if (mode === 'payments') { setPayments(null); setRevenuePage(null); }
      if (mode === 'bookings') setBookingPage(null);
      const invalid = adminRangeError(requestParams); if (invalid) throw new Error(invalid);
      if (mode === 'payments') {
        const [data, rows] = await Promise.all([
          beautyApi.adminPaymentSummary(requestParams),
          beautyApi.adminRevenue({ ...requestParams, page: revenuePageIndex, size: 20 }),
        ]);
        if (requestId === requestSequence.current) { setPayments(data); setRevenuePage(rows); }
      }
      if (mode === 'bookings') { const data = await beautyApi.adminBookings({ ...requestParams, query: deferredQuery.trim() || undefined, status: status || undefined, paymentStatus: paymentStatus || undefined, page, size: 20 }); if (requestId === requestSequence.current) setBookingPage(data); }
    } catch (err) {
      if (requestId === requestSequence.current) setError(getApiErrorMessage(err, 'Không thể tải dữ liệu quản trị.'));
    } finally { if (requestId === requestSequence.current) setLoading(false); }
  }, [mode, requestParams, deferredQuery, status, paymentStatus, page, revenuePageIndex]);

  useEffect(() => { void load(); return () => { requestSequence.current++; }; }, [load]);
  useEffect(() => { setQuery(initialSearch); }, [initialSearch]);
  useEffect(() => { setPage(0); }, [from, to, includeDemo, query, status, paymentStatus]);
  useEffect(() => { setRevenuePageIndex(0); }, [from, to, includeDemo]);

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
      <section className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap gap-2"><button onClick={() => preset(1)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">Hôm nay</button><button onClick={() => preset(7)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">7 ngày</button><button onClick={() => preset(30)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">30 ngày</button></div>
        <label className="text-xs font-bold text-slate-500">Từ ngày<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-bold text-slate-500">Đến ngày<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
        <label className="ml-auto flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-900"><input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} /> Bao gồm dữ liệu demo/test</label>
      </section>
  );
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <AdminNav active={active} adminName={adminName} onNavigate={onNavigate} onHome={onHome} onLogout={onLogout} controls={filters} />
    <main className="min-w-0 px-4 py-6 lg:ml-60 lg:px-7">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div><p className="text-xs font-black uppercase tracking-[0.2em] text-pink-600">Quản trị hệ thống</p><h1 className="mt-2 text-3xl font-black">{mode === 'overview' ? 'Tổng quan kinh doanh' : mode === 'bookings' ? 'Lịch hẹn toàn hệ thống' : 'Thanh toán đã xác minh'}</h1><p className="mt-2 text-sm text-slate-500">Dữ liệu thật từ MySQL · múi giờ Asia/Ho_Chi_Minh · {includeDemo ? 'đang gồm dữ liệu demo' : 'đã loại dữ liệu demo'}</p></div>
        <button type="button" onClick={() => mode === 'overview' ? setOverviewRefresh(v => v + 1) : void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black hover:border-pink-300"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới</button>
      </div>



      {error && <div role="alert" className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700"><span>{error}</span><button onClick={() => void load()} className="underline">Thử lại</button></div>}
      {loading && !error ? <div className="grid min-h-80 place-items-center"><div className="text-center text-sm font-bold text-slate-500"><Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-pink-600" />Đang tổng hợp dữ liệu...</div></div> : null}

      {!loading && !error && mode === 'overview' && <AdminOverview params={requestParams} refreshKey={overviewRefresh} renderBookings={rows => <BookingTable title="Đơn đặt lịch gần đây" bookings={rows} onSelect={setSelected} />} onSalon={id => onOpenSalon?.(id, includeDemo)} onBookedCustomers={() => onOpenBookedCustomers(from, to)} />}
      {!loading && mode === 'bookings' && bookingPage && <>
        <section className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
          <label className="relative md:col-span-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mã lịch, khách, salon, dịch vụ" className="min-h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm" /></label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 text-sm font-bold"><option value="">Mọi trạng thái lịch</option>{Object.entries(bookingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 text-sm font-bold"><option value="">Mọi trạng thái thanh toán</option>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </section>
        <BookingTable title={`${bookingPage.totalElements.toLocaleString('vi-VN')} lịch phù hợp`} bookings={bookingPage.content} onSelect={setSelected} />
        <div className="mt-4 flex justify-end gap-2"><button disabled={page === 0} onClick={() => setPage((v) => Math.max(0, v - 1))} className="rounded-xl border bg-white px-4 py-2 text-xs font-black disabled:opacity-40">Trang trước</button><span className="px-3 py-2 text-xs font-bold">{page + 1}/{Math.max(bookingPage.totalPages, 1)}</span><button disabled={page + 1 >= bookingPage.totalPages} onClick={() => setPage((v) => v + 1)} className="rounded-xl border bg-white px-4 py-2 text-xs font-black disabled:opacity-40">Trang sau</button></div>
      </>}

      {!loading && mode === 'payments' && payments && <>
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Đã thu online xác minh', money(payments.verifiedOnlineCollected), `${payments.verifiedPaymentBookings} lịch`],
            ['Tiền cọc xác minh', money(payments.verifiedDeposits), `${payments.depositBookings} lịch · gồm 5% và 50% lịch sử`],
            ['Thanh toán 100%', money(payments.verifiedFullPayments), `${payments.fullPaymentBookings} lịch`],
            ['Còn lại tại salon', money(payments.remainingAtSalon), 'Không phải doanh thu BeautyLink'],
          ].map(([label, value, note]) => <article key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-pink-700">{value}</p><p className="mt-3 text-[11px] font-semibold text-slate-400">{note}</p></article>)}
        </section>
        <section className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-3xl border border-amber-200 bg-amber-50 p-6"><div className="flex gap-3"><AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" /><div><h2 className="font-black text-amber-950">{payments.reconciliationIssues} giao dịch cần đối soát</h2><p className="mt-2 text-sm leading-6 text-amber-900">Khoản đang chờ hoặc cần xem xét không được cộng vào tiền đã thu. Dùng quy trình Payment Review hiện có để xử lý.</p></div></div></div><div className="rounded-3xl border border-slate-200 bg-white p-6"><h2 className="font-black">Quy ước kế toán</h2><p className="mt-2 text-sm leading-6 text-slate-600">Số tiền dùng giao dịch PAID xác minh đầu tiên của mỗi booking theo <strong>paidAt</strong> trong kỳ. Webhook lặp và lần thử lại không được cộng trùng. Không hiển thị “lợi nhuận” vì hệ thống chưa mô hình hóa hoa hồng và quyết toán.</p><p className="mt-3 text-[11px] text-slate-400">Cập nhật {dateTime(payments.generatedAt)}</p></div></section>
        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div><h2 className="font-black">Bảng doanh thu online đã xác minh</h2><p className="mt-1 text-xs text-slate-500">{(revenuePage?.totalElements || 0).toLocaleString('vi-VN')} giao dịch · theo ngày thanh toán · chưa trừ hoàn tiền · không bao gồm tiền trả tại salon</p></div>
            <button type="button" onClick={() => void downloadRevenue()} disabled={exportingRevenue} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-pink-600 px-4 text-sm font-black text-white hover:bg-pink-700 disabled:opacity-50"><Download className="h-4 w-4" />{exportingRevenue ? 'Đang xuất CSV...' : 'Tải CSV'}</button>
          </div>
          {revenuePage?.content.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs font-black text-slate-600"><tr><th className="px-4 py-3">Ngày thanh toán</th><th className="px-4 py-3">Mã lịch</th><th className="px-4 py-3">Đối tác / dịch vụ</th><th className="px-4 py-3">Hình thức</th><th className="px-4 py-3 text-right">Đã thu online</th><th className="px-4 py-3 text-right">Còn lại tại salon</th></tr></thead><tbody className="divide-y divide-slate-100">{revenuePage.content.map((row) => <tr key={row.paymentId}><td className="whitespace-nowrap px-4 py-4">{dateTime(row.paidAt)}</td><td className="px-4 py-4 font-bold">{row.bookingCode}</td><td className="px-4 py-4"><strong>{row.supplierName}</strong><span className="block text-xs text-slate-500">{row.serviceName}</span></td><td className="px-4 py-4">{row.paymentOption === 'FULL_100' ? 'Thanh toán 100%' : row.paymentOption === 'DEPOSIT_05' ? 'Đặt cọc 5%' : 'Đặt cọc 50%'}</td><td className="px-4 py-4 text-right font-black text-pink-700">{money(row.amount)}</td><td className="px-4 py-4 text-right">{money(row.remainingAtSalon)}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-slate-500">Chưa có giao dịch đã xác minh trong khoảng ngày này.</p>}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4"><button type="button" disabled={revenuePageIndex === 0} onClick={() => setRevenuePageIndex((value) => Math.max(0, value - 1))} className="rounded-xl border px-4 py-2 text-xs font-black disabled:opacity-40">Trang trước</button><span className="px-2 text-xs font-bold">{revenuePageIndex + 1}/{Math.max(revenuePage?.totalPages || 0, 1)}</span><button type="button" disabled={revenuePageIndex + 1 >= (revenuePage?.totalPages || 0)} onClick={() => setRevenuePageIndex((value) => value + 1)} className="rounded-xl border px-4 py-2 text-xs font-black disabled:opacity-40">Trang sau</button></div>
        </section>
      </>}
    </main>
    {selected && <BookingDetail booking={selected} onClose={() => setSelected(null)} />}
  </div>;
};

export const BookingTable = ({ title, bookings, onSelect }: { title: string; bookings: AdminBooking[]; onSelect: (booking: AdminBooking) => void }) => <section className="mt-6 min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4 font-bold">{title}</div>{bookings.length === 0 ? <div className="grid min-h-48 place-items-center text-sm text-slate-400">Không có lịch hẹn trong khoảng này.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-4 py-3">Mã / ngày tạo</th><th className="px-4 py-3">Khách hàng</th><th className="px-4 py-3">Salon / dịch vụ</th><th className="px-4 py-3">Lịch hẹn</th><th className="px-4 py-3">Trạng thái lịch</th><th className="px-4 py-3">Thanh toán</th><th className="px-4 py-3">Chi tiết</th></tr></thead><tbody className="divide-y divide-slate-100">{bookings.map((booking) => <tr key={booking.id} className="hover:bg-pink-50/40"><td className="px-4 py-4"><strong>{booking.bookingCode}</strong><span className="mt-1 block text-xs text-slate-400">{dateTime(booking.createdAt)}</span></td><td className="px-4 py-4">{booking.customerName}</td><td className="px-4 py-4"><strong>{booking.supplierName}</strong><span className="block text-xs text-slate-400">{booking.serviceName}</span></td><td className="whitespace-nowrap px-4 py-4">{booking.appointmentDate} · {booking.startTime.slice(0, 5)}</td><td className="px-4 py-4"><StatusPill tone={booking.status === 'CANCELLED' ? 'rose' : booking.status === 'COMPLETED' ? 'green' : 'pink'}>{bookingLabels[booking.status]}</StatusPill></td><td className="px-4 py-4"><StatusPill tone={booking.paymentStatus === 'PAID' ? 'green' : booking.paymentStatus === 'UNPAID' ? 'slate' : 'amber'}>{paymentLabels[booking.paymentStatus]}</StatusPill>{booking.paymentReviewRequired && <StatusPill tone="rose">Đối soát</StatusPill>}</td><td className="px-4 py-4"><button type="button" onClick={() => onSelect(booking)} className="rounded-lg border border-pink-200 px-3 py-2 text-xs font-semibold text-pink-700" aria-label={`Chi tiết ${booking.bookingCode}`}>Xem</button></td></tr>)}</tbody></table></div>}</section>;
