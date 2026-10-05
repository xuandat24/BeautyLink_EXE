import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  Filter,
  ArrowUpDown,
  Star,
  MapPin,
  Clock,
  Sparkles,
  RotateCcw,
  Check,
  ChevronDown,
  Plus,
  Flame,
  Building2,
  Tag,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { HotDeal, Salon, NewPartner, HOT_DEALS, NEARBY_SALONS, NEW_PARTNERS } from '../data/mockData';
import { PriceRangeSlider, PriceRange } from './PriceRangeSlider';
import { OptimizedImage } from './OptimizedImage';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export type ViewAllContext = 'deals' | 'nearby' | 'new-partners' | 'all';

interface ViewAllServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: ViewAllContext;
  initialCategory?: string;
  onBookDeal: (serviceTitle: string, salonName: string, price: number, originalPrice: number) => void;
  onAddToCart: (deal: HotDeal) => void;
  deals?: HotDeal[];
  salons?: Salon[];
  partners?: NewPartner[];
}

// Unified item representation for filtering & sorting
export interface UnifiedServiceItem {
  id: string;
  type: 'deal' | 'salon' | 'partner';
  title: string;
  brandName: string;
  brandLogo: string;
  image: string;
  salePrice: number;
  originalPrice: number;
  discountPercent: number;
  rating: number;
  reviewsCount: number;
  duration?: string;
  category: string;
  distanceKm: number;
  district: string;
  address?: string;
  highlightText?: string;
  isNew?: boolean;
}

