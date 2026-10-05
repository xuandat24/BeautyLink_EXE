import React, { useState, useEffect } from 'react';
import { X, Gift, Sparkles, Award, CheckCircle2, AlertCircle } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface RewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RewardsModal: React.FC<RewardsModalProps> = ({ isOpen, onClose }) => {
  const [points, setPoints] = useState(380);
  const [redeemed, setRedeemed] = useState<Record<string, boolean>>({});
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'warning' } | null>(null);

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

  const rewardItems = [
    {
      id: 'r-1',
      title: 'Voucher Giảm 50K dịch vụ bất kỳ',
      cost: 150,
      description: 'Áp dụng cho hóa đơn từ 200k tại tất cả đối tác BeautyLink',
      badge: 'Phổ biến nhất',
    },
    {
      id: 'r-2',
      title: 'Tặng 1 Hộp Mặt Nạ Collagen Hoa Hồng',
      cost: 250,
      description: 'Nhận quà trực tiếp tại quầy check-in khi sử dụng dịch vụ',
      badge: 'Quà tặng',
    },
    {
      id: 'r-3',
      title: 'Miễn Phí 1 Buổi Xông Hơi Thảo Dược 45p',
      cost: 350,
      description: 'Trải nghiệm xông hơi đá muối thải độc toàn thân',
      badge: 'Đặc quyền VIP',
    },
  ];

  const handleRedeem = (item: (typeof rewardItems)[0]) => {
    if (points >= item.cost) {
      setPoints((prev) => prev - item.cost);
      setRedeemed((prev) => ({ ...prev, [item.id]: true }));
      setStatusMsg({ text: `Đổi quà "${item.title}" thành công! Vui lòng kiểm tra ví quà tặng.`, type: 'success' });
      setTimeout(() => setStatusMsg(null), 4000);
    } else {
      setStatusMsg({ text: 'Bạn chưa đủ điểm tích lũy để đổi phần quà này. Hãy đặt lịch làm đẹp để tích thêm điểm nhé!', type: 'warning' });
      setTimeout(() => setStatusMsg(null), 4000);
    }
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
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">BeautyLink Rewards Club</h3>
              <p className="text-[11px] text-pink-100 font-medium">Tích lũy điểm làm đẹp & nhận quà VIP</p>
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

        {/* Status banner */}
        {statusMsg && (
          <div
            className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Points balance status banner */}
        <div className="p-4 bg-gradient-to-r from-pink-50 via-rose-50 to-pink-100/80 border-b border-pink-200 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              Số điểm của bạn
            </span>
            <div className="text-2xl font-black text-[#be185d] flex items-center gap-1.5">
              <span>{points}</span>
              <span className="text-xs font-semibold text-pink-600">Điểm Sen</span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-white text-[#e1146c] text-xs font-extrabold border border-pink-200 shadow-xs">
            Hạng: Rose VIP
          </span>
        </div>

        {/* Rewards list */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 overscroll-contain">
          {rewardItems.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl border border-pink-100 bg-[#FFF9FA] hover:border-pink-300 transition-all flex items-start justify-between gap-3 shadow-xs"
            >
              <div className="flex-1 min-w-0">
                <span className="px-2.5 py-0.5 rounded-full bg-pink-100 text-[#be185d] text-[10px] font-bold">
                  {item.badge}
                </span>
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 mt-1">
                  {item.title}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{item.description}</p>
                <div className="mt-2 text-xs font-bold text-[#e1146c]">
                  Yêu cầu: {item.cost} Điểm Sen
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRedeem(item)}
                disabled={redeemed[item.id] || points < item.cost}
                className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  redeemed[item.id]
                    ? 'bg-emerald-100 text-emerald-700 cursor-default'
                    : points < item.cost
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white hover:opacity-90 shadow-xs'
                }`}
              >
                {redeemed[item.id] ? 'Đã đổi quà' : 'Đổi ngay'}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">Đặt lịch làm đẹp để tích thêm 10% điểm thưởng</span>
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
