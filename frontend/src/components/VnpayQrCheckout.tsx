import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, LoaderCircle, LockKeyhole, QrCode, ShieldCheck, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { useLanguage } from '../lib/language';

interface VnpayQrCheckoutProps {
  serviceName: string;
  supplierName: string;
  amount: number;
  appointmentDate: string;
  appointmentTime: string;
  paymentReference: string;
  submitting: boolean;
  error?: string;
  onBack: () => void;
  onConfirm: () => void;
}

const formatMoney = (amount: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
}).format(amount);

const formatCountdown = (seconds: number) => {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
};

export const VnpayQrCheckout: React.FC<VnpayQrCheckoutProps> = ({
  serviceName,
  supplierName,
  amount,
  appointmentDate,
  appointmentTime,
  paymentReference,
  submitting,
  error,
  onBack,
  onConfirm,
}) => {
  const { language, text } = useLanguage();
  const [qrImage, setQrImage] = useState('');
  const [qrError, setQrError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);

  const qrPayload = useMemo(() => JSON.stringify({
    provider: 'VNPAY-QR',
    merchant: 'BEAUTYLINK_DEMO',
    reference: paymentReference,
    amount,
    currency: 'VND',
    demo: true,
  }), [amount, paymentReference]);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrPayload, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#172033', light: '#FFFFFF' },
    })
      .then((value) => { if (active) setQrImage(value); })
      .catch(() => { if (active) setQrError(text('Không thể tạo mã QR demo.', 'Could not create the demo QR code.')); });
    return () => { active = false; };
  }, [qrPayload, text]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => current > 0 ? current - 1 : 0);
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const expired = secondsLeft === 0;
  const displayDate = new Date(`${appointmentDate}T00:00:00`).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-GB');

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-[#f3f6fb]" role="dialog" aria-modal="true" aria-labelledby="vnpay-title">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <ArrowLeft className="h-4 w-4" /> {text('Quay lại', 'Back')}
          </button>
          <div className="flex items-center gap-3" aria-label="VNPAY QR">
            <span className="text-2xl font-black italic tracking-tight text-[#005baa]">VN<span className="text-[#ed1c24]">PAY</span></span>
            <span className="rounded-md bg-[#005baa] px-2 py-1 text-xs font-black text-white">QR</span>
          </div>
          <span className="hidden items-center gap-1.5 text-xs font-bold text-emerald-700 sm:inline-flex"><LockKeyhole className="h-4 w-4" /> {text('Kết nối an toàn', 'Secure checkout')}</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs font-semibold leading-5 text-amber-800">
          {text('MÔ PHỎNG VNPAY-QR — Mã này không thu tiền thật. Nhấn xác nhận bên dưới để hoàn tất lịch hẹn demo.', 'VNPAY-QR DEMO — This code does not charge real money. Confirm below to complete the demo booking.')}
        </div>

        <div className="grid overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="p-5 sm:p-8 lg:border-r lg:border-slate-100">
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#005baa]">{text('Quét mã thanh toán', 'Scan to pay')}</p>
              <h1 id="vnpay-title" className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">{text('Thanh toán qua VNPAY‑QR', 'Pay with VNPAY-QR')}</h1>
              <p className="mt-2 text-sm text-slate-500">{text('Mở Mobile Banking hoặc Ví VNPAY và chọn chức năng quét QR.', 'Open Mobile Banking or VNPAY Wallet and select Scan QR.')}</p>
            </div>

            <div className="mx-auto mt-6 w-fit rounded-[1.75rem] border-2 border-[#005baa]/15 bg-white p-3 shadow-lg shadow-blue-900/10">
              <div className="relative grid h-64 w-64 place-items-center overflow-hidden rounded-2xl bg-slate-50 sm:h-72 sm:w-72">
                {qrImage ? <img src={qrImage} alt={text('Mã VNPAY-QR mô phỏng', 'Simulated VNPAY-QR code')} className="h-full w-full" /> : qrError ? <p className="px-6 text-center text-sm font-semibold text-rose-600">{qrError}</p> : <LoaderCircle className="h-8 w-8 animate-spin text-[#005baa]" />}
                {qrImage && <span className="pointer-events-none absolute grid h-12 w-12 place-items-center rounded-xl border-4 border-white bg-[#005baa] text-[10px] font-black text-white shadow">VNPAY</span>}
              </div>
            </div>

            <div className="mt-5 text-center">
              <p className="text-xs font-semibold text-slate-500">{text('Giao dịch hết hạn sau', 'Payment expires in')}</p>
              <p className={`mt-1 font-mono text-2xl font-black tracking-wider ${expired ? 'text-rose-600' : 'text-[#ed1c24]'}`}>{formatCountdown(secondsLeft)}</p>
              {expired && <p className="mt-2 text-xs font-bold text-rose-600">{text('Mã đã hết hạn. Hãy quay lại để tạo mã mới.', 'The code has expired. Go back to generate a new one.')}</p>}
            </div>

            <ol className="mx-auto mt-7 grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                [Smartphone, text('Mở ứng dụng', 'Open your app'), text('Mobile Banking hoặc Ví VNPAY', 'Mobile Banking or VNPAY Wallet')],
                [QrCode, text('Quét mã QR', 'Scan the QR'), text('Chọn QR Pay và quét mã', 'Select QR Pay and scan')],
                [CheckCircle2, text('Xác nhận', 'Confirm'), text('Kiểm tra rồi xác nhận giao dịch', 'Review and confirm payment')],
              ].map(([Icon, title, detail], index) => {
                const StepIcon = Icon as typeof Smartphone;
                return <li key={String(title)} className="rounded-2xl bg-slate-50 p-3 text-left"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-[#005baa]"><StepIcon className="h-4 w-4" /></span><strong className="text-xs text-slate-800">{index + 1}. {String(title)}</strong></div><p className="mt-2 text-[11px] leading-4 text-slate-500">{String(detail)}</p></li>;
              })}
            </ol>
          </section>

          <aside className="bg-slate-50/70 p-5 sm:p-8">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">{text('Thông tin giao dịch', 'Transaction details')}</p>
              <dl className="mt-5 space-y-4 text-sm">
                <div><dt className="text-xs font-semibold text-slate-400">{text('Dịch vụ', 'Service')}</dt><dd className="mt-1 font-black text-slate-900">{serviceName}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-400">{text('Nhà cung cấp', 'Provider')}</dt><dd className="mt-1 font-bold text-slate-700">{supplierName}</dd></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><dt className="flex items-center gap-1 text-xs font-semibold text-slate-400"><CalendarDays className="h-3.5 w-3.5" />{text('Ngày hẹn', 'Date')}</dt><dd className="mt-1 font-bold text-slate-700">{displayDate}</dd></div>
                  <div><dt className="flex items-center gap-1 text-xs font-semibold text-slate-400"><Clock3 className="h-3.5 w-3.5" />{text('Giờ hẹn', 'Time')}</dt><dd className="mt-1 font-bold text-slate-700">{appointmentTime}</dd></div>
                </div>
                <div><dt className="text-xs font-semibold text-slate-400">{text('Mã thanh toán', 'Payment reference')}</dt><dd className="mt-1 break-all font-mono text-xs font-bold text-slate-700">{paymentReference}</dd></div>
              </dl>
              <div className="mt-5 flex items-end justify-between gap-3 border-t border-dashed border-slate-200 pt-5"><span className="text-sm font-bold text-slate-500">{text('Tổng thanh toán', 'Total')}</span><strong className="text-2xl font-black text-[#ed1c24]">{formatMoney(amount)}</strong></div>
            </div>

            <div className="mt-4 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs leading-5 text-blue-800"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p>{text('BeautyLink không yêu cầu số thẻ, mật khẩu ngân hàng hoặc mã OTP trên trang này.', 'BeautyLink never asks for your card number, banking password, or OTP on this page.')}</p></div>
            {(error || qrError) && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error || qrError}</p>}

            <button type="button" onClick={onConfirm} disabled={submitting || expired || !qrImage} className="mt-5 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#005baa] px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-[#004b8d] focus:outline-none focus:ring-2 focus:ring-[#005baa] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              {submitting ? text('Đang xác nhận...', 'Confirming...') : text('Tôi đã quét và thanh toán', 'I scanned and paid')}
            </button>
            <button type="button" onClick={onBack} disabled={submitting} className="mt-2 w-full rounded-xl py-3 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50">{text('Hủy và quay lại lịch hẹn', 'Cancel and return to booking')}</button>
          </aside>
        </div>
      </main>
    </div>
  );
};
