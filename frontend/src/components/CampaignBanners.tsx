import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowUpRight,
  Clock,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  BookOpen,
  Copy,
  Tag,
  X,
  Heart,
  Share2,
  Flame,
  Star,
} from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useScrollReveal } from '../hooks/useScrollReveal';

export interface BannerSlide {
  id: string;
  type: 'ad' | 'tip'; // 'ad' = Quảng cáo & Deal, 'tip' = Bí kíp làm đẹp
  headerTitle: string;
  tag: string;
  category: 'all' | 'ad' | 'tip' | 'clinic' | 'spa';
  title: string;
  subtitle: string;
  priceHighlight?: string;
  originalPrice?: string;
  discountBadge?: string;
  ctaText: string;
  bgStyle: string; // Tailored gradient/background
  image: string;
  doctorBg?: string;
  partnerLogos?: string[];
  hotline?: string;
  badgeColor?: string;
  // Detail info for modal
  tipDetails?: {
    readingTime: string;
    expertDoctor: string;
    targetSkin: string;
    summary: string;
    steps: {
      stepNumber: number;
      stepTitle: string;
      description: string;
      productTip: string;
    }[];
    expertAdvice: string;
    recommendedService: {
      title: string;
      salonName: string;
      price: number;
      originalPrice: number;
    };
  };
  dealDetails?: {
    serviceTitle: string;
    salonName: string;
    price: number;
    originalPrice: number;
    voucherCode?: string;
    features: string[];
    branches: string[];
  };
}

