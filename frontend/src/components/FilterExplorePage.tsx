import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
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
  X,
  Calendar,
  Camera,
  CheckCircle2,
  MessageSquare,
  ThumbsUp,
  Layers,
  Award,
  Users,
  Heart,
} from 'lucide-react';
import { HotDeal, Salon, NewPartner, HOT_DEALS, NEARBY_SALONS, NEW_PARTNERS } from '../data/mockData';
import { PriceRangeSlider, PriceRange } from './PriceRangeSlider';
import { OptimizedImage } from './OptimizedImage';
import { CurrentUser } from '../types';
import { reviewService, ServiceStep, ServiceReviewItem } from '../services/reviewService';
import { FavoriteToast, FavoriteToastInfo } from './FavoriteToast';

export type ExploreContext = 'deals' | 'nearby' | 'new-partners' | 'all';

export interface FilterExplorePageProps {
  initialContext?: ExploreContext;
  initialCategory?: string;
  onBack: () => void;
  onBookDeal: (serviceTitle: string, salonName: string, price: number, originalPrice?: number) => void;
  onAddToCart: (deal: HotDeal) => void;
  onSelectPartner?: (partner: NewPartner) => void;
  deals?: HotDeal[];
  salons?: Salon[];
  partners?: NewPartner[];
  currentUser?: CurrentUser | null;
}

