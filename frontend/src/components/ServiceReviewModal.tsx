import React, { useState } from 'react';
import {
  Star,
  X,
  Upload,
  Camera,
  CheckCircle2,
  Sparkles,
  Heart,
  ShieldCheck,
  Image as ImageIcon,
} from 'lucide-react';
import { reviewService, ServiceReviewItem } from '../services/reviewService';

interface ServiceReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceTitle: string;
  salonName: string;
  bookingCode?: string;
  customerName?: string;
  customerAvatar?: string;
  onSuccess?: (review: ServiceReviewItem) => void;
}

const CRITERIA_TAGS = [
  'Chuyên viên tay nghề cao',
  'Không gian sạch sẽ & sang trọng',
  'Đúng giờ hẹn, không phải chờ',
  'Dụng cụ vệ sinh y tế vô trùng',
  'Hiệu quả thấy rõ sau liệu trình',
  'Thư giãn, không đau rát',
  'Phục vụ tận tâm, không chèo kéo',
  'Giá cả xứng đáng chất lượng',
];

const PRESET_FEEDBACK_IMAGES = [
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1512290900672-1f48644558e8?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80',
];

export const ServiceReviewModal: React.FC<ServiceReviewModalProps> = ({
  isOpen,
  onClose,
  serviceTitle,
  salonName,
  bookingCode,
  customerName = 'Khách hàng BeautyLink',
  customerAvatar,
  onSuccess,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([
    'Chuyên viên tay nghề cao',
    'Không gian sạch sẽ & sang trọng',
  ]);
  const [content, setContent] = useState<string>('');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result && typeof reader.result === 'string') {
          setImages((prev) => [...prev, reader.result as string].slice(0, 4));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSelectPresetImage = (url: string) => {
    if (!images.includes(url)) {
      setImages((prev) => [...prev, url].slice(0, 4));
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const getRatingLabel = (stars: number) => {
    switch (stars) {
      case 1:
        return '1 sao · Rất không hài lòng';
      case 2:
        return '2 sao · Chưa hài lòng';
      case 3:
        return '3 sao · Tạm ổn / Bình thường';
      case 4:
        return '4 sao · Hài lòng & phục vụ tốt';
      case 5:
      default:
        return '5 sao · Cực kỳ hài lòng & Xuất sắc!';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && selectedTags.length === 0) return;

    setSubmitting(true);
    setTimeout(() => {
      const fullContent =
        content.trim() ||
        `Dịch vụ rất tuyệt vời! Mình rất hài lòng với sự tận tâm và tay nghề của cơ sở. Sẽ tiếp tục quay lại.`;

      const newReview = reviewService.addReview({
        serviceTitle,
        salonName,
        bookingCode,
        authorName: customerName,
        authorAvatar:
          customerAvatar ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        rating,
        content: fullContent,
        tags: selectedTags,
        images: images.length > 0 ? images : undefined,
      });

      setSubmitting(false);
      setIsSuccess(true);

      setTimeout(() => {
        if (onSuccess) onSuccess(newReview);
        onClose();
      }, 1400);
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-pink-100 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-5 sm:p-6 pb-4 bg-gradient-to-r from-pink-500 via-[#db2777] to-[#be185d] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-200 block">
                Đánh giá trải nghiệm thực tế
              </span>
              <h3 className="text-base sm:text-lg font-black leading-tight">
                Đánh giá dịch vụ làm đẹp
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-900">Cảm ơn đánh giá của bạn!</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Nhận xét của bạn giúp cộng đồng làm đẹp có thêm thông tin hữu ích và giúp cơ sở hoàn thiện chất lượng phục vụ hơn nữa.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Được cộng +20 điểm thưởng PinkPoints</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="overflow-y-auto p-5 sm:p-6 space-y-4">
            {/* Service & Salon Preview */}
            <div className="p-3.5 rounded-2xl bg-pink-50/60 border border-pink-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-[#be185d] block uppercase tracking-wider">
                  {salonName}
                </span>
                <p className="text-xs sm:text-sm font-black text-slate-900 truncate">
                  {serviceTitle}
                </p>
                {bookingCode && (
                  <span className="text-[10px] font-mono text-slate-400">
                    Mã đặt chỗ: {bookingCode}
                  </span>
                )}
              </div>
              <div className="w-9 h-9 rounded-xl bg-white border border-pink-200 flex items-center justify-center text-pink-500 shrink-0">
                <Heart className="w-4 h-4 fill-pink-500" />
              </div>
            </div>

            {/* Star Rating Section */}
            <div className="text-center py-2 bg-gradient-to-b from-amber-50/50 to-transparent rounded-2xl border border-amber-100/60 p-4">
              <span className="text-xs font-bold text-slate-600 block mb-2">
                Bạn đánh giá chất lượng dịch vụ bao nhiêu sao?
              </span>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="p-1 hover:scale-125 transition-transform cursor-pointer"
                    >
                      <Star
                        className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                          active
                            ? 'fill-amber-400 text-amber-400 filter drop-shadow-sm'
                            : 'text-slate-200'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <p className="text-xs font-bold text-amber-600 mt-2">
                {getRatingLabel(hoverRating || rating)}
              </p>
            </div>

            {/* Quick Criteria Tags */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Điểm nổi bật bạn yêu thích (chọn nhanh):
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CRITERIA_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#be185d] text-white border-transparent shadow-xs'
                          : 'bg-white text-slate-600 border-pink-200 hover:border-pink-300 hover:bg-pink-50/50'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Review Comment Textarea */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Cảm nhận chi tiết của bạn sau khi trải nghiệm:
              </label>
              <textarea
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Chia sẻ về tay nghề của kỹ thuật viên, không gian, cảm giác trong và sau khi làm đẹp..."
                className="w-full p-3.5 rounded-2xl border border-pink-200 focus:outline-none focus:border-[#e1146c] text-xs sm:text-sm text-slate-800 bg-white placeholder:text-slate-400"
              />
            </div>

            {/* Add Photo / Evidence */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-[#e1146c]" />
                  <span>Thêm hình ảnh kết quả / không gian (tùy chọn)</span>
                </label>
                <span className="text-[11px] text-slate-400">{images.length}/4 ảnh</span>
              </div>

              {/* Uploaded / Selected images preview */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative w-16 h-16 rounded-xl overflow-hidden border border-pink-200 group"
                  >
                    <img src={img} alt="Feedback" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer text-xs font-bold"
                    >
                      Xóa
                    </button>
                  </div>
                ))}

                {images.length < 4 && (
                  <label className="w-16 h-16 rounded-xl border-2 border-dashed border-pink-300 hover:border-pink-500 bg-pink-50/40 hover:bg-pink-50 flex flex-col items-center justify-center text-slate-500 hover:text-[#be185d] transition cursor-pointer text-[10px]">
                    <Upload className="w-4 h-4 mb-0.5 text-pink-500" />
                    <span>Tải ảnh</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Quick Preset Images */}
              {images.length === 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                  <span>Hoặc chọn mẫu ảnh làm đẹp thực tế:</span>
                  <div className="flex gap-1.5">
                    {PRESET_FEEDBACK_IMAGES.slice(0, 3).map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectPresetImage(url)}
                        className="w-7 h-7 rounded-lg overflow-hidden border border-pink-200 hover:scale-105 transition cursor-pointer"
                        title="Chọn ảnh mẫu này"
                      >
                        <img src={url} alt="sample" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Submit */}
            <div className="pt-3 border-t border-pink-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-pink-200 text-slate-600 hover:bg-pink-50 text-xs font-bold transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 via-[#db2777] to-[#be185d] text-white text-xs font-black shadow-md hover:opacity-95 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{submitting ? 'Đang gửi đánh giá...' : 'Gửi đánh giá dịch vụ'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
