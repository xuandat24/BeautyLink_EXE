import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Users,
  CalendarCheck,
  TicketPercent,
  Gift,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useLanguage } from '../lib/language';

interface HeroSectionProps {
  onOpenCommunity: () => void;
  onOpenAppointments: () => void;
  onOpenVouchers: () => void;
  onOpenRewards: () => void;
  onBookDirect: (title: string, price: number, originalPrice: number) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenCommunity,
  onOpenAppointments,
  onOpenVouchers,
  onOpenRewards,
  onBookDirect,
}) => {
  const { text } = useLanguage();
  const slides = [
    {
      id: 1,
      badge: text('DEAL ĐỘC QUYỀN BEAUTYLINK', 'BEAUTYLINK EXCLUSIVE DEAL'),
      title: text('MASSAGE BODY TINH DẦU', 'AROMATHERAPY BODY MASSAGE'),
      subtitle: text('THƯ GIÃN TOÀN THÂN & ĐẢ THÔNG KINH LẠC', 'FULL-BODY RELAXATION & TENSION RELEASE'),
      price: '225K',
      priceNum: 225000,
      originalPrice: '449K',
      originalPriceNum: 449000,
      discount: '-50%',
      image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
      tagline: text('Tặng xông hơi đá muối thảo dược Himalaya', 'Complimentary Himalayan salt herbal steam'),
      partnerName: 'PARADISE SKIN CLINIC & SPA',
      accentColor: 'from-[#B42D58] to-[#EB0F51]',
    },
    {
      id: 2,
      badge: text('CÔNG NGHỆ CHÂU ÂU', 'EUROPEAN TECHNOLOGY'),
      title: text('TRẺ HÓA CĂNG BÓNG DA HOA HỒNG', 'ROSE GLOW SKIN REJUVENATION'),
      subtitle: text('PEEL VI SINH & CẤY TINH CHẤT HOA HỒNG SEN', 'MICROBIOME PEEL & ROSE ESSENCE INFUSION'),
      price: '380K',
      priceNum: 380000,
      originalPrice: '850K',
      originalPriceNum: 850000,
      discount: '-55%',
      image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80',
      tagline: text('Da sáng mịn căng bóng, mờ thâm sạm sau 1 buổi', 'Smoother, brighter skin after one session'),
      partnerName: 'VENUS BEAUTY INSTITUTE',
      accentColor: 'from-[#EB0F51] to-[#ec4899]',
    },
    {
      id: 3,
      badge: text('DƯỠNG SINH CỔ TRUYỀN', 'TRADITIONAL WELLNESS'),
      title: text('GỘI ĐẦU DƯỠNG SINH AN MIÊN', 'AN MIEN HERBAL HEAD SPA'),
      subtitle: text('BỒ KẾT THẢO DƯỢC & MASSAGE CỔ VAI GÁY', 'HERBAL HAIR WASH & NECK-SHOULDER MASSAGE'),
      price: '199K',
      priceNum: 199000,
      originalPrice: '350K',
      originalPriceNum: 350000,
      discount: '-43%',
      image: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=1200&q=80',
      tagline: text('Xua tan mệt mỏi, ngủ sâu giấc và thư thái tinh thần', 'Release fatigue and enjoy deeper relaxation'),
      partnerName: 'HỆ THỐNG AN MIÊN SPA',
      accentColor: 'from-[#B42D58] to-[#B42D58]',
    },
  ];

  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto slide
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const slide = slides[currentSlide];

  return (
    <section className="py-4 md:py-6 max-w-7xl mx-auto px-4 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-stretch">
        {/* Left Side: Large Hero Banner Slider */}
        <div className="lg:col-span-8 relative rounded-3xl overflow-hidden shadow-lg shadow-pink-900/5 min-h-[380px] md:min-h-[420px] bg-slate-900 flex flex-col justify-between group">
          {/* Background Image with Gentle Overlay */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-700 ease-out transform scale-105 group-hover:scale-100"
            style={{ backgroundImage: `url(${slide.image})` }}
          >
            {/* Ambient Pink Tint & Contrast Scrim */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/35" />
            <div className="absolute inset-0 bg-gradient-to-t from-pink-950/40 via-transparent to-transparent mix-blend-multiply" />
          </div>

          {/* Top content on hero slide */}
          <div className="relative z-10 p-6 md:p-8 flex flex-col items-start gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-pink-200 text-xs font-semibold tracking-wide border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-pink-300" />
              <span>{slide.badge}</span>
            </div>

            <div className="text-pink-300 text-xs font-bold uppercase tracking-wider mt-1">
              {slide.partnerName}
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight mt-1 max-w-xl">
              {slide.title}
            </h1>

            <p className="text-pink-100/90 text-sm sm:text-base font-medium max-w-lg mt-1">
              {slide.subtitle}
            </p>

            {/* Price badge block */}
            <div className="mt-4 flex items-baseline gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20">
              <span className="text-3xl md:text-4xl font-black bg-gradient-to-r from-pink-300 to-rose-200 bg-clip-text text-transparent">
                {slide.price}
              </span>
              <span className="text-xs sm:text-sm text-pink-200 line-through">
                [{text('Giá gốc', 'Original')}: {slide.originalPrice}]
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#EB0F51] text-white text-xs font-black shadow-sm">
                {slide.discount}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-pink-200/90 mt-2 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-pink-400" />
              <span>{slide.tagline}</span>
            </div>
          </div>

          {/* Bottom Hero Controls */}
          <div className="relative z-10 p-6 md:p-8 pt-0 flex items-center justify-between">
            <button
              onClick={() =>
                onBookDirect(
                  slide.title,
                  slide.priceNum,
                  slide.originalPriceNum
                )
              }
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#EB0F51] via-[#D28474] to-[#ec4899] text-white text-sm font-bold shadow-lg shadow-pink-600/40 hover:opacity-95 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <span>{text('Đặt lịch ngay', 'Book now')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Pagination dots & navigation buttons */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {slides.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === currentSlide
                        ? 'w-7 bg-[#f472b6]'
                        : 'w-2 bg-white/40 hover:bg-white/70'
                    }`}
                    aria-label={`Slide ${idx + 1}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={prevSlide}
                  className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 text-white flex items-center justify-center transition-colors"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextSlide}
                  className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 text-white flex items-center justify-center transition-colors"
                  aria-label="Next slide"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: 4 Quick Actions (Exact UI/UX from the screenshot) */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-3 sm:gap-4">
          {/* 1. Cộng đồng */}
          <button
            onClick={onOpenCommunity}
            className="group flex flex-col items-center justify-center p-6 rounded-3xl bg-white border border-pink-100 hover:border-pink-300 shadow-sm hover:shadow-md hover:shadow-pink-500/10 transition-all text-center relative overflow-hidden"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-100 to-pink-50 flex items-center justify-center text-[#B42D58] mb-3 group-hover:scale-110 group-hover:bg-gradient-to-tr group-hover:from-pink-500 group-hover:to-rose-500 group-hover:text-white transition-all shadow-inner">
              <Users className="w-7 h-7" />
            </div>
            <span className="text-base font-bold text-slate-800 group-hover:text-[#B42D58] transition-colors">
              {text('Cộng đồng', 'Community')}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5">
              {text('Review & Bí quyết làm đẹp', 'Reviews & beauty tips')}
            </span>
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-pink-400 group-hover:animate-ping" />
          </button>

          {/* 2. Lịch hẹn */}
          <button
            onClick={onOpenAppointments}
            className="group flex flex-col items-center justify-center p-6 rounded-3xl bg-white border border-pink-100 hover:border-pink-300 shadow-sm hover:shadow-md hover:shadow-pink-500/10 transition-all text-center relative overflow-hidden"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-100 to-pink-50 flex items-center justify-center text-[#B42D58] mb-3 group-hover:scale-110 group-hover:bg-gradient-to-tr group-hover:from-pink-500 group-hover:to-rose-500 group-hover:text-white transition-all shadow-inner">
              <CalendarCheck className="w-7 h-7" />
            </div>
            <span className="text-base font-bold text-slate-800 group-hover:text-[#B42D58] transition-colors">
              {text('Lịch hẹn', 'Appointments')}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5">
              {text('Quản lý lịch & Nhắc hẹn', 'Manage and track bookings')}
            </span>
          </button>

          {/* 3. Mã giảm giá */}
          <button
            onClick={onOpenVouchers}
            className="group flex flex-col items-center justify-center p-6 rounded-3xl bg-white border border-pink-100 hover:border-pink-300 shadow-sm hover:shadow-md hover:shadow-pink-500/10 transition-all text-center relative overflow-hidden"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-100 to-pink-50 flex items-center justify-center text-[#B42D58] mb-3 group-hover:scale-110 group-hover:bg-gradient-to-tr group-hover:from-pink-500 group-hover:to-rose-500 group-hover:text-white transition-all shadow-inner">
              <TicketPercent className="w-7 h-7" />
            </div>
            <span className="text-base font-bold text-slate-800 group-hover:text-[#B42D58] transition-colors">
              {text('Mã giảm giá', 'Vouchers')}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5">
              {text('Săn voucher tới 50%', 'Save up to 50%')}
            </span>
          </button>

          {/* 4. Rewards */}
          <button
            onClick={onOpenRewards}
            className="group flex flex-col items-center justify-center p-6 rounded-3xl bg-white border border-pink-100 hover:border-pink-300 shadow-sm hover:shadow-md hover:shadow-pink-500/10 transition-all text-center relative overflow-hidden"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-100 to-pink-50 flex items-center justify-center text-[#B42D58] mb-3 group-hover:scale-110 group-hover:bg-gradient-to-tr group-hover:from-pink-500 group-hover:to-rose-500 group-hover:text-white transition-all shadow-inner">
              <Gift className="w-7 h-7" />
            </div>
            <span className="text-base font-bold text-slate-800 group-hover:text-[#B42D58] transition-colors">
              Rewards
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5">
              {text('Đổi điểm nhận quà VIP', 'Redeem points for VIP gifts')}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};
