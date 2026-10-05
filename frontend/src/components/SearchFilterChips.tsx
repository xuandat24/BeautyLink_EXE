import React, { useState, useRef, useEffect } from 'react';
import {
  Tag,
  Star,
  MapPin,
  ChevronDown,
  RotateCcw,
  Check,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { SearchFilters } from '../types';

interface SearchFilterChipsProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  className?: string;
  onChipInteraction?: () => void;
  onOpenFullFilterPage?: () => void;
}

const PRICE_OPTIONS = [
  { value: 'all', label: 'Tất cả mức giá', short: 'Mọi giá' },
  { value: 'under-300', label: 'Dưới 300.000đ', short: '< 300k' },
  { value: '300-800', label: '300.000đ - 800.000đ', short: '300k-800k' },
  { value: 'over-800', label: 'Trên 800.000đ', short: '> 800k' },
] as const;

const RATING_OPTIONS = [
  { value: 0, label: 'Tất cả đánh giá', short: 'Mọi sao' },
  { value: 4.8, label: 'Từ 4.8★ trở lên (Xuất sắc)', short: '4.8★+' },
  { value: 4.5, label: 'Từ 4.5★ trở lên (Rất tốt)', short: '4.5★+' },
  { value: 4.0, label: 'Từ 4.0★ trở lên (Tốt)', short: '4.0★+' },
] as const;

const DISTANCE_OPTIONS = [
  { value: 0, label: 'Toàn bộ khoảng cách', short: 'Toàn khu vực' },
  { value: 2, label: 'Dưới 2 km (Gần nhất)', short: '< 2 km' },
  { value: 5, label: 'Dưới 5 km', short: '< 5 km' },
  { value: 10, label: 'Dưới 10 km', short: '< 10 km' },
] as const;

