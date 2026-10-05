import React, { useState, useEffect } from 'react';
import { X, Trash2, ShoppingBag, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { HotDeal } from '../data/mockData';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export interface CartItem {
  deal: HotDeal;
  quantity: number;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onRemoveItem,
  onClearCart,
  onCheckout,
}) => {
  const [voucherCode, setVoucherCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(0);
  const [voucherMessage, setVoucherMessage] = useState('');

  // Lock body scroll when cart is open
  useBodyScrollLock(isOpen);

  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const subtotal = items.reduce(
    (sum, item) => sum + item.deal.salePrice * item.quantity,
    0
  );

  const applyVoucher = () => {
    if (voucherCode.trim().toUpperCase() === 'BEAUTYPINK50') {
      setDiscountApplied(50000);
      setVoucherMessage('Áp dụng thành công: Giảm 50.000đ!');
    } else if (voucherCode.trim().toUpperCase() === 'SPASEN100') {
      setDiscountApplied(100000);
      setVoucherMessage('Áp dụng thành công: Giảm 100.000đ!');
    } else {
      setDiscountApplied(0);
      setVoucherMessage('Mã voucher không hợp lệ hoặc đã hết hạn.');
    }
  };

  const finalTotal = Math.max(0, subtotal - discountApplied);

  const formatVND = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Blurred & Dimmed Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Right Drawer Panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10 z-10">
        <div
          className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300 border-l border-pink-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-pink-100 flex items-center justify-between bg-pink-50/50">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#e1146c]" />
              <h3 className="text-base font-extrabold text-slate-800">
                Dịch vụ đã chọn ({items.length})
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-pink-100 text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            {items.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-pink-50 flex items-center justify-center text-[#e1146c] mb-3">
                  <ShoppingBag className="w-8 h-8 text-pink-300" />
                </div>
                <h4 className="text-sm font-bold text-slate-700">Giỏ dịch vụ đang trống</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Hãy khám phá mục Khuyến Mãi Hot và thêm các gói spa, chăm sóc da ưng ý!
                </p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.deal.id}
                  className="flex gap-3 p-3 rounded-2xl border border-pink-100 bg-pink-50/30 items-center justify-between"
                >
                  <img
                    src={item.deal.image}
                    alt={item.deal.title}
                    className="w-16 h-16 rounded-xl object-cover border border-pink-200"
                  />
                  <div className="flex-1 min-w-0 pr-2">
                    <span className="text-[10px] font-bold text-[#be185d]">
                      {item.deal.brandName}
                    </span>
                    <h5 className="text-xs font-bold text-slate-800 line-clamp-1">
                      {item.deal.title}
                    </h5>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-xs font-black text-[#e1146c]">
                        {formatVND(item.deal.salePrice)}
                      </span>
                      <span className="text-[10px] text-slate-400 line-through">
                        {formatVND(item.deal.originalPrice)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.deal.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Xóa khỏi giỏ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer & Checkout */}
          {items.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-pink-100 bg-white space-y-3">
              {/* Voucher Apply */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nhập mã voucher (vd: BEAUTYPINK50)"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-pink-200 uppercase focus:outline-none focus:border-[#e1146c]"
                />
                <button
                  type="button"
                  onClick={applyVoucher}
                  className="px-4 py-2 rounded-xl bg-pink-100 text-[#be185d] text-xs font-bold hover:bg-pink-200 transition-colors"
                >
                  Áp dụng
                </button>
              </div>

              {voucherMessage && (
                <p
                  className={`text-[11px] font-semibold ${
                    discountApplied > 0 ? 'text-emerald-600' : 'text-red-500'
                  }`}
                >
                  {voucherMessage}
                </p>
              )}

              {/* Price Breakdown */}
              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-pink-50">
                <div className="flex justify-between">
                  <span>Tạm tính ({items.length} dịch vụ):</span>
                  <span>{formatVND(subtotal)}</span>
                </div>
                {discountApplied > 0 && (
                  <div className="flex justify-between text-[#e1146c] font-semibold">
                    <span>Voucher giảm giá:</span>
                    <span>-{formatVND(discountApplied)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-slate-800 pt-1 border-t border-pink-100">
                  <span>Tổng thanh toán:</span>
                  <span className="text-base text-[#e1146c]">{formatVND(finalTotal)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                type="button"
                onClick={onCheckout}
                className="w-full py-3 rounded-full bg-gradient-to-r from-[#e1146c] via-[#db2777] to-[#be185d] text-white text-xs font-black shadow-lg shadow-pink-600/30 hover:opacity-95 transition-all flex items-center justify-center gap-1.5 uppercase tracking-wide cursor-pointer"
              >
                <span>Tiến hành thanh toán</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
