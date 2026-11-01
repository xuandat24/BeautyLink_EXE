import React, { useState, useEffect } from 'react';
import {
  Star,
  Clock,
  ChevronRight,
  ChevronLeft,
  Plus,
  Check,
  SlidersHorizontal,
  Search,
  X,
  Heart,
} from 'lucide-react';
import { HotDeal } from '../data/mockData';
import { HotDealCardSkeleton } from './Skeleton';
import { OptimizedImage } from './OptimizedImage';
import { SearchFilters } from '../types';
import { useScrollReveal } from '../hooks/useScrollReveal';

interface HotDealsSectionProps {
  deals: HotDeal[];
  isLoading?: boolean;
  onBookDeal: (deal: HotDeal) => void;
  onAddToCart: (deal: HotDeal) => void;
  onViewAll: () => void;
  searchQuery?: string;
  searchFilters?: SearchFilters;
  onResetSearch?: () => void;
  favorites?: string[];
  onToggleFavorite?: (deal: HotDeal) => void;
  onSelectPartner?: (deal: HotDeal) => void;
}

const getDealsPageSize = () => {
  if (typeof window === 'undefined') return 10;
  if (window.innerWidth >= 1280) return 10;
  if (window.innerWidth >= 1024) return 8;
  if (window.innerWidth >= 640) return 6;
  return 4;
};

// Isolated Countdown Component so 1-second ticks do not trigger re-render of deal cards
const FlashSaleCountdown = React.memo(() => {
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
    <div className="hidden md:flex items-center gap-1.5 bg-pink-50 border border-pink-200 px-3 py-1 rounded-full text-xs font-bold text-[#be185d]">
      <Clock className="w-3.5 h-3.5 text-[#e1146c]" />
      <span>Kết thúc sau:</span>
      <span className="bg-[#e1146c] text-white px-1.5 py-0.5 rounded font-mono tabular-nums">
        {String(timeLeft.hours).padStart(2, '0')}
      </span>
      :
      <span className="bg-[#e1146c] text-white px-1.5 py-0.5 rounded font-mono tabular-nums">
        {String(timeLeft.minutes).padStart(2, '0')}
      </span>
      :
      <span className="bg-[#e1146c] text-white px-1.5 py-0.5 rounded font-mono tabular-nums">
        {String(timeLeft.seconds).padStart(2, '0')}
      </span>
    </div>
  );
});

