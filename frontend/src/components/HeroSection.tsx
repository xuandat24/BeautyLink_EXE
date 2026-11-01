import React, { useEffect, useState } from 'react';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface HeroSectionProps {
  onBookDirect: (title: string, price: number, originalPrice: number) => void;
}

const HERO_SLIDES = [
  {
    id: 1,
    badge: 'DEAL ĐỘC QUYỀN BEAUTYLINK',
    title: 'MASSAGE BODY TINH DẦU',
    price: '225K',
    priceNum: 225000,
    originalPrice: '449K',
    originalPriceNum: 449000,
    discount: '-50%',
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1600&q=82',
    partnerName: 'PARADISE SKIN CLINIC & SPA',
  },
  {
    id: 2,
    badge: 'CÔNG NGHỆ CHÂU ÂU',
    title: 'TRẺ HÓA CĂNG BÓNG DA HOA HỒNG',
    price: '380K',
    priceNum: 380000,
    originalPrice: '850K',
    originalPriceNum: 850000,
    discount: '-55%',
    image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1600&q=82',
    partnerName: 'VENUS BEAUTY INSTITUTE',
  },
  {
    id: 3,
    badge: 'DƯỠNG SINH CỔ TRUYỀN',
    title: 'GỘI ĐẦU DƯỠNG SINH AN MIÊN',
    price: '199K',
    priceNum: 199000,
    originalPrice: '350K',
    originalPriceNum: 350000,
    discount: '-43%',
    image: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=1600&q=82',
    partnerName: 'HỆ THỐNG AN MIÊN SPA',
  },
] as const;

export const HeroSection: React.FC<HeroSectionProps> = ({ onBookDirect }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentSlide((previous) => (previous + 1) % HERO_SLIDES.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  const slide = HERO_SLIDES[currentSlide];
  const previousSlide = () =>
    setCurrentSlide((previous) => (previous === 0 ? HERO_SLIDES.length - 1 : previous - 1));
  const nextSlide = () =>
    setCurrentSlide((previous) => (previous + 1) % HERO_SLIDES.length);

  return (
    <section className="mx-auto max-w-7xl px-4 py-3 sm:px-6 md:py-4">
      <div className="group relative h-[210px] overflow-hidden rounded-3xl bg-slate-900 shadow-lg shadow-pink-900/5 sm:h-[220px]">
        <img src={getOptimizedImageUrl(slide.image,{width:1280,height:360,quality:75})}
          srcSet={[640,1280,1920].map(width=>`${getOptimizedImageUrl(slide.image,{width,height:Math.round(width*360/1280),quality:75})} ${width}w`).join(', ')} sizes="(max-width: 1280px) 100vw, 1280px"
          alt="" aria-hidden="true" width={1280} height={360} loading="eager" fetchPriority={currentSlide===0?'high':'auto'} decoding="async"
          className="absolute inset-0 h-full w-full scale-105 object-cover object-center transition-transform duration-700 ease-out group-hover:scale-100" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/62 to-black/20" />
        <div className="absolute inset-0 shadow-[inset_0_0_72px_rgba(15,23,42,0.5)]" />

        <div className="relative z-10 flex h-full flex-col justify-between p-4 sm:p-5 md:p-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[10px] font-bold tracking-wide text-pink-100 backdrop-blur-md">
              <span>{slide.badge}</span>
            </div>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-pink-300">
              {slide.partnerName}
            </p>
            <h1 className="mt-1 max-w-2xl text-xl font-black leading-tight tracking-tight text-white sm:text-2xl md:text-3xl">
              {slide.title}
            </h1>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <span className="text-2xl font-black text-pink-200 sm:text-3xl">{slide.price}</span>
              <span className="hidden text-xs text-pink-100/80 line-through sm:inline">{slide.originalPrice}</span>
              <span className="rounded-md bg-[#e1146c] px-2 py-0.5 text-[10px] font-black text-white">
                {slide.discount}
              </span>
              <button
                type="button"
                onClick={() => onBookDirect(slide.title, slide.priceNum, slide.originalPriceNum)}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#e1146c] to-[#ec4899] px-3 py-2 text-xs font-bold text-white shadow-md shadow-pink-600/30 transition hover:opacity-95 sm:px-4"
              >
                <span>Đặt lịch ngay</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={previousSlide}
                aria-label="Banner trước"
                className="grid h-8 w-8 place-items-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/35"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={nextSlide}
                aria-label="Banner tiếp theo"
                className="grid h-8 w-8 place-items-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/35"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
