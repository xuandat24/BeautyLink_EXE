import React, { useState } from 'react';
import {
  ArrowLeft,
  Sparkles,
  MapPin,
  Clock,
  Phone,
  ShieldCheck,
  Award,
  Star,
  CheckCircle2,
  Calendar,
  Share2,
  Heart,
  ChevronRight,
  ExternalLink,
  Check,
  FileCheck,
  UserCheck,
  Coffee,
  Car,
  Wifi,
  CreditCard,
  Camera,
  Users,
  ZoomIn,
  X,
  BadgeCheck,
} from 'lucide-react';
import { NewPartner } from '../data/mockData';
import { CurrentUser } from '../types';
import { reviewService } from '../services/reviewService';
import { ServiceReviewModal } from './ServiceReviewModal';
import { FavoriteToast, FavoriteToastInfo } from './FavoriteToast';

interface PartnerDetailPageProps {
  partner: NewPartner;
  currentUser: CurrentUser | null;
  onBack: () => void;
  onBookService: (serviceTitle: string, salonName: string, price: number, originalPrice?: number) => void;
  onNeedLogin: () => void;
}

interface PartnerCertificate {
  id: string;
  title: string;
  issuer: string;
  code: string;
  year: string;
  image: string;
  description?: string;
}

interface PartnerServiceOffer {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  durationMinutes: number;
  highlight: string;
  category: string;
  image: string;
  rating: number;
  reviewsCount: number;
  experiencedCount: number;
}