export const HotDealsSection: React.FC<HotDealsSectionProps> = React.memo(({
  deals,
  isLoading = false,
  onBookDeal,
  onAddToCart,
  onViewAll,
  searchQuery,
  searchFilters,
  onResetSearch,
  favorites = [],
  onToggleFavorite,
  onSelectPartner,
}) => {
  const [pageSize, setPageSize] = useState(getDealsPageSize);
  const [currentPage, setCurrentPage] = useState(0);
  const [addedDealId, setAddedDealId] = useState<string | null>(null);

  const handleFavoriteClick = (e: React.MouseEvent, deal: HotDeal) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(deal);
    }
  };

  useEffect(() => {
    const handleResize = () => setPageSize(getDealsPageSize());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const pageCount = Math.min(2, Math.max(1, Math.ceil(deals.length / pageSize)));
  const visibleDeals = deals.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const canScrollLeft = currentPage > 0;
  const canScrollRight = currentPage < pageCount - 1;

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount - 1));
  }, [pageCount]);

  const scroll = (direction: 'left' | 'right') => {
    setCurrentPage((page) =>
      direction === 'left' ? Math.max(0, page - 1) : Math.min(pageCount - 1, page + 1)
    );
  };

  const handlePartnerClick = (event: React.MouseEvent, deal: HotDeal) => {
    event.stopPropagation();
    onSelectPartner?.(deal);
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

  const hasActiveFilters = Boolean(
    searchQuery ||
    (searchFilters &&
      (searchFilters.priceRange !== 'all' ||
        searchFilters.minRating > 0 ||
        searchFilters.maxDistance > 0))
  );

  const { ref: sectionRef, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.08 });

  return (
    <section
      id="deals"
      ref={sectionRef}
      className={`py-6 max-w-7xl mx-auto px-4 sm:px-6 relative reveal-on-scroll ${
        isVisible ? 'is-revealed' : ''
      }`}
    >
      {/* Section Header: Title, Flash Sale Timer & Shared Filter/View All Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl sm:text-2xl font-black text-[#e1146c] tracking-tight uppercase flex items-center gap-2">
            <span>KHUYẾN MÃI HOT</span>
            <span className="inline-block p-1 rounded-full bg-pink-100 text-[#e1146c] animate-bounce">
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
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-pink-50 hover:bg-pink-100/90 border border-pink-200 text-xs font-bold text-[#be185d] hover:text-[#9d174d] transition-all cursor-pointer group shadow-xs self-start sm:self-auto disabled:opacity-50"
          title="Mở bộ lọc nâng cao & xem tất cả ưu đãi"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#e1146c]" />
          <span>Bộ lọc & Xem tất cả ({isLoading ? '...' : deals.length})</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Active Search & Filter Info Bar */}
      {hasActiveFilters && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl bg-white border border-pink-200/90 p-3 sm:p-3.5 shadow-2xs animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <Search className="w-3.5 h-3.5 text-[#EB0F51]" />
              {searchQuery ? (
                <>
                  Tìm kiếm: <span className="font-extrabold text-[#EB0F51]">"{searchQuery}"</span>
                </>
              ) : (
                <span>Bộ lọc tìm kiếm:</span>
              )}
              <span className="text-slate-400">({deals.length} dịch vụ)</span>
            </span>

            {/* Filter tags */}
            {searchFilters?.priceRange && searchFilters.priceRange !== 'all' && (
              <span className="px-2 py-0.5 rounded-lg bg-pink-100 text-[#EB0F51] font-bold text-[11px]">
                {searchFilters.priceRange === 'under-300'
                  ? 'Giá < 300k'
                  : searchFilters.priceRange === '300-800'
                  ? 'Giá 300k-800k'
                  : 'Giá > 800k'}
              </span>
            )}

            {searchFilters?.minRating && searchFilters.minRating > 0 && (
              <span className="px-2 py-0.5 rounded-lg bg-pink-100 text-[#EB0F51] font-bold text-[11px] flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                {searchFilters.minRating}★+
              </span>
            )}

            {searchFilters?.maxDistance && searchFilters.maxDistance > 0 && (
              <span className="px-2 py-0.5 rounded-lg bg-pink-100 text-[#EB0F51] font-bold text-[11px]">
                Bán kính &lt; {searchFilters.maxDistance}km
              </span>
            )}
          </div>

          {onResetSearch && (
            <button
              type="button"
              onClick={onResetSearch}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-[#EB0F51] transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>
      )}

      {/* Deals Display Area: Skeletons vs Real Content (Zero Layout Shift) */}
      {isLoading ? (
        <div className="relative group/carousel">
          <div className="grid grid-cols-2 items-stretch gap-3.5 px-1.5 py-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: pageSize }).map((_, index) => (
              <HotDealCardSkeleton key={index} />
            ))}
          </div>
        </div>
      ) : deals.length === 0 ? (
        <div className="bg-pink-50/50 rounded-3xl border border-pink-200/70 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-white shadow-xs text-[#EB0F51] flex items-center justify-center mx-auto">
            <Search className="w-5 h-5" />
          </div>
          <p className="text-base font-extrabold text-slate-800">
            {hasActiveFilters
              ? 'Không tìm thấy dịch vụ phù hợp'
              : 'Hiện chưa có ưu đãi nào khả dụng'}
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Hãy thử điều chỉnh từ khóa tìm kiếm hoặc nới lỏng các bộ lọc mức giá, đánh giá và khoảng cách.'
              : 'Hãy quay lại sau hoặc khám phá các dịch vụ khác của chúng tôi.'}
          </p>
          {onResetSearch && hasActiveFilters ? (
            <button
              type="button"
              onClick={onResetSearch}
              className="px-4 py-2 rounded-full bg-[#EB0F51] text-white text-xs font-bold shadow-xs hover:bg-[#be185d] transition-all cursor-pointer"
            >
              Xóa bộ lọc & Hiển thị tất cả ưu đãi
            </button>
          ) : (
            <button
              type="button"
              onClick={onViewAll}
              className="px-4 py-1.5 rounded-full bg-[#e1146c] text-white text-xs font-bold shadow hover:bg-[#be185d] transition-all cursor-pointer"
            >
              Xem tất cả dịch vụ
            </button>
          )}
        </div>
      ) : (
        /* Carousel Track with Floating Navigation Buttons */
        <div className="relative group/carousel">
          {/* Floating Left Button */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scroll('left')}
              aria-label="Xem khuyến mãi trước"
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
              aria-label="Xem thêm khuyến mãi tiếp theo"
              className="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 backdrop-blur-md shadow-xl shadow-pink-500/15 border border-pink-100 flex items-center justify-center text-[#6366f1] hover:text-[#e1146c] hover:scale-110 active:scale-95 transition-all cursor-pointer"
            >
              <ChevronRight className="w-5 h-5 text-[#6366f1]" strokeWidth={2.5} />
            </button>
          )}

          {/* Scrollable Deals Container */}
          <div className="grid grid-cols-2 items-stretch gap-3.5 px-1.5 py-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {visibleDeals.map((deal, idx) => {
              const isFav = favorites.includes(deal.id);
              return (
                <div
                  key={deal.id}
                  onClick={() => onBookDeal(deal)}
                  className={`group flex w-full flex-col justify-between overflow-hidden rounded-2xl border border-pink-100/90 bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-pink-300 hover:shadow-xl hover:shadow-pink-500/20 hover:ring-2 hover:ring-pink-200/60 cursor-pointer will-change-transform transform-gpu stagger-item stagger-delay-${Math.min(
                    idx,
                    7
                  )}`}
                >
                  {/* Thumbnail with badges & favorite button */}
                  <div className="relative aspect-square w-full overflow-hidden bg-pink-50">
                    <OptimizedImage
                      src={deal.image}
                      alt={deal.title}
                      preset="deal-card"
                      priority={idx < 2}
                      vignette
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                      containerClassName="w-full h-full"
                    />

                    {/* Top Badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">
                      <span className="bg-gradient-to-r from-rose-500 to-[#e1146c] text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm">
                        -{deal.discountPercent}%
                      </span>
                      {deal.discountPercent >= 50 && (
                        <span className="bg-amber-400 text-amber-950 text-[9px] font-black px-1.5 py-0.5 rounded shadow-xs flex items-center gap-0.5">
                          ⚡ FLASH
                        </span>
                      )}
                    </div>

                    {/* Favorite Button (Heart) */}
                    <button
                      type="button"
                      onClick={(e) => handleFavoriteClick(e, deal)}
                      aria-label={isFav ? 'Bỏ yêu thích' : 'Yêu thích dịch vụ'}
                      title={isFav ? 'Đã lưu vào danh sách yêu thích' : 'Thêm vào danh sách yêu thích'}
                      className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 z-20 cursor-pointer shadow-md backdrop-blur-md ${
                        isFav
                          ? 'bg-white text-rose-500 hover:scale-115 shadow-rose-500/25 ring-1 ring-rose-200'
                          : 'bg-white/85 hover:bg-white text-slate-400 hover:text-rose-500 hover:scale-115'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isFav
                            ? 'fill-rose-500 text-rose-500 scale-110'
                            : 'stroke-[2.2]'
                        }`}
                      />
                    </button>

                    {/* Brand Tag overlay on image */}
                    <button
                      type="button"
                      onClick={(event) => handlePartnerClick(event, deal)}
                      disabled={!onSelectPartner || !deal.supplierId}
                      aria-label={`Mở cửa hàng ${deal.brandName}`}
                      className="absolute bottom-2 left-2 z-10 max-w-[165px] truncate rounded bg-black/65 px-2 py-1 text-left text-[10px] font-bold text-white backdrop-blur-md transition hover:bg-[#be185d] hover:underline disabled:cursor-default disabled:hover:bg-black/65 disabled:hover:no-underline"
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
                        {deal.duration || '60 phút'}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-xs sm:text-[13px] font-bold text-slate-800 line-clamp-2 group-hover:text-[#e1146c] transition-colors leading-snug">
                      {deal.title}
                    </h3>
                  </div>

                  {/* Price & Add to Cart Action */}
                  <div className="mt-2.5 pt-2 border-t border-pink-50 flex items-end justify-between">
                    <div>
                      <div className="text-xs sm:text-sm font-black text-[#e1146c]">
                        {formatVND(deal.salePrice)}
                      </div>
                      <div className="text-[10px] text-slate-400 line-through">
                        {formatVND(deal.originalPrice)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleAddClick(e, deal)}
                      className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                        addedDealId === deal.id
                          ? 'bg-emerald-500 text-white'
                          : 'bg-pink-50 hover:bg-[#e1146c] text-[#e1146c] hover:text-white border border-pink-200 hover:border-transparent'
                      }`}
                      title="Thêm vào giỏ"
                    >
                      {addedDealId === deal.id ? (
                        <Check className="w-3.5 h-3.5 animate-in zoom-in-50 duration-200" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
          {pageCount > 1 && (
            <div className="mt-2 flex items-center justify-center gap-2" aria-label="Trang khuyến mãi">
              {Array.from({ length: pageCount }).map((_, page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  aria-label={`Xem trang khuyến mãi ${page + 1}`}
                  aria-current={currentPage === page ? 'page' : undefined}
                  className={`h-2 rounded-full transition-all ${
                    currentPage === page ? 'w-7 bg-[#e1146c]' : 'w-2 bg-pink-200 hover:bg-pink-300'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
});