export const SearchFilterChips: React.FC<SearchFilterChipsProps> = ({
  filters,
  onChange,
  className = '',
  onChipInteraction,
  onOpenFullFilterPage,
}) => {
  const [openDropdown, setOpenDropdown] = useState<'price' | 'rating' | 'distance' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const hasActiveFilters =
    filters.priceRange !== 'all' || filters.minRating > 0 || filters.maxDistance > 0;

  const currentPriceLabel =
    PRICE_OPTIONS.find((p) => p.value === filters.priceRange)?.short || 'Giá';
  const currentRatingLabel =
    RATING_OPTIONS.find((r) => r.value === filters.minRating)?.short || 'Đánh giá';
  const currentDistanceLabel =
    DISTANCE_OPTIONS.find((d) => d.value === filters.maxDistance)?.short || 'Khoảng cách';

  const handleResetAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({
      priceRange: 'all',
      minRating: 0,
      maxDistance: 0,
    });
    setOpenDropdown(null);
    onChipInteraction?.();
  };

  const handleSelectPrice = (value: SearchFilters['priceRange']) => {
    onChange({ ...filters, priceRange: value });
    setOpenDropdown(null);
    onChipInteraction?.();
  };

  const handleSelectRating = (value: number) => {
    onChange({ ...filters, minRating: value });
    setOpenDropdown(null);
    onChipInteraction?.();
  };

  const handleSelectDistance = (value: number) => {
    onChange({ ...filters, maxDistance: value });
    setOpenDropdown(null);
    onChipInteraction?.();
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-wrap items-center gap-1.5 pt-1.5 pb-0.5 animate-in fade-in duration-200 ${className}`}
    >
      <span className="text-[11px] font-bold text-slate-400 mr-0.5 hidden sm:inline-block">
        Lọc nhanh:
      </span>

      {/* 1. Price Range Chip */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setOpenDropdown(openDropdown === 'price' ? null : 'price');
            onChipInteraction?.();
          }}
          className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all shadow-2xs cursor-pointer border ${
            filters.priceRange !== 'all'
              ? 'bg-[#EB0F51] text-white border-[#EB0F51] shadow-pink-500/25 ring-2 ring-pink-300/40'
              : 'bg-white text-slate-700 border-pink-200/90 hover:border-pink-300 hover:bg-pink-50/50'
          }`}
          title="Lọc theo mức giá"
        >
          <Tag className={`w-3 h-3 ${filters.priceRange !== 'all' ? 'text-white' : 'text-pink-600'}`} />
          <span>{filters.priceRange !== 'all' ? currentPriceLabel : 'Mức giá'}</span>
          {filters.priceRange !== 'all' ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleSelectPrice('all');
              }}
              className="ml-0.5 p-0.5 rounded-full hover:bg-white/20 transition-colors"
              title="Xóa lọc giá"
            >
              <X className="w-2.5 h-2.5 stroke-[3]" />
            </span>
          ) : (
            <ChevronDown
              className={`w-3 h-3 transition-transform ${
                openDropdown === 'price' ? 'rotate-180' : ''
              } text-slate-400`}
            />
          )}
        </button>

        {openDropdown === 'price' && (
          <div
            className="absolute top-full left-0 mt-1.5 w-48 bg-white rounded-2xl border border-pink-100 shadow-xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-150"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
              Chọn mức giá
            </div>
            {PRICE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelectPrice(opt.value)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                  filters.priceRange === opt.value
                    ? 'bg-pink-50 text-[#EB0F51] font-bold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{opt.label}</span>
                {filters.priceRange === opt.value && (
                  <Check className="w-3.5 h-3.5 text-[#EB0F51]" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Rating Chip */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setOpenDropdown(openDropdown === 'rating' ? null : 'rating');
            onChipInteraction?.();
          }}
          className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all shadow-2xs cursor-pointer border ${
            filters.minRating > 0
              ? 'bg-[#EB0F51] text-white border-[#EB0F51] shadow-pink-500/25 ring-2 ring-pink-300/40'
              : 'bg-white text-slate-700 border-pink-200/90 hover:border-pink-300 hover:bg-pink-50/50'
          }`}
          title="Lọc theo đánh giá sao"
        >
          <Star
            className={`w-3 h-3 ${
              filters.minRating > 0 ? 'text-amber-300 fill-amber-300' : 'text-amber-500 fill-amber-500'
            }`}
          />
          <span>{filters.minRating > 0 ? currentRatingLabel : 'Đánh giá'}</span>
          {filters.minRating > 0 ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleSelectRating(0);
              }}
              className="ml-0.5 p-0.5 rounded-full hover:bg-white/20 transition-colors"
              title="Xóa lọc sao"
            >
              <X className="w-2.5 h-2.5 stroke-[3]" />
            </span>
          ) : (
            <ChevronDown
              className={`w-3 h-3 transition-transform ${
                openDropdown === 'rating' ? 'rotate-180' : ''
              } text-slate-400`}
            />
          )}
        </button>

        {openDropdown === 'rating' && (
          <div
            className="absolute top-full left-0 mt-1.5 w-56 bg-white rounded-2xl border border-pink-100 shadow-xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-150"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
              Đánh giá tối thiểu
            </div>
            {RATING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelectRating(opt.value)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                  filters.minRating === opt.value
                    ? 'bg-pink-50 text-[#EB0F51] font-bold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{opt.label}</span>
                {filters.minRating === opt.value && (
                  <Check className="w-3.5 h-3.5 text-[#EB0F51]" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Distance Chip */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setOpenDropdown(openDropdown === 'distance' ? null : 'distance');
            onChipInteraction?.();
          }}
          className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all shadow-2xs cursor-pointer border ${
            filters.maxDistance > 0
              ? 'bg-[#EB0F51] text-white border-[#EB0F51] shadow-pink-500/25 ring-2 ring-pink-300/40'
              : 'bg-white text-slate-700 border-pink-200/90 hover:border-pink-300 hover:bg-pink-50/50'
          }`}
          title="Lọc theo khoảng cách"
        >
          <MapPin
            className={`w-3 h-3 ${filters.maxDistance > 0 ? 'text-white' : 'text-pink-600'}`}
          />
          <span>{filters.maxDistance > 0 ? currentDistanceLabel : 'Khoảng cách'}</span>
          {filters.maxDistance > 0 ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleSelectDistance(0);
              }}
              className="ml-0.5 p-0.5 rounded-full hover:bg-white/20 transition-colors"
              title="Xóa lọc khoảng cách"
            >
              <X className="w-2.5 h-2.5 stroke-[3]" />
            </span>
          ) : (
            <ChevronDown
              className={`w-3 h-3 transition-transform ${
                openDropdown === 'distance' ? 'rotate-180' : ''
              } text-slate-400`}
            />
          )}
        </button>

        {openDropdown === 'distance' && (
          <div
            className="absolute top-full left-0 mt-1.5 w-52 bg-white rounded-2xl border border-pink-100 shadow-xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-150"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
              Bán kính khoảng cách
            </div>
            {DISTANCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelectDistance(opt.value)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                  filters.maxDistance === opt.value
                    ? 'bg-pink-50 text-[#EB0F51] font-bold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{opt.label}</span>
                {filters.maxDistance === opt.value && (
                  <Check className="w-3.5 h-3.5 text-[#EB0F51]" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. Reset All Filters Button */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleResetAll}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold text-slate-500 hover:text-[#EB0F51] hover:bg-pink-50 transition cursor-pointer"
          title="Đặt lại tất cả bộ lọc"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          <span>Đặt lại</span>
        </button>
      )}

      {/* 5. Button to Open Full Filter Page */}
      {onOpenFullFilterPage && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenFullFilterPage();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-[#be185d] bg-pink-50 hover:bg-pink-100 border border-pink-200 shadow-2xs transition-colors cursor-pointer ml-auto"
          title="Mở toàn bộ trang lọc & khám phá chuyên sâu thay vì hiển thị nổi lên"
        >
          <SlidersHorizontal className="w-3 h-3 text-[#e1146c]" />
          <span>Xem tất cả bộ lọc →</span>
        </button>
      )}
    </div>
  );
};
