import React, { useState, useEffect } from 'react';
import { X, TicketPercent, Copy, Check, Clock, Sparkles } from 'lucide-react';
import { VOUCHERS } from '../data/mockData';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface VoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyVoucher: (code: string) => void;
}

export const VoucherModal: React.FC<VoucherModalProps> = ({
  isOpen,
  onClose,
  onApplyVoucher,
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Lock body scroll when open
  useBodyScrollLock(isOpen);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopy = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleUse = (code: string) => {
    onApplyVoucher(code);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Blurred & Dimmed Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Pristine Modal Card */}
      <div
        className="relative z-10 w-full max-w-lg max-h-[88vh] bg-white rounded-[2rem] shadow-2xl border border-pink-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#be185d] via-[#db2777] to-[#e1146c] text-white p-5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <TicketPercent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Ví Voucher & Mã Giảm Giá</h3>
              <p className="text-[11px] text-pink-100 font-medium">Săn mã ưu đãi độc quyền từ BeautyLink</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white text-white hover:text-[#EB0F51] flex items-center justify-center transition-all shadow-sm cursor-pointer"
            title="Đóng (ESC)"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1 overscroll-contain">
          {VOUCHERS.map((v) => (
            <div
              key={v.code}
              className="p-4 rounded-2xl border border-pink-200/90 bg-gradient-to-r from-pink-50/50 via-white to-rose-50/30 flex items-start justify-between gap-3 shadow-xs hover:border-pink-300 transition-all"
            >
              <div className="flex-1 min-w-0">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-pink-100 text-[#be185d] text-[10px] font-bold">
                  {v.tag}
                </span>
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 mt-1 leading-snug">
                  {v.title}
                </h4>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1.5">
                  <span>{v.minOrder}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3 h-3 text-[#e1146c]" />
                    {v.expiry}
                  </span>
                </div>
                <div className="mt-2 text-xs font-mono font-bold text-[#e1146c] bg-white px-2.5 py-1 rounded-lg border border-pink-200 inline-block shadow-2xs">
                  {v.code}
                </div>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy(v.code)}
                  className="px-3 py-1.5 rounded-xl border border-pink-200 hover:border-pink-300 text-xs font-semibold text-slate-700 bg-white hover:bg-pink-50 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {copiedCode === v.code ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600 font-bold">Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleUse(v.code)}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs font-bold shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Dùng ngay
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">Mã giảm giá được áp dụng trực tiếp khi thanh toán</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