const BANNER_SLIDES: BannerSlide[] = [
  // 1. PMT AESTHETIC CLINIC (Replicating Image 2 Center)
  {
    id: 'pmt-clinic',
    type: 'ad',
    category: 'clinic',
    headerTitle: 'PMT AESTHETIC CLINIC - TRỊ NÁM CHUYÊN SÂU HÀNG ĐẦU VIỆT NAM',
    tag: 'CLINIC Y KHOA',
    title: 'LÀM SÁNG DA TỨC THÌ\nVới Liệu Trình Chống Lão Hóa BEAUTY RADIANCE',
    subtitle: 'Công nghệ trẻ hóa da hàng đầu Hoa Kỳ - Kích thích collagen tự thân đa tầng',
    priceHighlight: '199K',
    originalPrice: '2.500.000đ',
    discountBadge: 'GIẢM 90%',
    ctaText: 'Nhận Ưu Đãi 199K',
    bgStyle: 'bg-gradient-to-r from-[#0d4f55] via-[#115e59] to-[#042f2e]',
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80',
    doctorBg: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=500&q=80',
    dealDetails: {
      serviceTitle: 'Liệu Trình Trẻ Hóa & Làm Sáng Da Tức Thì Beauty Radiance',
      salonName: 'PMT Aesthetic Clinic',
      price: 199000,
      originalPrice: 2500000,
      voucherCode: 'PMT199K',
      features: [
        'Soi da 3D và lập phác đồ cùng Bác sĩ Da liễu 1:1',
        'Điện di tinh chất Collagen tươi & Vitamin C thế hệ mới',
        'Chiếu ánh sáng sinh học phục hồi tầng sâu',
        'Cam kết hiệu quả sáng mịn ngay buổi đầu tiên',
      ],
      branches: ['Quận 1, TP.HCM', 'Cầu Giấy, Hà Nội', 'Hải Châu, Đà Nẵng'],
    },
  },

  // 2. RẠNG RỠ MÙA THU (Replicating Image 3 Center)
  {
    id: 'autumn-deal',
    type: 'ad',
    category: 'ad',
    headerTitle: 'Hot Deal Làm Đẹp & Voucher Spa Ưu Đãi 77% | BeautyLink',
    tag: 'SIÊU DEAL MÙA THU',
    title: 'RẠNG RỠ MÙA THU\nSĂN DEAL Vi Vu',
    subtitle: 'Đại tiệc làm đẹp đón mùa lá rụng - Giảm đến 77% hàng trăm dịch vụ Spa & Clinic',
    priceHighlight: 'Ưu Đãi 77%',
    discountBadge: 'HOT DEAL',
    ctaText: 'Săn Deal Vi Vu Ngay',
    bgStyle: 'bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#fb923c]',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    hotline: '0343 131 008',
    dealDetails: {
      serviceTitle: 'Combo Rạng Rỡ Mùa Thu: Tắm Trắng Phi Thuyền & Trẻ Hóa Da',
      salonName: 'Hệ Thống Spa Đối Tác BeautyLink',
      price: 389000,
      originalPrice: 1690000,
      voucherCode: 'MUATHU77',
      features: [
        'Áp dụng tại hơn 180+ cơ sở spa uy tín liên kết',
        'Tặng kèm voucher 100.000đ khi đi nhóm từ 2 người',
        'Không phát sinh chi phí phụ thu cuối tuần',
      ],
      branches: ['Toàn quốc (Hà Nội, TP.HCM, Đà Nẵng, Cần Thơ)'],
    },
  },

  // 3. BÍ KÍP LÀM ĐẸP: PHỤC HỒI GLASS SKIN (Beauty Tip 1)
  {
    id: 'tip-glass-skin',
    type: 'tip',
    category: 'tip',
    headerTitle: 'BÍ KÍP LÀM ĐẸP: 4 BƯỚC PHỤC HỒI HÀNG RÀO DA CĂNG BÓNG CHUẨN GLASS SKIN',
    tag: 'BÍ KÍP CHĂM DA CHUẨN HÀN',
    title: 'PHỤC HỒI HÀNG RÀO DA:\nRoutine 4 Bước Căng Bóng Chuẩn Glass Skin',
    subtitle: 'Công thức cấp ẩm đa tầng HA & B5 cứu nguy làn da khô ráp, bong tróc và sau peel',
    priceHighlight: 'Bí Kíp Y Khoa',
    discountBadge: 'BÍ KÍP VÀNG',
    ctaText: 'Đọc Bí Kíp Chi Tiết',
    bgStyle: 'bg-gradient-to-r from-[#4c1d95] via-[#6b21a8] to-[#9333ea]',
    image: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=800&q=80',
    tipDetails: {
      readingTime: '3 phút đọc',
      expertDoctor: 'Bác sĩ Da liễu Vũ Hoài Nam (12 năm kinh nghiệm)',
      targetSkin: 'Da nhạy cảm, thiếu nước, bong tróc sau treatment',
      summary:
        'Làn da căng bóng ngậm nước như sương mai (Glass Skin) không đến từ lớp trang điểm dày mà bắt nguồn từ một hàng rào ẩm (Skin Barrier) khỏe khoắn được cấp ẩm đa tầng.',
      steps: [
        {
          stepNumber: 1,
          stepTitle: 'Làm sạch dịu nhẹ với pH 5.5',
          description:
            'Tuyệt đối không dùng sữa rửa mặt tạo bọt nhiều hoặc có hạt scrub làm xước màng bảo vệ tự nhiên.',
          productTip: 'Nên chọn sản phẩm chứa Amino Acid hoặc Gel tràm trà/cúc La Mã hữu cơ.',
        },
        {
          stepNumber: 2,
          stepTitle: 'Tưới ẩm đa tầng với Hyaluronic Acid (HA) phân tử nhỏ',
          description:
            'Thoa serum HA ngay khi da còn hơi ẩm nước để hút ẩm ngược vào biểu bì, vỗ nhẹ 60 giây.',
          productTip: 'Kết hợp thêm Vitamin B5 (Panthenol) 5% để làm dịu các vùng đỏ rát tức thì.',
        },
        {
          stepNumber: 3,
          stepTitle: 'Khóa màng Lipid với Ceramide & Peptide',
          description:
            'Kem dưỡng ẩm chứa phức hợp Ceramide 1-3-6 tái lập bức tường sinh học ngăn ngừa thoát hơi nước.',
          productTip: 'Thoa một lượng bằng hạt đậu, làm ấm lòng bàn tay và áp nhẹ lên toàn mặt.',
        },
        {
          stepNumber: 4,
          stepTitle: 'Bảo vệ kép với kem chống nắng phổ rộng SPF 50+ PA++++',
          description:
            'Tia UV là kẻ thù số 1 phá hủy collagen và hàng rào da. Thoa đủ 2 lóng tay trước khi ra ngoài 20 phút.',
          productTip: 'Chọn dòng KCN quang phổ rộng có màng lọc Tinosorb hoặc Zinc Oxide nano.',
        },
      ],
      expertAdvice:
        '“Khi da đang kích ứng đỏ, hãy tạm ngưng toàn bộ acid nồng độ cao (AHA/BHA/Retinol). Tập trung phục hồi tối giản 7 ngày bạn sẽ thấy nền da căng bóng tự nhiên trở lại.”',
      recommendedService: {
        title: 'Liệu Trình Cấy Căng Bóng HA Đa Tầng & Điện Di Tế Bào Gốc',
        salonName: 'Seoul Luxury Skin Center',
        price: 399000,
        originalPrice: 1200000,
      },
    },
  },

  // 4. TRỊ MỤN CHUẨN Y KHOA (Replicating Image 2 Left)
  {
    id: 'acne-clinic',
    type: 'ad',
    category: 'clinic',
    headerTitle: 'PHÁC ĐỒ TRỊ MỤN CHUẨN Y KHOA - SẠCH MỤN, MỜ THÂM KHÔNG ĐỂ LẠI SẸO',
    tag: 'TRỊ MỤN CHUYÊN SÂU',
    title: 'TRỊ MỤN CHUẨN Y KHOA\nSạch mụn, da láng mịn tự tin',
    subtitle: 'Lấy nhân mụn chuẩn vô trùng y khoa + Chiếu ánh sáng sinh học Blue Light kháng viêm',
    priceHighlight: '150K',
    originalPrice: '650.000đ',
    discountBadge: 'GIẢM 77%',
    ctaText: 'Click Vào Để Săn Deal',
    bgStyle: 'bg-gradient-to-r from-[#0369a1] via-[#0284c7] to-[#38bdf8]',
    image: 'https://images.unsplash.com/photo-1512290900672-1f55b91b920e?auto=format&fit=crop&w=800&q=80',
    dealDetails: {
      serviceTitle: 'Gói Trị Mụn Chuẩn Y Khoa 14 Bước Vô Trùng Tuyệt Đối',
      salonName: 'Phòng Khám Da Liễu O2 Skin Partner',
      price: 150000,
      originalPrice: 650000,
      voucherCode: 'SACHMUN150',
      features: [
        'Dụng cụ tiệt trùng đóng gói riêng biệt từng khách hàng',
        'Lấy sạch tận gốc nhân mụn ẩn, mụn đầu đen không gây thâm rỗ',
        'Đắp mặt nạ thảo dược làm dịu & kháng khuẩn cấp tốc',
      ],
      branches: ['Hệ thống 15 chi nhánh tại TP.HCM & Hà Nội'],
    },
  },

  // 5. GỘI ĐẦU DƯỠNG SINH (Replicating Image 2 Right)
  {
    id: 'herbal-scalp',
    type: 'ad',
    category: 'spa',
    headerTitle: 'GỘI ĐẦU DƯỠNG SINH THẢO MỘC - KHẮC TINH CĂNG THẲNG MỆT MỎI CỔ VAI GÁY',
    tag: 'DƯỠNG SINH & TRỊ LIỆU',
    title: 'GỘI ĐẦU DƯỠNG SINH\nKHẮC TINH MỆT MỎI',
    subtitle: 'Canh thuốc thảo dược 12 vị nấu ấm nóng + Đả thông kinh lạc, giảm đau nửa đầu',
    priceHighlight: 'Chỉ 99K',
    originalPrice: '350.000đ',
    discountBadge: 'ƯU ĐÃI 99K',
    ctaText: 'Click Để Đặt Lịch',
    bgStyle: 'bg-gradient-to-r from-[#78350f] via-[#92400e] to-[#b45309]',
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
    dealDetails: {
      serviceTitle: 'Gội Đầu Dưỡng Sinh Thảo Mộc 70 Phút & Massage Cổ Vai Gáy',
      salonName: 'An Miên Spa Dưỡng Sinh',
      price: 99000,
      originalPrice: 350000,
      voucherCode: 'DUONGSINH99',
      features: [
        'Nước gội bồ kết, vỏ bưởi, hà thủ ô nấu ấm tại chỗ',
        'Massage bấm 14 huyệt đạo vùng đầu, cổ, vai gáy giải tỏa stress',
        'Ngâm chân thảo dược muối hồng Himalaya thư giãn sâu',
      ],
      branches: ['Quận 3, TP.HCM', 'Bình Thạnh, TP.HCM', 'Đống Đa, Hà Nội'],
    },
  },

  // 6. PHUN XĂM THẨM MỸ HỒNG SEN (Replicating Image 3 Right & Image 1)
  {
    id: 'brows-tattoo',
    type: 'ad',
    category: 'ad',
    headerTitle: 'PHUN XĂM THẨM MỸ CHÂU ÂU - CÔNG NGHỆ ĐIÊU KHẮC VI SỢI TỰ NHIÊN',
    tag: 'CÔNG NGHỆ ĐỘC QUYỀN',
    title: 'PHUN XĂM THẨM MỸ HỒNG SEN\nKhắc sợi Hairstroke & Phun môi vi chạm',
    subtitle: 'Bảo hành dặm lại miễn phí 6 tháng - Mực hữu cơ nhập khẩu Đức không trổ xanh đỏ',
    priceHighlight: 'Tặng 500K',
    discountBadge: 'CHÂU ÂU',
    ctaText: 'BOOK NOW ↗',
    bgStyle: 'bg-gradient-to-r from-[#18181b] via-[#27272a] to-[#09090b]',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
    partnerLogos: ['Quy Brows', 'Yên Trang', 'Châu Beauty', 'Ly Beauty', 'Jivi Center'],
    dealDetails: {
      serviceTitle: 'Điêu Khắc Chân Mày Hairstroke Vi Chạm & Phun Môi Tế Bào Gốc',
      salonName: 'Viện Thẩm Mỹ Quốc Tế Hồng Sen',
      price: 899000,
      originalPrice: 2800000,
      voucherCode: 'PHUNXAM500',
      features: [
        'Thiết kế dáng chân mày chuẩn tỉ lệ vàng phong thủy gương mặt',
        'Kim Nano siêu mảnh không gây đau rát hay sưng phù',
        'Miễn phí dặm lại không giới hạn trong vòng 6 tháng',
      ],
      branches: ['Quận 10, TP.HCM', 'Ba Đình, Hà Nội', 'Ninh Kiều, Cần Thơ'],
    },
  },

  // 7. BÍ KÍP LÀM ĐẸP: DƯỠNG MÔI SAU PHUN (Beauty Tip 2)
  {
    id: 'tip-lips',
    type: 'tip',
    category: 'tip',
    headerTitle: 'BÍ KÍP LÀM ĐẸP: CÁCH CHĂM SÓC MÔI SAU PHUN LÊN MÀU ĐỀU ĐẸP, TỰ NHIÊN',
    tag: 'CẨM NANG PHUN MÔI',
    title: 'CHĂM SÓC MÔI SAU PHUN:\nBí Quyết Lên Màu Chuẩn Hồng Baby Không Loang',
    subtitle: 'Lời khuyên từ Master phun xăm 10 năm kinh nghiệm: Ăn gì, kiêng gì và bôi gì đúng cách',
    priceHighlight: 'Mẹo Chuyên Gia',
    discountBadge: 'BÍ KÍP HOT',
    ctaText: 'Xem Cẩm Nang Dưỡng Môi',
    bgStyle: 'bg-gradient-to-r from-[#be123c] via-[#e11d48] to-[#fb7185]',
    image: 'https://images.unsplash.com/photo-1588510841489-f008214744be?auto=format&fit=crop&w=800&q=80',
    tipDetails: {
      readingTime: '2.5 phút đọc',
      expertDoctor: 'Master Yến Trang (Chuyên gia Phun thêu vi điểm quốc tế)',
      targetSkin: 'Môi mới phun từ ngày 1 đến ngày 30 sau dịch vụ',
      summary:
        'Giai đoạn sau phun xăm quyết định 50% độ tươi và bền của màu môi. Nắm vững quy tắc giữ ẩm và dinh dưỡng giúp môi bong nhẹ như hạt bụi và bật tone rạng rỡ.',
      steps: [
        {
          stepNumber: 1,
          stepTitle: 'Thấm nước mô cẩn thận trong 48 giờ đầu',
          description:
            'Dùng bông tẩy trang thấm nhẹ nước muối sinh lý 0.9% để lau sạch huyết tương đọng lại trên bề mặt môi, tránh đóng vảy dày.',
          productTip: 'Thực hiện 3-4 lần/ngày sau khi ăn uống.',
        },
        {
          stepNumber: 2,
          stepTitle: 'Để môi bong tróc tự nhiên, tuyệt đối không cạy gỡ',
          description:
            'Sau 2-3 ngày môi bắt đầu se lại và bong vảy mỏng. Hãy để môi tự rơi vảy để tránh làm mất màu và gây thâm sẹo.',
          productTip: 'Nếu môi khô rát quá mức, thoa một lớp mỏng dưỡng tế bào gốc chuyên dụng.',
        },
        {
          stepNumber: 3,
          stepTitle: 'Bổ sung nước ép dứa, cà rốt và cà chua',
          description:
            'Vitamin C và Bromelain trong dứa giúp kích hoạt sắc tố hồng tự nhiên và tăng cường đề kháng cho niêm mạc môi.',
          productTip: 'Uống 1 cốc nước ép dứa hoặc cam tươi nguyên chất mỗi ngày trong 2 tuần.',
        },
        {
          stepNumber: 4,
          stepTitle: 'Chống nắng cho môi và duy trì son dưỡng dưỡng ẩm cao',
          description:
            'Ánh nắng mặt trời kích thích hắc sắc tố Melanin khiến màu môi bị sẫm lại sau khi bong.',
          productTip: 'Sử dụng son dưỡng có chỉ số chống nắng SPF 15+ khi ra ngoài trời.',
        },
      ],
      expertAdvice:
        '“Màu môi sau khi bong thường sẽ nhạt và hơi tối trong 2 tuần đầu do tế bào môi đang tái tạo. Đừng lo lắng! Màu sẽ lên đều và tươi tắn chuẩn nhất sau 30-45 ngày.”',
      recommendedService: {
        title: 'Phun Môi Collagen Tế Bào Gốc Siêu Vi Chạm',
        salonName: 'Yên Trang Beauty Spa & Academy',
        price: 699000,
        originalPrice: 2000000,
      },
    },
  },
];

