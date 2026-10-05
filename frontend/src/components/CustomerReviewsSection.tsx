import React, { useState, useEffect } from 'react';
import {
  Star,
  CheckCircle2,
  ShieldCheck,
  ThumbsUp,
  MessageSquare,
  Camera,
  Sparkles,
  Plus,
  X,
  Award,
  ArrowRight,
  User,
  Heart,
} from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useScrollReveal } from '../hooks/useScrollReveal';

export interface CustomerReview {
  id: string;
  authorName: string;
  authorAvatar: string;
  verifiedBooking: boolean;
  salonName: string;
  salonCategory: 'spa' | 'clinic' | 'nail' | 'hair';
  serviceTitle: string;
  rating: number;
  date: string;
  content: string;
  images?: string[];
  likesCount: number;
  salonReply?: {
    responderName: string;
    content: string;
    date: string;
  };
}

const INITIAL_REVIEWS: CustomerReview[] = [
  {
    id: 'rev-1',
    authorName: 'Hoàng Thùy Linh',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    verifiedBooking: true,
    salonName: 'An Miên Spa Dưỡng Sinh',
    salonCategory: 'spa',
    serviceTitle: 'Gói Thư Giãn 90 Phút - Chăm Sóc Toàn Thân & Làn Da',
    rating: 5,
    date: '2 ngày trước',
    content:
      'Mình làm văn phòng ngồi máy tính nhiều nên cổ vai gáy cứng đơ. Đặt lịch qua BeautyPink áp mã giảm 50K siêu hời. Đến nơi được bạn lễ tân đón tiếp chu đáo, trà gừng thảo dược ấm nóng thơm nức. Kỹ thuật viên tay nghề cực kỳ vững, bấm huyệt nào đã huyệt đó, gội đầu xong nhẹ bẫng cả người. Chắc chắn sẽ quay lại hàng tuần!',
    images: [
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1519735777090-ec97162dc266?auto=format&fit=crop&w=600&q=80',
    ],
    likesCount: 52,
    salonReply: {
      responderName: 'Ban Quản Lý An Miên Spa',
      content:
        'Dạ An Miên Spa chân thành cảm ơn chị Thùy Linh đã tin chọn và dành tặng đánh giá tuyệt vời. Chúc chị luôn tràn đầy năng lượng và rạng rỡ ạ!',
      date: '1 ngày trước',
    },
  },
  {
    id: 'rev-2',
    authorName: 'Dược sĩ Mai Phương',
    authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
    verifiedBooking: true,
    salonName: 'PMT Aesthetic Clinic',
    salonCategory: 'clinic',
    serviceTitle: 'Liệu Trình Trẻ Hóa & Làm Sáng Da Beauty Radiance 199K',
    rating: 5,
    date: '3 ngày trước',
    content:
      'Ban đầu thấy giá 199K trên app mình hơi lăn tăn vì sợ phát sinh phụ thu hay bị chèo kéo mua gói. Nhưng đến nơi hoàn toàn bất ngờ! Phòng khám chuẩn Y khoa 100%, Bác sĩ chuyên khoa trực tiếp soi da 3D và tư vấn rất tận tâm, không ép uổng gì cả. Da sau khi điện di tinh chất collagen căng bóng thấy rõ ngay lập tức!',
    images: [
      'https://images.unsplash.com/photo-1512290900672-1f55b91b920e?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80',
    ],
    likesCount: 68,
    salonReply: {
      responderName: 'Đội Ngũ Bác Sĩ PMT Clinic',
      content:
        'Cảm ơn chị Mai Phương rất nhiều. Sự hài lòng và tin cậy của chị là động lực lớn nhất của toàn thể y bác sĩ tại PMT!',
      date: '2 ngày trước',
    },
  },
  {
    id: 'rev-3',
    authorName: 'Khánh Vy',
    authorAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
    verifiedBooking: true,
    salonName: 'Yên Trang Beauty Spa & Academy',
    salonCategory: 'clinic',
    serviceTitle: 'Điêu Khắc Chân Mày Hairstroke & Phun Môi Tế Bào Gốc',
    rating: 5,
    date: '5 ngày trước',
    content:
      'Làm chân mày và môi ở đây ưng dã man các nàng ơi! Master vẽ dáng theo đúng tỉ lệ vàng của khuôn mặt mình, làm êm ru không đau tí nào. Về nhà bong nhẹ như bụi phấn mà màu lên chuẩn hồng baby tự nhiên cực kỳ. Lại còn có phiếu bảo hành dặm màu miễn phí 6 tháng nữa!',
    images: [
      'https://images.unsplash.com/photo-1588510841489-f008214744be?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80',
    ],
    likesCount: 45,
  },
  {
    id: 'rev-4',
    authorName: 'Thu Hương',
    authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    verifiedBooking: true,
    salonName: 'Seoul Luxury Skin Center',
    salonCategory: 'clinic',
    serviceTitle: 'Trị Mụn Laser Diode & Cấy HA Căng Bóng Da',
    rating: 5,
    date: '1 tuần trước',
    content:
      'Đặt lịch hẹn trước trên BeautyPink tiện thật sự, đến nơi là nhân viên dẫn vào phòng làm ngay, không phải ngồi chờ 1 phút nào. Dụng cụ ở đây tiệt trùng nguyên gói mở niêm phong trước mặt khách. Lấy mụn rất kỹ mà không để lại vết thâm hay sưng đỏ. Cho 10/10 điểm về chất lượng và độ an toàn!',
    images: [
      'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=600&q=80',
    ],
    likesCount: 38,
  },
  {
    id: 'rev-5',
    authorName: 'Trần Minh Anh',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    verifiedBooking: true,
    salonName: 'Paradise Skin Clinic',
    salonCategory: 'spa',
    serviceTitle: 'Chăm Sóc Da Mặt Chuẩn Y Khoa & Điện Di Tinh Chất C',
    rating: 4.9,
    date: '1 tuần trước',
    content:
      'Cực kỳ ưng ý quy trình chăm sóc khách hàng ở Paradise. Đặt qua app còn được tích lũy điểm PinkPoints để đổi voucher lần sau. Kỹ thuật viên rửa mặt và massage mặt cực kỳ nhẹ nhàng, êm ái đến mức mình ngủ quên luôn. Tỉnh dậy thấy da sáng mịn và tươi tắn hẳn.',
    likesCount: 29,
  },
  {
    id: 'rev-6',
    authorName: 'Ngọc Hân',
    authorAvatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=150&q=80',
    verifiedBooking: true,
    salonName: 'De Paris Nail & Eyelash Studio',
    salonCategory: 'nail',
    serviceTitle: 'Combo Sơn Gel Thạch Hàn Quốc & Nối Mi Thiết Kế',
    rating: 5,
    date: '2 tuần trước',
    content:
      'Sơn gel thạch bóng mướt giữ được hơn 3 tuần không hề sứt mẻ, thợ vẽ móng tỉ mỉ từng chi tiết hoa nhũ. Nối mi sợi tơ siêu nhẹ không hề bị cộm cay mắt hay rụng mi thật. Lại được áp voucher đi 2 người giảm 20% trên BeautyPink quá rẻ!',
    images: [
      'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=600&q=80',
    ],
    likesCount: 41,
  },
];

