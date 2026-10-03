import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Star,
  Clock,
  ChevronRight,
  ChevronLeft,
  Plus,
  Check,
  SlidersHorizontal,
} from 'lucide-react';
import { HotDeal } from '../data/mockData';
import { HotDealCardSkeleton } from './Skeleton';
import { useLanguage } from '../lib/language';

interface HotDealsSectionProps {
  deals: HotDeal[];
  isLoading?: boolean;
  onBookDeal: (deal: HotDeal) => void;
  onOpenShop: (supplierId: number) => void;
  onAddToCart: (deal: HotDeal) => void;
  onViewAll: () => void;
}

// Isolated Countdown Component so 1-second ticks do not trigger re-render of deal cards
const FlashSaleCountdown = React.memo(() => {
  const { text } = useLanguage();
  const [timeLeft, setTimeLeft] = useState({ hours: 5, minutes: 42, seconds: 18 });

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: 59, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return { hours: 12, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="hidden md:flex items-center gap-1.5 bg-pink-50 border border-pink-200 px-3 py-1 rounded-full text-xs font-bold text-[#B42D58]">
      <Clock className="w-3.5 h-3.5 text-[#EB0F51]" />
      <span>{text('Kết thúc sau:', 'Ends in:')}</span>
      <span className="bg-[#EB0F51] text-white px-1.5 py-0.5 rounded font-mono tabular-nums">
        {String(timeLeft.hours).padStart(2, '0')}
      </span>
      :
      <span className="bg-[#EB0F51] text-white px-1.5 py-0.5 rounded font-mono tabular-nums">
        {String(timeLeft.minutes).padStart(2, '0')}
      </span>
      :
      <span className="bg-[#EB0F51] text-white px-1.5 py-0.5 rounded font-mono tabular-nums">
        {String(timeLeft.seconds).padStart(2, '0')}
      </span>
    </div>
  );
});

