import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import { AdminBooking, AdminCustomer } from '../types';
import { beautyApi, getAccessToken, getApiErrorMessage } from '../services/beautyApi';
import { AdminStatusBadge } from './admin/AdminStatusBadge';
import { adminMoney } from './admin/AdminOverview';
import { AdminNav, type AdminSection } from './admin/AdminNav';

interface AdminCustomersPageProps {
  onBack: () => void;
  onNavigate: (section: AdminSection) => void;
  onLogout: () => void;
  adminName: string;
  bookedRange?: { from: string; to: string } | null;
  embedded?: boolean;
}

export const AdminCustomersPage: React.FC<AdminCustomersPageProps> = ({ onBack, onNavigate, onLogout, adminName, bookedRange, embedded = false }) => {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomer | null>(null);
  const [history, setHistory] = useState<AdminBooking[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const requestSequence = useRef(0); const historySequence = useRef(0);

  const loadCustomers = async () => {
    const request = ++requestSequence.current; const token = getAccessToken();
    setLoading(true);
    setError('');
    try {
      const rows = await beautyApi.adminCustomers(bookedRange ? { ...bookedRange, bookedOnly: true, includeDemo: false } : { includeDemo: false });
      if (request === requestSequence.current && token === getAccessToken()) setCustomers(rows);
    } catch (err) {
      if (request === requestSequence.current && token === getAccessToken()) setError(getApiErrorMessage(err, 'Không thể tải danh sách tài khoản khách hàng.'));
    } finally {
      if (request === requestSequence.current && token === getAccessToken()) setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
    return () => { requestSequence.current++; historySequence.current++; };
  }, [bookedRange]);

  const openHistory = async (customer: AdminCustomer) => {
    const request = ++historySequence.current; const token = getAccessToken();
    setSelectedCustomer(customer); setHistoryLoading(true); setHistory([]);
    try { const rows = (await beautyApi.adminCustomerBookings(customer.id)).content; if (request === historySequence.current && token === getAccessToken()) setHistory(rows); }
    catch (err) { if (request === historySequence.current && token === getAccessToken()) setError(getApiErrorMessage(err, 'Không thể tải lịch sử đặt lịch.')); }
    finally { if (request === historySequence.current && token === getAccessToken()) setHistoryLoading(false); }
  };

  const visibleCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN');
    return customers
      .map((customer, index) => ({ customer, ordinal: index + 1 }))
      .filter(({ customer }) => {
        if (!normalizedQuery) return true;
        return [customer.fullName, customer.phone, customer.email]
          .some((value) => value?.toLocaleLowerCase('vi-VN').includes(normalizedQuery));
      });
  }, [customers, query]);

  const handleExport = async () => {
    const token = getAccessToken();
    setExporting(true);
    setError('');
    try {
      const blob = await beautyApi.exportAdminCustomers();
      if (token !== getAccessToken()) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `beautylink-customers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể tải xuống dữ liệu khách hàng.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={`${embedded ? '' : 'min-h-screen'} bg-slate-50 text-slate-900`}>
      {!embedded && <AdminNav active="customers" adminName={adminName} onNavigate={onNavigate} onHome={onBack} onLogout={onLogout} />}

      <main className={embedded ? 'min-w-0 py-4' : 'min-w-0 px-4 py-5 lg:ml-60 lg:px-6'}>
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>

            <h1 className="text-2xl font-extrabold">Tài khoản khách hàng</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Tài khoản khách hàng và lịch sử đặt dịch vụ.
              {bookedRange && <span className="mt-1 block font-bold text-pink-700">Đang lọc khách đã đặt lịch từ {bookedRange.from} đến {bookedRange.to}.</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#be185d] px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-pink-900/15 transition hover:bg-[#9d174d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            Tải toàn bộ dữ liệu (.CSV)
          </button>
        </div>

        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-pink-50 text-pink-700">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">Tổng tài khoản khách hàng</p>
                <p className="text-2xl font-black text-slate-900">{customers.length}</p>
              </div>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <label className="relative min-w-0 flex-1 sm:w-80">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <span className="sr-only">Tìm khách hàng</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm theo tên, điện thoại, email"
                  className="min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-pink-400 focus:bg-white focus:ring-2 focus:ring-pink-100"
                />
              </label>
              <button
                type="button"
                onClick={() => void loadCustomers()}
                disabled={loading}
                aria-label="Tải lại danh sách"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-pink-200 hover:text-pink-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid min-h-72 place-items-center">
              <div className="text-center text-sm font-semibold text-slate-500">
                <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-pink-600" />
                Đang tải tài khoản khách hàng...
              </div>
            </div>
          ) : visibleCustomers.length === 0 ? (
            <div className="grid min-h-72 place-items-center px-6 text-center">
              <div>
                <Users className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 font-black text-slate-700">
                  {query ? 'Không tìm thấy khách hàng phù hợp' : 'Chưa có tài khoản khách hàng'}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {query ? 'Hãy thử tên, số điện thoại hoặc email khác.' : 'Tài khoản mới sẽ xuất hiện tại đây sau khi đăng ký.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] border-collapse text-left">
                <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="w-16 px-4 py-3 text-center">STT</th>
                    <th className="px-4 py-3">Tên người dùng</th>
                    <th className="px-4 py-3">Số điện thoại</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3 text-center">Đã đặt</th>
                    <th className="px-4 py-3 text-center">Đã trả</th>
                    <th className="px-4 py-3 text-center">Hoàn thành</th>
                    <th className="px-4 py-3">Thu online</th>
                    <th className="px-4 py-3">Lần đặt cuối</th>
                    <th className="px-4 py-3">Lịch sử</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleCustomers.map(({ customer, ordinal }) => (
                    <tr key={customer.id} className="transition hover:bg-pink-50/40">
                      <td className="px-4 py-3 text-center text-sm font-black text-slate-400">{ordinal}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pink-100 text-sm font-black text-pink-700">
                            {customer.fullName.trim().charAt(0).toLocaleUpperCase('vi-VN') || '?'}
                          </span>
                          <span className="text-sm font-black text-slate-800">{customer.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm font-bold text-slate-700">{customer.phone}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-600">{customer.email || 'Chưa cập nhật'}</td>
                      <td className="px-4 py-3 text-center font-black">{customer.bookingsPlaced}</td>
                      <td className="px-4 py-3 text-center font-black text-emerald-700">{customer.paidBookings}</td>
                      <td className="px-4 py-3 text-center font-black">{customer.completedBookings}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap tabular-nums font-black text-pink-700">{adminMoney(customer.totalVerifiedOnlineAmount)}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-500">{customer.lastBookingAt ? new Date(customer.lastBookingAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa đặt'}</td>
                      <td className="px-4 py-3"><button type="button" onClick={() => void openHistory(customer)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black hover:border-pink-300 hover:text-pink-700"><Eye className="h-4 w-4" /> Xem</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {error && (
          <p role="alert" className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {error}
          </p>
        )}
      </main>
      {selectedCustomer && <div className="fixed inset-0 z-[120] flex justify-end bg-slate-950/50" role="dialog" aria-modal="true" aria-label="Lịch sử khách hàng"><button type="button" className="absolute inset-0" onClick={() => setSelectedCustomer(null)} aria-label="Đóng" /><aside className="relative h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase text-pink-600">Khách hàng #{selectedCustomer.id}</p><h2 className="mt-2 text-2xl font-black">{selectedCustomer.fullName}</h2><p className="mt-1 text-sm text-slate-500">{selectedCustomer.phone} · {selectedCustomer.email}</p></div><button onClick={() => setSelectedCustomer(null)} aria-label="Đóng" className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100"><X className="h-5 w-5" /></button></div>{historyLoading ? <Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-pink-600" /> : history.length === 0 ? <p className="mt-20 text-center text-sm font-bold text-slate-400">Khách hàng chưa có lịch hẹn thực.</p> : <div className="mt-6 space-y-3">{history.map((booking) => <article key={booking.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><strong>{booking.bookingCode} · {booking.serviceName}</strong><p className="mt-1 text-xs text-slate-500">{booking.supplierName} · {booking.appointmentDate} {booking.startTime.slice(0, 5)}</p></div><span className="text-xs whitespace-nowrap tabular-nums font-black text-pink-700">{adminMoney(booking.totalAmount)}</span></div><div className="mt-2 flex flex-wrap gap-2"><AdminStatusBadge kind="booking" value={booking.status} /><AdminStatusBadge kind="payment" value={booking.paymentStatus} />{booking.paymentReviewRequired && <AdminStatusBadge kind="paymentReview" value="REVIEW_REQUIRED" />}</div></article>)}</div>}</aside></div>}
    </div>
  );
};