interface CampaignBannersProps {
  onOpenCampaign?: (campaignTitle: string) => void;
  onBookDeal?: (title: string, salonName: string, price: number, originalPrice: number) => void;
}

export const CampaignBanners: React.FC<CampaignBannersProps> = ({
  onOpenCampaign,
  onBookDeal,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'ad' | 'tip' | 'clinic' | 'spa'>('all');
  const [activeModalSlide, setActiveModalSlide] = useState<BannerSlide | null>(null);
  const [copiedVoucher, setCopiedVoucher] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  // Lock body scroll when modal is active
  useBodyScrollLock(Boolean(activeModalSlide));

  // Close on Escape key
  useEffect(() => {
    if (!activeModalSlide) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveModalSlide(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModalSlide]);

  const filteredSlides = BANNER_SLIDES.filter((slide) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'ad') return slide.type === 'ad';
    if (selectedCategory === 'tip') return slide.type === 'tip';
    return slide.category === selectedCategory;
  });

  // Ensure index stays in range when filter changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedCategory]);

  // Autoplay with pause-on-hover
  useEffect(() => {
    if (!isAutoPlay || activeModalSlide) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % filteredSlides.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isAutoPlay, activeModalSlide, filteredSlides.length]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + filteredSlides.length) % filteredSlides.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % filteredSlides.length);
  };

  const handleSelectSlide = (slide: BannerSlide) => {
    setActiveModalSlide(slide);
  };

  const currentSlide = filteredSlides[currentIndex] || BANNER_SLIDES[0];

  // Calculate indices for peeking side banners
  const prevIndex = (currentIndex - 1 + filteredSlides.length) % filteredSlides.length;
  const nextIndex = (currentIndex + 1) % filteredSlides.length;
  const prevSlide = filteredSlides[prevIndex];
  const nextSlide = filteredSlides[nextIndex];

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedVoucher(true);
    setTimeout(() => setCopiedVoucher(false), 2200);
  };

  const { ref: sectionRef, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.08 });

  return (
    <section
      ref={sectionRef}
      className={`py-8 max-w-7xl mx-auto px-4 sm:px-6 select-none reveal-on-scroll ${
        isVisible ? 'is-revealed' : ''
      }`}
      onMouseEnter={() => setIsAutoPlay(false)}
      onMouseLeave={() => setIsAutoPlay(true)}
    >
      {/* Top Header with Active Slide Headline (Replicating exact title format of Image 2 & 3) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-pink-100 text-[#e1146c] text-[10px] font-black uppercase tracking-wider">
              {currentSlide.type === 'tip' ? '💡 BÍ KÍP SẮC ĐẸP' : '🔥 QUẢNG CÁO & HOT DEAL'}
            </span>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Cập nhật mỗi ngày • Kiểm định uy tín
            </span>
          </div>

          <h2 className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight leading-snug uppercase flex items-center gap-2">
            <span>{currentSlide.headerTitle}</span>
            <Sparkles className="w-5 h-5 text-[#e1146c] shrink-0 animate-pulse" />
          </h2>
        </div>

        {/* Filter Tabs (Quảng cáo / Bí kíp / Clinic / Dưỡng sinh) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-[#e1146c] text-white shadow-xs'
                : 'bg-pink-50 text-slate-600 hover:bg-pink-100 hover:text-[#e1146c]'
            }`}
          >
            Tất cả ({BANNER_SLIDES.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('ad')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'ad'
                ? 'bg-[#e1146c] text-white shadow-xs'
                : 'bg-pink-50 text-slate-600 hover:bg-pink-100 hover:text-[#e1146c]'
            }`}
          >
            🔥 Quảng cáo & Deal
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('tip')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'tip'
                ? 'bg-[#e1146c] text-white shadow-xs'
                : 'bg-pink-50 text-slate-600 hover:bg-pink-100 hover:text-[#e1146c]'
            }`}
          >
            💡 Bí kíp làm đẹp
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('clinic')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'clinic'
                ? 'bg-[#e1146c] text-white shadow-xs'
                : 'bg-pink-50 text-slate-600 hover:bg-pink-100 hover:text-[#e1146c]'
            }`}
          >
            🏥 Clinic Y Khoa
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('spa')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'spa'
                ? 'bg-[#e1146c] text-white shadow-xs'
                : 'bg-pink-50 text-slate-600 hover:bg-pink-100 hover:text-[#e1146c]'
            }`}
          >
            💆‍♀️ Dưỡng Sinh
          </button>
        </div>
      </div>

      {/* Main 3D Carousel Stage (Replicating exact layout of Image 2 & 3 with Peeking Side Banners) */}
      <div className="relative overflow-hidden py-2">
        {/* Floating Left Navigation Arrow */}
        <button
          type="button"
          onClick={handlePrev}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/95 text-slate-700 hover:text-[#e1146c] hover:bg-white flex items-center justify-center shadow-lg border border-pink-100/80 transition-all hover:scale-110 active:scale-95 cursor-pointer"
          title="Banner trước"
        >
          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-pink-700" />
        </button>

        {/* Floating Right Navigation Arrow */}
        <button
          type="button"
          onClick={handleNext}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/95 text-slate-700 hover:text-[#e1146c] hover:bg-white flex items-center justify-center shadow-lg border border-pink-100/80 transition-all hover:scale-110 active:scale-95 cursor-pointer"
          title="Banner kế tiếp"
        >
          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-pink-700" />
        </button>

        {/* Carousel Tracks */}
        <div className="flex items-center justify-center gap-3 sm:gap-5 w-full">
          {/* Peeking Left Slide (Click to jump to prev) */}
          <div
            onClick={handlePrev}
            className="hidden md:block w-[22%] lg:w-[24%] h-[260px] lg:h-[300px] rounded-3xl overflow-hidden relative cursor-pointer opacity-60 hover:opacity-85 transition-all duration-300 scale-95 hover:scale-98 shadow-md border border-pink-200/50 shrink-0"
          >
            <div className={`absolute inset-0 ${prevSlide.bgStyle}`} />
            <img
              src={prevSlide.image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-5 flex flex-col justify-between">
              <span className="self-start px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[9px] font-black uppercase">
                {prevSlide.tag}
              </span>
              <div>
                <h4 className="text-white text-sm font-extrabold line-clamp-2 leading-tight">
                  {prevSlide.title}
                </h4>
                <div className="mt-2 text-[11px] font-bold text-pink-300 flex items-center gap-1">
                  <span>Xem thêm</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          </div>

          {/* Center Main Hero Slide (Prominent Focus) */}
          <div
            onClick={() => handleSelectSlide(currentSlide)}
            className="w-full md:w-[54%] lg:w-[52%] min-h-[280px] sm:min-h-[320px] rounded-3xl overflow-hidden relative cursor-pointer shadow-xl hover:shadow-2xl hover:shadow-pink-500/20 transition-all duration-500 group border border-pink-200/80 shrink-0 flex flex-col justify-between"
          >
            {/* Background Gradient */}
            <div className={`absolute inset-0 ${currentSlide.bgStyle}`} />

            {/* Background Aesthetic Imagery */}
            <div className="absolute right-0 top-0 bottom-0 w-1/2 sm:w-2/5 overflow-hidden">
              <img
                src={currentSlide.image}
                alt={currentSlide.title}
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
            </div>

            {/* Doctor / Specialist subtle background in clinical banners */}
            {currentSlide.doctorBg && (
              <div className="absolute right-28 top-0 bottom-0 w-32 opacity-25 hidden sm:block pointer-events-none">
                <img
                  src={currentSlide.doctorBg}
                  alt="Doctor"
                  className="w-full h-full object-cover object-top"
                />
              </div>
            )}

            {/* Decorative Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-transparent z-10" />

            {/* Content Top */}
            <div className="relative z-20 p-5 sm:p-7 max-w-md sm:max-w-lg">
              {/* Category Badge & Starburst */}
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/25 text-white text-[11px] font-black uppercase tracking-wider shadow-xs">
                  {currentSlide.type === 'tip' ? (
                    <BookOpen className="w-3.5 h-3.5 text-yellow-300" />
                  ) : (
                    <Flame className="w-3.5 h-3.5 text-pink-300" />
                  )}
                  <span>{currentSlide.tag}</span>
                </span>

                {currentSlide.discountBadge && (
                  <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-wider animate-pulse shadow">
                    {currentSlide.discountBadge}
                  </span>
                )}
              </div>

              {/* Title with styled typography */}
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-white leading-tight tracking-tight drop-shadow-md whitespace-pre-line">
                {currentSlide.title}
              </h3>

              {/* Subtitle */}
              <p className="text-xs sm:text-sm text-pink-100/90 mt-2 line-clamp-2 max-w-sm font-medium">
                {currentSlide.subtitle}
              </p>
            </div>

            {/* Content Bottom / Price Highlight / CTA */}
            <div className="relative z-20 p-5 sm:p-7 pt-0 flex items-end justify-between gap-4">
              {/* Price / Highlight badge */}
              <div className="flex items-baseline gap-2">
                {currentSlide.priceHighlight && (
                  <div className="flex flex-col">
                    {currentSlide.originalPrice && (
                      <span className="text-[11px] text-pink-200/80 line-through font-semibold">
                        Giá gốc: {currentSlide.originalPrice}
                      </span>
                    )}
                    <span className="text-2xl sm:text-3xl font-black text-yellow-300 drop-shadow">
                      {currentSlide.priceHighlight}
                    </span>
                  </div>
                )}
                {currentSlide.hotline && (
                  <span className="text-[11px] text-white/90 font-medium hidden sm:inline">
                    📞 {currentSlide.hotline}
                  </span>
                )}
              </div>

              {/* Action Button */}
              <button
                type="button"
                className="px-5 py-2.5 sm:px-6 sm:py-3 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-pink-600/40 group-hover:scale-105 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>{currentSlide.ctaText}</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>

            {/* Partner logos banner for Phun xăm thẩm mỹ */}
            {currentSlide.partnerLogos && (
              <div className="relative z-20 px-6 py-2 bg-black/40 backdrop-blur-xs border-t border-white/10 flex items-center gap-4 overflow-hidden text-[10px] text-white/70 font-semibold">
                <span className="text-pink-300">Đối tác liên kết:</span>
                <div className="flex items-center gap-3">
                  {currentSlide.partnerLogos.map((logo, idx) => (
                    <span key={idx} className="bg-white/10 px-2 py-0.5 rounded">
                      {logo}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Peeking Right Slide (Click to jump to next) */}
          <div
            onClick={handleNext}
            className="hidden md:block w-[22%] lg:w-[24%] h-[260px] lg:h-[300px] rounded-3xl overflow-hidden relative cursor-pointer opacity-60 hover:opacity-85 transition-all duration-300 scale-95 hover:scale-98 shadow-md border border-pink-200/50 shrink-0"
          >
            <div className={`absolute inset-0 ${nextSlide.bgStyle}`} />
            <img
              src={nextSlide.image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-5 flex flex-col justify-between">
              <span className="self-start px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[9px] font-black uppercase">
                {nextSlide.tag}
              </span>
              <div>
                <h4 className="text-white text-sm font-extrabold line-clamp-2 leading-tight">
                  {nextSlide.title}
                </h4>
                <div className="mt-2 text-[11px] font-bold text-pink-300 flex items-center gap-1">
                  <span>Xem thêm</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Indicators / Dots below */}
        <div className="flex items-center justify-center gap-2 mt-5">
          {filteredSlides.map((slide, idx) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`transition-all rounded-full cursor-pointer ${
                idx === currentIndex
                  ? 'w-8 h-2 bg-[#e1146c]'
                  : 'w-2 h-2 bg-pink-200 hover:bg-pink-300'
              }`}
              title={slide.title}
            />
          ))}
        </div>
      </div>

      {/* Interactive Detail Modal (For Beauty Tips or Promotional Deals) */}
      {activeModalSlide && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          {/* Blurred & Dimmed Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 cursor-pointer"
            onClick={() => setActiveModalSlide(null)}
            aria-hidden="true"
          />

          {/* Pristine Modal Card */}
          <div
            className="relative z-10 w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-pink-100 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`shrink-0 p-6 text-white relative ${activeModalSlide.bgStyle}`}>
              <button
                type="button"
                onClick={() => setActiveModalSlide(null)}
                className="absolute right-4 top-4 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-0.5 rounded-full bg-white/25 text-[11px] font-black uppercase tracking-wider">
                  {activeModalSlide.type === 'tip' ? '💡 CẨM NANG BÍ KÍP' : '🔥 CHIẾN DỊCH KHUYẾN MÃI'}
                </span>
                {activeModalSlide.discountBadge && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500 text-[10px] font-black uppercase">
                    {activeModalSlide.discountBadge}
                  </span>
                )}
              </div>

              <h3 className="text-xl sm:text-2xl font-black leading-tight pr-8">
                {activeModalSlide.title}
              </h3>
              <p className="text-xs text-pink-100/90 mt-1">
                {activeModalSlide.subtitle}
              </p>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-5 text-slate-700">
              {/* If it is a Beauty Tip */}
              {activeModalSlide.type === 'tip' && activeModalSlide.tipDetails && (
                <div className="space-y-4">
                  {/* Meta Bar */}
                  <div className="flex flex-wrap items-center gap-4 p-3.5 rounded-2xl bg-pink-50/70 border border-pink-100 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                      <Clock className="w-4 h-4 text-[#e1146c]" />
                      <span>{activeModalSlide.tipDetails.readingTime}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                      <UserCheck className="w-4 h-4 text-[#e1146c]" />
                      <span>{activeModalSlide.tipDetails.expertDoctor}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                      <ShieldCheck className="w-4 h-4 text-[#e1146c]" />
                      <span>Dành cho: {activeModalSlide.tipDetails.targetSkin}</span>
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-xs sm:text-sm leading-relaxed text-slate-600 italic border-l-3 border-[#e1146c] pl-3">
                    {activeModalSlide.tipDetails.summary}
                  </p>

                  {/* Steps */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Quy trình thực hiện chuẩn Y khoa:
                    </h4>
                    {activeModalSlide.tipDetails.steps.map((step) => (
                      <div
                        key={step.stepNumber}
                        className="p-3.5 rounded-2xl border border-pink-100 bg-white shadow-xs hover:border-pink-300 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-6 h-6 rounded-full bg-[#e1146c] text-white text-xs font-black flex items-center justify-center">
                            {step.stepNumber}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-slate-800">
                            {step.stepTitle}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 pl-8 leading-relaxed">
                          {step.description}
                        </p>
                        <div className="mt-2 pl-8 flex items-center gap-1.5 text-[11px] font-semibold text-[#be185d]">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Mẹo sản phẩm: {step.productTip}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Expert Advice Quote */}
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                    <div className="font-bold mb-1">💬 Lời khuyên từ chuyên gia:</div>
                    <div>{activeModalSlide.tipDetails.expertAdvice}</div>
                  </div>

                  {/* Recommended Clinic Service */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-[#be185d] uppercase tracking-wider block">
                        Dịch vụ bổ trợ khuyên dùng
                      </span>
                      <h5 className="text-xs sm:text-sm font-extrabold text-slate-800">
                        {activeModalSlide.tipDetails.recommendedService.title}
                      </h5>
                      <span className="text-[11px] text-slate-500">
                        Tại: {activeModalSlide.tipDetails.recommendedService.salonName}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 line-through block">
                          {activeModalSlide.tipDetails.recommendedService.originalPrice.toLocaleString(
                            'vi-VN'
                          )}
                          đ
                        </span>
                        <span className="text-base font-black text-[#e1146c]">
                          {activeModalSlide.tipDetails.recommendedService.price.toLocaleString(
                            'vi-VN'
                          )}
                          đ
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const s = activeModalSlide.tipDetails?.recommendedService;
                          if (s && onBookDeal) {
                            onBookDeal(s.title, s.salonName, s.price, s.originalPrice);
                          } else if (onOpenCampaign) {
                            onOpenCampaign(activeModalSlide.title);
                          }
                          setActiveModalSlide(null);
                        }}
                        className="px-4 py-2 rounded-full bg-[#e1146c] hover:bg-[#be185d] text-white text-xs font-bold shadow-md cursor-pointer transition-all"
                      >
                        Đặt lịch trải nghiệm
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* If it is an Advertisement / Promotional Deal */}
              {activeModalSlide.type === 'ad' && activeModalSlide.dealDetails && (
                <div className="space-y-4">
                  {/* Voucher code quick box */}
                  {activeModalSlide.dealDetails.voucherCode && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 text-white flex items-center justify-between shadow-md">
                      <div>
                        <span className="text-[11px] uppercase font-bold text-pink-100 block">
                          Mã ưu đãi độc quyền
                        </span>
                        <div className="text-xl font-black tracking-wider text-yellow-300">
                          {activeModalSlide.dealDetails.voucherCode}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyCode(activeModalSlide.dealDetails!.voucherCode!)
                        }
                        className="px-4 py-2 rounded-full bg-white text-[#be185d] text-xs font-bold shadow hover:bg-pink-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedVoucher ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Đã sao chép!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Sao chép mã</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Highlights */}
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2.5">
                      Đặc quyền ưu đãi gói dịch vụ:
                    </h4>
                    <ul className="space-y-2 text-xs text-slate-600">
                      {activeModalSlide.dealDetails.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Branches */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                    <div className="font-bold text-slate-700 mb-1">
                      📍 Cơ sở & Chi nhánh áp dụng:
                    </div>
                    <div className="text-slate-500">
                      {activeModalSlide.dealDetails.branches.join(' • ')}
                    </div>
                  </div>

                  {/* Bottom Action */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <div>
                      <span className="text-xs text-slate-400 line-through block">
                        Giá gốc:{' '}
                        {activeModalSlide.dealDetails.originalPrice.toLocaleString('vi-VN')}
                        đ
                      </span>
                      <span className="text-2xl font-black text-[#e1146c]">
                        {activeModalSlide.dealDetails.price.toLocaleString('vi-VN')}đ
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const d = activeModalSlide.dealDetails;
                        if (d && onBookDeal) {
                          onBookDeal(d.serviceTitle, d.salonName, d.price, d.originalPrice);
                        } else if (onOpenCampaign) {
                          onOpenCampaign(activeModalSlide.title);
                        }
                        setActiveModalSlide(null);
                      }}
                      className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs font-bold shadow-lg shadow-pink-600/30 hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Đặt lịch nhận ưu đãi</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
