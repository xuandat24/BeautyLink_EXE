import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CalendarCheck, CalendarDays, CheckCircle2, CreditCard, Loader2,
  RefreshCw, Search, TrendingUp, UserCheck, Users, X,
} from 'lucide-react';
import type { AdminBooking, AdminDashboardSummary, AdminPaymentSummary } from '../../types';
import { beautyApi, getApiErrorMessage } from '../../services/beautyApi';
import { AdminNav, type AdminSection } from './AdminNav';

type DashboardMode = 'overview' | 'bookings' | 'payments';

interface AdminDashboardPageProps {
  mode: DashboardMode;
  adminName: string;
  onNavigate: (section: AdminSection) => void;
  onHome: () => void;
  onLogout: () => void;
  onOpenBookedCustomers: (from: string, to: string) => void;
}

const isoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const daysAgo = (days: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return isoDate(date);
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

const BookingDetail = ({ booking, onClose }: { booking: AdminBooking; onClose: () => void }) => (
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

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ mode, adminName, onNavigate, onHome, onLogout, onOpenBookedCustomers }) => {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(daysAgo(0));
  const [includeDemo, setIncludeDemo] = useState(false);
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [payments, setPayments] = useState<AdminPaymentSummary | null>(null);
  const [bookingPage, setBookingPage] = useState<{ content: AdminBooking[]; totalElements: number; totalPages: number; page: number } | null>(null);
  const [query, setQuery] = useState('');
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
      if (mode === 'overview') { const data = await beautyApi.adminDashboardSummary(requestParams); if (requestId === requestSequence.current) setSummary(data); }
      if (mode === 'payments') { const data = await beautyApi.adminPaymentSummary(requestParams); if (requestId === requestSequence.current) setPayments(data); }
      if (mode === 'bookings') { const data = await beautyApi.adminBookings({ ...requestParams, query: deferredQuery.trim() || undefined, status: status || undefined, paymentStatus: paymentStatus || undefined, page, size: 20 }); if (requestId === requestSequence.current) setBookingPage(data); }
    } catch (err) {
      if (requestId === requestSequence.current) setError(getApiErrorMessage(err, 'Không thể tải dữ liệu quản trị.'));
    } finally { if (requestId === requestSequence.current) setLoading(false); }
  }, [mode, requestParams, deferredQuery, status, paymentStatus, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(0); }, [from, to, includeDemo, query, status, paymentStatus]);

  const preset = (days: number) => { setFrom(daysAgo(days - 1)); setTo(daysAgo(0)); };
  const maxTrend = Math.max(...(summary?.bookingTrends.map((item) => item.bookings) || [1]), 1);
  const active: AdminSection = mode;

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <AdminNav active={active} adminName={adminName} onNavigate={onNavigate} onHome={onHome} onLogout={onLogout} />
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div><p className="text-xs font-black uppercase tracking-[0.2em] text-pink-600">Quản trị hệ thống</p><h1 className="mt-2 text-3xl font-black">{mode === 'overview' ? 'Tổng quan kinh doanh' : mode === 'bookings' ? 'Lịch hẹn toàn hệ thống' : 'Thanh toán đã xác minh'}</h1><p className="mt-2 text-sm text-slate-500">Dữ liệu thật từ MySQL · múi giờ Asia/Ho_Chi_Minh · {includeDemo ? 'đang gồm dữ liệu demo' : 'đã loại dữ liệu demo'}</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black hover:border-pink-300"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới</button>
      </div>

      <section className="mt-6 flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2"><button onClick={() => preset(1)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">Hôm nay</button><button onClick={() => preset(7)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">7 ngày</button><button onClick={() => preset(30)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">30 ngày</button></div>
        <label className="text-xs font-bold text-slate-500">Từ ngày<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-bold text-slate-500">Đến ngày<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
        <label className="ml-auto flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-900"><input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} /> Bao gồm dữ liệu demo/test</label>
      </section>

      {error && <div role="alert" className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700"><span>{error}</span><button onClick={() => void load()} className="underline">Thử lại</button></div>}
      {loading && !error ? <div className="grid min-h-80 place-items-center"><div className="text-center text-sm font-bold text-slate-500"><Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-pink-600" />Đang tổng hợp dữ liệu...</div></div> : null}

      {!loading && mode === 'overview' && summary && <>
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {([
            { label: 'Khách hàng đăng ký', value: summary.registeredCustomers, Icon: Users, note: 'Tất cả tài khoản CUSTOMER' },
            { label: 'Khách đã đặt lịch', value: summary.customersWhoBooked, Icon: UserCheck, note: 'Mỗi khách chỉ tính một lần' },
            { label: 'Tổng lịch đã đặt', value: summary.totalBookings, Icon: CalendarDays, note: 'Gồm cả lịch hủy sau khi đặt' },
            { label: 'Khách có thanh toán', value: summary.paidBookingCustomers, Icon: CreditCard, note: 'Có giao dịch PayOS xác minh' },
            { label: 'Lịch sắp tới', value: summary.upcomingBookings, Icon: CalendarCheck, note: 'Trong nhóm lịch tạo ở kỳ này' },
            { label: 'Lịch hoàn thành', value: summary.completedBookings, Icon: CheckCircle2, note: 'Trạng thái COMPLETED' },
            { label: 'Khách quay lại', value: summary.repeatCustomers, Icon: TrendingUp, note: 'Ít nhất 2 lịch trong kỳ' },
            { label: 'Cần đối soát', value: summary.reconciliationIssues, Icon: AlertTriangle, note: 'Giao dịch cần xem xét' },
          ] as Array<{ label: string; value: number; Icon: React.ElementType; note: string }>).map(({ label, value, Icon, note }, index) => <button type="button" key={label} onClick={index === 1 ? () => onOpenBookedCustomers(from, to) : undefined} className={`rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm ${index === 1 ? 'transition hover:border-pink-300 hover:shadow-md' : 'cursor-default'}`}><div className="flex items-start justify-between"><div><p className="text-xs font-black text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{value.toLocaleString('vi-VN')}</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-pink-50 text-pink-700"><Icon className="h-5 w-5" /></span></div><p className="mt-3 text-[11px] font-semibold text-slate-400">{note}</p></button>)}
        </section>
        <div className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-end justify-between"><div><h2 className="font-black">Hoạt động đặt lịch</h2><p className="mt-1 text-xs text-slate-400">Theo ngày (theo tuần khi chọn hơn 60 ngày); cột là số lịch, nhãn phụ là khách duy nhất.</p></div><strong className="text-pink-700">{summary.bookingToPaymentConversion}% đã thanh toán</strong></div><div className="mt-6 flex h-52 items-end gap-1 overflow-x-auto" aria-label="Biểu đồ hoạt động đặt lịch">{summary.bookingTrends.map((item) => <div key={item.date} className="flex min-w-7 flex-1 flex-col items-center justify-end gap-1" title={`${item.date}: ${item.bookings} lịch, ${item.uniqueCustomers} khách`}><span className="text-[9px] font-bold text-slate-400">{item.bookings}</span><div className="w-full max-w-8 rounded-t-lg bg-gradient-to-t from-pink-600 to-pink-300" style={{ height: `${Math.max(4, item.bookings / maxTrend * 150)}px` }} /><span className="rotate-[-45deg] whitespace-nowrap text-[8px] text-slate-400">{item.date.slice(5)}</span></div>)}</div></section>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black">Định nghĩa đang áp dụng</h2><ul className="mt-4 space-y-3 text-xs leading-5 text-slate-600"><li><strong>Khách đã đặt:</strong> DISTINCT customer_id theo Booking.createdAt.</li><li><strong>Đã thanh toán:</strong> booking có ít nhất một PayOS PAID xác minh; lần thử không làm tăng số lịch.</li><li><strong>Khách quay lại:</strong> ít nhất hai lịch được tạo trong chính kỳ đã chọn.</li><li><strong>Demo:</strong> loại trừ mặc định và chỉ gồm khi quản trị viên chủ động bật.</li></ul><p className="mt-4 text-[11px] text-slate-400">Cập nhật {dateTime(summary.generatedAt)}</p></section>
        </div>
        <BookingTable title="Lịch mới gần đây" bookings={summary.recentBookings} onSelect={setSelected} />
      </>}

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
      </>}
    </main>
    {selected && <BookingDetail booking={selected} onClose={() => setSelected(null)} />}
  </div>;
};

const BookingTable = ({ title, bookings, onSelect }: { title: string; bookings: AdminBooking[]; onSelect: (booking: AdminBooking) => void }) => <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4 font-black">{title}</div>{bookings.length === 0 ? <div className="grid min-h-48 place-items-center text-sm font-bold text-slate-400">Không có lịch hẹn trong khoảng này.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Mã / ngày tạo</th><th className="px-4 py-3">Khách hàng</th><th className="px-4 py-3">Dịch vụ / salon</th><th className="px-4 py-3">Lịch hẹn</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Thanh toán</th><th className="px-4 py-3 text-right">Giá trị</th></tr></thead><tbody className="divide-y divide-slate-100">{bookings.map((booking) => <tr key={booking.id} onClick={() => onSelect(booking)} className="cursor-pointer hover:bg-pink-50/40"><td className="px-4 py-4"><strong>{booking.bookingCode}</strong><span className="mt-1 block text-[10px] text-slate-400">{dateTime(booking.createdAt)}</span></td><td className="px-4 py-4"><strong>{booking.customerName}</strong><span className="block text-xs text-slate-400">{booking.customerPhone}</span></td><td className="px-4 py-4"><strong>{booking.serviceName}</strong><span className="block text-xs text-slate-400">{booking.supplierName}</span></td><td className="px-4 py-4 font-bold">{booking.appointmentDate} · {booking.startTime.slice(0, 5)}</td><td className="px-4 py-4"><StatusPill tone={booking.status === 'CANCELLED' ? 'rose' : booking.status === 'COMPLETED' ? 'green' : 'pink'}>{bookingLabels[booking.status]}</StatusPill></td><td className="px-4 py-4"><StatusPill tone={booking.paymentStatus === 'PAID' ? 'green' : booking.paymentStatus === 'UNPAID' ? 'slate' : 'amber'}>{paymentLabels[booking.paymentStatus]}</StatusPill>{booking.paymentReviewRequired && <span className="ml-1"><StatusPill tone="rose">Đối soát</StatusPill></span>}</td><td className="px-4 py-4 text-right font-black">{money(booking.totalAmount)}</td></tr>)}</tbody></table></div>}</section>;
