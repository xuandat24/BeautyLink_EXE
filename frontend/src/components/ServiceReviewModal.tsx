import React, { useEffect, useRef, useState } from 'react';
import { prepareImageUpload } from '../lib/imageUpload';
import { X, Star } from 'lucide-react';
import { BackendBooking, BookingReview } from '../types';
import { beautyApi, getApiErrorMessage } from '../services/beautyApi';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { canReviewBooking, eligibleReviewBookings } from '../lib/bookingPolicy';

interface ServiceReviewModalProps {
  isOpen: boolean; onClose: () => void; serviceTitle: string; salonName: string;
  booking?: BackendBooking; serviceId?: number; supplierId?: number;
  initialTarget?: 'SERVICE' | 'SUPPLIER'; customerName?: string; customerAvatar?: string;
  onSuccess?: (review: BookingReview) => void;
}
export const ServiceReviewModal: React.FC<ServiceReviewModalProps> = ({ isOpen, onClose, serviceTitle, salonName, booking, serviceId, supplierId, initialTarget = 'SERVICE', onSuccess }) => {
  const [items, setItems] = useState<BackendBooking[]>([]);
  const [bookingId, setBookingId] = useState<number>();
  const [target, setTarget] = useState<'SERVICE' | 'SUPPLIER'>(initialTarget);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [preparing, setPreparing] = useState(false);
  const imageGeneration = useRef(0);
  useEffect(() => () => { imageGeneration.current += 1; }, []);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reloadAttempt, setReloadAttempt] = useState(0);
  const submissionInFlight = useRef(false);
  useBodyScrollLock(isOpen);
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true); setError(''); setItems([]); setBookingId(undefined); setTarget(initialTarget);
    beautyApi.myBookings().then((bookings) => {
      if (!active) return;
      const eligible = eligibleReviewBookings(bookings, { bookingId: booking?.id, serviceId, supplierId });
      setItems(eligible); setBookingId(eligible[0]?.id);
    }).catch((err) => { if (active) setError(getApiErrorMessage(err, 'Vui lòng đăng nhập để đánh giá lịch hẹn của bạn.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, booking?.id, serviceId, supplierId, initialTarget, reloadAttempt]);
  const selected = items.find((item) => item.id === bookingId);
  useEffect(() => {
    const existing = target === 'SERVICE' ? selected?.serviceReview : selected?.supplierReview;
    imageGeneration.current += 1; setPreparing(false);
    setRating(existing?.rating ?? 5); setComment(existing?.comment ?? ''); setImages(existing?.images ?? []);
  }, [selected, target]);
  useEffect(() => {
    if (!isOpen || submitting) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [isOpen, submitting, onClose]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !canReviewBooking(selected) || submissionInFlight.current || preparing) return;
    submissionInFlight.current = true;
    setSubmitting(true); setError('');
    try {
      const saved = await beautyApi.upsertBookingReview(selected.id, target, { rating, comment: comment.trim(), images });
      onSuccess?.(saved); onClose();
    } catch (err) { setError(getApiErrorMessage(err, 'Không thể lưu đánh giá. Vui lòng thử lại.')); }
    finally { submissionInFlight.current = false; setSubmitting(false); }
  };
  const chooseImages = async (files: File[]) => {
    if (!files.length || preparing || submitting) return;
    if (files.length + images.length > 3) { setError('Tối đa 3 ảnh đánh giá.'); return; }
    const generation = ++imageGeneration.current;
    setPreparing(true); setError('');
    try {
      const prepared: string[] = [];
      for (const file of files) prepared.push(await prepareImageUpload(file, { maxStoredCharacters: 1_050_000, maxEdge: 1600, quality: 0.86 }));
      if (generation === imageGeneration.current) setImages(previous => [...previous, ...prepared]);
    } catch (failure) { if (generation === imageGeneration.current) setError(failure instanceof Error ? failure.message : 'Không thể chuẩn bị ảnh.'); }
    finally { if (generation === imageGeneration.current) setPreparing(false); }
  };
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="review-title">
    <form onSubmit={submit} className="w-full max-w-lg max-h-[90dvh] overflow-y-auto space-y-4 rounded-3xl bg-white p-6 shadow-xl">
      <div className="flex items-start justify-between gap-3"><div><h2 id="review-title" className="text-xl font-black">Đánh giá sau trải nghiệm</h2><p className="text-sm text-slate-500">{salonName} · {serviceTitle}</p></div><button type="button" disabled={submitting} onClick={onClose} aria-label="Đóng đánh giá"><X /></button></div>
      {loading ? <p>Đang kiểm tra lịch hẹn...</p> : !selected ? <p>Chưa có lịch hẹn đủ điều kiện. Đánh giá mở từ giữa giờ hẹn khi đã thanh toán hoặc đặt cọc, không còn giao dịch cần đối soát.</p> : <>
        <label className="block text-sm font-bold">Lịch hẹn<select aria-label="Lịch hẹn" className="mt-1 w-full rounded-xl border p-2" value={bookingId} disabled={submitting || preparing} onChange={(e) => setBookingId(Number(e.target.value))}>{items.map((item) => <option key={item.id} value={item.id}>{item.bookingCode} · {item.serviceName} · {item.appointmentDate}</option>)}</select></label>
        <label className="block text-sm font-bold">Đối tượng đánh giá<select aria-label="Đối tượng đánh giá" className="mt-1 w-full rounded-xl border p-2" value={target} disabled={submitting || preparing} onChange={(e) => setTarget(e.target.value as 'SERVICE' | 'SUPPLIER')}><option value="SERVICE">Dịch vụ</option><option value="SUPPLIER">Nhà cung cấp</option></select></label>
        <fieldset disabled={submitting}><legend className="text-sm font-bold">Số sao</legend><div className="mt-2 flex gap-2">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={`${value} sao`} aria-pressed={rating === value} onClick={() => setRating(value)}><Star className={value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} /></button>)}</div></fieldset>
        <label className="block text-sm font-bold">Nhận xét (tùy chọn)<textarea className="mt-1 w-full rounded-xl border p-3" rows={4} value={comment} disabled={submitting} maxLength={1500} onChange={(e) => setComment(e.target.value)} /></label>
        <div className="space-y-2">
          <label className="block text-sm font-bold" htmlFor="review-images">Ảnh trải nghiệm (tối đa 3)</label>
          <input id="review-images" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={submitting || preparing || images.length >= 3}
            onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void chooseImages(files); }} />
          <p className="text-xs text-slate-500" role="status">{preparing ? 'Đang chuẩn bị ảnh...' : 'JPG, PNG, WEBP, tối đa 10 MB/ảnh. Ảnh đánh giá được công khai; không tải giấy tờ hoặc thông tin riêng tư.'}</p>
          <div className="flex flex-wrap gap-2">{images.map((image, index) => <div key={`${index}:${image}`} className="relative"><img src={image} alt={`Ảnh trải nghiệm ${index + 1}`} className="h-20 w-20 rounded-lg object-cover" /><button type="button" aria-label={`Xóa ảnh ${index + 1}`} disabled={submitting || preparing} onClick={() => setImages(values => values.filter((_, i) => i !== index))} className="absolute right-0 top-0 rounded-full bg-white p-1"><X size={14} /></button></div>)}</div>
        </div>
        <button type="submit" disabled={submitting || preparing} className="w-full rounded-xl bg-pink-600 p-3 font-bold text-white disabled:opacity-50">{submitting ? 'Đang lưu...' : 'Lưu đánh giá'}</button>
      </>}
      {error && <div><p role="alert" className="text-sm text-rose-700">{error}</p>{!selected && !loading && <button type="button" className="mt-2 rounded-xl border px-3 py-2 text-sm" onClick={() => setReloadAttempt((attempt) => attempt + 1)}>Thử lại</button>}</div>}
    </form>
  </div>;
};
