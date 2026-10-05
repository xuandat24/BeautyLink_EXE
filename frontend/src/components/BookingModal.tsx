import React, { useState, useEffect, useMemo } from 'react';
import { X, User, Calendar, Clock, Loader2, CheckCircle, ShieldCheck, CheckCircle2, Sparkles } from 'lucide-react';
import { BackendService, BackendPractitioner, CurrentUser } from '../types';
import { beautyApi, getApiErrorMessage } from '../services/beautyApi';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { BookingShareFeature } from './BookingShareFeature';

interface BookingModalProps {
  service: BackendService;
  currentUser: CurrentUser | null;
  onClose: () => void;
  onNeedLogin: () => void;
  onCreated: (bookingCode: string) => void;
  onViewMyBookings?: () => void;
  initialDate?: string;
  initialSlot?: string;
  onProceedToCheckout?: (service: BackendService, date: string, slot: string) => void;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('vi-VN').format(val) + 'đ';
};

const getTodayString = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const getMaxDateString = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
};

export const BookingModal: React.FC<BookingModalProps> = ({
  service,
  currentUser,
  onClose,
  onNeedLogin,
  onCreated,
  onViewMyBookings,
  initialDate,
  initialSlot,
  onProceedToCheckout,
}) => {
  const maxDate = useMemo(() => getMaxDateString(), []);
  const [selectedPractitioner, setSelectedPractitioner] = useState<BackendPractitioner | null>(
    service.practitioners?.[0] || null
  );
  const [date, setDate] = useState<string>(initialDate || getTodayString(1));
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>(initialSlot || '');
  const [note, setNote] = useState<string>('');
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [confirmedBooking, setConfirmedBooking] = useState<{
    bookingCode: string;
    totalAmount: number;
    appointmentDate: string;
    startTime: string;
    practitionerName: string;
    practitionerSpecialty?: string;
  } | null>(null);

  // Lock body scrolling when modal is active
  useBodyScrollLock(true);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!selectedPractitioner || !date) return;
    setLoadingSlots(true);
    if (!initialSlot || date !== initialDate) {
      setSelectedSlot('');
    }
    setError('');

    beautyApi
      .availability(service.id, selectedPractitioner.id, date)
      .then((res) => {
        const mappedSlots = res.availableSlots.map((s) => s.slice(0, 5));
        setSlots(mappedSlots);
        if (initialSlot && (mappedSlots.includes(initialSlot) || date === initialDate)) {
          setSelectedSlot(initialSlot);
        }
      })
      .catch((err) => {
        setError(getApiErrorMessage(err, 'Không thể tải lịch trống.'));
      })
      .finally(() => {
        setLoadingSlots(false);
      });
  }, [service.id, selectedPractitioner, date, initialDate, initialSlot]);

  const canSubmit = Boolean(
    currentUser &&
    currentUser.role === 'CUSTOMER' &&
    selectedPractitioner &&
    selectedSlot
  );

  const handleSubmit = async () => {
    if (!currentUser) {
      onNeedLogin();
      return;
    }
    if (currentUser.role !== 'CUSTOMER') {
      setError('Chỉ tài khoản khách hàng có thể đặt lịch.');
      return;
    }
    if (!selectedPractitioner || !selectedSlot) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await beautyApi.createBooking({
        serviceId: service.id,
        practitionerId: selectedPractitioner.id,
        appointmentDate: date,
        startTime: selectedSlot,
        note: note.trim() || undefined,
      });
      setConfirmedBooking({
        bookingCode: res.bookingCode,
        totalAmount: res.totalAmount || service.price,
        appointmentDate: date,
        startTime: selectedSlot,
        practitionerName: selectedPractitioner.displayName || selectedPractitioner.name || 'Chuyên viên',
        practitionerSpecialty: selectedPractitioner.specialty,
      });
      onCreated(res.bookingCode);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể xác nhận lịch hẹn.'));
    } finally {
      setSubmitting(false);
    }
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
        className="relative z-10 w-full max-w-xl max-h-[90vh] flex flex-col rounded-[2rem] bg-white shadow-2xl border border-pink-100 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {confirmedBooking ? (
          /* Confirmation Header */
          <div className="shrink-0 flex items-start justify-between border-b border-emerald-100 p-5 sm:p-6 bg-gradient-to-r from-emerald-50/90 via-pink-50/60 to-white">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
                <CheckCircle2 className="h-6 w-6 stroke-[2.5]" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <span>Đặt lịch thành công</span>
                  <Sparkles className="h-3.5 w-3.5 text-pink-500" />
                </p>
                <h2 className="mt-0.5 text-lg sm:text-xl font-black text-slate-900">
                  Lịch hẹn đã được xác nhận!
                </h2>
                <p className="text-xs text-slate-500 font-semibold">
                  Mã đặt lịch: <span className="font-extrabold text-pink-700">{confirmedBooking.bookingCode}</span>
                </p>
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
        ) : (
          /* Booking Form Header */
          <div className="shrink-0 flex items-start justify-between border-b border-slate-100 p-5 sm:p-6 bg-gradient-to-r from-pink-50/70 to-white">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#EB0F51]">
                Xác nhận lịch hẹn
              </p>
              <h2 className="mt-1 text-lg sm:text-xl font-black text-slate-900">{service.name}</h2>
              <p className="mt-0.5 text-xs text-slate-500 font-semibold">{service.supplierName}</p>
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
        )}

        {confirmedBooking ? (
          /* Confirmation & Social Sharing Screen */
          <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
            <BookingShareFeature
              data={{
                bookingCode: confirmedBooking.bookingCode,
                serviceName: service.name,
                supplierName: service.supplierName,
                supplierAddress: service.supplierAddress,
                practitionerName: confirmedBooking.practitionerName,
                practitionerSpecialty: confirmedBooking.practitionerSpecialty,
                appointmentDate: confirmedBooking.appointmentDate,
                startTime: confirmedBooking.startTime,
                totalAmount: confirmedBooking.totalAmount,
                note: note.trim() || undefined,
                imageUrl: service.imageUrl,
              }}
              showCardPreview={true}
              onViewMyBookings={() => {
                onClose();
                if (onViewMyBookings) onViewMyBookings();
              }}
              onDone={onClose}
            />
          </div>
        ) : (
          /* Booking Selection Form */
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain space-y-5 p-5 sm:p-6">
              {/* Practitioner Selector */}
              <div>
                <label className="mb-2 block text-xs font-black text-slate-700">
                  Chuyên viên
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {service.practitioners && service.practitioners.length > 0 ? (
                    service.practitioners.map((practitioner) => {
                      const isSelected = selectedPractitioner?.id === practitioner.id;
                      return (
                        <button
                          key={practitioner.id}
                          type="button"
                          onClick={() => setSelectedPractitioner(practitioner)}
                          className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                            isSelected
                              ? 'border-pink-500 bg-pink-50 text-pink-900'
                              : 'border-slate-200 hover:border-pink-200'
                          }`}
                        >
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm">
                            <User className="h-4 w-4 text-pink-600" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-extrabold truncate">
                              {practitioner.displayName || practitioner.name || 'Chuyên viên'}
                            </span>
                            <span className="block text-[11px] text-slate-500 truncate">
                              {practitioner.specialty || 'Chuyên viên chăm sóc'}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-500 py-2">
                      Chuyên viên chỉ định ngẫu nhiên theo lịch của cơ sở.
                    </p>
                  )}
                </div>
              </div>

              {/* Date Picker */}
              <label className="block">
                <span className="mb-2 block text-xs font-black text-slate-700">
                  Ngày hẹn
                </span>
                <input
                  type="date"
                  min={getTodayString()}
                  max={maxDate}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none transition focus:border-pink-400"
                />
                <span className="mt-1.5 block text-[11px] font-semibold text-slate-400">
                  Có thể đặt lịch trước đến {new Date(`${maxDate}T00:00:00`).toLocaleDateString('vi-VN')}.
                </span>
              </label>

              {/* Available Slots */}
              <div>
                <span className="mb-2 block text-xs font-black text-slate-700">
                  Khung giờ còn trống
                </span>
                {loadingSlots ? (
                  <div className="flex items-center gap-2 py-3 text-pink-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-xs font-bold">Đang tải khung giờ khả dụng...</span>
                  </div>
                ) : slots.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`rounded-xl border px-2 py-2.5 text-xs font-extrabold transition ${
                          selectedSlot === slot
                            ? 'border-pink-600 bg-pink-600 text-white shadow-sm'
                            : 'border-slate-200 hover:border-pink-300 bg-slate-50/50'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                    Không còn khung giờ trong ngày này. Hãy chọn ngày khác hoặc chuyên viên khác.
                  </p>
                )}
              </div>

              {/* Note */}
              <label className="block">
                <span className="mb-2 block text-xs font-black text-slate-700">
                  Ghi chú <span className="font-normal text-slate-400">(không bắt buộc)</span>
                </span>
                <textarea
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-20 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-pink-400"
                  placeholder="Dị ứng, yêu cầu đặc biệt hoặc thông tin gửi tới chuyên viên..."
                />
              </label>

              {error && (
                <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                  {error}
                </p>
              )}

              {!currentUser && (
                <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
                  <strong>Đăng nhập để giữ chỗ.</strong> Lựa chọn hiện tại sẽ được giữ trên trang.
                </div>
              )}
            </div>

            {/* Fixed Bottom Action Footer */}
            <div className="shrink-0 flex items-center justify-between gap-4 border-t border-slate-100 p-4 sm:p-6 bg-slate-50/90">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">
                  Thanh toán mô phỏng
                </p>
                <p className="text-xl font-black text-pink-700">
                  {formatCurrency(service.price)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {onProceedToCheckout ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentUser) {
                        onNeedLogin();
                        return;
                      }
                      if (!selectedSlot) {
                        setError('Vui lòng chọn khung giờ hẹn trước khi tiếp tục.');
                        return;
                      }
                      onProceedToCheckout(service, date, selectedSlot);
                    }}
                    disabled={Boolean(currentUser && !selectedSlot) || submitting}
                    className="inline-flex min-h-12 items-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#e1146c] to-[#be185d] px-6 text-xs sm:text-sm font-black text-white transition hover:opacity-95 disabled:opacity-40 cursor-pointer shadow-md shadow-pink-600/20"
                  >
                    <span>{currentUser ? 'Tiến hành đặt lịch & Thanh toán' : 'Đăng nhập để đặt lịch'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={Boolean(currentUser && !canSubmit) || submitting}
                    className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#e1146c] to-[#be185d] px-6 text-xs sm:text-sm font-extrabold text-white transition hover:opacity-95 disabled:opacity-40 cursor-pointer shadow-md shadow-pink-600/20"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : currentUser ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    {currentUser ? 'Xác nhận đặt lịch' : 'Đăng nhập để đặt'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