export const ViewAllServicesModal: React.FC<ViewAllServicesModalProps> = ({
  isOpen,
  onClose,
  context,
  initialCategory,
  onBookDeal,
  onAddToCart,
  deals = HOT_DEALS,
  salons = NEARBY_SALONS,
  partners = NEW_PARTNERS,
}) => {
  // Lock body scroll when open
  useBodyScrollLock(isOpen);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Active view tab inside modal
  const [activeTab, setActiveTab] = useState<ViewAllContext>(context);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState<PriceRange>({ min: 0, max: 1500000 });
  const [distanceFilter, setDistanceFilter] = useState<'all' | '1.5' | '3' | '5' | '10'>('all');
  const [ratingFilter, setRatingFilter] = useState<'all' | '4.5' | '4.8' | '5.0'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory || 'all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'price-asc' | 'price-desc' | 'distance-asc' | 'rating-desc' | 'discount-desc'>('popular');
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [addedItemId, setAddedItemId] = useState<string | null>(null);

  // Normalize all datasets into UnifiedServiceItem
  const allItems: UnifiedServiceItem[] = useMemo(() => {
    const dealsList: UnifiedServiceItem[] = deals.map((d) => ({
      id: d.id,
      type: 'deal',
      title: d.title,
      brandName: d.brandName,
      brandLogo: d.brandLogo,
      image: d.image,
      salePrice: d.salePrice,
      originalPrice: d.originalPrice,
      discountPercent: d.discountPercent,
      rating: d.rating,
      reviewsCount: d.reviewsCount,
      duration: d.duration,
      category: d.category,
      distanceKm: d.distanceKm ?? 1.5,
      district: d.district ?? 'Quận 1',
      highlightText: d.highlightText,
      isNew: d.isNew,
    }));

    const salonsList: UnifiedServiceItem[] = salons.map((s) => ({
      id: s.id,
      type: 'salon',
      title: `Gói Trải Nghiệm Tiêu Chuẩn tại ${s.name}`,
      brandName: s.name,
      brandLogo: s.logo,
      image: s.image,
      salePrice: s.minPrice || 299000,
      originalPrice: s.maxPrice || 500000,
      discountPercent: Math.round((((s.maxPrice || 500000) - (s.minPrice || 299000)) / (s.maxPrice || 500000)) * 100),
      rating: s.rating,
      reviewsCount: s.reviewsCount,
      duration: '60 phút',
      category: s.category,
      distanceKm: s.distanceKm,
      district: s.district,
      address: s.address,
      highlightText: s.badge || 'Cơ sở được chứng nhận chất lượng 5 sao',
      isNew: false,
    }));

    const partnersList: UnifiedServiceItem[] = partners.map((p, idx) => ({
      id: p.id,
      type: 'partner',
      title: p.specialty,
      brandName: p.name,
      brandLogo: p.logo,
      image: p.image,
      salePrice: 350000,
      originalPrice: 600000,
      discountPercent: 42,
      rating: 4.9,
      reviewsCount: 120 + idx * 35,
      duration: '75 phút',
      category: 'spa',
      distanceKm: 1.8 + idx * 0.7,
      district: p.address.includes('Phú Nhuận') ? 'Phú Nhuận' : p.address.includes('Bình Thạnh') ? 'Bình Thạnh' : 'Quận 1',
      address: p.address,
      highlightText: p.promoNotice,
      isNew: true,
    }));

    return [...dealsList, ...salonsList, ...partnersList];
  }, []);

  // Filter items based on active tab
  const tabFilteredItems = useMemo(() => {
    if (activeTab === 'deals') return allItems.filter((i) => i.type === 'deal');
    if (activeTab === 'nearby') return allItems.filter((i) => i.type === 'salon');
    if (activeTab === 'new-partners') return allItems.filter((i) => i.type === 'partner');
    return allItems;
  }, [activeTab, allItems]);

  // Apply Search, Filters, and Sorting
  const filteredAndSortedItems = useMemo(() => {
    return tabFilteredItems
      .filter((item) => {
        // Keyword Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchBrand = item.brandName.toLowerCase().includes(q);
          const matchDistrict = item.district.toLowerCase().includes(q);
          if (!matchTitle && !matchBrand && !matchDistrict) return false;
        }

        // Price Filter (Dual Constraint Slider)
        if (item.salePrice < priceRange.min || item.salePrice > priceRange.max) return false;

        // Distance Filter (Bán kính km)
        if (distanceFilter !== 'all') {
          const maxDist = parseFloat(distanceFilter);
          if (item.distanceKm > maxDist) return false;
        }

        // Star Rating Filter
        if (ratingFilter !== 'all') {
          const minRating = parseFloat(ratingFilter);
          if (item.rating < minRating) return false;
        }

        // Category Filter
        if (categoryFilter !== 'all') {
          if (item.category !== categoryFilter) return false;
        }

        // District Filter
        if (districtFilter !== 'all') {
          if (!item.district.toLowerCase().includes(districtFilter.toLowerCase())) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.salePrice - b.salePrice;
        if (sortBy === 'price-desc') return b.salePrice - a.salePrice;
        if (sortBy === 'distance-asc') return a.distanceKm - b.distanceKm;
        if (sortBy === 'rating-desc') return b.rating - a.rating;
        if (sortBy === 'discount-desc') return b.discountPercent - a.discountPercent;
        return b.reviewsCount - a.reviewsCount; // 'popular'
      });
  }, [
    tabFilteredItems,
    searchQuery,
    priceRange,
    distanceFilter,
    ratingFilter,
    categoryFilter,
    districtFilter,
    sortBy,
  ]);

  const hasActiveFilters =
    priceRange.min > 0 ||
    priceRange.max < 1500000 ||
    distanceFilter !== 'all' ||
    ratingFilter !== 'all' ||
    categoryFilter !== 'all' ||
    districtFilter !== 'all' ||
    searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setSearchQuery('');
    setPriceRange({ min: 0, max: 1500000 });
    setDistanceFilter('all');
    setRatingFilter('all');
    setCategoryFilter('all');
    setDistrictFilter('all');
    setSortBy('popular');
  };

  const formatVND = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  const handleAddToCartClick = (e: React.MouseEvent, item: UnifiedServiceItem) => {
    e.stopPropagation();
    const dealMock: HotDeal = {
      id: item.id,
      title: item.title,
      brandName: item.brandName,
      brandLogo: item.brandLogo,
      image: item.image,
      originalPrice: item.originalPrice,
      salePrice: item.salePrice,
      discountPercent: item.discountPercent,
      rating: item.rating,
      reviewsCount: item.reviewsCount,
      duration: item.duration || '60 phút',
      category: item.category,
      highlightText: item.highlightText || '',
      distanceKm: item.distanceKm,
      district: item.district,
    };
    onAddToCart(dealMock);
    setAddedItemId(item.id);
    setTimeout(() => setAddedItemId(null), 1500);
  };

  const getModalTitle = () => {
    switch (activeTab) {
      case 'deals':
        return 'Tất Cả Khuyến Mãi Hot 🔥';
      case 'nearby':
        return 'Tất Cả Địa Điểm Gần Bạn 📍';
      case 'new-partners':
        return 'Doanh Nghiệp Mới Tham Gia ✨';
      default:
        return 'Khám Phá Toàn Bộ Dịch Vụ & Spa 🌸';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Blurred & Dimmed Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Pristine Modal Card */}
      <div
        className="relative z-10 w-full max-w-6xl bg-white rounded-3xl shadow-2xl border border-pink-100 flex flex-col h-[92vh] max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#be185d] via-[#e1146c] to-[#fb7185] text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-xl font-black tracking-tight">{getModalTitle()}</h2>
              <p className="text-xs text-pink-100 font-medium hidden sm:block">
                Hơn 120+ dịch vụ & cơ sở làm đẹp đã kiểm định uy tín trên BeautyLink
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFiltersMobile(!showFiltersMobile)}
              className="md:hidden px-3 py-1.5 rounded-full bg-white/20 text-xs font-bold flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Bộ lọc</span>
              {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-yellow-300" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white text-white hover:text-[#EB0F51] flex items-center justify-center transition-all shadow-sm cursor-pointer"
              title="Đóng cửa sổ (ESC)"
              aria-label="Đóng cửa sổ"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Khuyến Mãi Hot, Gần Bạn, Đối Tác Mới, Tất Cả) */}
        <div className="bg-pink-50/70 border-b border-pink-100 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('deals')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'deals'
                  ? 'bg-[#e1146c] text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-[#e1146c] border border-pink-100'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Khuyến Mãi Hot</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('nearby')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'nearby'
                  ? 'bg-[#e1146c] text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-[#e1146c] border border-pink-100'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Địa Điểm Gần Bạn</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('new-partners')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'new-partners'
                  ? 'bg-[#e1146c] text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-[#e1146c] border border-pink-100'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Đối Tác Mới</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-[#e1146c] text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-[#e1146c] border border-pink-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tất Cả Dịch Vụ</span>
            </button>
          </div>

          {/* Result Count and Reset Button */}
          <div className="flex items-center gap-2 shrink-0 text-xs">
            <span className="text-slate-500 font-semibold hidden lg:inline">
              Tìm thấy <strong className="text-[#e1146c]">{filteredAndSortedItems.length}</strong> kết quả
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1 rounded-full bg-pink-100 text-[#e1146c] hover:bg-pink-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Đặt lại lọc</span>
              </button>
            )}
          </div>
        </div>

        {/* FULL FILTER & SORT TOOLBAR (Requested by User) */}
        <div
          className={`bg-white border-b border-pink-100 p-4 sm:px-6 space-y-3 shrink-0 ${
            showFiltersMobile ? 'block' : 'hidden md:block'
          }`}
        >
          {/* Row 1: Search Input & Sort Dropdown */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm tên dịch vụ, spa, quận..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-pink-200 focus:outline-none focus:border-[#e1146c] focus:ring-1 focus:ring-pink-200 bg-slate-50/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort Selector Dropdown */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1 shrink-0">
                <ArrowUpDown className="w-3.5 h-3.5 text-[#e1146c]" />
                <span>Sắp xếp theo:</span>
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 text-xs rounded-xl border border-pink-200 bg-white font-bold text-slate-700 focus:outline-none focus:border-[#e1146c] cursor-pointer shadow-xs"
              >
                <option value="popular">🔥 Phổ biến & Nổi bật nhất</option>
                <option value="price-asc">💵 Giá: Thấp đến Cao</option>
                <option value="price-desc">💎 Giá: Cao đến Thấp</option>
                <option value="distance-asc">📍 Khoảng cách: Gần nhất trước</option>
                <option value="rating-desc">⭐ Đánh giá: Sao cao nhất</option>
                <option value="discount-desc">🏷️ Ưu đãi: Giảm % nhiều nhất</option>
              </select>
            </div>
          </div>

          {/* Row 2: Filter Pills (Price, Distance, Star Rating, Category, District) */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            {/* 1. LỌC THEO KHOẢNG GIÁ VỚI SLIDER */}
            <PriceRangeSlider
              value={priceRange}
              onChange={setPriceRange}
              minLimit={0}
              maxLimit={1500000}
              step={25000}
              itemCount={filteredAndSortedItems.length}
              label="Khoảng giá"
            />

            {/* 2. LỌC THEO KHOẢNG CÁCH ĐỊA LÝ */}
            <div className="flex items-center gap-1.5 bg-pink-50/80 px-2.5 py-1 rounded-xl border border-pink-100">
              <span className="font-extrabold text-[#be185d] flex items-center gap-1 text-[11px]">
                <MapPin className="w-3 h-3" />
                <span>Khoảng cách:</span>
              </span>
              <select
                value={distanceFilter}
                onChange={(e) => setDistanceFilter(e.target.value as any)}
                className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer text-xs"
              >
                <option value="all">Tất cả khoảng cách</option>
                <option value="1.5">Gần nhất (&lt; 1.5 km)</option>
                <option value="3">Dưới 3 km</option>
                <option value="5">Dưới 5 km</option>
                <option value="10">Bán kính 10 km</option>
              </select>
            </div>

            {/* 3. LỌC THEO XẾP HẠNG SAO */}
            <div className="flex items-center gap-1.5 bg-pink-50/80 px-2.5 py-1 rounded-xl border border-pink-100">
              <span className="font-extrabold text-[#be185d] flex items-center gap-1 text-[11px]">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>Đánh giá:</span>
              </span>
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value as any)}
                className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer text-xs"
              >
                <option value="all">Tất cả số sao</option>
                <option value="4.5">Từ 4.5+ ⭐</option>
                <option value="4.8">Từ 4.8+ ⭐ (Rất tốt)</option>
                <option value="5.0">5.0 ⭐ (Tuyệt đối)</option>
              </select>
            </div>

            {/* 4. LỌC THEO DANH MỤC */}
            <div className="flex items-center gap-1.5 bg-pink-50/80 px-2.5 py-1 rounded-xl border border-pink-100">
              <span className="font-extrabold text-[#be185d] text-[11px]">Danh mục:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer text-xs"
              >
                <option value="all">Tất cả danh mục</option>
                <option value="spa">Spa & Chăm sóc da</option>
                <option value="clinic">Clinic Y Khoa</option>
                <option value="massage">Massage & Dưỡng sinh</option>
                <option value="nail">Nails & Mi</option>
                <option value="tham-my-vien">Thẩm mỹ viện</option>
              </select>
            </div>

            {/* 5. LỌC THEO KHU VỰC / QUẬN */}
            <div className="flex items-center gap-1.5 bg-pink-50/80 px-2.5 py-1 rounded-xl border border-pink-100">
              <span className="font-extrabold text-[#be185d] text-[11px]">Khu vực:</span>
              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer text-xs"
              >
                <option value="all">Tất cả quận/huyện</option>
                <option value="Quận 1">Quận 1</option>
                <option value="Quận 3">Quận 3</option>
                <option value="Quận 7">Quận 7</option>
                <option value="Quận 10">Quận 10</option>
                <option value="Phú Nhuận">Phú Nhuận</option>
                <option value="Bình Thạnh">Bình Thạnh</option>
              </select>
            </div>
          </div>
        </div>

        {/* RESULTS GRID CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {filteredAndSortedItems.length === 0 ? (
            /* Empty State */
            <div className="py-16 text-center space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-pink-100 text-[#e1146c] flex items-center justify-center mx-auto text-2xl">
                🔍
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">
                Không tìm thấy dịch vụ phù hợp bộ lọc
              </h3>
              <p className="text-xs text-slate-500">
                Thử thay đổi mức giá, nới rộng bán kính khoảng cách hoặc bỏ các điều kiện lọc để xem thêm dịch vụ.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-5 py-2.5 rounded-full bg-[#e1146c] text-white text-xs font-bold shadow-md hover:bg-[#be185d] transition-all cursor-pointer"
              >
                Xóa tất cả bộ lọc
              </button>
            </div>
          ) : (
            /* Cards Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredAndSortedItems.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() =>
                    onBookDeal(item.title, item.brandName, item.salePrice, item.originalPrice)
                  }
                  className="group flex flex-col justify-between bg-white rounded-2xl border border-pink-100 hover:border-pink-300 shadow-xs hover:shadow-lg hover:shadow-pink-500/10 transition-all duration-300 overflow-hidden cursor-pointer"
                >
                  {/* Image & Badges */}
                  <div className="relative aspect-video sm:aspect-square w-full overflow-hidden bg-pink-50">
                    <OptimizedImage
                      src={item.image}
                      alt={item.title}
                      preset="deal-card"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      containerClassName="w-full h-full"
                    />

                    {/* Discount Badge */}
                    <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                      {item.discountPercent > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-[#e1146c] to-[#f43f5e] text-white text-[11px] font-black shadow-md tracking-wider">
                          -{item.discountPercent}%
                        </span>
                      )}
                      {item.isNew && (
                        <span className="px-1.5 py-0.5 rounded bg-fuchsia-600 text-white text-[9px] font-black uppercase tracking-wider shadow">
                          MỚI
                        </span>
                      )}
                    </div>

                    {/* Brand Logo & Distance Tag */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <div className="w-7 h-7 rounded-full bg-white/95 backdrop-blur-sm border border-pink-200 flex items-center justify-center text-[10px] font-bold text-[#be185d] shadow-sm">
                        {item.brandLogo}
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 text-pink-400" />
                        <span>{item.distanceKm} km</span>
                      </span>
                    </div>

                    {/* Quick Add To Cart Button */}
                    <button
                      type="button"
                      onClick={(e) => handleAddToCartClick(e, item)}
                      className={`absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all ${
                        addedItemId === item.id
                          ? 'bg-emerald-500 text-white scale-110'
                          : 'bg-white/90 text-[#be185d] hover:bg-[#e1146c] hover:text-white'
                      }`}
                      title="Thêm vào giỏ"
                    >
                      {addedItemId === item.id ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="p-3.5 flex flex-col flex-1 justify-between">
                    <div>
                      {/* Salon / Brand & District */}
                      <div className="flex items-center justify-between text-[11px] text-pink-700/80 font-semibold mb-1">
                        <span className="truncate max-w-[130px]">{item.brandName}</span>
                        <span className="text-slate-400 font-medium">📍 {item.district}</span>
                      </div>

                      {/* Service Title */}
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-[#e1146c] transition-colors line-clamp-2 leading-snug">
                        {item.title}
                      </h4>

                      {/* Highlight Subtext */}
                      {item.highlightText && (
                        <p className="mt-1 text-[11px] text-slate-500 line-clamp-1 italic">
                          ✨ {item.highlightText}
                        </p>
                      )}
                    </div>

                    {/* Pricing & Footer Meta */}
                    <div className="mt-3 pt-2 border-t border-pink-50">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-base sm:text-lg font-black text-[#e1146c] tracking-tight">
                            {formatVND(item.salePrice)}
                          </span>
                          {item.originalPrice > item.salePrice && (
                            <span className="text-xs text-slate-400 line-through block">
                              {formatVND(item.originalPrice)}
                            </span>
                          )}
                        </div>

                        {item.duration && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            {item.duration}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 text-amber-500 font-bold">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{item.rating}</span>
                          <span className="text-slate-400 font-normal">({item.reviewsCount})</span>
                        </span>

                        <span className="text-[11px] font-bold text-[#e1146c] group-hover:underline">
                          Đặt lịch ngay →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Bottom Status Bar */}
        <div className="p-3 sm:px-6 bg-white border-t border-pink-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Cam kết giá niêm yết chính xác • Miễn phí hủy lịch trước 2 giờ</span>
          </div>

          <div className="text-slate-700 font-bold hidden sm:block">
            Đang hiển thị {filteredAndSortedItems.length} dịch vụ
          </div>
        </div>
      </div>
    </div>
  );
};
