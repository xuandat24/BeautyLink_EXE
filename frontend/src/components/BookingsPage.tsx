import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Tag,
  MessageSquare,
  XCircle,
  Loader2,
  X,
  Share2,
} from 'lucide-react';
import { BackendBooking } from '../types';
import { beautyApi, getApiErrorMessage, getAccessToken } from '../services/beautyApi';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { AppointmentShareModal } from './AppointmentShareModal';
import { supportReportSchema, FieldErrors, zodFieldErrors } from '../lib/validation';
import { FieldError } from './FieldError';
import { ServiceReviewModal } from './ServiceReviewModal';
import { needsPaymentSync, reconcileHistoryPayment } from '../lib/bookingHistorySync';
import { sessionCredentialEpoch } from '../lib/authSession';
import { canCancelBooking, canPayBooking, canCompleteBooking, canReviewBooking, paymentSupportMessage } from '../lib/bookingPolicy';
import { PaymentContinuationDialog } from './PaymentContinuationDialog';
import { paymentBookingId, setPaymentBookingId } from '../lib/paymentNavigation';
import { useBeautyStore } from '../store/beautyStore';
import { isAuthStorageEvent } from '../lib/authSession';

interface BookingsPageProps {
  embedded?: boolean;
  onBack: () => void;
  onBookNew: () => void;
}

const statusMap: Record<string, string> = {
  CONFIRMED: 'Đã xác nhận',
  PENDING: 'Chờ xác nhận',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('vi-VN').format(val) + 'đ';
};