interface CustomerReviewsSectionProps {
  onBookService?: (serviceTitle: string, salonName: string, price: number, originalPrice: number) => void;
}

export const CustomerReviewsSection: React.FC<CustomerReviewsSectionProps> = React.memo(({
  onBookService,
}) => {
  const [reviews, setReviews] = useState<CustomerReview[]>(INITIAL_REVIEWS);
  const [activeCategory, setActiveCategory] = useState<'all' | 'spa' | 'clinic' | 'nail' | 'with-photos'>('all');
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Review Modal State
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [newAuthor, setNewAuthor] = useState('');
  const [newSalon, setNewSalon] = useState('An Miên Spa Dưỡng Sinh');
  const [newService, setNewService] = useState('Gội đầu dưỡng sinh thảo dược');
  const [newRating, setNewRating] = useState(5);
  const [newContent, setNewContent] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Lock body scroll when review modal or preview image is open
  useBodyScrollLock(Boolean(previewImage || isWriteModalOpen));

  // Close on Escape key
  useEffect(() => {
    if (!previewImage && !isWriteModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewImage) setPreviewImage(null);
        else if (isWriteModalOpen) setIsWriteModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage, isWriteModalOpen]);

  // Toggle like
  const handleToggleLike = (id: string) => {
    setLikedMap((prev) => {
      const isLiked = !prev[id];
      setReviews((revList) =>
        revList.map((r) =>
          r.id === id ? { ...r, likesCount: r.likesCount + (isLiked ? 1 : -1) } : r
        )
      );
      return { ...prev, [id]: isLiked };
    });
  };

  // Submit review
  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuthor.trim() || !newContent.trim()) return;

    const newRevItem: CustomerReview = {
      id: `rev-${Date.now()}`,
      authorName: newAuthor.trim(),
      authorAvatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80`,
      verifiedBooking: true,
      salonName: newSalon,
      salonCategory: 'spa',
      serviceTitle: newService,
      rating: newRating,
      date: 'Vừa xong',
      content: newContent.trim(),
      likesCount: 1,
    };

    setReviews([newRevItem, ...reviews]);
    setSubmitSuccess(true);
    setTimeout(() => {
      setSubmitSuccess(false);
      setIsWriteModalOpen(false);
      setNewAuthor('');
      setNewContent('');
    }, 1500);
  };

  // Filtering
  const filteredReviews = reviews.filter((rev) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'with-photos') return (rev.images?.length ?? 0) > 0;
    return rev.salonCategory === activeCategory;
  });

  const { ref: sectionRef, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.08 });

  return (
    <section
      ref={sectionRef}
      className={`py-12 bg-gradient-to-b from-[#FFF5F7] via-white to-[#FFF5F7] border-t border-b border-pink-100/70 reveal-on-scroll ${
        isVisible ? 'is-revealed' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-[11px] font-black uppercase tracking-wider shadow-xs flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>100% ĐÁNH GIÁ THỰC TẾ TỪ KHÁCH HÀNG</span>
              </span>
              <span className="text-xs text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Đã xác thực lịch hẹn</span>
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
              Khách Hàng Nói Gì Về <span className="text-[#e1146c]">BeautyPink</span>?
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
              Hơn 12.850+ khách hàng đã tin tưởng đặt lịch và trải nghiệm dịch vụ tại các cơ sở Spa, Thẩm mỹ viện & Clinic liên kết trên toàn quốc.
            </p>
          </div>

          {/* Action: Write review button */}
          <button
            type="button"
            onClick={() => setIsWriteModalOpen(true)}
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] hover:from-[#c2185b] hover:to-[#9d174d] text-white text-xs sm:text-sm font-bold shadow-md shadow-pink-500/25 hover:shadow-pink-500/40 transition-all flex items-center gap-2 cursor-pointer self-start md:self-auto shrink-0 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Viết đánh giá của bạn</span>
          </button>
        </div>

        {/* Rating Overview Stats Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-pink-100 mb-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Overall score */}
          <div className="md:col-span-4 text-center md:text-left flex flex-col items-center md:items-start md:border-r border-pink-100 md:pr-6">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-slate-800">4.9</span>
              <span className="text-slate-400 font-bold text-lg">/ 5.0</span>
            </div>
            <div className="flex items-center gap-1 my-2">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className="w-5 h-5 fill-amber-400 text-amber-400"
                />
              ))}
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Dựa trên <strong>12.850+</strong> lượt đánh giá có hóa đơn xác thực
            </span>
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-50 text-[11px] font-bold text-[#be185d]">
              <Award className="w-3.5 h-3.5 text-[#e1146c]" />
              <span>Top 1 Nền tảng Đặt lịch Sắc đẹp hài lòng nhất 2026</span>
            </div>
          </div>

          {/* Rating Bars Breakdown */}
          <div className="md:col-span-5 space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-10 font-bold text-slate-700">5 sao</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full w-[94%]" />
              </div>
              <span className="w-9 text-right text-slate-400 font-semibold">94%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 font-bold text-slate-700">4 sao</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full w-[5%]" />
              </div>
              <span className="w-9 text-right text-slate-400 font-semibold">5%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 font-bold text-slate-700">3 sao</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-amber-300 rounded-full w-[1%]" />
              </div>
              <span className="w-9 text-right text-slate-400 font-semibold">1%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 font-bold text-slate-700">2 sao</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-slate-200 rounded-full w-[0%]" />
              </div>
              <span className="w-9 text-right text-slate-400 font-semibold">0%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 font-bold text-slate-700">1 sao</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-slate-200 rounded-full w-[0%]" />
              </div>
              <span className="w-9 text-right text-slate-400 font-semibold">0%</span>
            </div>
          </div>

          {/* Key Trust Pillars */}
          <div className="md:col-span-3 bg-pink-50/60 rounded-2xl p-4 border border-pink-100 space-y-2 text-xs">
            <div className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider mb-1 text-[#be185d]">
              Chỉ số cam kết chất lượng:
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span>Tay nghề chuyên viên:</span>
              <strong className="text-[#e1146c]">4.95 / 5</strong>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span>Vệ sinh & cơ sở vật chất:</span>
              <strong className="text-[#e1146c]">4.98 / 5</strong>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span>Đúng giá niêm yết:</span>
              <strong className="text-[#e1146c]">100%</strong>
            </div>
          </div>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-6">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === 'all'
                ? 'bg-[#e1146c] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-pink-50 border border-pink-200/80'
            }`}
          >
            Tất cả đánh giá ({reviews.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('with-photos')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeCategory === 'with-photos'
                ? 'bg-[#e1146c] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-pink-50 border border-pink-200/80'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-[#e1146c]" />
            <span>Có hình ảnh thực tế</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('spa')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === 'spa'
                ? 'bg-[#e1146c] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-pink-50 border border-pink-200/80'
            }`}
          >
            💆‍♀️ Spa & Dưỡng sinh
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('clinic')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === 'clinic'
                ? 'bg-[#e1146c] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-pink-50 border border-pink-200/80'
            }`}
          >
            🏥 Clinic Y Khoa & Thẩm mỹ
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('nail')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === 'nail'
                ? 'bg-[#e1146c] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-pink-50 border border-pink-200/80'
            }`}
          >
            💅 Nail & Nối mi
          </button>
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredReviews.map((review) => (
            <div
              key={review.id}
              className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md border border-pink-100 flex flex-col justify-between transition-all group"
            >
              {/* Top author & verified badge */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={review.authorAvatar}
                      alt={review.authorName}
                      className="w-11 h-11 rounded-full object-cover border-2 border-pink-100 shadow-xs"
                    />
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-800 leading-tight">
                        {review.authorName}
                      </h4>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Đã trải nghiệm</span>
                        </span>
                        <span className="text-[11px] text-slate-400">• {review.date}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rating stars */}
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < Math.floor(review.rating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-slate-200 text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Salon & Service Tag */}
                <div className="p-2.5 rounded-2xl bg-pink-50/60 border border-pink-100/80 mb-3 text-xs">
                  <div className="font-bold text-[#be185d] flex items-center gap-1 truncate">
                    <span>📍 {review.salonName}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 truncate mt-0.5">
                    Dịch vụ: <strong>{review.serviceTitle}</strong>
                  </div>
                </div>

                {/* Review Content */}
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed line-clamp-4">
                  "{review.content}"
                </p>

                {/* Attached Real Photos */}
                {review.images && review.images.length > 0 && (
                  <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar">
                    {review.images.map((img, idx) => (
                      <div
                        key={idx}
                        onClick={() => setPreviewImage(img)}
                        className="relative w-16 h-16 rounded-xl overflow-hidden cursor-pointer shrink-0 border border-pink-100 hover:opacity-90 group/img shadow-xs"
                      >
                        <img
                          src={img}
                          alt="Review attachment"
                          className="w-full h-full object-cover group-hover/img:scale-110 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/10 group-hover/img:bg-transparent" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Salon Official Response */}
                {review.salonReply && (
                  <div className="mt-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                      <span className="text-[#be185d] flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        <span>{review.salonReply.responderName}</span>
                      </span>
                      <span className="text-slate-400">{review.salonReply.date}</span>
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed italic">
                      "{review.salonReply.content}"
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Card Actions */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleToggleLike(review.id)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
                    likedMap[review.id]
                      ? 'bg-pink-100 text-[#e1146c]'
                      : 'text-slate-500 hover:text-[#e1146c] hover:bg-pink-50'
                  }`}
                >
                  <ThumbsUp
                    className={`w-3.5 h-3.5 ${
                      likedMap[review.id] ? 'fill-[#e1146c]' : ''
                    }`}
                  />
                  <span>Hữu ích ({review.likesCount})</span>
                </button>

                {onBookService && (
                  <button
                    type="button"
                    onClick={() =>
                      onBookService(review.serviceTitle, review.salonName, 299000, 450000)
                    }
                    className="text-xs font-bold text-[#e1146c] hover:text-[#be185d] flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span>Trải nghiệm ngay</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Image Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-hidden animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity cursor-pointer"
            onClick={() => setPreviewImage(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black cursor-pointer shadow-md"
              title="Đóng (ESC)"
              aria-label="Đóng xem ảnh"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewImage}
              alt="Review attachment preview"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      )}

      {/* Write Review Modal */}
      {isWriteModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 cursor-pointer"
            onClick={() => setIsWriteModalOpen(false)}
            aria-hidden="true"
          />

          <div
            className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl border border-pink-100 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="shrink-0 bg-gradient-to-r from-[#be185d] via-[#db2777] to-[#e1146c] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-white" />
                <h3 className="text-base font-extrabold">Đánh giá trải nghiệm dịch vụ</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWriteModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Đóng (ESC)"
                aria-label="Đóng cửa sổ"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain">
              {submitSuccess ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-slate-800">
                  Cảm ơn đánh giá quý báu của bạn!
                </h4>
                <p className="text-xs text-slate-500">
                  Đánh giá của bạn đã được xuất bản và giúp hàng ngàn khách hàng khác an tâm làm đẹp. Bạn nhận được +20 PinkPoints!
                </p>
              </div>
            ) : (
              <form onSubmit={handleAddReview} className="p-5 sm:p-6 space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Họ và tên của bạn:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Hoàng Thảo"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-pink-200 focus:outline-none focus:border-[#e1146c]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Cơ sở làm đẹp:
                    </label>
                    <select
                      value={newSalon}
                      onChange={(e) => setNewSalon(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-pink-200 focus:outline-none focus:border-[#e1146c] bg-white"
                    >
                      <option value="An Miên Spa Dưỡng Sinh">An Miên Spa Dưỡng Sinh</option>
                      <option value="PMT Aesthetic Clinic">PMT Aesthetic Clinic</option>
                      <option value="Yên Trang Beauty Spa">Yên Trang Beauty Spa</option>
                      <option value="Seoul Luxury Skin Center">Seoul Luxury Skin Center</option>
                      <option value="Paradise Skin Clinic">Paradise Skin Clinic</option>
                      <option value="De Paris Nail & Eyelash">De Paris Nail & Eyelash</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Tên dịch vụ:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Gội đầu, Cấy HA..."
                      value={newService}
                      onChange={(e) => setNewService(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-pink-200 focus:outline-none focus:border-[#e1146c]"
                    />
                  </div>
                </div>

                {/* Star rating selector */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Mức độ hài lòng của bạn:
                  </label>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-pink-50/70 border border-pink-100">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewRating(star)}
                        className="cursor-pointer p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= newRating
                              ? 'fill-amber-400 text-amber-400'
                              : 'fill-slate-200 text-slate-200'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-slate-700 ml-2">
                      {newRating === 5
                        ? 'Tuyệt vời! 🌟'
                        : newRating === 4
                        ? 'Rất hài lòng 👍'
                        : 'Bình thường'}
                    </span>
                  </div>
                </div>

                {/* Comment Text */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Chia sẻ cảm nhận chi tiết của bạn:
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Cảm nhận về tay nghề chuyên viên, không gian, mức độ sạch sẽ và hiệu quả dịch vụ..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-pink-200 focus:outline-none focus:border-[#e1146c] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs font-bold shadow-md shadow-pink-600/30 hover:opacity-95 transition-all mt-1 cursor-pointer"
                >
                  Gửi đánh giá & Nhận 20 PinkPoints
                </button>
              </form>
            )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
});

CustomerReviewsSection.displayName = 'CustomerReviewsSection';
