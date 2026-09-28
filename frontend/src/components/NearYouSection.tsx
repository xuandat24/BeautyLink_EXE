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

interface NearYouSectionProps {
  salons: Salon[];
  isLoading?: boolean;
  onSelectSalon: (salon: Salon) => void;
  onViewAll: () => void;
  locationPermission?: 'idle' | 'loading' | 'ready' | 'denied';
  onEnableLocation?: () => void;
}

export const NearYouSection: React.FC<NearYouSectionProps> = React.memo(({
  salons,
  isLoading = false,
  onSelectSalon,
  onViewAll,
  locationPermission = 'idle',
  onEnableLocation,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

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

  const toggleFavorite = (e: React.MouseEvent, salonId: string) => {
    e.stopPropagation();
    setFavorites((prev) => ({ ...prev, [salonId]: !prev[salonId] }));
  };

  const formatVND = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  return (
    <section id="nearby" className="py-6 max-w-7xl mx-auto px-4 sm:px-6 relative">
      {/* Header with Title & Shared Filter Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <span>Gần bạn</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </h2>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-pink-50 px-2.5 py-0.5 rounded-full border border-pink-100">
            <MapPin className="w-3 h-3 text-[#EB0F51]" />
            {salons.length} cơ sở làm đẹp
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
        {locationPermission !== 'ready' && <button type="button" onClick={onEnableLocation} disabled={locationPermission === 'loading'} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"><Navigation className={`h-3.5 w-3.5 ${locationPermission === 'loading' ? 'animate-pulse' : ''}`} />{locationPermission === 'loading' ? 'Đang định vị...' : locationPermission === 'denied' ? 'Thử lại GPS' : 'Dùng vị trí của tôi'}</button>}
        {locationPermission === 'ready' && <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700"><CheckCircle className="h-3.5 w-3.5" />Khoảng cách GPS thật</span>}
        <button
          type="button"
          onClick={onViewAll}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-pink-50 hover:bg-pink-100/90 border border-pink-200 text-xs font-bold text-[#B42D58] hover:text-[#B42D58] transition-all cursor-pointer group shadow-xs self-start sm:self-auto disabled:opacity-50"
          title="Mở bộ lọc nâng cao & xem tất cả địa điểm gần bạn"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#EB0F51]" />
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
                  ? 'bg-gradient-to-r from-[#EB0F51] to-[#B42D58] text-white border-transparent shadow-sm shadow-pink-500/25'
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
          <div className="flex items-stretch gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar py-1 px-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <SalonCardSkeleton key={index} />
            ))}
          </div>
        </div>
      ) : filteredSalons.length === 0 ? (
        <div className="py-12 px-4 text-center bg-white rounded-2xl border border-pink-100 shadow-sm max-w-md mx-auto my-2">
          <div className="w-12 h-12 rounded-full bg-pink-50 flex items-center justify-center mx-auto mb-3 text-[#EB0F51]">
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
            className="px-4 py-2 rounded-full bg-gradient-to-r from-[#EB0F51] to-[#B42D58] text-white text-xs font-bold shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
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
              className="absolute -left-3 sm:-left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 backdrop-blur-md shadow-xl shadow-pink-500/15 border border-pink-100 flex items-center justify-center text-[#6366f1] hover:text-[#EB0F51] hover:scale-110 active:scale-95 transition-all cursor-pointer"
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
              className="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 backdrop-blur-md shadow-xl shadow-pink-500/15 border border-pink-100 flex items-center justify-center text-[#6366f1] hover:text-[#EB0F51] hover:scale-110 active:scale-95 transition-all cursor-pointer"
            >
              <ChevronRight className="w-5 h-5 text-[#6366f1]" strokeWidth={2.5} />
            </button>
          )}

          {/* Horizontal Scroll Track */}
          <div
            ref={scrollRef}
            className="flex items-stretch gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1"
          >
            {filteredSalons.map((salon) => (
              <div
                key={salon.id}
                onClick={() => onSelectSalon(salon)}
                className="group flex flex-col justify-between bg-white rounded-2xl border border-pink-100/80 hover:border-pink-300 shadow-sm hover:shadow-xl hover:shadow-pink-500/10 transition-all duration-300 overflow-hidden cursor-pointer w-[250px] sm:w-[270px] shrink-0"
              >
                {/* Thumbnail Image */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-pink-50">
                  <img
                    src={salon.image}
                    alt={salon.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.src.endsWith('/assets/beauty-placeholder.svg')) {
                        target.src = '/assets/beauty-placeholder.svg';
                      }
                    }}
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
                    onClick={(e) => toggleFavorite(e, salon.id)}
                    aria-label="Yêu thích cơ sở"
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors shadow-sm cursor-pointer z-10"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        favorites[salon.id] ? 'fill-rose-500 text-rose-500' : ''
                      }`}
                    />
                  </button>

                  {/* Distance Overlay */}
                  <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#EB0F51]" />
                    <span>{salon.hasExactDistance ? `${salon.distanceKm} km` : 'Bật GPS để đo'}</span>
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
                    <h3 className="font-bold text-slate-800 group-hover:text-[#EB0F51] transition-colors line-clamp-1 text-sm leading-snug">
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
                      <div className="text-xs sm:text-sm font-black text-[#EB0F51]">
                        {formatVND(salon.minPrice ?? 150000)}
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-pink-50 text-[#B42D58] font-bold text-xs group-hover:bg-[#EB0F51] group-hover:text-white transition-all shadow-xs">
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
