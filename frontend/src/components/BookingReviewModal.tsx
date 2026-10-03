import React, { useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, Sparkles, Star, Store, X } from 'lucide-react';
import { getApiErrorMessage } from '../lib/api';
import { platformApi } from '../services/platformApi';
import type { BookingRecord, BookingReview, ReviewTarget } from '../types';

interface BookingReviewModalProps {
  booking: BookingRecord;
  onClose: () => void;
  onSaved: (targetType: ReviewTarget, review: BookingReview) => void;
}

interface ReviewEditorProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  initialReview?: BookingReview | null;
  saving: boolean;
  saved: boolean;
  onSave: (rating: number, comment: string) => Promise<void>;
}

const ratingText = ['Không chấm điểm', 'Rất tệ', 'Chưa tốt', 'Bình thường', 'Tốt', 'Tuyệt vời'];

const ReviewEditor: React.FC<ReviewEditorProps> = ({ icon, title, description, initialReview, saving, saved, onSave }) => {
  const [rating, setRating] = useState(initialReview?.rating ?? 0);
  const [comment, setComment] = useState(initialReview?.comment ?? '');

  return (
    <section className="rounded-3xl border border-pink-100 bg-[#fffafb] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-pink-100 text-pink-700">{icon}</div>
        <div>
          <h3 className="font-black text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1" role="radiogroup" aria-label={`Điểm ${title}`}>
        <button
          type="button"
          role="radio"
          aria-checked={rating === 0}
          onClick={() => setRating(0)}
          className={`mr-2 rounded-full px-3 py-2 text-xs font-black transition ${rating === 0 ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-pink-300'}`}
        >
          0 sao
        </button>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-label={`${value} sao`}
            aria-checked={rating === value}
            onClick={() => setRating(value)}
            className="rounded-lg p-1 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
          >
            <Star className={`h-7 w-7 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
          </button>
        ))}
        <span className="ml-2 text-xs font-bold text-slate-500">{ratingText[rating]}</span>
      </div>

      <label className="mt-4 block">
        <span className="mb-2 block text-xs font-black text-slate-700">Nhận xét <span className="font-medium text-slate-400">(không bắt buộc)</span></span>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={1500}
          placeholder="Chia sẻ trải nghiệm thực tế của bạn..."
          className="min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-300 focus:border-pink-400 focus:ring-4 focus:ring-pink-100"
        />
      </label>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-400">{comment.length}/1500</span>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(rating, comment)}
          className="inline-flex min-w-36 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : null}
          {initialReview ? 'Cập nhật' : saved ? 'Đã lưu' : 'Gửi đánh giá'}
        </button>
      </div>
    </section>
  );
};

export const BookingReviewModal: React.FC<BookingReviewModalProps> = ({ booking, onClose, onSaved }) => {
  const [saving, setSaving] = useState<ReviewTarget | null>(null);
  const [saved, setSaved] = useState<ReviewTarget[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const save = async (targetType: ReviewTarget, rating: number, comment: string) => {
    setSaving(targetType);
    setError('');
    try {
      const review = await platformApi.upsertBookingReview(booking.id, targetType, { rating, comment: comment.trim() });
      onSaved(targetType, review);
      setSaved((items) => items.includes(targetType) ? items : [...items, targetType]);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-dialog-title"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="mx-auto my-4 w-full max-w-2xl rounded-[2rem] bg-white p-5 shadow-2xl sm:my-8 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-pink-600">Đánh giá đơn hàng</p>
            <h2 id="review-dialog-title" className="mt-1 text-2xl font-black text-slate-900">{booking.serviceName}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{booking.supplierName} · {booking.bookingCode}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-pink-100 hover:text-pink-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-5 rounded-2xl bg-pink-50 px-4 py-3 text-xs font-semibold leading-5 text-pink-800">
          Hai đánh giá được lưu riêng. Bạn có thể gửi một mục trước và quay lại chỉnh sửa bất cứ lúc nào.
        </p>
        {error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}

        <div className="mt-5 space-y-4">
          <ReviewEditor
            icon={<Sparkles className="h-5 w-5" />}
            title="Dịch vụ"
            description={`Chấm điểm chất lượng “${booking.serviceName}”.`}
            initialReview={booking.serviceReview}
            saving={saving === 'SERVICE'}
            saved={saved.includes('SERVICE')}
            onSave={(rating, comment) => save('SERVICE', rating, comment)}
          />
          <ReviewEditor
            icon={<Store className="h-5 w-5" />}
            title="Cửa hàng / nhà cung cấp"
            description={`Chấm điểm trải nghiệm tổng thể tại ${booking.supplierName}.`}
            initialReview={booking.supplierReview}
            saving={saving === 'SUPPLIER'}
            saved={saved.includes('SUPPLIER')}
            onSave={(rating, comment) => save('SUPPLIER', rating, comment)}
          />
        </div>
      </div>
    </div>
  );
};
