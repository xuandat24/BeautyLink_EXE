import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ShoppingBag, Trash2, X } from 'lucide-react';
import { HotDeal } from '../data/mockData';
import { useLanguage } from '../lib/language';

export interface CartItem { deal: HotDeal; quantity: number; }

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, items, onRemoveItem, onClearCart, onCheckout }) => {
  const { text } = useLanguage();
  const [voucherCode, setVoucherCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(0);
  const [voucherMessage, setVoucherMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const subtotal = items.reduce((sum, item) => sum + item.deal.salePrice * item.quantity, 0);
  const finalTotal = Math.max(0, subtotal - discountApplied);
  const formatVND = (price: number) => `${new Intl.NumberFormat('vi-VN').format(price)}đ`;
  const applyVoucher = () => {
    const code = voucherCode.trim().toUpperCase();
    if (code === 'BEAUTYPINK50') { setDiscountApplied(50000); setVoucherMessage(text('Áp dụng thành công: Giảm 50.000đ!', 'Applied: 50,000đ off!')); return; }
    if (code === 'SPASEN100') { setDiscountApplied(100000); setVoucherMessage(text('Áp dụng thành công: Giảm 100.000đ!', 'Applied: 100,000đ off!')); return; }
    setDiscountApplied(0); setVoucherMessage('Mã voucher không hợp lệ hoặc đã hết hạn.');
  };

  return createPortal(
    <div className="fixed inset-0 z-[200]" role="presentation">
      <button type="button" aria-label={text('Đóng giỏ dịch vụ', 'Close service cart')} onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-slate-950/60 backdrop-blur-sm" />
      <aside role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title" className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200">
        <header className="flex shrink-0 items-center justify-between border-b border-pink-100 bg-pink-50/60 p-4 sm:p-5">
          <div className="flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-[#EB0F51]" /><h2 id="cart-drawer-title" className="text-base font-extrabold text-slate-800">{text('Dịch vụ đã chọn', 'Selected services')} ({items.length})</h2></div>
          <button type="button" onClick={onClose} aria-label={text('Đóng giỏ dịch vụ', 'Close service cart')} className="relative z-10 rounded-full p-2 text-slate-600 transition hover:bg-pink-100 focus:outline-none focus:ring-2 focus:ring-[#EB0F51]"><X className="h-5 w-5" /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
          {items.length === 0 ? <div className="flex flex-col items-center justify-center py-16 text-center"><div className="mb-3 grid h-16 w-16 place-items-center rounded-full bg-pink-50"><ShoppingBag className="h-8 w-8 text-pink-300" /></div><h3 className="text-sm font-bold text-slate-700">{text('Giỏ dịch vụ đang trống', 'Your service cart is empty')}</h3><p className="mt-1 max-w-xs text-xs text-slate-400">{text('Khám phá dịch vụ và thêm lựa chọn yêu thích để đặt lịch.', 'Explore services and add your favorites to start booking.')}</p><button type="button" onClick={onClose} className="mt-5 rounded-full bg-[#EB0F51] px-5 py-2.5 text-xs font-black text-white">{text('Tiếp tục khám phá', 'Continue browsing')}</button></div> : items.map((item) => <article key={item.deal.id} className="flex items-center gap-3 rounded-2xl border border-pink-100 bg-pink-50/30 p-3">
            <img src={item.deal.image} alt={item.deal.title} className="h-16 w-16 shrink-0 rounded-xl border border-pink-200 object-cover" />
            <div className="min-w-0 flex-1"><span className="text-[10px] font-bold text-[#B42D58]">{item.deal.brandName}</span><h3 className="line-clamp-2 text-xs font-bold text-slate-800">{item.deal.title}</h3><div className="mt-1 flex items-baseline gap-2"><span className="text-xs font-black text-[#EB0F51]">{formatVND(item.deal.salePrice)}</span><span className="text-[10px] text-slate-400 line-through">{formatVND(item.deal.originalPrice)}</span></div></div>
            <button type="button" onClick={() => onRemoveItem(item.deal.id)} aria-label={`${text('Xóa', 'Remove')} ${item.deal.title}`} className="relative z-10 shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-300"><Trash2 className="h-4 w-4" /></button>
          </article>)}
        </div>

        {items.length > 0 && <footer className="shrink-0 space-y-3 border-t border-pink-100 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between"><p className="text-xs font-black text-slate-700">{text('Mã ưu đãi', 'Voucher code')}</p><button type="button" onClick={onClearCart} className="text-[11px] font-bold text-rose-600 hover:underline">{text('Xóa toàn bộ', 'Clear all')}</button></div>
          <div className="flex gap-2"><input type="text" placeholder={text('Ví dụ: BEAUTYPINK50', 'Example: BEAUTYPINK50')} value={voucherCode} onChange={(event) => setVoucherCode(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-pink-200 px-3 py-2 text-xs uppercase focus:border-[#EB0F51] focus:outline-none" /><button type="button" onClick={applyVoucher} className="rounded-xl bg-pink-100 px-4 py-2 text-xs font-bold text-[#B42D58] hover:bg-pink-200">{text('Áp dụng', 'Apply')}</button></div>
          {voucherMessage && <p className={`text-[11px] font-semibold ${discountApplied > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{voucherMessage}</p>}
          <div className="space-y-1.5 border-t border-pink-50 pt-3 text-xs text-slate-600"><div className="flex justify-between"><span>{text('Tạm tính', 'Subtotal')} ({items.length} {text('dịch vụ', 'services')})</span><span>{formatVND(subtotal)}</span></div>{discountApplied > 0 && <div className="flex justify-between font-semibold text-[#EB0F51]"><span>{text('Voucher giảm giá', 'Voucher discount')}</span><span>-{formatVND(discountApplied)}</span></div>}<div className="flex justify-between border-t border-pink-100 pt-2 text-sm font-extrabold text-slate-800"><span>{text('Tổng thanh toán', 'Total')}</span><span className="text-base text-[#EB0F51]">{formatVND(finalTotal)}</span></div></div>
          <button type="button" onClick={onCheckout} className="flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#EB0F51] via-[#D28474] to-[#B42D58] py-3 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-pink-600/30 hover:opacity-95"><span>{text('Xác nhận & tiến hành đặt lịch', 'Continue to booking')}</span><ArrowRight className="h-4 w-4" /></button>
        </footer>}
      </aside>
    </div>,
    document.body,
  );
};
