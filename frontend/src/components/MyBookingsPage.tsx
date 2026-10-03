import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, CalendarDays, Clock3, LoaderCircle, MapPin, MessageCircleWarning,
  ReceiptText, ShoppingBag, Sparkles, Star, X, XCircle,
} from 'lucide-react';
import { getApiErrorMessage } from '../lib/api';
import { platformApi } from '../services/platformApi';
import type { BookingRecord, BookingReview, ReviewTarget } from '../types';
import { BookingReviewModal } from './BookingReviewModal';

interface MyBookingsPageProps {
  onBack: () => void;
  onBookNew: () => void;
  onOpenShop: (supplierId: number) => void;
}

const formatMoney = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
const statusLabel: Record<BookingRecord['status'], string> = { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy' };

const BookingImage: React.FC<{ booking: BookingRecord }> = ({ booking }) => {
  const [failed, setFailed] = useState(false);
  const source = booking.serviceImageUrl || booking.supplierImageUrl;
  if (!source || failed) return <div className="grid h-full w-full place-items-center bg-gradient-to-br from-pink-100 to-rose-50"><Sparkles className="h-8 w-8 text-pink-400" /></div>;
  return <img src={source} alt={booking.serviceName} loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(true)} />;
};

export const MyBookingsPage: React.FC<MyBookingsPageProps> = ({ onBack, onBookNew, onOpenShop }) => {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [reportBooking, setReportBooking] = useState<BookingRecord | null>(null);
  const [reviewBooking, setReviewBooking] = useState<BookingRecord | null>(null);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [message, setMessage] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    platformApi.myBookings().then(setBookings).catch((requestError) => setError(getApiErrorMessage(requestError))).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const cancel = async (id: number) => {
    setBusyId(id);
    setError('');
    try {
      const updated = await platformApi.cancelBooking(id);
      setBookings((items) => items.map((item) => item.id === id ? updated : item));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusyId(null);
    }
  };

  const submitReport = async () => {
    if (!reportBooking || reason.trim().length < 2 || details.trim().length < 2) return;
    setReporting(true);
    setError('');
    try {
      await platformApi.createReport({ targetType: 'BOOKING', targetId: reportBooking.id, reason: reason.trim(), details: details.trim() });
      setReportBooking(null);
      setReason('');
      setDetails('');
      setMessage('Phản hồi đã được gửi đến đội ngũ hỗ trợ.');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setReporting(false);
    }
  };

  const handleReviewSaved = (targetType: ReviewTarget, review: BookingReview) => {
    const update = (booking: BookingRecord) => booking.id !== review.bookingId ? booking : {
      ...booking,
      ...(targetType === 'SERVICE' ? { serviceReview: review } : { supplierReview: review }),
    };
    setBookings((items) => items.map(update));
    setReviewBooking((booking) => booking ? update(booking) : null);
  };

  return (
    <div className="min-h-screen bg-[#FFF0F3]">
      <header className="border-b border-pink-100 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6"><button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-600 hover:text-pink-700"><ArrowLeft className="h-4 w-4" /> Trang chủ</button><span className="text-lg font-black">Beauty<span className="text-pink-600">Link</span></span><button onClick={onBookNew} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-pink-700">Đặt lịch mới</button></div></header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-pink-600">Tài khoản khách hàng</p>
        <h1 className="mt-2 text-3xl font-black">Lịch hẹn của tôi</h1>
        <p className="mt-2 text-sm text-slate-500">Xem dịch vụ, cửa hàng, trạng thái thanh toán và đánh giá ngay trên từng đơn.</p>
        {loading && <div className="grid h-64 place-items-center"><LoaderCircle className="h-8 w-8 animate-spin text-pink-600" /></div>}
        {error && <p className="mt-6 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>}
        {!loading && bookings.length === 0 && <div className="mt-8 rounded-[2rem] border border-pink-100 bg-white p-12 text-center shadow-sm"><CalendarDays className="mx-auto h-10 w-10 text-pink-400" /><h2 className="mt-4 text-xl font-black">Bạn chưa có lịch hẹn</h2><p className="mt-2 text-sm text-slate-500">Chọn một dịch vụ và khung giờ phù hợp để bắt đầu.</p><button onClick={onBookNew} className="mt-6 rounded-2xl bg-pink-600 px-6 py-3 text-sm font-extrabold text-white">Khám phá dịch vụ</button></div>}
        {message && <p className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</p>}

        <div className="mt-8 space-y-4">
          {bookings.map((booking) => <article key={booking.id} className="overflow-hidden rounded-[1.6rem] border border-pink-100 bg-white shadow-sm">
            <div className="grid gap-5 p-4 sm:grid-cols-[132px_minmax(0,1fr)_auto] sm:p-5">
              <div className="h-40 overflow-hidden rounded-2xl sm:h-32"><BookingImage booking={booking} /></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${booking.status === 'CANCELLED' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{statusLabel[booking.status]}</span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-[#005baa]">VNPAY‑QR · Demo</span>{booking.serviceReview && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">Dịch vụ {booking.serviceReview.rating}/5 ★</span>}{booking.supplierReview && <span className="rounded-full bg-pink-50 px-2.5 py-1 text-[10px] font-black text-pink-700">Cửa hàng {booking.supplierReview.rating}/5 ★</span>}</div>
                <h2 className="mt-3 text-lg font-black">{booking.serviceName}</h2>
                <button onClick={() => onOpenShop(booking.supplierId)} className="mt-1 inline-flex max-w-full items-center gap-1.5 text-left text-sm font-extrabold text-pink-700 hover:underline"><ShoppingBag className="h-4 w-4 shrink-0" /><span className="truncate">{booking.supplierName}</span></button>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{booking.supplierAddress}</span></p>
                <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-slate-600"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{booking.appointmentDate}</span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)}</span><span>Chuyên viên: {booking.practitionerName}</span></div>
              </div>
              <div className="shrink-0 sm:text-right"><p className="text-lg font-black text-pink-700">{formatMoney(booking.totalAmount)}</p><p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-slate-400"><ReceiptText className="h-3.5 w-3.5" />{booking.bookingCode}</p></div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
              {booking.reviewEligible && <button onClick={() => setReviewBooking(booking)} className="flex items-center gap-1.5 rounded-full bg-[#EB0F51] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#B42D58]"><Star className="h-4 w-4" />{booking.serviceReview || booking.supplierReview ? 'Xem / sửa đánh giá' : 'Đánh giá'}</button>}
              <button onClick={() => setReportBooking(booking)} className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500 hover:text-pink-700"><MessageCircleWarning className="h-4 w-4" /> Phản hồi</button>
              {!['CANCELLED', 'COMPLETED'].includes(booking.status) && <button disabled={busyId === booking.id} onClick={() => cancel(booking.id)} className="flex items-center gap-1.5 text-xs font-extrabold text-rose-600 hover:text-rose-800">{busyId === booking.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Hủy lịch</button>}
            </div>
          </article>)}
        </div>
      </main>

      {reportBooking && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-pink-600">Gửi phản hồi</p><h2 className="mt-1 text-xl font-black">{reportBooking.serviceName}</h2></div><button onClick={() => setReportBooking(null)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100"><X className="h-4 w-4" /></button></div><label className="mt-5 block"><span className="mb-2 block text-xs font-black">Tiêu đề</span><input maxLength={120} value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-pink-400" placeholder="Ví dụ: Cần hỗ trợ đổi lịch" /></label><label className="mt-4 block"><span className="mb-2 block text-xs font-black">Nội dung chi tiết</span><textarea maxLength={1500} value={details} onChange={(event) => setDetails(event.target.value)} className="min-h-32 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-pink-400" /></label><button onClick={submitReport} disabled={reporting || reason.trim().length < 2 || details.trim().length < 2} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-extrabold text-white hover:bg-pink-700 disabled:opacity-40">{reporting && <LoaderCircle className="h-4 w-4 animate-spin" />} Gửi đến hỗ trợ</button></div></div>}
      {reviewBooking && <BookingReviewModal booking={reviewBooking} onClose={() => setReviewBooking(null)} onSaved={handleReviewSaved} />}
    </div>
  );
};
