import React, { useEffect, useRef, useState } from 'react';
import { beautyApi, getAccessToken, getApiErrorMessage } from '../services/beautyApi';
import { useBeautyStore } from '../store/beautyStore';
import { canPayBooking, safeCheckout } from '../lib/bookingPolicy';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import type { BackendBooking } from '../types';

export function PaymentContinuationDialog({ bookingId, onClose }: { bookingId: number; onClose: () => void }) {
  const { currentUser } = useBeautyStore();
  const [sessionRevision, setSessionRevision] = useState(0);
  const session = `${getAccessToken() ?? ''}:${currentUser?.id ?? ''}:${sessionRevision}`;
  const [booking, setBooking] = useState<BackendBooking | null>(null);
  const [option, setOption] = useState<'DEPOSIT_50' | 'FULL_100'>('DEPOSIT_50');
  const [voucher, setVoucher] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0); const submitting = useRef(false); const latestId = useRef(bookingId); latestId.current = bookingId;
  const focus = useRef<HTMLButtonElement>(null);
  useBodyScrollLock(true);
  useEffect(() => { const changed = () => setSessionRevision(n => n + 1); window.addEventListener('storage', changed); return () => window.removeEventListener('storage', changed); }, []);
  useEffect(() => {
    const version = ++generation.current, token = getAccessToken();
    setBooking(null); setError(''); setLoading(true); focus.current?.focus();
    setBusy(submitting.current);
    if (!token) { setLoading(false); setError('Vui lòng đăng nhập lại để tiếp tục thanh toán.'); return; }
    beautyApi.myBooking(bookingId).then(data => {
      if (version !== generation.current || token !== getAccessToken()) return;
      if (data.id !== bookingId) throw new Error('Máy chủ trả về lịch hẹn không khớp.');
      setBooking(data); setOption(data.paymentOption ?? 'DEPOSIT_50'); setVoucher(data.paymentVoucherCode ?? '');
    }).catch(err => { if (version === generation.current && token === getAccessToken()) setError(getApiErrorMessage(err, 'Không tải được lịch hẹn.')); })
      .finally(() => { if (version === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [bookingId, session, revision]);
  const pay = async () => {
    if (submitting.current || !booking || !canPayBooking(booking)) return;
    submitting.current = true; setBusy(true); setError('');
    const version = generation.current, token = getAccessToken();
    const current = () => version === generation.current && bookingId === latestId.current && token !== null && token === getAccessToken();
    const execute = async () => {
      const fresh = await beautyApi.myBooking(bookingId);
      if (!current()) return;
      if (fresh.id !== bookingId) throw new Error('Máy chủ trả về lịch hẹn không khớp.');
      if (!canPayBooking(fresh)) { setBooking(fresh); throw new Error('Lịch hẹn không còn được phép thanh toán. Vui lòng làm mới hoặc liên hệ hỗ trợ.'); }
      // Options are from server or explicit customer input, never restored browser payment data.
      const payment = await beautyApi.createPayOSPayment(bookingId, { paymentOption: option, voucherCode: voucher.trim() || undefined });
      if (!current()) return;
      const url = safeCheckout(payment, bookingId);
      if (!url) throw new Error('Chưa có checkout an toàn. Không thanh toán lại; vui lòng làm mới hoặc liên hệ hỗ trợ.');
      sessionStorage.setItem('beautylink_payos_order_code', String(payment.orderCode));
      window.location.assign(url);
    };
    try {
      if (!current()) return;
      if (typeof navigator !== 'undefined' && navigator.locks?.request) await navigator.locks.request(`beautylink-payment-${bookingId}`, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error('Lịch hẹn đang được thanh toán ở tab khác.'); await execute();
      });
      else await execute(); // DB root locks/ledger still enforce idempotency across all browsers.
    } catch (err) { if (current()) { setBooking(null); setError(getApiErrorMessage(err, 'Không thể tiếp tục thanh toán.')); } }
    finally { submitting.current = false; if (generation.current > 0) setBusy(false); }
  };
  return <div className="fixed inset-0 z-[140] grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="payment-continue-title"
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
    <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6">
      <h2 id="payment-continue-title" className="text-xl font-black">Tiếp tục thanh toán lịch hẹn</h2>
      <button ref={focus} type="button" disabled={busy} onClick={onClose}>Quay lại</button>
      {loading && <p role="status">Đang tải trạng thái từ máy chủ...</p>}
      {error && <p role="alert" className="text-rose-700">{error}</p>}
      {booking && <><p>{booking.bookingCode} — {booking.serviceName}</p><p>{booking.appointmentDate} {booking.startTime.slice(0, 5)} — {booking.totalAmount.toLocaleString('vi-VN')}đ</p>
        {!canPayBooking(booking) && <p role="alert">Lịch hẹn không thể mở checkout ({booking.paymentBlockerReason ?? booking.status}). Vui lòng liên hệ hỗ trợ khi cần đối soát.</p>}
        <label className="block">Hình thức thanh toán<select aria-label="Hình thức thanh toán" value={option} disabled={busy || !canPayBooking(booking) || booking.paymentAttemptActive === true} onChange={e => setOption(e.target.value as typeof option)}>
          <option value="DEPOSIT_50">Đặt cọc 50%</option><option value="FULL_100">Thanh toán 100%</option></select></label>
        <label className="block">Voucher<input aria-label="Voucher" maxLength={40} value={voucher} disabled={busy || !canPayBooking(booking) || booking.paymentAttemptActive === true} onChange={e => setVoucher(e.target.value)} /></label>
        {booking.paymentAttemptActive && <p>Phiên đang hoạt động giữ nguyên hình thức thanh toán/voucher; không tạo lại link để thay đổi.</p>}
        <button type="button" disabled={loading || busy || !canPayBooking(booking)} onClick={() => void pay()} className="rounded-xl bg-pink-600 p-3 text-white">{busy ? 'Đang kiểm tra...' : 'Tiếp tục tới PayOS'}</button>
      </>}
      <button type="button" disabled={busy || loading} onClick={() => setRevision(n => n + 1)}>Làm mới trạng thái</button>
    </div>
  </div>;
}
