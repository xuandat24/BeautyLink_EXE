import React, { useState, useEffect } from 'react';
import { X, CalendarCheck, Clock, MapPin, CheckCircle2, Phone, Calendar, Share2, Star } from 'lucide-react';
import { BookingDetails } from '../types';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { AppointmentShareModal } from './AppointmentShareModal';
import { ServiceReviewModal } from './ServiceReviewModal';
import { reviewService } from '../services/reviewService';

interface AppointmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: BookingDetails[];
  onBookNew: () => void;
}

export const AppointmentsModal: React.FC<AppointmentsModalProps> = ({
  isOpen,
  onClose,
  appointments,
  onBookNew,
}) => {
  const [sharingApp, setSharingApp] = useState<BookingDetails | null>(null);
  const [reviewingApp, setReviewingApp] = useState<BookingDetails | null>(null);
  const [reviewedMap, setReviewedMap] = useState<Record<string, boolean>>(() => {
    return reviewService.getReviewedBookings();
  });

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

  if (!isOpen) return null;

  const formatVND = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

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

      {/* Pristine Modal Card */}
      <div
        className="relative z-10 w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-pink-100 overflow-hidden max-h-[88vh] flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 bg-gradient-to-r from-[#be185d] via-[#db2777] to-[#e1146c] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-white" />
            <div>
              <h3 className="text-base font-extrabold tracking-tight">Lịch Hẹn Của Bạn</h3>
              <p className="text-[11px] text-pink-100/90 font-medium">Theo dõi và quản lý lịch dịch vụ làm đẹp</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Đóng (ESC)"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 p-5 overflow-y-auto overscroll-contain space-y-3.5">
          {appointments.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-pink-50 flex items-center justify-center text-[#e1146c] mb-3">
                <Calendar className="w-7 h-7 text-pink-300" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">Chưa có lịch hẹn nào</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Bạn chưa đặt dịch vụ nào. Hãy chọn một gói làm đẹp yêu thích để trải nghiệm ngay!
              </p>
              <button
                onClick={() => {
                  onClose();
                  onBookNew();
                }}
                className="mt-4 px-5 py-2 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs font-bold shadow hover:opacity-90 transition-opacity"
              >
                Khám phá dịch vụ ngay
              </button>
            </div>
          ) : (
            appointments.map((app, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-pink-100 bg-pink-50/30 space-y-2 relative"
              >
                <div className="flex items-start justify-between">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Đã xác nhận giữ chỗ
                  </span>
                  <div className="text-right">
                    <span className="text-sm font-black text-[#e1146c] block">
                      {formatVND(app.paidAmount || app.price)}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold block">
                      🕒 Đã thanh toán: {app.paymentTime || '14:32 · 02/10/2026'}
                    </span>
                  </div>
                </div>

                <h4 className="text-sm font-extrabold text-slate-800">{app.serviceTitle}</h4>

                <div className="space-y-1 text-xs text-slate-600 pt-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-[#e1146c]" />
                    <span>Cơ sở: <strong>{app.salonName}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#e1146c]" />
                    <span>Thời gian: <strong>{app.timeSlot}</strong> ngày <strong>{app.date}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <span>Khách: {app.customerName} ({app.customerPhone})</span>
                    <span>·</span>
                    <span>{app.specialist || 'Chuyên viên Master'}</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-pink-100 text-[11px] text-slate-500">
                  <span className="font-mono font-bold text-slate-700">Mã: {app.bookingCode || 'BP-982312'}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSharingApp(app)}
                      className="inline-flex items-center gap-1 font-bold text-[#be185d] bg-pink-50 hover:bg-pink-100 border border-pink-200 px-2.5 py-1 rounded-xl shadow-2xs transition cursor-pointer"
                      title="Chia sẻ thông tin lịch hẹn cho bạn bè"
                    >
                      <Share2 className="w-3 h-3 text-[#e1146c]" />
                      <span>Chia sẻ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewingApp(app)}
                      className={`inline-flex items-center gap-1 font-bold px-2.5 py-1 rounded-xl shadow-2xs transition cursor-pointer ${
                        app.bookingCode && reviewedMap[app.bookingCode]
                          ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                          : 'text-white bg-gradient-to-r from-pink-500 to-[#be185d] hover:opacity-95'
                      }`}
                      title="Đánh giá dịch vụ sau khi trải nghiệm"
                    >
                      <Star
                        className={`w-3 h-3 ${
                          app.bookingCode && reviewedMap[app.bookingCode]
                            ? 'fill-amber-500 text-amber-500'
                            : 'fill-amber-200 text-amber-200'
                        }`}
                      />
                      <span>
                        {app.bookingCode && reviewedMap[app.bookingCode] ? 'Đã đánh giá' : 'Đánh giá'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Service Review Modal */}
      {reviewingApp && (
        <ServiceReviewModal
          isOpen={Boolean(reviewingApp)}
          onClose={() => setReviewingApp(null)}
          serviceTitle={reviewingApp.serviceTitle}
          salonName={reviewingApp.salonName}
          bookingCode={reviewingApp.bookingCode}
          customerName={reviewingApp.customerName}
          onSuccess={() => {
            if (reviewingApp.bookingCode) {
              setReviewedMap((prev) => ({ ...prev, [reviewingApp.bookingCode!]: true }));
            }
          }}
        />
      )}

      {/* Appointment Share Modal */}
      <AppointmentShareModal
        isOpen={Boolean(sharingApp)}
        onClose={() => setSharingApp(null)}
        data={
          sharingApp
            ? {
                bookingCode: sharingApp.bookingCode || 'BK-APPOINTMENT',
                serviceName: sharingApp.serviceTitle,
                supplierName: sharingApp.salonName,
                practitionerName: sharingApp.specialist,
                appointmentDate: sharingApp.date,
                startTime: sharingApp.timeSlot,
                totalAmount: sharingApp.price,
                note: sharingApp.note,
              }
            : null
        }
      />
    </div>
  );
};
