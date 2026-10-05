import React, { useEffect, useState } from 'react';
import {
  X,
  Flame,
  Clock,
  Sparkles,
  Gift,
  BellRing,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { PushNotification } from '../data/notificationsData';

interface PushNotificationToastProps {
  notification: PushNotification | null;
  onClose: () => void;
  onOpenDeal: (dealTitle: string, salonName: string, price: number, originalPrice: number) => void;
  onOpenVouchers?: () => void;
}

export const PushNotificationToast: React.FC<PushNotificationToastProps> = ({
  notification,
  onClose,
  onOpenDeal,
  onOpenVouchers,
}) => {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!notification) return;
    setProgress(100);
  }, [notification]);

  useEffect(() => {
    if (!notification) return;

    const duration = 7000; // 7 seconds
    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      if (!isPaused) {
        setProgress((prev) => {
          const next = prev - step;
          return next <= 0 ? 0 : next;
        });
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [notification, isPaused]);

  useEffect(() => {
    if (progress <= 0 && notification) {
      onClose();
    }
  }, [progress, notification, onClose]);

  if (!notification) return null;

  const getIcon = () => {
    switch (notification.type) {
      case 'flash_sale':
        return <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />;
      case 'deal_expiring':
        return <Clock className="w-4 h-4 text-rose-500" />;
      case 'new_promo':
        return <Sparkles className="w-4 h-4 text-fuchsia-500" />;
      default:
        return <Gift className="w-4 h-4 text-[#e1146c]" />;
    }
  };

  const getBadgeStyle = () => {
    switch (notification.type) {
      case 'flash_sale':
        return 'bg-gradient-to-r from-amber-500 to-rose-500 text-white';
      case 'deal_expiring':
        return 'bg-rose-500 text-white';
      case 'new_promo':
        return 'bg-gradient-to-r from-[#e1146c] to-purple-600 text-white';
      default:
        return 'bg-pink-100 text-[#be185d]';
    }
  };

  const formatVND = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  const handleClickAction = () => {
    if (notification.dealTitle && notification.salonName && notification.dealPrice) {
      onOpenDeal(
        notification.dealTitle,
        notification.salonName,
        notification.dealPrice,
        notification.dealOriginalPrice || notification.dealPrice
      );
    } else if (notification.type === 'new_promo' && onOpenVouchers) {
      onOpenVouchers();
    }
    onClose();
  };

  return (
    <div
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 max-w-[310px] w-[calc(100vw-32px)] animate-in slide-in-from-bottom-3 fade-in duration-300"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative bg-white/98 backdrop-blur-md rounded-2xl shadow-xl shadow-pink-900/15 border border-pink-200 overflow-hidden text-slate-800">
        {/* Top Header info */}
        <div className="bg-pink-50/90 px-3 py-1.5 border-b border-pink-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-[#e1146c] to-[#f43f5e] flex items-center justify-center">
              <BellRing className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-[10px] font-black tracking-wide text-slate-700 uppercase">
              Thông báo ưu đãi
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-4 h-4 rounded-full hover:bg-pink-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-2.5 space-y-2">
          <div className="flex items-center gap-2.5">
            {notification.image ? (
              <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-pink-100 bg-pink-50">
                <img
                  src={notification.image}
                  alt=""
                  className="w-full h-full object-cover"
                />
                {notification.discountBadge && (
                  <span className="absolute bottom-0 inset-x-0 bg-[#e1146c] text-white text-[8px] font-black text-center py-0.2 leading-tight">
                    {notification.discountBadge}
                  </span>
                )}
              </div>
            ) : (
              <div className="w-9 h-9 rounded-lg bg-pink-100/80 flex items-center justify-center shrink-0 shadow-xs">
                {getIcon()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <span className={`px-1.5 py-0.2 rounded-full text-[8.5px] font-black tracking-wider uppercase shadow-xs ${getBadgeStyle()}`}>
                  {notification.type === 'flash_sale'
                    ? 'Flash Sale'
                    : notification.type === 'deal_expiring'
                    ? 'Sắp hết hạn'
                    : 'Ưu đãi mới'}
                </span>
                {notification.expiresIn && (
                  <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1 rounded border border-rose-100">
                    {notification.expiresIn}
                  </span>
                )}
              </div>

              <h4 className="text-[11.5px] font-bold text-slate-900 leading-snug line-clamp-1">
                {notification.title}
              </h4>

              <p className="text-[10px] text-slate-500 line-clamp-1">
                {notification.message}
              </p>
            </div>
          </div>

          {/* Pricing Highlight if available */}
          {notification.dealPrice && (
            <div className="bg-pink-50/70 rounded-lg px-2 py-1 border border-pink-100/80 flex items-center justify-between text-xs">
              <div className="flex items-baseline gap-1">
                <span className="text-xs font-black text-[#e1146c]">
                  {formatVND(notification.dealPrice)}
                </span>
                {notification.dealOriginalPrice && notification.dealOriginalPrice > notification.dealPrice && (
                  <span className="text-[10px] text-slate-400 line-through">
                    {formatVND(notification.dealOriginalPrice)}
                  </span>
                )}
              </div>
              <span className="text-[9.5px] font-semibold text-slate-600 truncate max-w-[120px]">
                {notification.salonName}
              </span>
            </div>
          )}

          {/* CTA Buttons */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={handleClickAction}
              className="flex-1 py-1 px-2.5 rounded-lg bg-gradient-to-r from-[#e1146c] to-[#be185d] hover:from-[#c2185b] hover:to-[#9d174d] text-white text-[11px] font-bold shadow-xs hover:shadow-pink-500/25 transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-98"
            >
              <span>{notification.dealTitle ? 'Xem & Đặt chỗ' : 'Nhận ngay'}</span>
              <ChevronRight className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-1 px-2 rounded-lg border border-pink-200 text-[10px] font-semibold text-slate-500 hover:bg-pink-50 hover:text-[#be185d] transition-colors cursor-pointer"
            >
              Bỏ qua
            </button>
          </div>
        </div>

        {/* Countdown progress bar */}
        <div className="h-0.5 bg-pink-100 w-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#e1146c] to-[#fb7185] transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