export const BookingsPage: React.FC<BookingsPageProps> = ({ onBack, onBookNew, embedded = false }) => {
  const { currentUser } = useBeautyStore();
  const [paymentId, setPaymentId] = useState<number | null>(() => paymentBookingId());
  const [sessionRevision, setSessionRevision] = useState(0);
  const sessionToken = getAccessToken();
  const priorAccount = useRef(currentUser?.id);
  useEffect(() => {
    if (currentUser?.id != null && priorAccount.current != null && String(priorAccount.current) !== String(currentUser.id)) {
      setPaymentId(null); setPaymentBookingId(null);
    }
    if (currentUser?.id != null) priorAccount.current = currentUser.id;
  }, [currentUser?.id]);
  const [bookings, setBookings] = useState<BackendBooking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [confirmingBooking, setConfirmingBooking] = useState<BackendBooking | null>(null);
  const [reviewingBooking, setReviewingBooking] = useState<BackendBooking | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'history'>('all');
  const [error, setError] = useState<string>('');
  const [reportBooking, setReportBooking] = useState<BackendBooking | null>(null);
  const [reportReason, setReportReason] = useState<string>('');
  const [reportDetails, setReportDetails] = useState<string>('');
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);
  const [reportSuccess, setReportSuccess] = useState<string>('');
  const [sharingBooking, setSharingBooking] = useState<BackendBooking | null>(null);
  const [reportErrors, setReportErrors] = useState<FieldErrors>({});
  const alive = useRef(false);
  const loadVersion = useRef(0);
  const actionBusy = useRef(false);
  const syncInFlight = useRef(false);
  const [checkingPayments, setCheckingPayments] = useState<number[]>([]);

  // Lock body scroll when report modal is open
  useBodyScrollLock(Boolean(reportBooking || confirmingBooking));

  // Close report modal on ESC
  useEffect(() => {
    if (!reportBooking && !confirmingBooking) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && completingId === null) { setReportBooking(null); setConfirmingBooking(null); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reportBooking, confirmingBooking, completingId]);

  const loadBookings = useCallback(async (keepError = false, silent = false) => {
    if (silent && syncInFlight.current) return;
    const version = ++loadVersion.current;
    const token = getAccessToken(), epoch = sessionCredentialEpoch();
    const current = () => alive.current && version === loadVersion.current && token === getAccessToken() && epoch === sessionCredentialEpoch();
    syncInFlight.current = true;
    if (!silent) setLoading(true);
    if (!keepError) setError('');
    try {
      const data = await beautyApi.myBookings();
      if (!current()) return;
      const pending = data.filter(needsPaymentSync);
      setBookings(data); setCheckingPayments(pending.map(b => b.id)); setLoading(false);
      let index = 0;
      const worker = async () => {
        while (index < pending.length && current()) {
          const b = pending[index++];
          const updated = await reconcileHistoryPayment(b, beautyApi.currentBookingPayment, beautyApi.myBooking);
          if (!current()) return;
          setBookings(items => items.map(item => item.id === b.id ? updated : item));
          setCheckingPayments(ids => ids.filter(id => id !== b.id));
        }
      };
      await Promise.all([worker(), worker()]); // Bounded, no overlapping polling or attempt creation.
    } catch (err) { if (current()) { if (!silent) setBookings([]); setError(getApiErrorMessage(err, 'Không thể cập nhật lịch hẹn. Vui lòng làm mới.')); } }
    finally { if (current()) { setLoading(false); setCheckingPayments([]); syncInFlight.current = false; } }
  }, []);

  useEffect(() => {
    alive.current = true;
    setBookings([]); setReviewingBooking(null); setConfirmingBooking(null);
    void loadBookings();
    return () => { alive.current = false; loadVersion.current += 1; };
  }, [loadBookings, sessionToken, currentUser?.id, sessionRevision]);
  useEffect(() => {
    const pop = () => setPaymentId(paymentBookingId());
    const changed = (event: StorageEvent) => { if (isAuthStorageEvent(event)) { setPaymentId(null); setSessionRevision(n => n + 1); } };
    window.addEventListener('popstate', pop); window.addEventListener('storage', changed);
    return () => { window.removeEventListener('popstate', pop); window.removeEventListener('storage', changed); };
  }, []);
  useEffect(() => {
    const refresh = () => { void loadBookings(true, true); };
    window.addEventListener('beautylink-bookings-refresh', refresh);
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', visible);
    const timer = window.setInterval(visible, 30_000);
    return () => { window.removeEventListener('beautylink-bookings-refresh', refresh); document.removeEventListener('visibilitychange', visible); window.clearInterval(timer); };
  }, [loadBookings]);

  const handleCancelBooking = async (id: number) => {
    if (actionBusy.current || !bookings.some(b => b.id === id && canCancelBooking(b))) return;
    actionBusy.current = true; loadVersion.current += 1;
    const token = getAccessToken();
    const current = () => alive.current && token === getAccessToken();
    setCancellingId(id);
    setError('');
    try {
      await beautyApi.cancelBooking(id);
    } catch (err) {
      if (current()) setError(getApiErrorMessage(err, 'Không thể hủy lịch hẹn.'));
    } finally {
      if (current()) { await loadBookings(true); setCancellingId(null); }
      actionBusy.current = false;
    }
  };

  const handleComplete = async () => {
    if (!confirmingBooking || actionBusy.current || !canCompleteBooking(confirmingBooking)) return;
    actionBusy.current = true; loadVersion.current += 1;
    const token = getAccessToken();
    const current = () => alive.current && token === getAccessToken();
    setCompletingId(confirmingBooking.id); setError('');
    try {
      await beautyApi.completeBooking(confirmingBooking.id);
      if (current()) setConfirmingBooking(null);
    } catch (err) { if (current()) setError(getApiErrorMessage(err, 'Không thể xác nhận hoàn thành.')); }
    finally { if (current()) { await loadBookings(true); setCompletingId(null); } actionBusy.current = false; }
  };

  const handleSendReport = async () => {
    if (!reportBooking) return;
    const validation = supportReportSchema.safeParse({ reason: reportReason, details: reportDetails });
    if (!validation.success) {
      setReportErrors(zodFieldErrors(validation.error));
      return;
    }
    setReportErrors({});
    setSubmittingReport(true);
    setError('');
    try {
      await beautyApi.createReport({
        targetType: 'BOOKING',
        targetId: reportBooking.id,
        reason: reportReason.trim(),
        details: reportDetails.trim(),
      });
      setReportBooking(null);
      setReportReason('');
      setReportDetails('');
      setReportSuccess('Phản hồi đã được gửi đến đội ngũ hỗ trợ.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể gửi phản hồi.'));
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className={embedded ? "bg-white" : "min-h-screen bg-[#FFF0F3]"}>
      {!embedded && <header className="border-b border-pink-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-600 hover:text-pink-700 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Trang chủ
          </button>
          <span className="text-lg font-black tracking-tight">
            Beauty<span className="text-pink-600">Link</span>
          </span>
          <button
            onClick={onBookNew}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-pink-700 transition"
          >
            Đặt lịch mới
          </button>
        </div>
      </header>}

      <main className={embedded ? "mx-auto max-w-5xl py-6" : "mx-auto max-w-5xl px-4 py-10 sm:px-6"}>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-pink-600">
          Tài khoản khách hàng
        </p>
        <h1 className="mt-2 text-3xl font-black">Lịch hẹn của tôi</h1>
        <p className="mt-2 text-sm text-slate-500">
          Đánh giá mở từ giữa giờ hẹn khi đã thanh toán hoặc đặt cọc. Xác nhận hoàn thành sau giờ kết thúc dịch vụ.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(['all', 'upcoming', 'history'] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className="rounded-xl border px-3 py-2 text-sm">{{all: 'Tất cả', upcoming: 'Sắp tới', history: 'Lịch sử'}[value]}</button>)}
          <button type="button" onClick={() => void loadBookings()} disabled={loading || cancellingId !== null || completingId !== null} className="rounded-xl border px-3 py-2 text-sm">Làm mới</button>
          {embedded && <button type="button" onClick={onBookNew} className="rounded-xl bg-pink-600 px-3 py-2 text-sm text-white">Đặt lịch mới</button>}
        </div>
        {loading && (
          <div className="grid h-64 place-items-center">
            <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
          </div>
        )}

        {error && (
          <p className="mt-6 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {error}
          </p>
        )}

        {!loading && bookings.length === 0 && (
          <div className="mt-8 rounded-[2rem] border border-pink-100 bg-white p-12 text-center shadow-sm">
            <Calendar className="mx-auto h-10 w-10 text-pink-400" />
            <h2 className="mt-4 text-xl font-black">Bạn chưa có lịch hẹn</h2>
            <p className="mt-2 text-sm text-slate-500">
              Chọn một dịch vụ và khung giờ phù hợp để bắt đầu.
            </p>
            <button
              onClick={onBookNew}
              className="mt-6 rounded-2xl bg-pink-600 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-pink-700"
            >
              Khám phá dịch vụ
            </button>
          </div>
        )}

        {reportSuccess && (
          <p className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            {reportSuccess}
          </p>
        )}

        <div className="mt-8 space-y-4">
          {bookings.filter((item) => filter === 'all' || (filter === 'history' ? ['COMPLETED', 'CANCELLED'].includes(item.status) : ['PENDING', 'CONFIRMED'].includes(item.status))).map((item) => (
            <article
              key={item.id}
              className="rounded-[1.6rem] border border-pink-100 bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex flex-col justify-between gap-5 sm:flex-row">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                        item.status === 'CANCELLED'
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {statusMap[item.status] || item.status}
                    </span>
                    <span className="rounded-full bg-pink-50 px-2.5 py-1 text-[10px] font-black text-pink-700">
                      {item.paymentStatus === 'PAID'
                        ? 'Đã thanh toán đủ'
                        : item.paymentStatus === 'PARTIALLY_PAID'
                          ? item.paymentOption === 'DEPOSIT_50'
                            ? 'Đã cọc 50% (giao dịch cũ)'
                            : item.paymentOption === 'DEPOSIT_05'
                              ? 'Đã cọc 5%'
                              : 'Đã đặt cọc'
                          : item.paymentStatus === 'REFUNDED' ? 'Đã hoàn tiền' : item.status === 'CANCELLED' ? 'Chưa thanh toán · đã hủy' : checkingPayments.includes(item.id) ? 'Đang đối soát' : 'Chưa thanh toán'}
                    </span>
                  </div>

                  <h2 className="mt-3 text-lg font-black">{item.serviceName}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                    <MapPin className="h-4 w-4 text-pink-500" /> {item.supplierName}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-slate-400" /> {item.appointmentDate}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-slate-400" />{' '}
                      {item.startTime.slice(0, 5)}–{item.endTime.slice(0, 5)}
                    </span>
                    <span>Chuyên viên: {item.practitionerName}</span>
                  </div>
                </div>

                <div className="shrink-0 sm:text-right">
                  <p className="text-lg font-black text-pink-700">
                    {formatCurrency(item.totalAmount)}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-slate-400">
                    <Tag className="h-3.5 w-3.5" /> {item.bookingCode}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2.5 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setSharingBooking(item)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-pink-200 bg-pink-50/80 px-3 py-1.5 text-xs font-black text-pink-700 hover:bg-pink-100 hover:border-pink-300 transition shadow-2xs cursor-pointer"
                      title="Chia sẻ lịch hẹn lên mạng xã hội"
                    >
                      <Share2 className="h-3.5 w-3.5" /> Chia sẻ
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportBooking(item)}
                      className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500 hover:text-pink-700 transition"
                    >
                      <MessageSquare className="h-4 w-4" /> Phản hồi
                    </button>
                    {canCompleteBooking(item) && <button type="button" disabled={completingId !== null || cancellingId !== null} onClick={() => setConfirmingBooking(item)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Đã sử dụng dịch vụ</button>}
                    {canReviewBooking(item) && <button type="button" onClick={() => setReviewingBooking(item)} className="rounded-xl bg-pink-600 px-3 py-2 text-xs font-bold text-white">{item.serviceReview || item.supplierReview ? 'Xem / sửa đánh giá' : 'Đánh giá dịch vụ / nhà cung cấp'}</button>}
                    {checkingPayments.includes(item.id) && <p role="status" className="text-xs text-slate-500">Đang đối soát thanh toán...</p>}
                    {!checkingPayments.includes(item.id) && canPayBooking(item) && <button type="button" disabled={loading || cancellingId !== null || completingId !== null} onClick={() => { setPaymentBookingId(item.id, true); setPaymentId(item.id); }} className="rounded-xl bg-pink-600 px-3 py-2 text-xs font-bold text-white">Tiếp tục thanh toán</button>}
                    {canCancelBooking(item) && (
                      <button
                        disabled={cancellingId !== null || completingId !== null}
                        onClick={() => handleCancelBooking(item.id)}
                        className="flex items-center gap-1.5 text-xs font-extrabold text-rose-600 hover:text-rose-800 transition"
                      >
                        {cancellingId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        Hủy lịch
                      </button>
                    )}
                  </div>
                  {paymentSupportMessage(item) && <p role="status" className="mt-3 max-w-sm text-xs text-amber-800">{paymentSupportMessage(item)}</p>}
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      {confirmingBooking && <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="complete-title">
        <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6">
          <h2 id="complete-title" className="text-xl font-black">Xác nhận đã sử dụng dịch vụ</h2>
          <p>Bạn xác nhận đã sử dụng xong {confirmingBooking.serviceName} tại {confirmingBooking.supplierName}? Sau xác nhận, lịch hẹn không thể hủy và bạn có thể đánh giá trải nghiệm.</p>
          {error && <p role="alert" className="text-rose-700">{error}</p>}
          <div className="flex justify-end gap-3"><button type="button" disabled={completingId !== null} onClick={() => setConfirmingBooking(null)}>Quay lại</button><button type="button" disabled={completingId !== null} onClick={handleComplete} className="rounded-xl bg-emerald-600 p-3 text-white">{completingId !== null ? 'Đang xác nhận...' : 'Xác nhận hoàn thành'}</button></div>
        </div>
      </div>}
      {reviewingBooking && <ServiceReviewModal isOpen booking={reviewingBooking} serviceTitle={reviewingBooking.serviceName} salonName={reviewingBooking.supplierName} onClose={() => setReviewingBooking(null)} onSuccess={() => void loadBookings()} />}
      {paymentId !== null && <PaymentContinuationDialog bookingId={paymentId} onClose={() => { setPaymentBookingId(null); setPaymentId(null); void loadBookings(); }} />}

      {/* Support Report Modal */}
      {reportBooking && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          {/* Blurred & Dimmed Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-150 cursor-pointer"
            onClick={() => setReportBooking(null)}
            aria-hidden="true"
          />

          <div
            className="relative z-10 w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl border border-pink-100 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-pink-600">
                  Gửi phản hồi
                </p>
                <h2 className="mt-1 text-xl font-black">{reportBooking.serviceName}</h2>
              </div>
              <button
                onClick={() => setReportBooking(null)}
                className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-pink-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-xs font-black">Tiêu đề</span>
              <input
                maxLength={120}
                value={reportReason}
                onChange={(e) => { setReportReason(e.target.value); setReportErrors((prev) => ({ ...prev, reason: '' })); }}
                minLength={2}
                aria-invalid={Boolean(reportErrors.reason)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-pink-400"
                placeholder="Ví dụ: Cần hỗ trợ đổi lịch hẹn"
              />
              <FieldError message={reportErrors.reason} />
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-black">Nội dung chi tiết</span>
              <textarea
                value={reportDetails}
                onChange={(e) => { setReportDetails(e.target.value); setReportErrors((prev) => ({ ...prev, details: '' })); }}
                minLength={10}
                maxLength={1500}
                aria-invalid={Boolean(reportErrors.details)}
                className="min-h-32 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-pink-400"
                placeholder="Mô tả cụ thể vấn đề bạn gặp phải..."
              />
              <FieldError message={reportErrors.details} />
            </label>

            <button
              onClick={handleSendReport}
              disabled={
                submittingReport ||
                reportReason.trim().length < 2 ||
                reportDetails.trim().length < 10
              }
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-extrabold text-white hover:bg-pink-700 disabled:opacity-40 transition"
            >
              {submittingReport && <Loader2 className="h-4 w-4 animate-spin" />}
              Gửi đến hỗ trợ
            </button>
          </div>
        </div>
      )}

      {/* Social Media Sharing Modal */}
      <AppointmentShareModal
        isOpen={Boolean(sharingBooking)}
        onClose={() => setSharingBooking(null)}
        data={
          sharingBooking
            ? {
                bookingCode: sharingBooking.bookingCode,
                serviceName: sharingBooking.serviceName,
                supplierName: sharingBooking.supplierName,
                practitionerName: sharingBooking.practitionerName,
                appointmentDate: sharingBooking.appointmentDate,
                startTime: sharingBooking.startTime.slice(0, 5),
                endTime: sharingBooking.endTime ? sharingBooking.endTime.slice(0, 5) : undefined,
                totalAmount: sharingBooking.totalAmount,
                note: sharingBooking.note,
              }
            : null
        }
      />
    </div>
  );
};
