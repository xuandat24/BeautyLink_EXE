import { CheckoutBrand } from './CheckoutBrand';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, Copy, Download, QrCode, RefreshCw, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { beautyApi, getAccessToken } from '../services/beautyApi';
import { safeCheckout } from '../lib/bookingPolicy';
import { payableAttempt, freshObservation, recordCheckoutDuration, retryDelay, samePayment, usableProviderQr, type QRCheckoutState } from '../lib/payosCheckout';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { subscribeSession } from '../lib/authSession';
import type { BackendBooking, PayOSPayment } from '../types/beauty';
const money = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);
const banks: Record<string, string> = { '970422': 'MB Bank', '970436': 'Vietcombank', '970418': 'BIDV', '970415': 'VietinBank', '970407': 'Techcombank', '970416': 'ACB' };

export function PayOSCheckoutPage({ initialPayment, booking, onBack }: { initialPayment: PayOSPayment; booking?: BackendBooking | null; onBack: () => void }) {
  const [payment, setPayment] = useState(initialPayment);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [now, setNow] = useState(Date.now());
  const [revision, setRevision] = useState(0);
  const [session] = useState(getAccessToken);
  const [verified, setVerified] = useState(() => freshObservation(initialPayment, session) && payableAttempt(initialPayment, initialPayment.bookingId) && usableProviderQr(initialPayment.qrCode, initialPayment.amount));
  const [checking, setChecking] = useState(!verified);
  const title = useRef<HTMLHeadingElement>(null);
  const autoRetryAllowed = useRef(true), reportedStatus = useRef('');
  const verifiedByStatus = useRef(false);
  useBodyScrollLock(true);
  useEffect(() => subscribeSession(() => {
    if (session !== getAccessToken()) { setError('Phiên đăng nhập đã thay đổi. Vui lòng quay lại lịch hẹn.'); setQr(''); }
  }), [session]);
  useEffect(() => { title.current?.focus(); const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  useEffect(() => {
    let active = true; let timer: number | undefined; let failures = 0;
    const controller = new AbortController();
    autoRetryAllowed.current = true;
    const verify = async () => {
      if (!active) return;
      if (!session || session !== getAccessToken()) { setError('Phiên đăng nhập đã thay đổi. Vui lòng quay lại lịch hẹn.'); setChecking(false); return; }
      setChecking(true);
      let delay = 5000;
      try {
        const fresh = await beautyApi.payOSPaymentStatus(String(initialPayment.orderCode), controller.signal);
        if (!active) return;
        if (session !== getAccessToken()) { setError('Phiên đăng nhập đã thay đổi. Vui lòng quay lại lịch hẹn.'); return; }
        if (!samePayment(fresh, initialPayment)) { autoRetryAllowed.current = false; setError('Thông tin giao dịch không khớp. Không chuyển tiền; vui lòng liên hệ hỗ trợ.'); return; }
        if (typeof fresh.checkoutAllowed !== 'boolean' || typeof fresh.verificationPending !== 'boolean') {
          autoRetryAllowed.current = false; setError('Máy chủ chưa hỗ trợ xác minh phiên QR này. Vui lòng quay lại lịch hẹn và thử sau khi hệ thống cập nhật.'); return;
        }
        setPayment(fresh); setVerified(true);
        if (fresh.verificationPending && !fresh.requiresManualReview && fresh.status !== 'REVIEW_REQUIRED') throw new Error('Provider verification deferred');
        verifiedByStatus.current = true;
        setError(''); failures = 0;
        if (fresh.status !== 'PENDING' || fresh.requiresManualReview) {
          const key = `${fresh.status}:${fresh.requiresManualReview}`;
          if (reportedStatus.current !== key) { reportedStatus.current = key; window.dispatchEvent(new window.Event('beautylink-bookings-refresh')); }
          return;
        }
      } catch (failure) {
        if (!active) return;
        const status = (failure as { response?: { status?: number } })?.response?.status;
        setError(status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại từ lịch hẹn.' : status === 403 ? 'Bạn không có quyền truy cập giao dịch này.' : 'Chưa xác minh được giao dịch. Kiểm tra lại trạng thái trước khi chuyển tiền.');
        failures++;
        if (status === 401 || status === 403 || (status && status < 500 && status !== 429)) { autoRetryAllowed.current = false; return; }
        if (failures >= 5) return;
        delay = retryDelay(failure, failures);
      }
      finally { if (active) setChecking(false); }
      if (active) timer = window.setTimeout(verify, delay);
    };
    if (revision === 0 && freshObservation(initialPayment, session) && payableAttempt(initialPayment, initialPayment.bookingId)
        && usableProviderQr(initialPayment.qrCode, initialPayment.amount)) {
      setChecking(false); timer = window.setTimeout(verify, 5000);
    } else void verify();
    return () => { active = false; controller.abort(); if (timer !== undefined) window.clearTimeout(timer); };
  }, [initialPayment.bookingId, initialPayment.orderCode, initialPayment.paymentLinkId, session, revision]);
  useEffect(() => {
    const reconnect = () => { if (autoRetryAllowed.current && session === getAccessToken()) setRevision(value => value + 1); };
    const visible = () => { setNow(Date.now()); if (document.visibilityState === 'visible') reconnect(); };
    window.addEventListener('online', reconnect); document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener('online', reconnect); document.removeEventListener('visibilitychange', visible); };
  }, [session]);
  const expiry = Date.parse(payment.expiresAt);
  const seconds = Number.isFinite(expiry) ? Math.max(0, Math.ceil((expiry - now) / 1000)) : 0;
  const manual = payment.requiresManualReview || payment.status === 'REVIEW_REQUIRED';
  const paid = verified && payment.status === 'PAID' && !manual && session === getAccessToken() && !error;
  const pending = verified && !error && session === getAccessToken() && payableAttempt(payment, initialPayment.bookingId, now)
    && (verifiedByStatus.current || payment.instructionsFreshForMs === undefined || freshObservation(payment, session));
  const ready = pending && usableProviderQr(payment.qrCode, payment.amount);
  const state: QRCheckoutState = error || session !== getAccessToken() ? 'NETWORK_ERROR' : !verified ? 'INITIALIZING' : manual ? 'REVIEW_REQUIRED' : paid ? 'PAID'
    : payment.status === 'EXPIRED' ? 'EXPIRED' : payment.status === 'CANCELLED' || payment.status === 'FAILED' ? 'CANCELLED' : !pending ? 'VERIFYING' : ready ? 'PENDING' : 'QR_UNAVAILABLE';
  const stateTitle: Record<QRCheckoutState, string> = { INITIALIZING: 'Đang tải chỉ dẫn thanh toán', PENDING: 'Chờ thanh toán', VERIFYING: 'Đang đối soát giao dịch', NETWORK_ERROR: 'Cần kiểm tra trạng thái', QR_UNAVAILABLE: 'Chưa có chỉ dẫn QR tại BeautyLink', PAID: 'Thanh toán thành công', EXPIRED: 'PayOS đã xác nhận hết hạn', CANCELLED: 'PayOS đã xác nhận đóng phiên', REVIEW_REQUIRED: 'Giao dịch cần đối soát' };
  useEffect(() => {
    let active = true; setQr('');
    const qrStarted = performance.now();
    if (ready && payment.qrCode) QRCode.toDataURL(payment.qrCode, { width: 720, margin: 4, errorCorrectionLevel: 'M' }).then(v => { if (active) { recordCheckoutDuration('beautylink-qr-render', qrStarted); setQr(v); } }).catch(() => { if (active) setError('Không thể hiển thị QR. Vui lòng kiểm tra lại trạng thái.'); });
    return () => { active = false; };
  }, [ready, payment.qrCode]);
  const copy = async (label: string, value: string) => {
    if (!ready || session !== getAccessToken()) return;
    try { await navigator.clipboard.writeText(value); setFeedback(`Đã sao chép ${label.toLowerCase()}.`); }
    catch { setFeedback('Không thể sao chép tự động. Bạn có thể chọn thông tin bên dưới để sao chép.'); }
  };
  const rows = [['Ngân hàng', payment.bankBin ? banks[payment.bankBin] ?? `Ngân hàng BIN ${payment.bankBin}` : ''], ['Chủ tài khoản', payment.bankAccountName ?? ''], ['Số tài khoản', payment.bankAccountNumber ?? ''], ['Số tiền', String(payment.amount)], ['Nội dung chuyển khoản', payment.transferDescription ?? '']];
  return <div role="dialog" aria-modal="true" aria-labelledby="payos-checkout-title" data-checkout-state={state} className="fixed inset-0 z-[160] overflow-y-auto bg-[#fff7fa] text-slate-900" onKeyDown={e => {
    if (e.key === 'Escape') onBack();
    if (e.key === 'Tab') {
      const nodes = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')];
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === title.current)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }}>
    <header className="sticky top-0 z-10 border-b border-pink-100 bg-white/95 px-4 py-3 backdrop-blur-sm"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3"><CheckoutBrand /><span className="flex items-center gap-2 text-xs font-semibold text-slate-500"><ShieldCheck className="h-4 w-4 text-[#bd195c]" /> PayOS bảo mật</span></div></header>
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <button type="button" onClick={onBack} className="mb-6 flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-slate-600 hover:bg-pink-100"><ArrowLeft className="h-4 w-4" /> Quay lại lịch hẹn</button>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#bd195c]">Lịch hẹn {payment.bookingCode}</p><h1 ref={title} tabIndex={-1} id="payos-checkout-title" className="text-2xl font-black tracking-tight outline-none sm:text-4xl">{paid ? 'Đã xác nhận thanh toán' : 'Thanh toán lịch hẹn'}</h1><p className="mt-3 text-sm leading-relaxed text-slate-500">Quét mã bằng ứng dụng ngân hàng hoặc chuyển khoản theo thông tin bên dưới.</p></div>{pending && <div className="flex items-center gap-2 rounded-full border border-pink-200 bg-white px-4 py-3 text-sm"><Clock3 className="h-4 w-4 text-[#bd195c]" /> Còn <strong className="tabular-nums text-[#bd195c]">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</strong></div>}</div>
      {ready ? <div className="grid overflow-hidden rounded-[28px] border border-pink-100 bg-white shadow-xl shadow-pink-100/60 md:grid-cols-2">
        <section className="flex flex-col items-center border-b border-pink-100 bg-gradient-to-b from-pink-50/70 to-white p-6 text-center sm:p-8 md:border-b-0 md:border-r"><h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#bd195c]"><QrCode className="h-5 w-5" /> Quét mã để thanh toán</h2><p className="mb-5 text-xs text-slate-500">Mở ứng dụng ngân hàng hỗ trợ VietQR</p><div className="w-full max-w-[300px] rounded-3xl border border-pink-100 bg-white p-1 shadow-sm">{qr ? <img src={qr} alt={`Mã QR PayOS cho lịch hẹn ${payment.bookingCode}`} width="300" height="300" className="h-auto w-full rounded-2xl" /> : <div role="status" className="grid aspect-square place-items-center text-sm text-slate-500">Đang tạo ảnh QR…</div>}</div>{qr && <a href={qr} download={`BeautyLink-${payment.bookingCode}.png`} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-pink-200 px-5 text-sm font-semibold text-[#bd195c] hover:bg-pink-50"><Download className="h-4 w-4" /> Lưu mã QR</a>}<p className="mt-4 max-w-xs text-xs leading-relaxed text-slate-500">Dùng điện thoại này? Lưu mã QR rồi chọn ảnh trong ứng dụng ngân hàng.</p></section>
        <section className="min-w-0 p-6 sm:p-8">
          {booking?.id === payment.bookingId && <div className="mb-5 border-b border-slate-100 pb-4"><h2 className="break-words text-lg font-bold">{booking.serviceName}</h2><p className="mt-1 break-words text-sm text-slate-500">{booking.supplierName}</p><p className="mt-3 text-sm text-slate-600">Giá dịch vụ: <strong className="whitespace-nowrap">{money(booking.totalAmount)}</strong></p></div>}
          <p className="text-sm font-medium text-slate-500">{payment.paymentOption === 'FULL_100' ? 'Thanh toán toàn bộ' : payment.paymentOption === 'DEPOSIT_50' ? 'Đặt cọc 50% · giao dịch cũ' : 'Đặt cọc 5%'}</p><p className="mt-1 whitespace-nowrap text-3xl font-black tracking-tight text-[#bd195c] sm:text-4xl">{money(payment.amount)}</p><p className="mt-2 text-xs text-slate-500">Còn lại tại salon: <strong className="whitespace-nowrap">{money(payment.remainingAmount)}</strong></p><dl className="mt-6 divide-y divide-slate-100">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className={`mt-1 break-all text-sm font-bold ${label === 'Nội dung chuyển khoản' ? 'text-[#bd195c]' : 'text-slate-900'}`}>{label === 'Số tiền' ? money(payment.amount) : value || 'PayOS chưa cung cấp thông tin này'}</dd></div>{value && label !== 'Ngân hàng' && <button type="button" aria-label={`Sao chép ${label.toLowerCase()}`} onClick={() => void copy(label, value)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-pink-50 text-[#bd195c] hover:bg-pink-100"><Copy className="h-4 w-4" /></button>}</div>)}</dl><p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">Chuyển đúng số tiền và nội dung do PayOS cung cấp. Nếu thiếu thông tin để chuyển thủ công, hãy dùng QR; không tự đoán nội dung hoặc tài khoản.</p></section>
      </div> : <section className="rounded-[28px] border border-pink-100 bg-white p-8 text-center shadow-sm"><CheckCircle2 className={`mx-auto mb-4 h-12 w-12 ${paid ? 'text-emerald-600' : 'text-[#bd195c]'}`} /><h2 className="text-xl font-bold">{stateTitle[state]}</h2><p role={error || manual ? 'alert' : 'status'} className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-600">{paid ? `Máy chủ đã xác nhận ${money(payment.amount)} cho lịch hẹn ${payment.bookingCode}.` : manual ? 'Liên hệ hỗ trợ từ lịch hẹn và không thanh toán lại.' : error || (state === 'INITIALIZING' ? 'Đang xác minh phiên hiện có với máy chủ, chưa hiển thị chỉ dẫn chuyển tiền.' : !pending ? 'Nếu đã chuyển tiền, hãy kiểm tra lại trạng thái. Đồng hồ hết giờ không xác định giao dịch thất bại.' : 'Đã kiểm tra phiên hiện có. API tra cứu của PayOS không cung cấp lại QR cho link cũ; không tạo phiên mới để thay thế. Bạn có thể dùng trang PayOS như phương án dự phòng.')}</p>{state === 'QR_UNAVAILABLE' && safeCheckout(payment, payment.bookingId) && <a className="mt-5 inline-flex rounded-full border border-pink-200 px-6 py-3 text-sm font-bold text-[#bd195c]" href={safeCheckout(payment, payment.bookingId)!}>Mở phiên trên PayOS</a>}</section>}
      <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-2xl border border-pink-100 bg-white px-5 py-4 sm:flex-row"><p role="status" className="text-sm text-slate-600">{paid ? 'Đã được máy chủ xác minh' : checking ? 'Đang kiểm tra trạng thái…' : error && autoRetryAllowed.current ? 'Đang tự kết nối lại; không cần mở phiên khác' : 'Trạng thái được kiểm tra tự động'}</p><button type="button" disabled={checking} onClick={() => setRevision(n => n + 1)} className="flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-bold text-[#bd195c] hover:bg-pink-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} /> Kiểm tra trạng thái</button></div><p role="status" aria-live="polite" className="mt-3 min-h-5 text-center text-sm text-[#bd195c]">{feedback}</p><p className="mt-4 text-center text-xs text-slate-500">Quay lại lịch hẹn không hủy phiên thanh toán. Chỉ máy chủ xác nhận kết quả từ PayOS.</p>
    </main>
  </div>;
}
