import { CheckoutPreparation, type PreparationStage } from './CheckoutPreparation';
import { CheckoutBrand } from './CheckoutBrand';
import { PayOSCheckoutPage } from './PayOSCheckoutPage';
import type { PayOSPayment } from '../types/beauty';
import React, { useEffect, useRef, useState } from 'react';
import { beautyApi, getAccessToken, getApiErrorMessage, getPaymentErrorMessage } from '../services/beautyApi';
import { useBeautyStore } from '../store/beautyStore';
import { canPayBooking } from '../lib/bookingPolicy';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import type { BackendBooking, PaymentOption, PaymentQuote } from '../types';
import { BookingContactDialog } from './BookingContactDialog';
import { isAuthStorageEvent } from '../lib/authSession';
import { ArrowLeft, ArrowRight, CalendarDays, CircleAlert, CreditCard, RefreshCw, ShieldCheck, Store } from 'lucide-react';

const formatMoney = (value: number | null | undefined) => value == null ? 'Đang xác minh' : `${value.toLocaleString('vi-VN')}đ`;

export function PaymentContinuationDialog({ bookingId, onClose }: { bookingId: number; onClose: () => void }) {
  const { currentUser, setCurrentUser } = useBeautyStore();
  const [preparationStage, setPreparationStage] = useState<PreparationStage>('VALIDATING');
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [activePayment, setActivePayment] = useState<PayOSPayment | null>(null);
  const [sessionRevision, setSessionRevision] = useState(0);
  const session = `${getAccessToken() ?? ''}:${currentUser?.id ?? ''}:${sessionRevision}`;
  const [booking, setBooking] = useState<BackendBooking | null>(null);
  const [option, setOption] = useState<PaymentOption>('DEPOSIT_05');
  const [voucher, setVoucher] = useState('');
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0); const submitting = useRef(false); const latestId = useRef(bookingId); latestId.current = bookingId;
  const focus = useRef<HTMLButtonElement>(null);
  useBodyScrollLock(true);
  useEffect(() => { const changed = (event: StorageEvent) => { if (isAuthStorageEvent(event)) setSessionRevision(n => n + 1); }; window.addEventListener('storage', changed); return () => window.removeEventListener('storage', changed); }, []);
  useEffect(() => {
    const version = ++generation.current, token = getAccessToken();
    setBooking(null); setError(''); setLoading(true); focus.current?.focus();
    setBusy(submitting.current);
    if (!token) { setLoading(false); setError('Vui lòng đăng nhập lại để tiếp tục thanh toán.'); return; }
    beautyApi.myBooking(bookingId).then(data => {
      if (version !== generation.current || token !== getAccessToken()) return;
      if (data.id !== bookingId) throw new Error('Máy chủ trả về lịch hẹn không khớp.');
      setBooking(data);
      setOption(data.paymentAttemptActive && data.paymentOption ? data.paymentOption : 'DEPOSIT_05');
      setVoucher(data.paymentAttemptActive ? data.paymentVoucherCode ?? '' : '');
    }).catch(err => { if (version === generation.current && token === getAccessToken()) setError(getApiErrorMessage(err, 'Không tải được lịch hẹn.')); })
      .finally(() => { if (version === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [bookingId, session, revision]);
  useEffect(() => {
    let active = true;
    setQuote(null);
    setQuoteError('');
    setQuoteLoading(false);
    if (!booking || booking.paymentAttemptActive || option === 'DEPOSIT_50' || !canPayBooking(booking)) return () => { active = false; };
    setQuoteLoading(true);
    beautyApi.bookingPaymentQuote(booking.id, option, voucher.trim() || undefined)
      .then(value => { if (active) setQuote(value); })
      .catch(err => { if (active) setQuoteError(getApiErrorMessage(err, 'Không thể xác minh số tiền với máy chủ.')); })
      .finally(() => { if (active) setQuoteLoading(false); });
    return () => { active = false; };
  }, [booking, option, voucher]);
  const pay = async () => {
    if (submitting.current || !booking || !canPayBooking(booking)) return;
    if (!booking.paymentAttemptActive && (quoteLoading || quoteError || quote?.paymentOption !== option || !quote?.paymentAvailable)) {
      setError(quoteError || 'Số tiền chưa được máy chủ xác minh hoặc chưa thể thanh toán qua PayOS.');
      return;
    }
    setPreparationStage('VALIDATING');
    submitting.current = true; setBusy(true); setError('');
    const version = generation.current, token = getAccessToken();
    const current = () => version === generation.current && bookingId === latestId.current && token !== null && token === getAccessToken();
    const execute = async () => {
      const fresh = await beautyApi.myBooking(bookingId);
      if (!current()) return;
      if (fresh.id !== bookingId) throw new Error('Máy chủ trả về lịch hẹn không khớp.');
      if (!canPayBooking(fresh)) { setBooking(fresh); throw new Error('Lịch hẹn không còn được phép thanh toán. Vui lòng làm mới hoặc liên hệ hỗ trợ.'); }
      // Options are from server or explicit customer input, never restored browser payment data.
      setPreparationStage('PROVIDER');
      const payment = await beautyApi.createPayOSPayment(bookingId, { paymentOption: option, voucherCode: voucher.trim() || undefined },
        () => { if (current()) setPreparationStage('RECOVERING'); });
      if (!current()) return;
      if (!booking.paymentAttemptActive && quote && (payment.paymentOption !== quote.paymentOption
          || payment.amount !== quote.amount || payment.remainingAmount !== quote.remainingAmount)) {
        throw new Error('Giá thanh toán đã thay đổi sau khi máy chủ xác minh. Phiên PayOS được giữ nguyên để bạn kiểm tra trước khi tiếp tục.');
      }
      if (payment.bookingId !== bookingId || !Number.isSafeInteger(payment.orderCode)) throw new Error('Chưa có checkout an toàn. Không thanh toán lại; vui lòng làm mới hoặc liên hệ hỗ trợ.');
      sessionStorage.setItem('beautylink_payos_order_code', String(payment.orderCode));
      setBooking(fresh); setActivePayment(payment);
    };
    try {
      if (!current()) return;
      if (typeof navigator !== 'undefined' && navigator.locks?.request) await navigator.locks.request(`beautylink-payment-${bookingId}`, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error('Lịch hẹn đang được thanh toán ở tab khác.'); await execute();
      });
      else await execute(); // DB root locks/ledger still enforce idempotency across all browsers.
    } catch (err) { if (current()) {
      if ((err as any)?.response?.data?.code === 'BOOKING_CONTACT_REQUIRED' && currentUser) setContactDialogOpen(true);
      else { setBooking(null); setError(getPaymentErrorMessage(err, 'Không thể tiếp tục thanh toán.')); }
    } }
    finally { submitting.current = false; if (generation.current > 0) setBusy(false); }
  };
  if (activePayment) return <PayOSCheckoutPage key={String(activePayment.orderCode)} initialPayment={activePayment} booking={booking} onBack={onClose} />;
  const canContinue = booking && canPayBooking(booking);
  const displayedQuote = quote?.paymentOption === option ? quote : null;
  const amount = booking?.paymentAttemptActive ? booking.paymentAmount : displayedQuote?.amount;
  const remaining = booking?.paymentAttemptActive ? booking.paymentRemainingAmount : displayedQuote?.remainingAmount;
  if (busy && !contactDialogOpen) return <CheckoutPreparation serviceName={booking?.serviceName ?? 'Lịch hẹn của bạn'} supplierName={booking?.supplierName}
    bookingCode={booking?.bookingCode} amount={amount} option={option} stage={preparationStage} onBack={onClose} />;
  return <div className="fixed inset-0 z-[140] grid place-items-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="payment-continue-title"
    onKeyDown={event => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key === 'Tab') {
        const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')];
        if (!nodes.length) { event.preventDefault(); return; }
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
    {contactDialogOpen && currentUser && <BookingContactDialog currentUser={currentUser} onCancel={() => setContactDialogOpen(false)} onComplete={(updated) => { setCurrentUser(updated); setContactDialogOpen(false); void pay(); }} />}
    <div className="my-auto w-full max-w-xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
      <div className="bg-gradient-to-br from-[#861146] via-[#bd195c] to-[#e1146c] p-5 text-white sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <CheckoutBrand light />
          <button ref={focus} type="button" disabled={busy} onClick={onClose} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-white/40 px-3 text-xs font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"><ArrowLeft className="h-4 w-4" /> Quay lại</button>
        </div>
        <h2 id="payment-continue-title" className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">Tiếp tục thanh toán</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-pink-100">Kiểm tra lịch hẹn và số tiền trước khi mở mã QR thanh toán.</p>
      </div>
      <div className="space-y-5 p-5 sm:p-7">
        {busy && <p role="status" className="rounded-xl bg-pink-50 p-3 text-sm text-[#bd195c]">Đang chuẩn bị và xác minh phiên QR. Vui lòng chờ; bạn không cần bấm lại.</p>}
        {loading && <p role="status" className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Đang tải trạng thái từ máy chủ...</p>}
        {error && <p role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
        {booking && <>
          <section aria-label="Thông tin lịch hẹn" className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pink-100 text-[#bd195c]"><Store className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-semibold text-slate-500">Lịch hẹn {booking.bookingCode}</p><h3 className="mt-0.5 text-base font-bold text-slate-900">{booking.serviceName}</h3></div></div>
            <p className="mt-3 flex items-center gap-2 border-t border-slate-200 pt-3 text-sm text-slate-700"><CalendarDays className="h-4 w-4 text-[#bd195c]" />{booking.appointmentDate} lúc {booking.startTime.slice(0, 5)}</p>
          </section>
          {!canContinue && <p role="alert" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />Lịch hẹn chưa thể mở PayOS ({booking.paymentBlockerReason ?? booking.status}). Vui lòng kiểm tra lịch hẹn hoặc liên hệ hỗ trợ nếu cần đối soát.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-800">Hình thức thanh toán<select aria-label="Hình thức thanh toán" value={option} disabled={busy || !canContinue || booking.paymentAttemptActive === true} onChange={e => { setQuote(null); setOption(e.target.value as PaymentOption); }} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#bd195c] focus:outline-none focus:ring-2 focus:ring-pink-200 disabled:bg-slate-100 disabled:text-slate-500">
              {option === 'DEPOSIT_50' && <option value="DEPOSIT_50">Đặt cọc 50% (giao dịch cũ)</option>}
              <option value="DEPOSIT_05">Đặt cọc 5%</option><option value="FULL_100">Thanh toán 100%</option></select></label>
            <label className="text-sm font-semibold text-slate-800">Mã giảm giá<input aria-label="Voucher" maxLength={40} placeholder="Nhập mã nếu có" value={voucher} disabled={busy || !canContinue || booking.paymentAttemptActive === true} onChange={e => { setQuote(null); setVoucher(e.target.value); }} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 placeholder:text-slate-400 focus:border-[#bd195c] focus:outline-none focus:ring-2 focus:ring-pink-200 disabled:bg-slate-100 disabled:text-slate-500" /></label>
          </div>
          {booking.paymentAttemptActive && <p className="rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">Phiên PayOS đang hoạt động giữ nguyên hình thức thanh toán và mã giảm giá đã chọn.</p>}
          <section aria-label="Chi tiết thanh toán" className="overflow-hidden rounded-2xl border border-pink-200">
            <div className="space-y-2 p-4 text-sm"><div className="flex justify-between gap-3 text-slate-600"><span>Tổng giá dịch vụ</span><strong className="text-slate-900">{formatMoney(booking.totalAmount)}</strong></div><div className="flex justify-between gap-3 text-slate-600"><span>Còn lại tại salon</span><strong className="text-slate-900">{formatMoney(remaining)}</strong></div></div>
            <div className="flex items-center justify-between gap-3 bg-pink-50 px-4 py-4"><span className="text-sm font-bold text-[#861146]">Thanh toán trên PayOS</span><strong className="text-xl font-black text-[#bd195c]">{quoteLoading && !booking.paymentAttemptActive ? 'Đang xác minh' : formatMoney(amount)}</strong></div>
          </section>
          {quoteError && <p role="alert" className="text-sm font-medium text-rose-700">{quoteError}</p>}
          {displayedQuote && !displayedQuote.paymentAvailable && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Số tiền này chưa đạt mức tối thiểu của PayOS. Hãy chọn thanh toán 100% nếu tùy chọn đó hợp lệ.</p>}
          <button type="button" disabled={loading || busy || !canContinue || (!booking.paymentAttemptActive && (quoteLoading || Boolean(quoteError) || !displayedQuote?.paymentAvailable))} onClick={() => void pay()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#bd195c] px-5 text-sm font-bold text-white shadow-lg shadow-pink-200 transition hover:bg-[#9e174e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd195c] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none">{busy ? 'Đang kiểm tra...' : quoteLoading ? 'Đang xác minh giá...' : <>Mở thanh toán QR <ArrowRight className="h-4 w-4" /></>}</button>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500"><CreditCard className="mt-0.5 h-4 w-4 shrink-0" />Mã QR và thông tin nhận tiền được cung cấp bởi PayOS. BeautyLink tự kiểm tra trạng thái thanh toán.</p>
        </>}
        <button type="button" disabled={busy || loading} onClick={() => setRevision(n => n + 1)} className="mx-auto flex min-h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#bd195c] disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Làm mới trạng thái</button>
      </div>
    </div>
  </div>;
}
