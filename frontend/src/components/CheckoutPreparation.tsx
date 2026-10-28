import React, { useEffect, useRef } from 'react';
import { ArrowLeft, LoaderCircle, ShieldCheck } from 'lucide-react';
import { CheckoutBrand } from './CheckoutBrand';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import type { PaymentOption } from '../types/beauty';
export type PreparationStage = 'VALIDATING' | 'PROVIDER' | 'RECOVERING';
export function CheckoutPreparation({ serviceName, supplierName, bookingCode, amount, option, stage, onBack }: {
  serviceName: string; supplierName?: string; bookingCode?: string; amount?: number | null;
  option: PaymentOption; stage: PreparationStage; onBack: () => void;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  useBodyScrollLock(true);
  useEffect(() => { title.current?.focus(); }, []);
  const text = { VALIDATING: 'Đang kiểm tra lịch hẹn và quyền thanh toán', PROVIDER: 'Đang nhận chỉ dẫn thanh toán từ PayOS', RECOVERING: 'Đang tìm lại phiên thanh toán hiện có' }[stage];
  return <div role="dialog" aria-modal="true" aria-labelledby="checkout-preparing-title" data-checkout-state="PREPARING" aria-busy="true"
    className="fixed inset-0 z-[160] overflow-y-auto bg-[#fff7fa] text-slate-900" onKeyDown={event => {
      if(event.key === 'Escape') onBack();
      if(event.key === 'Tab') { event.preventDefault(); (event.currentTarget.querySelector('button') as HTMLButtonElement)?.focus(); }
    }}>
    <header className="border-b border-pink-100 bg-white px-4 py-3"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3"><CheckoutBrand /><ShieldCheck aria-label="Thanh toán được xác minh bởi máy chủ" className="h-5 w-5 text-[#bd195c]" /></div></header>
    <main className="mx-auto max-w-5xl p-4 sm:py-10">
      <button type="button" onClick={onBack} className="mb-6 flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-slate-600 hover:bg-pink-100 focus-visible:outline-2 focus-visible:outline-[#bd195c]"><ArrowLeft className="h-4 w-4" /> Quay lại lịch hẹn</button>
      <h1 id="checkout-preparing-title" tabIndex={-1} ref={title} className="mb-6 text-2xl font-black outline-none sm:text-4xl">Chuẩn bị thanh toán</h1>
      <div className="grid overflow-hidden rounded-[28px] border border-pink-100 bg-white shadow-sm md:grid-cols-2">
        <section className="flex flex-col items-center bg-pink-50/50 p-6 text-center sm:p-8">
          <div aria-hidden="true" className="grid aspect-square w-full max-w-[300px] place-items-center rounded-3xl bg-slate-100 motion-safe:animate-pulse"><LoaderCircle className="h-12 w-12 text-pink-300 motion-safe:animate-spin" /></div>
          <p role="status" aria-live="polite" className="mt-5 text-sm font-semibold text-[#bd195c]">{text}</p>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-500">Mã QR sẽ hiện tại đây khi máy chủ xác minh xong. Bạn không cần bấm thanh toán lần nữa.</p>
        </section>
        <section className="min-w-0 p-6 sm:p-8"><p className="text-xs font-semibold text-slate-500">{bookingCode ? `Lịch hẹn ${bookingCode}` : 'Lịch hẹn đang được xác nhận'}</p><h2 className="mt-2 break-words text-lg font-bold">{serviceName}</h2><p className="mt-1 break-words text-sm text-slate-500">{supplierName}</p><p className="mt-6 text-sm text-slate-500">{option === 'FULL_100' ? 'Thanh toán toàn bộ' : option === 'DEPOSIT_50' ? 'Đặt cọc 50% · giao dịch cũ' : 'Đặt cọc 5%'}</p><p className="mt-1 whitespace-nowrap text-3xl font-black text-[#bd195c]">{amount == null ? 'Đang xác minh' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}</p><p className="mt-6 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">Chưa có chỉ dẫn chuyển khoản. BeautyLink chỉ hiển thị tài khoản và QR sau khi phiên đủ điều kiện; không chuyển tiền theo thông tin từ bên ngoài.</p></section>
      </div>
    </main>
  </div>;
}
