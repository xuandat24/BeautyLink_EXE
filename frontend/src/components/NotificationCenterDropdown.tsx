import React, { useState } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  Trash2,
  Volume2,
  VolumeX,
  Play,
  Flame,
  Clock,
  Sparkles,
  Gift,
  ExternalLink,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { PushNotification } from '../data/notificationsData';

interface NotificationCenterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  notifications: PushNotification[];
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
  onTriggerTestPush: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  autoSimulationEnabled: boolean;
  onToggleAutoSimulation: () => void;
  onOpenDeal: (dealTitle: string, salonName: string, price: number, originalPrice: number) => void;
  onOpenVouchers: () => void;
}

export const NotificationCenterDropdown: React.FC<NotificationCenterDropdownProps> = ({
  isOpen,
  onClose,
  onMouseEnter,
  onMouseLeave,
  notifications,
  onMarkAllAsRead,
  onMarkAsRead,
  onClearAll,
  onTriggerTestPush,
  soundEnabled,
  onToggleSound,
  autoSimulationEnabled,
  onToggleAutoSimulation,
  onOpenDeal,
  onOpenVouchers,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'flash_sale' | 'deal_expiring' | 'promo'>('all');
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'flash_sale') return n.type === 'flash_sale';
    if (activeFilter === 'deal_expiring') return n.type === 'deal_expiring';
    if (activeFilter === 'promo') return n.type === 'new_promo';
    return true;
  });

  const formatVND = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  const handleItemClick = (notif: PushNotification) => {
    onMarkAsRead(notif.id);
    if (notif.dealTitle && notif.salonName && notif.dealPrice) {
      onOpenDeal(
        notif.dealTitle,
        notif.salonName,
        notif.dealPrice,
        notif.dealOriginalPrice || notif.dealPrice
      );
      onClose();
    } else if (notif.type === 'new_promo') {
      onOpenVouchers();
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop for closing dropdown on mobile */}
      <div
        className="fixed inset-0 z-40 bg-black/30 md:hidden"
        onClick={onClose}
      />

      {/* Notification Center Popover with hover continuity */}
      <div
        ref={dropdownRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="fixed md:absolute right-2 sm:right-0 top-16 md:top-full mt-2.5 z-50 w-[calc(100vw-16px)] sm:w-[420px] max-h-[85vh] bg-white rounded-3xl shadow-2xl shadow-pink-950/20 border border-pink-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black tracking-tight">Thông báo & Flash Sale</h3>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-white text-[#be185d] text-[10px] font-black rounded-full shadow-xs">
                    {unreadCount} mới
                  </span>
                )}
              </div>
              <p className="text-[10px] text-pink-100 font-medium">
                Cập nhật deal giảm sốc & ưu đãi sắp hết hạn
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={onToggleSound}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                soundEnabled ? 'bg-white/25 text-white' : 'bg-white/10 text-white/60 hover:text-white'
              }`}
              title={soundEnabled ? 'Âm thanh thông báo: Đang bật' : 'Âm thanh: Đang tắt'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action toolbar (Mark read, Test push, Auto simulation toggle) */}
        <div className="bg-pink-50/80 px-3.5 py-2 border-b border-pink-100 flex items-center justify-between gap-2 text-xs shrink-0">
          <button
            type="button"
            onClick={onTriggerTestPush}
            className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs hover:brightness-105 active:scale-95 transition-all cursor-pointer"
            title="Bắn ngay một thông báo đẩy giả lập"
          >
            <Zap className="w-3 h-3 fill-white" />
            <span>Thử nhận thông báo</span>
          </button>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="text-[11px] font-bold text-[#be185d] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Đã đọc tất cả</span>
              </button>
            )}

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                title="Xóa tất cả"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-3.5 py-2 border-b border-pink-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 bg-white">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeFilter === 'all'
                ? 'bg-[#e1146c] text-white shadow-xs'
                : 'bg-pink-50 text-slate-600 hover:text-[#e1146c]'
            }`}
          >
            Tất cả ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('flash_sale')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              activeFilter === 'flash_sale'
                ? 'bg-[#e1146c] text-white shadow-xs'
                : 'bg-pink-50 text-slate-600 hover:text-[#e1146c]'
            }`}
          >
            <Flame className="w-3 h-3 text-orange-500" />
            <span>Flash Sale</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('deal_expiring')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              activeFilter === 'deal_expiring'
                ? 'bg-[#e1146c] text-white shadow-xs'
                : 'bg-pink-50 text-slate-600 hover:text-[#e1146c]'
            }`}
          >
            <Clock className="w-3 h-3 text-rose-500" />
            <span>Sắp hết hạn</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('promo')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              activeFilter === 'promo'
                ? 'bg-[#e1146c] text-white shadow-xs'
                : 'bg-pink-50 text-slate-600 hover:text-[#e1146c]'
            }`}
          >
            <Gift className="w-3 h-3 text-fuchsia-500" />
            <span>Voucher</span>
          </button>
        </div>

        {/* Notifications Scroll List */}
        <div className="flex-1 overflow-y-auto divide-y divide-pink-50 bg-slate-50/40 p-1">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-pink-50 text-[#e1146c] flex items-center justify-center mx-auto text-xl">
                🔔
              </div>
              <p className="text-xs font-bold text-slate-700">Chưa có thông báo nào trong mục này</p>
              <p className="text-[11px] text-slate-400">
                Các deal Flash Sale và ưu đãi sắp hết hạn sẽ được cập nhật liên tục tại đây.
              </p>
              <button
                type="button"
                onClick={onTriggerTestPush}
                className="mt-2 px-3 py-1.5 rounded-full bg-pink-100 text-[#be185d] text-xs font-bold hover:bg-pink-200 transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                <Zap className="w-3 h-3" />
                <span>Bắn thử thông báo ngay</span>
              </button>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                className={`p-3 rounded-2xl transition-all cursor-pointer flex gap-3 relative ${
                  notif.isRead
                    ? 'bg-white hover:bg-pink-50/50'
                    : 'bg-pink-50/70 hover:bg-pink-100/60 border border-pink-200/60 shadow-xs'
                }`}
              >
                {/* Unread indicator dot */}
                {!notif.isRead && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#e1146c] ring-2 ring-white" />
                )}

                {/* Thumbnail or Category Icon */}
                {notif.image ? (
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-pink-100 bg-pink-50">
                    <img src={notif.image} alt="" className="w-full h-full object-cover" />
                    {notif.discountBadge && (
                      <span className="absolute bottom-0 inset-x-0 bg-[#e1146c] text-white text-[8px] font-black text-center py-0.2">
                        {notif.discountBadge}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center shrink-0 text-xl">
                    {notif.type === 'flash_sale' ? '🔥' : notif.type === 'deal_expiring' ? '⏳' : '🎁'}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-black tracking-wider uppercase ${
                        notif.type === 'flash_sale'
                          ? 'bg-amber-100 text-amber-800'
                          : notif.type === 'deal_expiring'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {notif.type === 'flash_sale'
                        ? 'Flash Sale'
                        : notif.type === 'deal_expiring'
                        ? 'Sắp hết hạn'
                        : 'Ưu đãi mới'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {notif.timestamp}
                    </span>
                    {notif.expiresIn && (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1 rounded">
                        {notif.expiresIn}
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-slate-800 line-clamp-1">
                    {notif.title}
                  </h4>

                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                    {notif.message}
                  </p>

                  {/* Price info if available */}
                  {notif.dealPrice && (
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-black text-[#e1146c]">
                          {formatVND(notif.dealPrice)}
                        </span>
                        {notif.dealOriginalPrice && (
                          <span className="text-[10px] text-slate-400 line-through">
                            {formatVND(notif.dealOriginalPrice)}
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] font-bold text-[#e1146c] flex items-center gap-0.5 group-hover:underline">
                        <span>Xem deal</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info & Toggle Auto Simulation */}
        <div className="p-3 bg-pink-50/50 border-t border-pink-100 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoSimulationEnabled}
              onChange={onToggleAutoSimulation}
              className="rounded text-[#e1146c] focus:ring-pink-400 cursor-pointer"
            />
            <span>Tự động nhận thông báo giả lập (~45s)</span>
          </label>

          <span className="font-semibold text-[#be185d]">BeautyLink Push v2.4</span>
        </div>
      </div>
    </>
  );
};
