import React, { useEffect } from 'react';
import { X, Share2 } from 'lucide-react';
import { BookingShareFeature, AppointmentShareData } from './BookingShareFeature';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface AppointmentShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AppointmentShareData | null;
  onViewMyBookings?: () => void;
}

export const AppointmentShareModal: React.FC<AppointmentShareModalProps> = ({
  isOpen,
  onClose,
  data,
  onViewMyBookings,
}) => {
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

  if (!isOpen || !data) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Blurred & Dimmed Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        className="relative z-10 w-full max-w-xl max-h-[90vh] flex flex-col rounded-[2rem] bg-white shadow-2xl border border-pink-100 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between border-b border-slate-100 p-5 sm:p-6 bg-gradient-to-r from-pink-50/70 to-white">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-100 text-pink-600 shadow-2xs">
              <Share2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-[#EB0F51]">
                Chia sẻ lịch hẹn
              </p>
              <h2 className="mt-0.5 text-base sm:text-lg font-black text-slate-900 truncate max-w-xs sm:max-w-md">
                {data.serviceName}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 hover:bg-[#EB0F51] hover:text-white flex items-center justify-center transition-all shadow-xs cursor-pointer shrink-0"
            title="Đóng (ESC)"
            aria-label="Đóng cửa sổ"
          >
            <X className="h-5 w-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
          <BookingShareFeature
            data={data}
            showCardPreview={true}
            onViewMyBookings={() => {
              onClose();
              if (onViewMyBookings) onViewMyBookings();
            }}
            onDone={onClose}
          />
        </div>
      </div>
    </div>
  );
};