export const PartnerDetailPage: React.FC<PartnerDetailPageProps> = ({
  partner,
  currentUser,
  onBack,
  onBookService,
  onNeedLogin,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'services' | 'certificates' | 'reviews'>('all');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedServiceForReview, setSelectedServiceForReview] = useState<string>(partner.specialty || partner.name);
  const [reviewsUpdateTrigger, setReviewsUpdateTrigger] = useState(0);
  const [previewCert, setPreviewCert] = useState<PartnerCertificate | null>(null);
  const [favoriteToast, setFavoriteToast] = useState<FavoriteToastInfo | null>(null);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const handleToggleFavorite = (e: React.MouseEvent, svc: PartnerServiceOffer) => {
    e.stopPropagation();
    const nextState = !favorites[svc.id];
    setFavorites((prev) => ({ ...prev, [svc.id]: nextState }));
    setFavoriteToast({
      id: svc.id,
      title: svc.name,
      salonName: partner.name,
      image: svc.image,
      isFavorited: nextState,
    });
  };

  const formatVND = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  // Mock comprehensive data for the partner shop
  const partnerProfile = {
    name: partner.name,
    subTitle: partner.subTitle || 'HỆ THỐNG THẨM MỸ & LÀM ĐẸP CHUẨN Y KHOA',
    address: partner.address,
    hotline: '1900 8899 - 0988 776 655',
    workingHours: '08:30 - 21:00 (Mở cửa tất cả các ngày trong tuần)',
    logo: partner.logo,
    coverImage: partner.image,
    promoNotice: partner.promoNotice,
    rating: 4.9,
    reviewsCount: 168,
    totalExperienced: '4,850+',
    establishedYear: '2021',
    description:
      `${partner.name} là không gian làm đẹp cao cấp được sáng lập với sứ mệnh mang đến trải nghiệm thẩm mỹ tự nhiên, chuẩn mực y khoa và bền vững. Chúng tôi sử dụng 100% dòng dược mỹ phẩm nhập khẩu sinh học, trang thiết bị công nghệ cao đạt chuẩn FDA Hoa Kỳ và CE Châu Âu, đảm bảo vô trùng tuyệt đối cho từng khách hàng.`,
    amenities: [
      { icon: Wifi, label: 'Wifi tốc độ cao miễn phí' },
      { icon: Car, label: 'Bãi đỗ xe ô tô & xe máy rộng rãi' },
      { icon: Coffee, label: 'Trà thảo mộc & bánh ngọt dưỡng nhan miễn phí' },
      { icon: ShieldCheck, label: 'Phòng VIP vô khuẩn riêng tư 1:1' },
      { icon: CreditCard, label: 'Hỗ trợ thanh toán VietQR, Visa, Master, MoMo' },
      { icon: Award, label: '100% Kỹ thuật viên có chứng chỉ hành nghề' },
    ],
    founder: {
      name: 'Master / Bác sĩ Nguyễn Thùy Trang',
      title: 'Nhà sáng lập & Giám đốc Chuyên môn',
      experience: '12+ năm kinh nghiệm Da liễu & Thẩm mỹ Y khoa',
      bio: 'Bác sĩ chuyên khoa Da liễu Thẩm mỹ tốt nghiệp Đại học Y Dược TP.HCM, từng có 5 năm tu nghiệp chuyên sâu tại Seoul, Hàn Quốc. Tác giả nhiều phác đồ phục hồi da nhạy cảm không xâm lấn được ứng dụng trên toàn quốc. Đạt giải thưởng Bàn Tay Vàng Ngành Làm Đẹp Châu Á 2024.',
      philosophy: 'Vẻ đẹp tự nhiên và sự an toàn của khách hàng là kim chỉ nam trong từng thao tác của chúng tôi.',
      verifiedBadge: 'Chứng thực Y tế Cấp độ 1',
    },
    certificates: [
      {
        id: 'cert-1',
        title: 'Giấy phép hoạt động khám chữa bệnh Chuyên khoa Da Liễu',
        issuer: 'Sở Y Tế TP. Hồ Chí Minh cấp phép',
        code: 'SYT-HCM-GPHĐ/08892',
        year: '2022',
        image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
        description: 'Đầy đủ điều kiện pháp lý hoạt động phòng khám chuyên khoa da liễu và trị liệu thẩm mỹ công nghệ cao.',
      },
      {
        id: 'cert-2',
        title: 'Chứng chỉ Thẩm mỹ Quốc tế CIDESCO Thụy Sĩ (International Beauty Therapist)',
        issuer: 'Hiệp hội Thẩm mỹ Quốc tế CIDESCO Zurich',
        code: 'CIDESCO-CH-2023-8819',
        year: '2023',
        image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
        description: 'Văn bằng chứng nhận tiêu chuẩn tay nghề chuyên gia thẩm mỹ quốc tế cao nhất thế giới.',
      },
      {
        id: 'cert-3',
        title: 'Chứng nhận Đào tạo Master Công nghệ Trẻ hóa Nâng cơ Hifu & Laser Pico',
        issuer: 'Viện Nghiên cứu Da liễu & Thẩm mỹ Hàn Quốc (KDA)',
        code: 'KDA-SEOUL-MASTER-99',
        year: '2024',
        image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80',
        description: 'Kỹ thuật viên trưởng và bác sĩ chuyên môn hoàn thành chương trình master ứng dụng laser sinh học.',
      },
    ],
    services: [
      {
        id: 'svc-p1',
        name: partner.specialty || 'Liệu trình Chăm sóc da chuyên sâu tái sinh tế bào gốc',
        price: 350000,
        originalPrice: 650000,
        durationMinutes: 75,
        highlight: partner.promoNotice || 'Tặng đắp mặt nạ vàng 24K nano',
        category: 'Chăm sóc da',
        image: partner.image,
        rating: 4.9,
        reviewsCount: 168,
        experiencedCount: 1420,
      },
      {
        id: 'svc-p2',
        name: 'Trị mụn viêm & Làm sạch bã nhờn chuẩn Y khoa Aqua Peel',
        price: 420000,
        originalPrice: 750000,
        durationMinutes: 90,
        highlight: '100% dụng cụ tiệt trùng Autoclave dùng riêng',
        category: 'Trị liệu da',
        image: 'https://images.unsplash.com/photo-1512290900672-1f48644558e8?auto=format&fit=crop&w=600&q=80',
        rating: 5.0,
        reviewsCount: 94,
        experiencedCount: 890,
      },
      {
        id: 'svc-p3',
        name: 'Gội đầu dưỡng sinh thảo mộc cổ truyền & Massage vai gáy',
        price: 199000,
        originalPrice: 350000,
        durationMinutes: 60,
        highlight: 'Nước bồ kết vỏ bưởi nấu tươi mỗi ngày',
        category: 'Dưỡng sinh',
        image: 'https://images.unsplash.com/photo-1519735777090-ec97162dc266?auto=format&fit=crop&w=600&q=80',
        rating: 4.9,
        reviewsCount: 215,
        experiencedCount: 1650,
      },
      {
        id: 'svc-p4',
        name: 'Liệu pháp trẻ hóa nâng cơ RF Vi điểm xóa mờ nếp nhăn',
        price: 890000,
        originalPrice: 1500000,
        durationMinutes: 80,
        highlight: 'Bác sĩ trực tiếp điều trị & cam kết hiệu quả',
        category: 'Công nghệ cao',
        image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80',
        rating: 4.8,
        reviewsCount: 82,
        experiencedCount: 620,
      },
    ] as PartnerServiceOffer[],
  };

  const reviews = React.useMemo(() => {
    return reviewService.getReviewsForService(partner.name);
  }, [partner.name, reviewsUpdateTrigger]);

  return (
    <div className="min-h-screen bg-[#FFF9FA] text-slate-900 pb-16">
      {/* 1. Header Navigation Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="bg-white/95 backdrop-blur-md border-b border-pink-100 py-3 px-4 sm:px-8 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl border border-pink-200 bg-pink-50/70 hover:bg-pink-100 text-slate-700 hover:text-[#be185d] transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Quay lại trang chủ</span>
            </button>
            <div className="h-5 w-px bg-pink-200 hidden sm:block" />
            <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
              <span className="text-[#be185d] font-bold">Doanh nghiệp mới tham gia</span>
              <span>/</span>
              <span className="font-extrabold text-slate-800 truncate">{partner.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Đã kiểm định Y tế 100%</span>
            </span>
          </div>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* YÊU CẦU NGƯỜI DÙNG: TÊN VÀ PROFILE CHỨNG CHỈ SẼ ĐƯỢC HIỂN THỊ ĐẦU KHI VÀO TRANG */}
      {/* NGAY ĐẦU TRANG ĐỂ NGƯỜI DÙNG NHÌN THẤY NGAY TỪ ĐẦU, KHÔNG CẦN CUỘN XUỐNG */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
        <div className="bg-white rounded-3xl border-2 border-pink-200 shadow-md p-5 sm:p-7 space-y-6">
          {/* Top Row: Partner Shop Branding & Key Stats */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-pink-100 pb-5">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-pink-50 to-pink-100 border-2 border-pink-300 flex items-center justify-center text-xl sm:text-2xl font-black text-[#be185d] shadow-sm shrink-0">
                {partnerProfile.logo}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-pink-100 text-[#be185d] text-[10px] font-black uppercase tracking-wider">
                    DOANH NGHIỆP MỚI THAM GIA
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{partnerProfile.rating} ({partnerProfile.reviewsCount} đánh giá)</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{partnerProfile.totalExperienced} khách đã trải nghiệm</span>
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                  {partnerProfile.name}
                </h1>
                <p className="text-xs sm:text-sm text-pink-700 font-bold mt-0.5">
                  {partnerProfile.subTitle}
                </p>

                <div className="flex items-center gap-4 mt-2 flex-wrap text-xs text-slate-600">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#e1146c] shrink-0" />
                    <span>{partnerProfile.address}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{partnerProfile.workingHours}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-pink-600 shrink-0" />
                    <span>Hotline: <strong className="text-slate-800">{partnerProfile.hotline}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('services-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 via-[#db2777] to-[#be185d] text-white text-xs sm:text-sm font-black shadow-md shadow-pink-500/20 hover:opacity-95 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                <span>Xem dịch vụ & Đặt lịch</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PROFILE CHỨNG CHỈ HÀNH NGHỀ & CHUYÊN MÔN (HIỂN THỊ ĐẦU TRANG THEO YÊU CẦU) */}
          {/* (Đã lược bỏ phần ảnh đại diện thừa ở dưới theo yêu cầu người dùng) */}
          {/* ========================================================================= */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-pink-100 text-[#be185d] flex items-center justify-center">
                  <BadgeCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                    Hồ sơ Chuyên gia & Danh mục Chứng chỉ Hành nghề Y Tế Đã Thẩm Định
                  </h2>
                  <span className="text-[11px] text-pink-600 font-bold block">
                    Được bảo chứng tính pháp lý & y tế bởi BeautyPink
                  </span>
                </div>
              </div>

              <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                ✓ Đầy đủ giấy phép hoạt động
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Founder / Specialist Information (Clean summary without redundant lower avatar) */}
              <div className="lg:col-span-4 p-4 rounded-2xl bg-gradient-to-br from-[#FFF5F7] via-white to-pink-50/50 border border-pink-200 flex flex-col justify-between space-y-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-pink-100 text-[#be185d] text-[10px] font-black uppercase mb-1.5">
                    <Award className="w-3 h-3" />
                    <span>{partnerProfile.founder.experience}</span>
                  </div>
                  <h3 className="text-sm font-black text-slate-900">
                    {partnerProfile.founder.name}
                  </h3>
                  <p className="text-xs text-pink-700 font-bold">
                    {partnerProfile.founder.title}
                  </p>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {partnerProfile.founder.bio}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white border border-pink-100 text-xs text-slate-700 font-medium flex items-start gap-2 shadow-2xs">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Triết lý:</strong> "{partnerProfile.founder.philosophy}"
                  </span>
                </div>
              </div>

              {/* Verified Certificates Grid with Click-To-Zoom Lightbox */}
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {partnerProfile.certificates.map((cert) => (
                  <div
                    key={cert.id}
                    onClick={() => setPreviewCert(cert)}
                    className="group bg-white rounded-2xl border border-pink-100 hover:border-pink-300 p-2.5 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                  >
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 mb-2">
                      <img
                        src={cert.image}
                        alt={cert.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-black/60 px-2 py-1 rounded-full">
                          <ZoomIn className="w-3 h-3" /> Phóng to
                        </span>
                      </div>
                      <div className="absolute top-1.5 right-1.5 bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-xs flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                        <span>Đã duyệt</span>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <span className="text-[9px] font-bold text-pink-600 block uppercase">
                        Năm {cert.year}
                      </span>
                      <h4 className="text-[11px] font-black text-slate-900 leading-tight line-clamp-2 mt-0.5 group-hover:text-[#be185d] transition-colors">
                        {cert.title}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
                        {cert.issuer}
                      </p>
                      <span className="text-[9px] font-mono font-bold text-slate-400 block mt-1">
                        Mã: {cert.code}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <div className="flex border-b border-pink-100 gap-2 overflow-x-auto no-scrollbar mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'all'
                ? 'border-[#e1146c] text-[#be185d]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#e1146c]" />
            <span>Tất cả dịch vụ & Đánh giá</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'services'
                ? 'border-[#e1146c] text-[#be185d]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Bảng giá dịch vụ ({partnerProfile.services.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('certificates')}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'certificates'
                ? 'border-[#e1146c] text-[#be185d]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <span>Hồ sơ Chứng chỉ chi tiết</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reviews')}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'reviews'
                ? 'border-[#e1146c] text-[#be185d]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
            <span>Đánh giá từ khách hàng ({reviews.length})</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* YÊU CẦU NGƯỜI DÙNG: CÓ RATING CHO TỪNG DỊCH VỤ VÀ SỐ LƯỢT NGƯỜI ĐÃ TRẢI NGHIỆM */}
        {/* ĐỂ NGƯỜI DÙNG NHÌN VÀO SẼ BIẾT KHI MỚI CHỈ NHÌN SƠ QUA BÊN NGOÀI */}
        {/* ========================================================================= */}
        {(activeTab === 'all' || activeTab === 'services') && (
          <div id="services-section" className="space-y-6 mb-10 animate-in fade-in duration-200">
            {/* Section Heading */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>Dịch vụ nổi bật & Bảng giá ưu đãi</span>
                  <span className="text-xs font-bold text-pink-600 bg-pink-100 px-2 py-0.5 rounded-full">
                    {partnerProfile.services.length} dịch vụ
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Từng dịch vụ đều có đánh giá sao riêng biệt và số lượng khách hàng thực tế đã trải nghiệm
                </p>
              </div>
            </div>

            {/* Services Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {partnerProfile.services.map((svc) => (
                <div
                  key={svc.id}
                  className="bg-white rounded-3xl border border-pink-100 p-4 sm:p-5 hover:border-pink-300 shadow-2xs hover:shadow-lg transition flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start gap-3.5 mb-3">
                      <div className="relative shrink-0">
                        <img
                          src={svc.image}
                          alt={svc.name}
                          className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border border-pink-100 bg-pink-50 group-hover:scale-105 transition-transform"
                        />
                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorite(e, svc)}
                          aria-label={favorites[svc.id] ? 'Bỏ yêu thích' : 'Yêu thích dịch vụ'}
                          title={favorites[svc.id] ? 'Đã lưu vào danh sách yêu thích' : 'Thêm vào danh sách yêu thích'}
                          className={`absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 z-10 cursor-pointer shadow-md backdrop-blur-md ${
                            favorites[svc.id]
                              ? 'bg-white text-rose-500 hover:scale-115 shadow-rose-500/25 ring-1 ring-rose-200'
                              : 'bg-white/85 hover:bg-white text-slate-400 hover:text-rose-500 hover:scale-115'
                          }`}
                        >
                          <Heart
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${
                              favorites[svc.id]
                                ? 'fill-rose-500 text-rose-500 scale-110'
                                : 'stroke-[2.2]'
                            }`}
                          />
                        </button>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-pink-50 text-[#be185d] inline-block mb-1">
                          {svc.category}
                        </span>
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-snug line-clamp-2">
                          {svc.name}
                        </h4>

                        {/* RATING & SỐ LƯỢT NGƯỜI ĐÃ TRẢI NGHIỆM CHO TỪNG DỊCH VỤ */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-xs font-black text-amber-900 shadow-2xs">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            <span>{svc.rating} ({svc.reviewsCount} đánh giá)</span>
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            <Users className="w-3 h-3 text-[#e1146c]" />
                            <span>{svc.experiencedCount.toLocaleString('vi-VN')}+ người đã trải nghiệm</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                          <Clock className="w-3.5 h-3.5 text-pink-400" />
                          <span>{svc.durationMinutes} phút</span>
                          <span>·</span>
                          <span className="text-emerald-700 font-bold truncate">
                            ✓ {svc.highlight}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-pink-50 flex items-center justify-between gap-3 mt-2">
                    <div>
                      <div className="text-base sm:text-lg font-black text-[#e1146c]">
                        {formatVND(svc.price)}
                      </div>
                      {svc.originalPrice > svc.price && (
                        <span className="text-[11px] text-slate-400 line-through">
                          {formatVND(svc.originalPrice)}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onBookService(svc.name, partner.name, svc.price, svc.originalPrice)}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-[#be185d] text-white text-xs font-black shadow-xs hover:opacity-95 hover:shadow-md transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Đặt lịch ngay</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Shop Amenities & Space intro */}
            <div className="bg-white rounded-3xl border border-pink-100 p-6 sm:p-8 space-y-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#e1146c]" />
                <span>Tiện ích & Tiêu chuẩn phục vụ tại {partnerProfile.name}</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {partnerProfile.description}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {partnerProfile.amenities.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-pink-50/50 border border-pink-100 flex items-center gap-2.5 text-xs font-bold text-slate-700"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white border border-pink-200 flex items-center justify-center text-[#e1146c] shrink-0 shadow-2xs">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB: CERTIFICATES EXPANDED */}
        {(activeTab === 'all' || activeTab === 'certificates') && (
          <div className="space-y-4 mb-10 animate-in fade-in duration-200">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-xs text-emerald-900 font-bold">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                Toàn bộ chứng chỉ chuyên môn và giấy phép khám chữa bệnh của {partnerProfile.name} đã được đội ngũ thẩm định BeautyPink kiểm tra tính pháp lý nghiêm ngặt.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {partnerProfile.certificates.map((cert) => (
                <div
                  key={cert.id}
                  onClick={() => setPreviewCert(cert)}
                  className="bg-white rounded-3xl border border-pink-100 overflow-hidden shadow-xs hover:shadow-lg transition flex flex-col justify-between cursor-pointer group"
                >
                  <div className="relative aspect-[4/3] w-full bg-pink-50 overflow-hidden">
                    <img
                      src={cert.image}
                      alt={cert.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/40 transition-colors flex items-center justify-center text-white opacity-0 group-hover:opacity-100">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur text-xs font-bold">
                        <ZoomIn className="w-3.5 h-3.5" /> Phóng to xem chi tiết
                      </span>
                    </div>
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>Đã xác minh</span>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-pink-600 uppercase tracking-wider block mb-1">
                        Cấp năm {cert.year}
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                        {cert.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-1">
                        <strong>Cơ quan cấp:</strong> {cert.issuer}
                      </p>
                      {cert.description && (
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                          {cert.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-pink-50 text-[10px] font-mono text-slate-400">
                      Số hiệu văn bằng: {cert.code}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REVIEWS SECTION */}
        {(activeTab === 'all' || activeTab === 'reviews') && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Rating Summary */}
            <div className="bg-white rounded-3xl border border-pink-100 p-6 flex flex-col sm:flex-row items-center justify-between gap-5">
              <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-300 text-white flex flex-col items-center justify-center font-black shadow-md">
                  <span className="text-2xl leading-none">{partnerProfile.rating}</span>
                  <span className="text-[11px]">★/5</span>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-amber-500 mb-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <h3 className="text-base font-black text-slate-900">
                    Điểm đánh giá trải nghiệm thực tế
                  </h3>
                  <p className="text-xs text-slate-500">
                    {reviews.length} đánh giá từ khách hàng đã đặt lịch thành công qua BeautyPink
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsReviewModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-[#be185d] text-white text-xs font-black shadow-xs hover:opacity-95 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                <span>Viết đánh giá cho doanh nghiệp</span>
              </button>
            </div>

            {/* Customer Reviews List */}
            <div className="space-y-3.5">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="bg-white rounded-2xl border border-pink-100 p-4 sm:p-5 hover:border-pink-200 shadow-2xs space-y-2.5 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {rev.authorAvatar ? (
                        <img
                          src={rev.authorAvatar}
                          alt={rev.authorName}
                          className="w-8 h-8 rounded-full object-cover border border-pink-200"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-pink-100 text-[#be185d] font-bold text-xs flex items-center justify-center">
                          {rev.authorName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-bold text-slate-900 block leading-tight">
                          {rev.authorName}
                        </span>
                        <span className="text-[10px] text-slate-400">{rev.date}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">{rev.content}</p>

                  {rev.images && rev.images.length > 0 && (
                    <div className="flex gap-2 pt-1 overflow-x-auto">
                      {rev.images.map((img, i) => (
                        <img
                          key={i}
                          src={img}
                          alt="Ảnh đánh giá"
                          className="w-16 h-16 rounded-xl object-cover border border-pink-100 shrink-0"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal: Phóng To Ảnh Chứng Chỉ */}
      {previewCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-pink-200">
            <div className="p-4 sm:p-5 border-b border-pink-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-pink-600 block">
                  Văn bằng / Chứng chỉ y tế đã kiểm định
                </span>
                <h3 className="text-sm sm:text-base font-black text-slate-900 line-clamp-1">
                  {previewCert.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCert(null)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-center">
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-inner">
                <img
                  src={previewCert.image}
                  alt={previewCert.title}
                  className="w-full max-h-[500px] object-contain mx-auto"
                />
              </div>

              <div className="text-left p-4 rounded-2xl bg-pink-50/50 border border-pink-100 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cơ quan thẩm quyền cấp:</span>
                  <strong className="text-slate-800">{previewCert.issuer}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Năm cấp:</span>
                  <strong className="text-slate-800">{previewCert.year}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số hiệu văn bằng:</span>
                  <strong className="text-pink-600 font-mono">{previewCert.code}</strong>
                </div>
                {previewCert.description && (
                  <p className="text-slate-600 pt-2 border-t border-pink-100 leading-relaxed">
                    {previewCert.description}
                  </p>
                )}
              </div>
            </div>

            <div className="p-3.5 border-t border-pink-100 bg-pink-50/30 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewCert(null)}
                className="px-5 py-2 rounded-xl bg-[#be185d] text-white text-xs font-bold hover:bg-[#9d174d] cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {isReviewModalOpen && (
        <ServiceReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          serviceTitle={selectedServiceForReview}
          salonName={partner.name}
          customerName={currentUser?.name}
          onSuccess={() => {
            setReviewsUpdateTrigger((prev) => prev + 1);
            setIsReviewModalOpen(false);
          }}
        />
      )}

      {/* Professional Favorite Toast */}
      <FavoriteToast
        toast={favoriteToast}
        onClose={() => setFavoriteToast(null)}
      />
    </div>
  );
};