export const HotDealsSection: React.FC<HotDealsSectionProps> = React.memo(({
  deals,
  isLoading = false,
  onBookDeal,
  onOpenShop,
  onAddToCart,
  onViewAll,
}) => {
  const { text } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [addedDealId, setAddedDealId] = useState<string | null>(null);

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
  }, [deals, isLoading]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -480 : 480;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleAddClick = (e: React.MouseEvent, deal: HotDeal) => {
    e.stopPropagation();
    onAddToCart(deal);
    setAddedDealId(deal.id);
    setTimeout(() => setAddedDealId(null), 1500);
  };

  const formatVND = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  return (
    <section id="deals" className="py-6 max-w-7xl mx-auto px-4 sm:px-6 relative">
      {/* Section Header: Title, Flash Sale Timer & Shared Filter/View All Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl sm:text-2xl font-black text-[#EB0F51] tracking-tight uppercase flex items-center gap-2">
            <span>{text('KHUYẾN MÃI HOT', 'HOT DEALS')}</span>
            <span className="inline-block p-1 rounded-full bg-pink-100 text-[#EB0F51] animate-bounce">
              🔥
            </span>
          </h2>

          {/* Flash sale timer */}
          <FlashSaleCountdown />
        </div>

        {/* Action Button: Opens the Unified Shared Filter & All Services Modal */}
        <button
          type="button"
          onClick={onViewAll}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-pink-50 hover:bg-pink-100/90 border border-pink-200 text-xs font-bold text-[#B42D58] hover:text-[#B42D58] transition-all cursor-pointer group shadow-xs self-start sm:self-auto disabled:opacity-50"
          title={text('Mở bộ lọc nâng cao & xem tất cả ưu đãi', 'Open filters and view all deals')}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#EB0F51]" />
          <span>{text('Bộ lọc & Xem tất cả', 'Filters & View all')} ({isLoading ? '...' : deals.length})</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Deals Display Area: Skeletons vs Real Content (Zero Layout Shift) */}
      {isLoading ? (
        <div className="relative group/carousel">
          <div className="flex items-stretch gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar py-1 px-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <HotDealCardSkeleton key={index} />
            ))}
          </div>
        </div>
      ) : deals.length === 0 ? (
        <div className="bg-pink-50/50 rounded-2xl border border-pink-200/70 p-8 text-center space-y-3">
          <p className="text-sm font-bold text-slate-700">
            {text('Hiện chưa có ưu đãi nào khả dụng', 'No deals are currently available')}
          </p>
          <button
            type="button"
            onClick={onViewAll}
            className="px-4 py-1.5 rounded-full bg-[#EB0F51] text-white text-xs font-bold shadow hover:bg-[#B42D58] transition-all cursor-pointer"
          >
            {text('Xem tất cả dịch vụ', 'View all services')}
          </button>
        </div>
      ) : (
        /* Carousel Track with Floating Navigation Buttons */
        <div className="relative group/carousel">
          {/* Floating Left Button */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scroll('left')}
              aria-label={text('Xem khuyến mãi trước', 'Previous deals')}
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
              aria-label={text('Xem thêm khuyến mãi tiếp theo', 'More deals')}
              className="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 backdrop-blur-md shadow-xl shadow-pink-500/15 border border-pink-100 flex items-center justify-center text-[#6366f1] hover:text-[#EB0F51] hover:scale-110 active:scale-95 transition-all cursor-pointer"
            >
              <ChevronRight className="w-5 h-5 text-[#6366f1]" strokeWidth={2.5} />
            </button>
          )}

          {/* Scrollable Deals Container */}
          <div
            ref={scrollRef}
            className="flex items-stretch gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1"
          >
            {deals.map((deal) => (
              <article
                key={deal.id}
                className="group relative flex flex-col justify-between bg-white rounded-2xl border border-pink-100/90 hover:border-pink-300 shadow-sm hover:shadow-xl hover:shadow-pink-500/10 transition-all duration-300 overflow-hidden cursor-pointer w-[215px] sm:w-[235px] shrink-0"
              >
                <button
                  type="button"
                  onClick={() => onBookDeal(deal)}
                  className="absolute inset-0 z-10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-inset focus:ring-pink-500"
                  aria-label={text(`Xem chi tiết đặt lịch ${deal.title}`, `View booking details for ${deal.title}`)}
                />
                {/* Thumbnail with badges */}
                <div className="relative aspect-square w-full overflow-hidden bg-pink-50">
                  <img
                    src={deal.image}
                    alt={deal.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                    }}
                  />

                  {/* Top Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                    <span className="bg-gradient-to-r from-rose-500 to-[#EB0F51] text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm">
                      -{deal.discountPercent}%
                    </span>
                    {deal.discountPercent >= 50 && (
                      <span className="bg-amber-400 text-amber-950 text-[9px] font-black px-1.5 py-0.5 rounded shadow-xs flex items-center gap-0.5">
                        ⚡ FLASH
                      </span>
                    )}
                  </div>

                  {/* Brand Tag overlay on image */}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (deal.supplierId) onOpenShop(deal.supplierId);
                    }}
                    disabled={!deal.supplierId}
                    className="absolute bottom-2 left-2 z-20 max-w-[170px] truncate rounded bg-black/65 px-2 py-1 text-left text-[10px] font-bold text-white backdrop-blur-md transition hover:bg-[#EB0F51] focus:outline-none focus:ring-2 focus:ring-white disabled:cursor-default"
                    aria-label={text(`Xem cửa hàng ${deal.brandName}`, `View ${deal.brandName} shop`)}
                  >
                    {deal.brandName}
                  </button>
                </div>

                {/* Content Details */}
                <div className="p-3 flex flex-col flex-1 justify-between">
                  <div>
                    {/* Rating & Duration */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <div className="flex items-center gap-1 text-amber-500 font-bold">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{deal.rating}</span>
                      </div>
                      <span className="text-slate-400 text-[10px]">
                        {deal.duration || text('60 phút', '60 minutes')}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-xs sm:text-[13px] font-bold text-slate-800 line-clamp-2 group-hover:text-[#EB0F51] transition-colors leading-snug">
                      {deal.title}
                    </h3>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (deal.supplierId) onOpenShop(deal.supplierId);
                      }}
                      disabled={!deal.supplierId}
                      className="relative z-20 mt-1 max-w-full truncate text-left text-[11px] font-bold text-pink-700 hover:underline focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:text-slate-400 disabled:no-underline"
                    >
                      {deal.brandName}
                    </button>
                  </div>

                  {/* Price & Add to Cart Action */}
                  <div className="mt-2.5 pt-2 border-t border-pink-50 flex items-end justify-between">
                    <div>
                      <div className="text-xs sm:text-sm font-black text-[#EB0F51]">
                        {formatVND(deal.salePrice)}
                      </div>
                      <div className="text-[10px] text-slate-400 line-through">
                        {formatVND(deal.originalPrice)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleAddClick(e, deal)}
                      className={`relative z-20 w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                        addedDealId === deal.id
                          ? 'bg-emerald-500 text-white'
                          : 'bg-pink-50 hover:bg-[#EB0F51] text-[#EB0F51] hover:text-white border border-pink-200 hover:border-transparent'
                      }`}
                      title={text('Thêm vào giỏ', 'Add to cart')}
                    >
                      {addedDealId === deal.id ? (
                        <Check className="w-3.5 h-3.5 animate-in zoom-in-50 duration-200" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
});
