import React from 'react';

/** Official artwork, shared by the booking and QR checkout surfaces. */
export function CheckoutBrand({ light = false }: { light?: boolean }) {
  return <span className="inline-flex min-w-0 items-center gap-2.5" data-checkout-brand>
    <img src="/beautylink-icon.png" alt="" width={44} height={44} className="h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11" />
    <span className="min-w-0 text-left">
      <span className={`block whitespace-nowrap text-xl font-black tracking-tight sm:text-2xl ${light ? 'text-white' : 'text-slate-900'}`}>Beauty<span className={light ? 'text-pink-100' : 'text-[#e1146c]'}>Link</span></span>
      <span className={`block whitespace-nowrap text-[8px] font-semibold uppercase tracking-widest sm:text-[9px] ${light ? 'text-pink-100' : 'text-[#b42d58]'}`}>Sắc đẹp & spa uy tín</span>
    </span>
  </span>;
}