export interface UnifiedExploreItem {
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

export const FilterExplorePage: React.FC<FilterExplorePageProps> = ({
  initialContext = 'all',
  initialCategory = 'all',
  onBack,
  onBookDeal,
  onAddToCart,
  onSelectPartner,
  deals = HOT_DEALS,
  salons = NEARBY_SALONS,
  partners = NEW_PARTNERS,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<ExploreContext>(initialContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState<PriceRange>({ min: 0, max: 2000000 });
  const [distanceFilter, setDistanceFilter] = useState<'all' | '1.5' | '3' | '5' | '10'>('all');
  const [ratingFilter, setRatingFilter] = useState<'all' | '4.5' | '4.8' | '5.0'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory || 'all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'price-asc' | 'price-desc' | 'distance-asc' | 'rating-desc' | 'discount-desc'>('popular');
  const [showMobileFilterDrawer, setShowMobileFilterDrawer] = useState(false);
  const [addedItemId, setAddedItemId] = useState<string | null>(null);
  const [activeStepsItem, setActiveStepsItem] = useState<UnifiedExploreItem | null>(null);
  const [activeReviewsItem, setActiveReviewsItem] = useState<UnifiedExploreItem | null>(null);
  const [favoriteToast, setFavoriteToast] = useState<FavoriteToastInfo | null>(null);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const handleToggleFavorite = (e: React.MouseEvent, item: UnifiedExploreItem) => {
    e.stopPropagation();
    const nextState = !favorites[item.id];
    setFavorites((prev) => ({ ...prev, [item.id]: nextState }));
    setFavoriteToast({
      id: item.id,
      title: item.title,
      salonName: item.brandName,
      image: item.image,
      isFavorited: nextState,
    });
  };

  // Normalize datasets
  const allItems: UnifiedExploreItem[] = useMemo(() => {
    const list: UnifiedExploreItem[] = [];

    // 1. Deals
    deals.forEach((d) => {
      list.push({
        id: `deal-${d.id}`,
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
        distanceKm: d.distanceKm ?? 1.2,
        district: d.district ?? 'TP.HCM',
        highlightText: d.highlightText,
        isNew: d.isNew,
      });
    });

    // 2. Salons
    salons.forEach((s) => {
      const sale = s.minPrice ?? 200000;
      const orig = s.maxPrice ?? sale;
      const discount = orig > sale ? Math.round(((orig - sale) / orig) * 100) : 0;
      list.push({
        id: `salon-${s.id}`,
        type: 'salon',
        title: `Dịch vụ tổng hợp tại ${s.name}`,
        brandName: s.name,
        brandLogo: s.logo,
        image: s.image,
        salePrice: sale,
        originalPrice: orig,
        discountPercent: discount,
        rating: s.rating,
        reviewsCount: s.reviewsCount,
        duration: '60 - 90 phút',
        category: s.category,
        distanceKm: s.distanceKm ?? 1.5,
        district: s.district ?? 'TP.HCM',
        address: s.address,
        highlightText: s.badge,
        isNew: false,
      });
    });

    // 3. New Partners
    partners.forEach((p) => {
      list.push({
        id: `partner-${p.id}`,
        type: 'partner',
        title: p.specialty,
        brandName: p.name,
        brandLogo: p.logo,
        image: p.image,
        salePrice: 299000,
        originalPrice: 500000,
        discountPercent: 40,
        rating: 4.9,
        reviewsCount: 120,
        duration: '60 phút',
        category: 'spa',
        distanceKm: 1.5,
        district: 'Quận 1',
        address: p.address,
        highlightText: p.promoNotice,
        isNew: true,
      });
    });

    return list;
  }, [deals, salons, partners]);

  // Unique categories and districts
  const categories = useMemo(() => {
    return [
      { id: 'all', name: 'Tất cả danh mục' },
      { id: 'spa', name: 'Spa thư giãn & Dưỡng sinh' },
      { id: 'clinic', name: 'Clinic & Trị liệu da' },
      { id: 'tham-my-vien', name: 'Thẩm mỹ viện công nghệ cao' },
      { id: 'massage', name: 'Massage trị liệu Đông y' },
      { id: 'nail', name: 'Nails & Mi nghệ thuật' },
      { id: 'salon-toc', name: 'Salon tóc' },
    ];
  }, []);

  const districts = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((i) => {
      if (i.district) set.add(i.district);
    });
    return Array.from(set).sort();
  }, [allItems]);

  // Filtering
  const filteredItems = useMemo(() => {
    return allItems
      .filter((item) => {
        // Tab filter
        if (activeTab === 'deals' && item.type !== 'deal') return false;
        if (activeTab === 'nearby' && item.type !== 'salon') return false;
        if (activeTab === 'new-partners' && item.type !== 'partner') return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesTitle = item.title.toLowerCase().includes(q);
          const matchesBrand = item.brandName.toLowerCase().includes(q);
          const matchesDistrict = item.district.toLowerCase().includes(q);
          if (!matchesTitle && !matchesBrand && !matchesDistrict) return false;
        }

        // Price range
        if (item.salePrice < priceRange.min || item.salePrice > priceRange.max) return false;

        // Distance
        if (distanceFilter !== 'all') {
          const maxDist = parseFloat(distanceFilter);
          if (item.distanceKm > maxDist) return false;
        }

        // Rating
        if (ratingFilter !== 'all') {
          const minRating = parseFloat(ratingFilter);
          if (item.rating < minRating) return false;
        }

        // Category
        if (categoryFilter !== 'all') {
          if (item.category !== categoryFilter) return false;
        }

        // District
        if (districtFilter !== 'all') {
          if (item.district !== districtFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.salePrice - b.salePrice;
        if (sortBy === 'price-desc') return b.salePrice - a.salePrice;
        if (sortBy === 'distance-asc') return a.distanceKm - b.distanceKm;
        if (sortBy === 'rating-desc') return b.rating - a.rating;
        if (sortBy === 'discount-desc') return b.discountPercent - a.discountPercent;
        // Default popular: rating * reviews
        return b.rating * b.reviewsCount - a.rating * a.reviewsCount;
      });
  }, [
    allItems,
    activeTab,
    searchQuery,
    priceRange,
    distanceFilter,
    ratingFilter,
    categoryFilter,
    districtFilter,
    sortBy,
  ]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (priceRange.min > 0 || priceRange.max < 2000000) count++;
    if (distanceFilter !== 'all') count++;
    if (ratingFilter !== 'all') count++;
    if (categoryFilter !== 'all') count++;
    if (districtFilter !== 'all') count++;
    return count;
  }, [searchQuery, priceRange, distanceFilter, ratingFilter, categoryFilter, districtFilter]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setPriceRange({ min: 0, max: 2000000 });
    setDistanceFilter('all');
    setRatingFilter('all');
    setCategoryFilter('all');
    setDistrictFilter('all');
    setSortBy('popular');
  };

  const handleAddToCartClick = (item: UnifiedExploreItem) => {
    const dealObj: HotDeal = {
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
      district: item.district,
      distanceKm: item.distanceKm,
      highlightText: item.highlightText || '',
    };
    onAddToCart(dealObj);
    setAddedItemId(item.id);
    setTimeout(() => setAddedItemId(null), 1500);
  };

  const formatVND = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  return (
    <div className="min-h-screen bg-[#FFF9FA] text-slate-900 pb-20">
      {/* 1. Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-pink-100 shadow-2xs py-3.5 px-4 sm:px-8">
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
            <div>
              <h1 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-[#e1146c]" />
                <span>Bộ lọc chuyên sâu & Khám phá tất cả</span>
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Tìm kiếm dịch vụ làm đẹp chuẩn y khoa, so sánh giá và đặt lịch nhanh chóng
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 rounded-full text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Xóa bộ lọc ({activeFiltersCount})</span>
              </button>
            )}

            {/* Mobile Filter Button */}
            <button
              type="button"
              onClick={() => setShowMobileFilterDrawer(true)}
              className="lg:hidden px-3.5 py-1.5 rounded-xl bg-pink-50 border border-pink-200 text-[#be185d] text-xs font-bold flex items-center gap-1.5 shadow-2xs"
            >
              <Filter className="w-3.5 h-3.5 text-[#e1146c]" />
              <span>Bộ lọc {activeFiltersCount > 0 && `(${activeFiltersCount})`}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Top Search & Main Context Tabs */}
      <div className="bg-white border-b border-pink-100 py-4 px-4 sm:px-8 shadow-xs">
        <div className="max-w-7xl mx-auto space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-5 h-5 text-[#e1146c] absolute left-4 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên dịch vụ (nặn mụn, peel da, dưỡng sinh...), tên salon hoặc quận huyện..."
              className="w-full pl-12 pr-10 py-3 rounded-2xl border border-pink-200 focus:outline-none focus:border-[#e1146c] focus:ring-4 focus:ring-pink-100 text-xs sm:text-sm text-slate-900 bg-pink-50/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-3.5 p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Context Tabs (Tất cả, Khuyến mãi hot, Gần bạn, Doanh nghiệp mới) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
            {[
              { id: 'all', label: 'Tất cả dịch vụ', icon: Sparkles },
              { id: 'deals', label: 'Khuyến mãi HOT 🔥', icon: Flame },
              { id: 'nearby', label: 'Gần vị trí của tôi 📍', icon: MapPin },
              { id: 'new-partners', label: 'Doanh nghiệp mới tham gia ✨', icon: Building2 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as ExploreContext)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-pink-500 via-[#db2777] to-[#be185d] text-white shadow-sm'
                      : 'bg-pink-50/70 text-slate-700 hover:bg-pink-100/80 border border-pink-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Main Two-Column Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
          {/* ========================================================================= */}
          {/* LEFT SIDEBAR FILTERS (DESKTOP) */}
          {/* ========================================================================= */}
          <aside className="hidden lg:block bg-white rounded-3xl border border-pink-100 p-5 space-y-6 shadow-xs sticky top-24">
            <div className="flex items-center justify-between pb-3 border-b border-pink-100">
              <span className="text-xs font-black uppercase tracking-wider text-[#be185d] flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#e1146c]" />
                <span>Bộ lọc chi tiết</span>
              </span>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[11px] font-bold text-slate-500 hover:text-rose-600 transition cursor-pointer"
                >
                  Xóa lọc
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-2">
                Danh mục dịch vụ
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-pink-200 text-xs font-semibold text-slate-800 bg-pink-50/30 focus:outline-none focus:border-[#e1146c]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* District Filter */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-2">
                Khu vực / Quận huyện
              </label>
              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-pink-200 text-xs font-semibold text-slate-800 bg-pink-50/30 focus:outline-none focus:border-[#e1146c]"
              >
                <option value="all">Tất cả quận huyện</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Range Slider */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-2">
                Mức giá dịch vụ
              </label>
              <PriceRangeSlider
                value={priceRange}
                onChange={setPriceRange}
                minLimit={0}
                maxLimit={2000000}
                step={50000}
              />
            </div>

            {/* Distance Filter */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-2">
                Bán kính khoảng cách
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: '1.5', label: '< 1.5 km' },
                  { id: '3', label: '< 3.0 km' },
                  { id: '5', label: '< 5.0 km' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDistanceFilter(item.id as any)}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer text-center ${
                      distanceFilter === item.id
                        ? 'bg-[#be185d] text-white border-[#be185d] shadow-2xs'
                        : 'bg-pink-50/40 text-slate-600 border-pink-100 hover:bg-pink-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rating Filter */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-2">
                Đánh giá tối thiểu
              </label>
              <div className="space-y-1.5">
                {[
                  { id: 'all', label: 'Tất cả đánh giá' },
                  { id: '4.5', label: '⭐ 4.5 sao trở lên' },
                  { id: '4.8', label: '⭐ 4.8 sao xuất sắc' },
                  { id: '5.0', label: '⭐ 5.0 sao tuyệt đối' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRatingFilter(item.id as any)}
                    className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold text-left border transition cursor-pointer ${
                      ratingFilter === item.id
                        ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs'
                        : 'bg-white text-slate-600 border-pink-100 hover:bg-pink-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* ========================================================================= */}
          {/* RIGHT CONTENT RESULTS */}
          {/* ========================================================================= */}
          <main className="space-y-4">
            {/* Top Results Bar with Sort Selector */}
            <div className="bg-white rounded-2xl border border-pink-100 p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div>
                <span className="text-xs font-black text-slate-900">
                  Tìm thấy <strong className="text-[#e1146c] text-sm">{filteredItems.length}</strong> kết quả phù hợp
                </span>
                <p className="text-[11px] text-slate-500">
                  Hiển thị danh sách dịch vụ và cơ sở làm đẹp đã xác minh y tế
                </p>
              </div>

              {/* Sort selector */}
              <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
                <span className="text-slate-500 font-bold shrink-0">Sắp xếp:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl border border-pink-200 bg-pink-50/50 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#e1146c]"
                >
                  <option value="popular">Phổ biến & Được yêu thích</option>
                  <option value="price-asc">Giá: Thấp đến cao</option>
                  <option value="price-desc">Giá: Cao đến thấp</option>
                  <option value="discount-desc">Mức giảm giá nhiều nhất</option>
                  <option value="rating-desc">Đánh giá cao nhất</option>
                  <option value="distance-asc">Khoảng cách gần nhất</option>
                </select>
              </div>
            </div>

            {/* Results Grid */}
            {filteredItems.length === 0 ? (
              <div className="bg-white rounded-3xl border border-pink-100 p-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-pink-50 text-[#e1146c] flex items-center justify-center mx-auto">
                  <Search className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black text-slate-800">
                  Không tìm thấy dịch vụ nào phù hợp
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Hãy thử nới lỏng các bộ lọc mức giá, bán kính khoảng cách hoặc xóa từ khóa tìm kiếm để xem thêm ưu đãi.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-5 py-2.5 rounded-full bg-gradient-to-r from-pink-500 to-[#be185d] text-white text-xs font-bold shadow-md hover:opacity-95 transition cursor-pointer"
                >
                  Xóa toàn bộ bộ lọc
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                {filteredItems.map((item) => (
                  <article
                    key={item.id}
                    className="bg-white rounded-2xl border border-pink-100 hover:border-pink-300 shadow-2xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between overflow-hidden group"
                  >
                    {/* Thumbnail */}
                    <div>
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-pink-50">
                        <OptimizedImage
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {/* Top Badges */}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 z-10 pointer-events-none">
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-slate-800 shadow-xs">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            <span>{item.rating.toFixed(1)}</span>
                            <span className="text-slate-400">({item.reviewsCount})</span>
                          </span>

                          {item.discountPercent > 0 && (
                            <span className="rounded-full bg-gradient-to-r from-rose-500 to-[#e1146c] px-2 py-0.5 text-[10px] font-black text-white shadow-xs">
                              -{item.discountPercent}%
                            </span>
                          )}
                        </div>

                        {/* Favorite Button (Heart) */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorite(e, item)}
                          aria-label={favorites[item.id] ? 'Bỏ yêu thích' : 'Yêu thích dịch vụ'}
                          title={favorites[item.id] ? 'Đã lưu vào danh sách yêu thích' : 'Thêm vào danh sách yêu thích'}
                          className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 z-20 cursor-pointer shadow-md backdrop-blur-md ${
                            favorites[item.id]
                              ? 'bg-white text-rose-500 hover:scale-115 shadow-rose-500/25 ring-1 ring-rose-200'
                              : 'bg-white/85 hover:bg-white text-slate-400 hover:text-rose-500 hover:scale-115'
                          }`}
                        >
                          <Heart
                            className={`w-4 h-4 transition-transform duration-200 ${
                              favorites[item.id]
                                ? 'fill-rose-500 text-rose-500 scale-110'
                                : 'stroke-[2.2]'
                            }`}
                          />
                        </button>

                        {item.distanceKm > 0 && (
                          <div className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded-full text-[10px] font-bold text-white flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 text-pink-300" />
                            <span>{item.distanceKm} km · {item.district}</span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-3.5 sm:p-4">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#be185d] mb-1 truncate">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="truncate">{item.brandName}</span>
                        </div>

                        <h3
                          className="text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-2 min-h-[2.4rem] group-hover:text-[#e1146c] transition-colors"
                          title={item.title}
                        >
                          {item.title}
                        </h3>

                        {/* Rating cho từng dịch vụ và số lượt người đã trải nghiệm */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-900 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>{item.rating.toFixed(1)} ({item.reviewsCount})</span>
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-md">
                            <Users className="w-3 h-3 text-[#be185d]" />
                            <span>{(item.reviewsCount * 9 + 180).toLocaleString('vi-VN')}+ người đã trải nghiệm</span>
                          </span>
                        </div>

                        {item.highlightText && (
                          <p className="mt-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block font-medium truncate max-w-full">
                            ✓ {item.highlightText}
                          </p>
                        )}

                        {/* Quick View Steps & Reviews Buttons */}
                        <div className="grid grid-cols-2 gap-1.5 pt-2.5 mt-2 border-t border-pink-50">
                          <button
                            type="button"
                            onClick={() => setActiveStepsItem(item)}
                            className="py-1.5 px-2 rounded-xl bg-pink-50/70 hover:bg-pink-100 border border-pink-200/70 text-[11px] font-bold text-[#be185d] flex items-center justify-center gap-1 transition cursor-pointer"
                            title="Xem chi tiết các bước quy trình có ảnh"
                          >
                            <Camera className="w-3 h-3 text-[#e1146c]" />
                            <span>Ảnh các bước</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveReviewsItem(item)}
                            className="py-1.5 px-2 rounded-xl bg-amber-50/70 hover:bg-amber-100 border border-amber-200/70 text-[11px] font-bold text-amber-900 flex items-center justify-center gap-1 transition cursor-pointer"
                            title="Xem đánh giá của khách hàng"
                          >
                            <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                            <span>Xem đánh giá</span>
                          </button>
                        </div>

                        {/* If this is a partner, button to visit the partner shop profile */}
                        {item.type === 'partner' && onSelectPartner && (
                          <button
                            type="button"
                            onClick={() => {
                              const p = partners.find((x) => `partner-${x.id}` === item.id) || partners[0];
                              if (p) onSelectPartner(p);
                            }}
                            className="w-full mt-2 py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 hover:bg-purple-100 border border-purple-200 text-[11px] font-bold text-purple-900 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                          >
                            <Building2 className="w-3.5 h-3.5 text-[#be185d]" />
                            <span>Hồ sơ Shop & Người sáng lập →</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-3.5 sm:p-4 pt-0">
                      <div className="pt-3 border-t border-pink-50 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-base sm:text-lg font-black text-[#e1146c]">
                            {formatVND(item.salePrice)}
                          </div>
                          {item.originalPrice > item.salePrice && (
                            <span className="text-[10px] text-slate-400 line-through">
                              {formatVND(item.originalPrice)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {item.type === 'deal' && (
                            <button
                              type="button"
                              onClick={() => handleAddToCartClick(item)}
                              className={`p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                                addedItemId === item.id
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                    : 'bg-pink-50 border-pink-200 text-[#be185d] hover:bg-pink-100'
                              }`}
                              title="Thêm vào giỏ"
                            >
                              {addedItemId === item.id ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onBookDeal(item.title, item.brandName, item.salePrice, item.originalPrice)}
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-[#be185d] text-white text-xs font-bold shadow-xs hover:opacity-95 transition flex items-center gap-1 cursor-pointer"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Đặt lịch</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Modal: Procedure Steps Preview */}
      {activeStepsItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-pink-100">
            <div className="p-4 sm:p-5 border-b border-pink-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-[#be185d] tracking-wider block">
                  Quy trình thực hiện chuẩn Y khoa
                </span>
                <h3 className="text-sm sm:text-base font-black text-slate-900 line-clamp-1">
                  {activeStepsItem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveStepsItem(null)}
                className="p-1.5 rounded-full bg-pink-50 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              {reviewService
                .getProcedureSteps(activeStepsItem.category, activeStepsItem.title)
                .map((step) => (
                  <div
                    key={step.stepNumber}
                    className="p-3.5 rounded-2xl border border-pink-100 bg-pink-50/30 flex gap-3.5"
                  >
                    <img
                      src={step.imageUrl}
                      alt={step.title}
                      className="w-20 h-20 rounded-xl object-cover border border-pink-100 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-black text-slate-900">
                          Bước {step.stepNumber}: {step.title}
                        </span>
                        <span className="text-[10px] font-bold text-pink-700 bg-pink-100 px-2 py-0.5 rounded-full shrink-0">
                          ⏱ {step.durationMinutes} phút
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {step.description}
                      </p>
                      {step.keyProducts && (
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Sản phẩm: {step.keyProducts}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            <div className="p-3.5 border-t border-pink-100 bg-pink-50/30 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveStepsItem(null)}
                className="px-4 py-2 rounded-xl border border-pink-200 text-xs font-bold text-slate-700 hover:bg-pink-50 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  const it = activeStepsItem;
                  setActiveStepsItem(null);
                  onBookDeal(it.title, it.brandName, it.salePrice, it.originalPrice);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-[#be185d] text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Đặt lịch ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Service Reviews Preview */}
      {activeReviewsItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-pink-100">
            <div className="p-4 sm:p-5 border-b border-pink-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-[#be185d] tracking-wider block">
                  Đánh giá thực tế từ khách hàng
                </span>
                <h3 className="text-sm sm:text-base font-black text-slate-900 line-clamp-1">
                  {activeReviewsItem.title} · {activeReviewsItem.brandName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveReviewsItem(null)}
                className="p-1.5 rounded-full bg-pink-50 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5">
              <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 flex items-center justify-between">
                <div>
                  <div className="text-xl font-black text-amber-900 flex items-center gap-1.5">
                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                    <span>{activeReviewsItem.rating.toFixed(1)} / 5.0</span>
                  </div>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    100% đánh giá từ khách hàng đã trải nghiệm dịch vụ tại {activeReviewsItem.brandName}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-200 text-amber-900 text-xs font-bold">
                  {activeReviewsItem.reviewsCount} lượt đánh giá
                </span>
              </div>

              {reviewService.getReviewsForService(activeReviewsItem.title).map((rev) => (
                <div key={rev.id} className="p-3.5 rounded-2xl border border-pink-100 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-pink-100 text-[#be185d] font-bold text-xs flex items-center justify-center">
                        {rev.authorName.charAt(0)}
                      </div>
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
                    <div className="flex gap-2 pt-1">
                      {rev.images.map((img, i) => (
                        <img
                          key={i}
                          src={img}
                          alt="Ảnh đánh giá"
                          className="w-16 h-16 rounded-xl object-cover border border-pink-100"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-3.5 border-t border-pink-100 bg-pink-50/30 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveReviewsItem(null)}
                className="px-4 py-2 rounded-xl bg-[#be185d] text-white text-xs font-bold hover:bg-[#9d174d] cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Filters Drawer */}
      {showMobileFilterDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white h-full overflow-y-auto p-5 space-y-5 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-pink-100">
              <span className="text-sm font-black text-slate-900">Bộ lọc chi tiết</span>
              <button
                type="button"
                onClick={() => setShowMobileFilterDrawer(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filters Inside Mobile Drawer */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-2">Danh mục dịch vụ</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-pink-200 text-xs font-semibold"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 block mb-2">Khu vực / Quận huyện</label>
              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-pink-200 text-xs font-semibold"
              >
                <option value="all">Tất cả quận huyện</option>
                {districts.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 block mb-2">Mức giá</label>
              <PriceRangeSlider
                value={priceRange}
                onChange={setPriceRange}
                minLimit={0}
                maxLimit={2000000}
                step={50000}
              />
            </div>

            <div className="pt-4 border-t border-pink-100 flex gap-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex-1 py-2.5 rounded-xl border border-pink-200 text-xs font-bold text-slate-700"
              >
                Xóa bộ lọc
              </button>
              <button
                type="button"
                onClick={() => setShowMobileFilterDrawer(false)}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-[#be185d] text-white text-xs font-bold"
              >
                Áp dụng ({filteredItems.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Professional Favorite Toast */}
      <FavoriteToast
        toast={favoriteToast}
        onClose={() => setFavoriteToast(null)}
      />
    </div>
  );
};
