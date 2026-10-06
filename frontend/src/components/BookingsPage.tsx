import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Tag,
  MessageSquare,
  XCircle,
  Loader2,
  X,
  Share2,
} from 'lucide-react';
import { BackendBooking } from '../types';
import { beautyApi, getApiErrorMessage } from '../services/beautyApi';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { AppointmentShareModal } from './AppointmentShareModal';
import { supportReportSchema, FieldErrors, zodFieldErrors } from '../lib/validation';
import { FieldError } from './FieldError';

interface BookingsPageProps {
  onBack: () => void;
  onBookNew: () => void;
}

const statusMap: Record<string, string> = {
  CONFIRMED: 'Đã xác nhận',
  PENDING: 'Chờ xác nhận',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('vi-VN').format(val) + 'đ';
};

export const BookingsPage: React.FC<BookingsPageProps> = ({ onBack, onBookNew }) => {
  const [bookings, setBookings] = useState<BackendBooking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [reportBooking, setReportBooking] = useState<BackendBooking | null>(null);
  const [reportReason, setReportReason] = useState<string>('');
  const [reportDetails, setReportDetails] = useState<string>('');
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);
  const [reportSuccess, setReportSuccess] = useState<string>('');
  const [sharingBooking, setSharingBooking] = useState<BackendBooking | null>(null);
  const [reportErrors, setReportErrors] = useState<FieldErrors>({});

  // Lock body scroll when report modal is open
  useBodyScrollLock(Boolean(reportBooking));

  // Close report modal on ESC
  useEffect(() => {
    if (!reportBooking) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReportBooking(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reportBooking]);

  const loadBookings = () => {
    setLoading(true);
    setError('');
    beautyApi
      .myBookings()
      .then((data) => setBookings(data))
      .catch((err) => setError(getApiErrorMessage(err, 'Không thể tải danh sách lịch hẹn.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleCancelBooking = async (id: number) => {
    setCancellingId(id);
    setError('');
    try {
      const updated = await beautyApi.cancelBooking(id);
      setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể hủy lịch hẹn.'));
    } finally {
      setCancellingId(null);
    }
  };

  const handleSendReport = async () => {
    if (!reportBooking) return;
    const validation = supportReportSchema.safeParse({ reason: reportReason, details: reportDetails });
    if (!validation.success) {
      setReportErrors(zodFieldErrors(validation.error));
      return;
    }
    setReportErrors({});
    setSubmittingReport(true);
    setError('');
    try {
      await beautyApi.createReport({
        targetType: 'BOOKING',
        targetId: reportBooking.id,
        reason: reportReason.trim(),
        details: reportDetails.trim(),
      });
      setReportBooking(null);
      setReportReason('');
      setReportDetails('');
      setReportSuccess('Phản hồi đã được gửi đến đội ngũ hỗ trợ.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể gửi phản hồi.'));
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF0F3]">
      <header className="border-b border-pink-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-600 hover:text-pink-700 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Trang chủ
          </button>
          <span className="text-lg font-black tracking-tight">
            Beauty<span className="text-pink-600">Link</span>
          </span>
          <button
            onClick={onBookNew}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-pink-700 transition"
          >
            Đặt lịch mới
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-pink-600">
          Tài khoản khách hàng
        </p>
        <h1 className="mt-2 text-3xl font-black">Lịch hẹn của tôi</h1>
        <p className="mt-2 text-sm text-slate-500">
          Theo dõi trạng thái, mã đặt lịch và giao dịch thanh toán.
        </p>

        {loading && (
          <div className="grid h-64 place-items-center">
            <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
          </div>
        )}

        {error && (
          <p className="mt-6 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {error}
          </p>
        )}

        {!loading && bookings.length === 0 && (
          <div className="mt-8 rounded-[2rem] border border-pink-100 bg-white p-12 text-center shadow-sm">
            <Calendar className="mx-auto h-10 w-10 text-pink-400" />
            <h2 className="mt-4 text-xl font-black">Bạn chưa có lịch hẹn</h2>
            <p className="mt-2 text-sm text-slate-500">
              Chọn một dịch vụ và khung giờ phù hợp để bắt đầu.
            </p>
            <button
              onClick={onBookNew}
              className="mt-6 rounded-2xl bg-pink-600 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-pink-700"
            >
              Khám phá dịch vụ
            </button>
          </div>
        )}

        {reportSuccess && (
          <p className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            {reportSuccess}
          </p>
        )}

        <div className="mt-8 space-y-4">
          {bookings.map((item) => (
            <article
              key={item.id}
              className="rounded-[1.6rem] border border-pink-100 bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex flex-col justify-between gap-5 sm:flex-row">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                        item.status === 'CANCELLED'
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {statusMap[item.status] || item.status}
                    </span>
                    <span className="rounded-full bg-pink-50 px-2.5 py-1 text-[10px] font-black text-pink-700">
                      {item.paymentStatus === 'PAID'
                        ? 'Đã thanh toán đủ'
                        : item.paymentStatus === 'PARTIALLY_PAID'
                          ? 'Đã cọc 50%'
                          : 'Chờ thanh toán'}
                    </span>
                  </div>

                  <h2 className="mt-3 text-lg font-black">{item.serviceName}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                    <MapPin className="h-4 w-4 text-pink-500" /> {item.supplierName}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-slate-400" /> {item.appointmentDate}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-slate-400" />{' '}
                      {item.startTime.slice(0, 5)}–{item.endTime.slice(0, 5)}
                    </span>
                    <span>Chuyên viên: {item.practitionerName}</span>
                  </div>
                </div>

                <div className="shrink-0 sm:text-right">
                  <p className="text-lg font-black text-pink-700">
                    {formatCurrency(item.totalAmount)}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-slate-400">
                    <Tag className="h-3.5 w-3.5" /> {item.bookingCode}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2.5 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setSharingBooking(item)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-pink-200 bg-pink-50/80 px-3 py-1.5 text-xs font-black text-pink-700 hover:bg-pink-100 hover:border-pink-300 transition shadow-2xs cursor-pointer"
                      title="Chia sẻ lịch hẹn lên mạng xã hội"
                    >
                      <Share2 className="h-3.5 w-3.5" /> Chia sẻ
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportBooking(item)}
                      className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500 hover:text-pink-700 transition"
                    >
                      <MessageSquare className="h-4 w-4" /> Phản hồi
                    </button>
                    {!['CANCELLED', 'COMPLETED'].includes(item.status) && (
                      <button
                        disabled={cancellingId === item.id}
                        onClick={() => handleCancelBooking(item.id)}
                        className="flex items-center gap-1.5 text-xs font-extrabold text-rose-600 hover:text-rose-800 transition"
                      >
                        {cancellingId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        Hủy lịch
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      {/* Support Report Modal */}
      {reportBooking && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          {/* Blurred & Dimmed Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-150 cursor-pointer"
            onClick={() => setReportBooking(null)}
            aria-hidden="true"
          />

          <div
            className="relative z-10 w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl border border-pink-100 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-pink-600">
                  Gửi phản hồi
                </p>
                <h2 className="mt-1 text-xl font-black">{reportBooking.serviceName}</h2>
              </div>
              <button
                onClick={() => setReportBooking(null)}
                className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-pink-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-xs font-black">Tiêu đề</span>
              <input
                maxLength={120}
                value={reportReason}
                onChange={(e) => { setReportReason(e.target.value); setReportErrors((prev) => ({ ...prev, reason: '' })); }}
                minLength={2}
                aria-invalid={Boolean(reportErrors.reason)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-pink-400"
                placeholder="Ví dụ: Cần hỗ trợ đổi lịch hẹn"
              />
              <FieldError message={reportErrors.reason} />
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-black">Nội dung chi tiết</span>
              <textarea
                value={reportDetails}
                onChange={(e) => { setReportDetails(e.target.value); setReportErrors((prev) => ({ ...prev, details: '' })); }}
                minLength={10}
                maxLength={1500}
                aria-invalid={Boolean(reportErrors.details)}
                className="min-h-32 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-pink-400"
                placeholder="Mô tả cụ thể vấn đề bạn gặp phải..."
              />
              <FieldError message={reportErrors.details} />
            </label>

            <button
              onClick={handleSendReport}
              disabled={
                submittingReport ||
                reportReason.trim().length < 2 ||
                reportDetails.trim().length < 10
              }
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-extrabold text-white hover:bg-pink-700 disabled:opacity-40 transition"
            >
              {submittingReport && <Loader2 className="h-4 w-4 animate-spin" />}
              Gửi đến hỗ trợ
            </button>
          </div>
        </div>
      )}

      {/* Social Media Sharing Modal */}
      <AppointmentShareModal
        isOpen={Boolean(sharingBooking)}
        onClose={() => setSharingBooking(null)}
        data={
          sharingBooking
            ? {
                bookingCode: sharingBooking.bookingCode,
                serviceName: sharingBooking.serviceName,
                supplierName: sharingBooking.supplierName,
                practitionerName: sharingBooking.practitionerName,
                appointmentDate: sharingBooking.appointmentDate,
                startTime: sharingBooking.startTime.slice(0, 5),
                endTime: sharingBooking.endTime ? sharingBooking.endTime.slice(0, 5) : undefined,
                totalAmount: sharingBooking.totalAmount,
                note: sharingBooking.note,
              }
            : null
        }
      />
    </div>
  );
};
