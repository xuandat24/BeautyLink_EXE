import React from 'react';
import {
  Bell,
  X,
  CheckCheck,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { PushNotification } from '../types';
import { useLanguage } from '../lib/language';

interface NotificationCenterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  notifications: PushNotification[];
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  placement?: 'header' | 'floating';
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
  soundEnabled,
  onToggleSound,
  placement = 'header',
}) => {
  const { text } = useLanguage();
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleItemClick = (notif: PushNotification) => {
    onMarkAsRead(notif.id);
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
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`${placement === 'floating' ? 'fixed bottom-20 right-3 sm:right-5' : 'fixed right-2 top-16 mt-2.5 md:absolute md:right-0 md:top-full sm:right-0'} z-50 flex max-h-[78vh] w-[calc(100vw-24px)] flex-col overflow-hidden rounded-3xl border border-pink-200 bg-white shadow-2xl shadow-pink-950/20 sm:w-[420px]`}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-[#EB0F51] to-[#B42D58] text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black tracking-tight">{text('Thông báo', 'Notifications')}</h3>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-white text-[#B42D58] text-[10px] font-black rounded-full shadow-xs">
                    {unreadCount} {text('mới', 'new')}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-pink-100 font-medium">
                {text('Cập nhật hoạt động tài khoản và lịch hẹn', 'Account and appointment updates')}
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

        {/* Notification actions */}
        <div className="bg-pink-50/80 px-3.5 py-2 border-b border-pink-100 flex items-center justify-end gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="text-[11px] font-bold text-[#B42D58] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{text('Đã đọc tất cả', 'Mark all read')}</span>
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

        {/* Notifications Scroll List */}
        <div className="flex-1 overflow-y-auto divide-y divide-pink-50 bg-slate-50/40 p-1">
          {notifications.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-pink-50 text-[#EB0F51] flex items-center justify-center mx-auto text-xl">
                🔔
              </div>
              <p className="text-xs font-bold text-slate-700">{text('Bạn chưa có thông báo nào', 'You have no notifications')}</p>
              <p className="text-[11px] text-slate-400">
                {text('Thông báo quan trọng về tài khoản và lịch hẹn sẽ xuất hiện tại đây.', 'Important account and appointment updates will appear here.')}
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
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
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#EB0F51] ring-2 ring-white" />
                )}

                {/* Thumbnail or Category Icon */}
                {notif.image ? (
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-pink-100 bg-pink-50">
                    <img src={notif.image} alt="" className="w-full h-full object-cover" />
                    {notif.discountBadge && (
                      <span className="absolute bottom-0 inset-x-0 bg-[#EB0F51] text-white text-[8px] font-black text-center py-0.2">
                        {notif.discountBadge}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center shrink-0 text-xl">
                    <Bell className="w-5 h-5 text-[#EB0F51]" />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] font-black tracking-wider uppercase">
                      {text('Hệ thống', 'System')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {notif.timestamp}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-800 line-clamp-1">
                    {notif.title}
                  </h4>

                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                    {notif.message}
                  </p>

                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </>
  );
};
