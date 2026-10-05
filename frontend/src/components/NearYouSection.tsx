import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MapPin,
  Star,
  CheckCircle,
  Heart,
  ChevronRight,
  ChevronLeft,
  Navigation,
  SlidersHorizontal,
} from 'lucide-react';
import { Salon } from '../types';
import { SalonCardSkeleton } from './Skeleton';
import { OptimizedImage } from './OptimizedImage';
import { useScrollReveal } from '../hooks/useScrollReveal';

interface NearYouSectionProps {
  salons: Salon[];
  isLoading?: boolean;
  onSelectSalon: (salon: Salon) => void;
  onViewAll: () => void;
  locationPermission?: 'idle' | 'loading' | 'ready' | 'denied';
  onEnableLocation?: () => void;
  favoritesList?: string[];
  onToggleFavorite?: (salon: Salon) => void;
}

export const NearYouSection: React.FC<NearYouSectionProps> = React.memo(({
  salons,
  isLoading = false,
  onSelectSalon,
  onViewAll,
  locationPermission = 'idle',
  onEnableLocation,
  favoritesList = [],
  onToggleFavorite,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [localFavorites, setLocalFavorites] = useState<Record<string, boolean>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const filterTabs = [
    { id: 'all', label: 'Tất cả' },
    { id: 'spa', label: 'Spa' },
    { id: 'tham-my-vien', label: 'Thẩm mỹ viện' },
    { id: 'clinic', label: 'Clinic' },
    { id: 'massage', label: 'Massage center' },
    { id: 'nail', label: 'Nails' },
    { id: 'salon-toc', label: 'Salon tóc' },
  ];

  // Fast category filter for quick preview on homepage
  const filteredSalons = useMemo(() => {
    if (activeCategory === 'all') return salons;
    return salons.filter((s) => s.category === activeCategory);
  }, [salons, activeCategory]);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 20);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 20);
    }
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      return () => el.removeEventListener('scroll', checkScroll);
    }
  }, [filteredSalons]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -560 : 560;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const toggleFavorite = (e: React.MouseEvent, salon: Salon) => {
    e.stopPropagation();
    setLocalFavorites((prev) => ({ ...prev, [salon.id]: !prev[salon.id] }));
    if (onToggleFavorite) {
      onToggleFavorite(salon);
    }
  };

  const formatVND = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  const { ref: sectionRef, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.08 });

  return (
    <section
      id="nearby"
      ref={sectionRef}
      className={`py-6 max-w-7xl mx-auto px-4 sm:px-6 relative reveal-on-scroll ${
        isVisible ? 'is-revealed' : ''
      }`}
    >
      {/* Header with Title & Shared Filter Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <span>Gần bạn</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </h2>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-pink-50 px-2.5 py-0.5 rounded-full border border-pink-100">
            <MapPin className="w-3 h-3 text-[#e1146c]" />
            {salons.length} cơ sở làm đẹp
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onEnableLocation && (
            <button
              type="button"
              onClick={onEnableLocation}
              disabled={locationPermission === 'loading'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold text-emerald-800 transition cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5 text-emerald-600" />
              <span>{locationPermission === 'ready' ? 'Đã định vị' : 'Định vị GPS gần tôi'}</span>
            </button>
          )}

          {/* Action Button: Opens the Unified Shared Filter & All Services Modal */}
          <button
            type="button"
            onClick={onViewAll}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-pink-50 hover:bg-pink-100/90 border border-pink-200 text-xs font-bold text-[#be185d] hover:text-[#9d174d] transition-all cursor-pointer group shadow-xs self-start sm:self-auto disabled:opacity-50"
            title="Mở bộ lọc nâng cao & xem tất cả địa điểm gần bạn"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#e1146c]" />
            <span>Bộ lọc & Xem tất cả ({isLoading ? '...' : salons.length})</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 mb-3 text-xs font-semibold">
        {filterTabs.map((tab) => {
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              disabled={isLoading}
              className={`px-3.5 py-1.5 rounded-full border transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white border-transparent shadow-sm shadow-pink-500/25'
                  : 'bg-white text-slate-700 border-pink-200 hover:border-pink-300 hover:bg-pink-50/60'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Display Area: Skeleton vs Empty vs Real Content (Zero Layout Shift) */}
      {isLoading ? (
        <div className="relative group/nearby mt-1">
          <div className="flex items-stretch gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar py-3 px-1.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <SalonCardSkeleton key={index} />
            ))}
          </div>
        </div>
      ) : filteredSalons.length === 0 ? (
        <div className="py-12 px-4 text-center bg-white rounded-2xl border border-pink-100 shadow-sm max-w-md mx-auto my-2">
          <div className="w-12 h-12 rounded-full bg-pink-50 flex items-center justify-center mx-auto mb-3 text-[#e1146c]">
            <Navigation className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            Chưa có cơ sở trong danh mục này
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Hãy chọn danh mục khác hoặc mở bộ lọc nâng cao để tìm kiếm thêm.
          </p>
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs font-bold shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
          >
            Hiển thị tất cả cơ sở
          </button>
        </div>
      ) : (
        /* Salon Cards Carousel Track with Floating Navigation Buttons */
        <div className="relative group/nearby mt-1">
          {/* Floating Left Button */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scroll('left')}
              aria-label="Địa điểm trước"
              className="absolute -left-3 sm:-left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 backdrop-blur-md shadow-xl shadow-pink-500/15 border border-pink-100 flex items-center justify-center text-[#6366f1] hover:text-[#e1146c] hover:scale-110 active:scale-95 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 text-[#6366f1]" strokeWidth={2.5} />
            </button>
          )}

          {/* Floating Right Button */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scroll('right')}
              aria-label="Địa điểm tiếp theo"
              className="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 backdrop-blur-md shadow-xl shadow-pink-500/15 border border-pink-100 flex items-center justify-center text-[#6366f1] hover:text-[#e1146c] hover:scale-110 active:scale-95 transition-all cursor-pointer"
            >
              <ChevronRight className="w-5 h-5 text-[#6366f1]" strokeWidth={2.5} />
            </button>
          )}

          {/* Horizontal Scroll Track */}
          <div
            ref={scrollRef}
            className="flex items-stretch gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth py-3 px-1.5"
          >
            {filteredSalons.map((salon, idx) => (
              <div
                key={salon.id}
                onClick={() => onSelectSalon(salon)}
                className={`group flex flex-col justify-between bg-white rounded-2xl border border-pink-100/80 hover:border-pink-300 shadow-sm hover:shadow-xl hover:shadow-pink-500/15 hover:scale-[1.025] hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer w-[250px] sm:w-[270px] shrink-0 will-change-transform stagger-item stagger-delay-${Math.min(
                  idx,
                  7
                )}`}
              >
                {/* Thumbnail Image */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-pink-50">
                  <OptimizedImage
                    src={salon.image}
                    alt={salon.name}
                    preset="salon-card"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    containerClassName="w-full h-full"
                  />

                  {/* Top Badges */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                    {salon.badge && (
                      <span className="bg-white/95 backdrop-blur-md text-emerald-600 font-bold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                        <CheckCircle className="w-3 h-3 fill-emerald-500 text-white" />
                        <span>{salon.badge}</span>
                      </span>
                    )}
                  </div>

                  {/* Favorite Button */}
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(e, salon)}
                    aria-label={
                      favoritesList.includes(salon.id) || localFavorites[salon.id]
                        ? 'Bỏ yêu thích'
                        : 'Yêu thích cơ sở'
                    }
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors shadow-sm cursor-pointer z-10 hover:scale-110 active:scale-95"
                  >
                    <Heart
                      className={`w-4 h-4 transition-transform ${
                        favoritesList.includes(salon.id) || localFavorites[salon.id]
                          ? 'fill-rose-500 text-rose-500 scale-110'
                          : ''
                      }`}
                    />
                  </button>

                  {/* Distance Overlay */}
                  <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#e1146c]" />
                    <span>{salon.distanceKm} km</span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-3.5 flex flex-col flex-1 justify-between">
                  <div>
                    {/* Rating & Review count */}
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <div className="flex items-center gap-1 font-bold text-amber-500">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{salon.rating}</span>
                        <span className="text-slate-400 font-normal">
                          ({salon.reviewsCount})
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">
                        {salon.category}
                      </span>
                    </div>

                    {/* Salon Name */}
                    <h3 className="font-bold text-slate-800 group-hover:text-[#e1146c] transition-colors line-clamp-1 text-sm leading-snug">
                      {salon.name}
                    </h3>

                    {/* Address */}
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                      {salon.address}
                    </p>
                  </div>

                  {/* Service Price Range & Booking CTA */}
                  <div className="mt-3 pt-2.5 border-t border-pink-50 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400">
                        Dịch vụ từ:
                      </div>
                      <div className="text-xs sm:text-sm font-black text-[#e1146c]">
                        {formatVND(salon.minPrice ?? 150000)}
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-pink-50 text-[#be185d] font-bold text-xs group-hover:bg-[#e1146c] group-hover:text-white transition-all shadow-xs">
                      <span>Đặt chỗ</span>
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
});
