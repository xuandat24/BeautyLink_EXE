import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  MapPin,
  ShieldCheck,
  Calendar,
  Loader2,
  Star,
  Clock,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  RotateCcw,
  CheckCircle2,
  Tag,
  Zap,
  Check,
  LayoutGrid,
  List,
  Eye,
  CreditCard,
  Phone,
  Info,
  Award,
  Camera,
  MessageSquare,
  ThumbsUp,
  Layers,
  Heart,
} from 'lucide-react';
import { BackendCategory, BackendService, CurrentUser } from '../types';
import { beautyApi, getApiErrorMessage, DEFAULT_CATEGORIES } from '../services/beautyApi';
import { BookingModal } from './BookingModal';
import { OptimizedImage } from './OptimizedImage';
import { reviewService, ServiceStep, ServiceReviewItem } from '../services/reviewService';
import { ServiceReviewModal } from './ServiceReviewModal';

interface CategoryServicePageProps {
  category: BackendCategory;
  categories?: BackendCategory[];
  onSelectCategory?: (category: BackendCategory) => void;
  locationId: number | null;
  locationLabel: string;
  currentUser: CurrentUser | null;
  onBack: () => void;
  onNeedLogin: () => void;
  onBookingCreated: (message: string) => void;
  onOpenLocationModal?: () => void;
  onAddToCart?: (service: BackendService) => void;
  onDirectCheckout?: (service: BackendService, preselectedDate?: string, preselectedTime?: string) => void;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('vi-VN').format(val) + 'đ';
};

// District lists based on active city
const DISTRICTS_HCM = [
  'Quận 1',
  'Quận 3',
  'Quận 7',
  'Phú Nhuận',
  'Bình Thạnh',
  'Tân Bình',
  'Thủ Đức',
];

const DISTRICTS_HN = [
  'Hoàn Kiếm',
  'Ba Đình',
  'Đống Đa',
  'Cầu Giấy',
  'Hai Bà Trưng',
  'Tây Hồ',
  'Thanh Xuân',
];

export const CategoryServicePage: React.FC<CategoryServicePageProps> = ({
  category,
  categories = DEFAULT_CATEGORIES,
  onSelectCategory,
  locationId,
  locationLabel,
  currentUser,
  onBack,
  onNeedLogin,
  onBookingCreated,
  onOpenLocationModal,
  onAddToCart,
  onDirectCheckout,
}) => {
  // Services & network state
  const [allServices, setAllServices] = useState<BackendService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active Category (allows in-page fast category switching)
  const [activeCategorySlug, setActiveCategorySlug] = useState<string>(category.slug);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [priceRange, setPriceRange] = useState<'all' | 'under-300k' | '300k-600k' | '600k-1000k' | 'above-1000k'>('all');
  const [minRating, setMinRating] = useState<number>(0);
  const [onlyAvailableToday, setOnlyAvailableToday] = useState(false);
  const [onlyDiscounted, setOnlyDiscounted] = useState(false);
  const [sortBy, setSortBy] = useState<'popular' | 'price-asc' | 'price-desc' | 'rating-desc' | 'duration-asc'>('popular');

  // Display Mode: Grid vs List
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(9);
  const catalogTopRef = useRef<HTMLDivElement>(null);

  // Detail Quick View Modal & Tabs
  const [previewService, setPreviewService] = useState<BackendService | null>(null);
  const [previewTab, setPreviewTab] = useState<'overview' | 'steps' | 'reviews'>('overview');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [reviewsUpdateTrigger, setReviewsUpdateTrigger] = useState<number>(0);

  // Booking modal state
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState<BackendService | null>(null);
  const [preselectedSlot, setPreselectedSlot] = useState<string | null>(null);
  const [preselectedDate, setPreselectedDate] = useState<string | null>(null);
  const [addedServiceId, setAddedServiceId] = useState<number | null>(null);

  // Floating Schedule Popover state (hover or tap / "dí vào")
  const [hoveredScheduleServiceId, setHoveredScheduleServiceId] = useState<number | null>(null);
  const [pinnedScheduleServiceId, setPinnedScheduleServiceId] = useState<number | null>(null);
  const [activePopoverDate, setActivePopoverDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [activePopoverSlot, setActivePopoverSlot] = useState<string | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);
  const dayAfterStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  }, []);

  const getServiceSlotsForDate = (service: BackendService, targetDate: string) => {
    if (targetDate === todayStr && service.availableTodaySlots && service.availableTodaySlots.length > 0) {
      return service.availableTodaySlots;
    }
    return ['09:00', '10:00', '11:30', '13:30', '14:30', '15:30', '16:30', '17:30', '18:30', '19:30'];
  };

  // Sync internal active slug when category prop changes
  useEffect(() => {
    setActiveCategorySlug(category.slug);
    setCurrentPage(1);
  }, [category.slug]);

  // Load services whenever category or location changes
  useEffect(() => {
    setLoading(true);
    setError('');
    beautyApi
      .services(activeCategorySlug, locationId || undefined)
      .then((data) => {
        setAllServices(data);
        setCurrentPage(1);
      })
      .catch((err) => setError(getApiErrorMessage(err, 'Không thể tải danh sách dịch vụ.')))
      .finally(() => setLoading(false));
  }, [activeCategorySlug, locationId]);

  // Reset page to 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDistrict, priceRange, minRating, onlyAvailableToday, onlyDiscounted, sortBy]);

  // Available districts for current city
  const availableDistricts = useMemo(() => {
    const isHN = locationLabel.toLowerCase().includes('hà nội') || locationLabel.toLowerCase().includes('ha noi');
    return isHN ? DISTRICTS_HN : DISTRICTS_HCM;
  }, [locationLabel]);

  // Active category object
  const currentCategory = useMemo(() => {
    if (activeCategorySlug === 'all') {
      return {
        id: 0,
        slug: 'all',
        name: 'Tất cả dịch vụ',
        description: `Khám phá toàn bộ dịch vụ làm đẹp, spa, chăm sóc da & tóc uy tín tại ${locationLabel}.`,
        imageUrl: category.imageUrl,
      };
    }
    const found = categories.find((c) => c.slug === activeCategorySlug);
    return found || category;
  }, [activeCategorySlug, categories, category, locationLabel]);

  // Filter & Sort Logic
  const filteredAndSortedServices = useMemo(() => {
    return allServices
      .filter((s) => {
        // 1. Text Search Filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = s.name.toLowerCase().includes(q);
          const matchSupplier = s.supplierName.toLowerCase().includes(q);
          const matchDesc = s.description ? s.description.toLowerCase().includes(q) : false;
          const matchCategory = s.categoryName ? s.categoryName.toLowerCase().includes(q) : false;
          if (!matchName && !matchSupplier && !matchDesc && !matchCategory) {
            return false;
          }
        }

        // 2. District Filter
        if (selectedDistrict !== 'all') {
          const d = selectedDistrict.toLowerCase();
          const matchDistrict =
            (s.district && s.district.toLowerCase().includes(d)) ||
            s.supplierAddress.toLowerCase().includes(d);
          if (!matchDistrict) return false;
        }

        // 3. Price Range Filter
        if (priceRange === 'under-300k' && s.price >= 300000) return false;
        if (priceRange === '300k-600k' && (s.price < 300000 || s.price > 600000)) return false;
        if (priceRange === '600k-1000k' && (s.price < 600000 || s.price > 1000000)) return false;
        if (priceRange === 'above-1000k' && s.price < 1000000) return false;

        // 4. Rating Filter
        if (minRating > 0 && s.rating < minRating) return false;

        // 5. Open Slots Today Filter
        if (onlyAvailableToday) {
          const hasSlots = Array.isArray(s.availableTodaySlots) && s.availableTodaySlots.length > 0;
          if (!hasSlots) return false;
        }

        // 6. Only Discounted Deals
        if (onlyDiscounted) {
          const isDisc = s.originalPrice && s.originalPrice > s.price;
          if (!isDisc) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        if (sortBy === 'rating-desc') return b.rating - a.rating;
        if (sortBy === 'duration-asc') return a.durationMinutes - b.durationMinutes;
        // Default: popular / rating & review count
        return (b.rating * (b.supplierReviewCount || 10)) - (a.rating * (a.supplierReviewCount || 10));
      });
  }, [allServices, searchQuery, selectedDistrict, priceRange, minRating, onlyAvailableToday, onlyDiscounted, sortBy]);

  // Total pages & Paginated slice
  const totalItems = filteredAndSortedServices.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedServices = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredAndSortedServices.slice(startIdx, startIdx + pageSize);
  }, [filteredAndSortedServices, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    catalogTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedDistrict !== 'all') count++;
    if (priceRange !== 'all') count++;
    if (minRating > 0) count++;
    if (onlyAvailableToday) count++;
    if (onlyDiscounted) count++;
    return count;
  }, [searchQuery, selectedDistrict, priceRange, minRating, onlyAvailableToday, onlyDiscounted]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedDistrict('all');
    setPriceRange('all');
    setMinRating(0);
    setOnlyAvailableToday(false);
    setOnlyDiscounted(false);
    setSortBy('popular');
    setCurrentPage(1);
  };

  const handleCategorySwitch = (cat: BackendCategory | { slug: string; name: string }) => {
    setActiveCategorySlug(cat.slug);
    if (onSelectCategory && 'id' in cat) {
      onSelectCategory(cat as BackendCategory);
    }
  };

  const handleOpenBooking = (service: BackendService, slot?: string, date?: string) => {
    setSelectedServiceForBooking(service);
    setPreselectedSlot(slot || null);
    setPreselectedDate(date || null);
    setPinnedScheduleServiceId(null);
    setHoveredScheduleServiceId(null);
  };

  const handleQuickAdd = (e: React.MouseEvent, service: BackendService) => {
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart(service);
    }
    setAddedServiceId(service.id);
    setTimeout(() => setAddedServiceId(null), 1500);
  };

  return (
    <div className="min-h-screen bg-[#FFF8F9] text-slate-900 pb-16">
      {/* 1. Breadcrumb Bar */}
      <section className="bg-white border-b border-pink-100 shadow-2xs">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <button
              onClick={onBack}
              className="hover:text-[#e1146c] transition-colors cursor-pointer"
            >
              Trang chủ
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-slate-400">Dịch vụ làm đẹp</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-[#e1146c] font-bold">{currentCategory.name}</span>
          </nav>
        </div>
      </section>

      {/* 2. Hero Editorial Banner */}
      <section className="relative overflow-hidden bg-gradient-to-b from-pink-50/80 via-rose-50/40 to-[#FFF8F9] py-7 sm:py-9 border-b border-pink-100/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#e1146c] bg-pink-100/80 px-2.5 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3 text-[#e1146c]" />
                  Danh mục dịch vụ tuyển chọn
                </span>
                <button
                  type="button"
                  onClick={onOpenLocationModal}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-[#e1146c] bg-white border border-pink-200/80 px-2.5 py-0.5 rounded-full transition cursor-pointer shadow-2xs"
                  title="Thay đổi thành phố"
                >
                  <MapPin className="w-3 h-3 text-[#e1146c]" />
                  <span>{locationLabel}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
                <span className="text-[11px] font-semibold text-slate-500 bg-white/70 px-2.5 py-0.5 rounded-full border border-pink-100">
                  {totalItems} dịch vụ sẵn sàng
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                {currentCategory.name}
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                {currentCategory.description || 'Đặt lịch hẹn giữ chỗ trực tuyến, giá ưu đãi độc quyền và cam kết chất lượng.'}
              </p>
            </div>

            {/* Quality Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
              <span className="inline-flex items-center gap-1.5 bg-white border border-pink-100 px-3 py-1.5 rounded-xl shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>100% Cơ sở xác minh</span>
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white border border-pink-100 px-3 py-1.5 rounded-xl shadow-2xs">
                <Calendar className="w-4 h-4 text-[#e1146c]" />
                <span>Giữ chỗ & Thanh toán tức thì</span>
              </span>
            </div>
          </div>

          {/* Category Tabs with Icons */}
          <div className="mt-6 pt-4 border-t border-pink-100 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => handleCategorySwitch({ slug: 'all', name: 'Tất cả dịch vụ' })}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeCategorySlug === 'all'
                  ? 'bg-[#e1146c] text-white shadow-sm shadow-pink-500/25'
                  : 'bg-white text-slate-700 border border-pink-200 hover:border-pink-300 hover:bg-pink-50'
              }`}
            >
              Tất cả dịch vụ
            </button>

            {categories.map((c) => {
              const isActive = activeCategorySlug === c.slug;
              return (
                <button
                  key={c.id}
                  onClick={() => handleCategorySwitch(c)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#e1146c] text-white shadow-sm shadow-pink-500/25'
                      : 'bg-white text-slate-700 border border-pink-200 hover:border-pink-300 hover:bg-pink-50'
                  }`}
                >
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. Sticky Filter & Sorting Toolbar */}
      <section ref={catalogTopRef} id="services-catalog-top" className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-pink-100 py-3 shadow-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-3">
          {/* Main Controls Row */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm dịch vụ, tên spa, kỹ thuật viên..."
                className="w-full pl-10 pr-9 py-2 bg-pink-50/50 hover:bg-pink-50 focus:bg-white border border-pink-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#e1146c] focus:ring-1 focus:ring-[#e1146c] transition-all"
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

            {/* Filter Dropdowns & Controls */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs">
              {/* Khu vực (District Filter) */}
              <div className="relative shrink-0">
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className={`pl-8 pr-7 py-2 rounded-xl border text-xs font-bold appearance-none cursor-pointer focus:outline-none focus:border-[#e1146c] transition-all shadow-2xs ${
                    selectedDistrict !== 'all'
                      ? 'bg-pink-50 border-[#e1146c] text-[#e1146c]'
                      : 'bg-white border-pink-200 text-slate-700 hover:bg-pink-50/50'
                  }`}
                >
                  <option value="all">📍 Khu vực: Tất cả</option>
                  {availableDistricts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#e1146c] pointer-events-none" />
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>

              {/* Mức giá (Price Filter) */}
              <div className="relative shrink-0">
                <select
                  value={priceRange}
                  onChange={(e) => setPriceRange(e.target.value as any)}
                  className={`pl-8 pr-7 py-2 rounded-xl border text-xs font-bold appearance-none cursor-pointer focus:outline-none focus:border-[#e1146c] transition-all shadow-2xs ${
                    priceRange !== 'all'
                      ? 'bg-pink-50 border-[#e1146c] text-[#e1146c]'
                      : 'bg-white border-pink-200 text-slate-700 hover:bg-pink-50/50'
                  }`}
                >
                  <option value="all">💵 Mức giá: Tất cả</option>
                  <option value="under-300k">Dưới 300.000đ</option>
                  <option value="300k-600k">300.000đ - 600.000đ</option>
                  <option value="600k-1000k">600.000đ - 1.000.000đ</option>
                  <option value="above-1000k">Trên 1.000.000đ</option>
                </select>
                <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#e1146c] pointer-events-none" />
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>

              {/* Đánh giá (Rating Filter) */}
              <div className="relative shrink-0">
                <select
                  value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                  className={`pl-8 pr-7 py-2 rounded-xl border text-xs font-bold appearance-none cursor-pointer focus:outline-none focus:border-[#e1146c] transition-all shadow-2xs ${
                    minRating > 0
                      ? 'bg-pink-50 border-[#e1146c] text-[#e1146c]'
                      : 'bg-white border-pink-200 text-slate-700 hover:bg-pink-50/50'
                  }`}
                >
                  <option value={0}>⭐ Đánh giá: Tất cả</option>
                  <option value={4.8}>Từ 4.8★ trở lên</option>
                  <option value={4.5}>Từ 4.5★ trở lên</option>
                  <option value={4.0}>Từ 4.0★ trở lên</option>
                </select>
                <Star className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-400 fill-amber-400 pointer-events-none" />
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>

              {/* Đang trống slot (Available Today Filter) */}
              <button
                type="button"
                onClick={() => setOnlyAvailableToday(!onlyAvailableToday)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                  onlyAvailableToday
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/25'
                    : 'bg-white text-slate-700 border-pink-200 hover:bg-pink-50 hover:border-pink-300'
                }`}
              >
                <Zap className={`w-3.5 h-3.5 ${onlyAvailableToday ? 'text-amber-300 fill-amber-300' : 'text-emerald-600'}`} />
                <span>Trống slot hôm nay</span>
              </button>

              {/* Sắp xếp (Sort Selector) */}
              <div className="relative shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="pl-8 pr-7 py-2 rounded-xl border border-pink-200 bg-white text-slate-700 text-xs font-bold appearance-none cursor-pointer focus:outline-none focus:border-[#e1146c] hover:bg-pink-50/50 transition-all shadow-2xs"
                >
                  <option value="popular">Phổ biến nhất</option>
                  <option value="price-asc">Giá: Thấp đến cao</option>
                  <option value="price-desc">Giá: Cao đến thấp</option>
                  <option value="rating-desc">Đánh giá cao nhất</option>
                  <option value="duration-asc">Thời lượng ngắn nhất</option>
                </select>
                <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#e1146c] pointer-events-none" />
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>

              {/* View Mode Toggle: Grid vs List */}
              <div className="flex items-center rounded-xl border border-pink-200 bg-white p-0.5 shrink-0 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'grid' ? 'bg-[#e1146c] text-white shadow-xs' : 'text-slate-400 hover:text-slate-700'
                  }`}
                  title="Chế độ lưới"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'list' ? 'bg-[#e1146c] text-white shadow-xs' : 'text-slate-400 hover:text-slate-700'
                  }`}
                  title="Chế độ danh sách chi tiết"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Active Filter summary and clear button */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-pink-50 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-500">
                  Đang lọc: <strong className="text-slate-800">{totalItems}</strong> kết quả
                </span>
                {selectedDistrict !== 'all' && (
                  <span className="inline-flex items-center gap-1 bg-pink-100/80 text-[#be185d] font-bold px-2.5 py-0.5 rounded-full text-[11px]">
                    Khu vực: {selectedDistrict}
                    <button onClick={() => setSelectedDistrict('all')} className="hover:text-red-500 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {priceRange !== 'all' && (
                  <span className="inline-flex items-center gap-1 bg-pink-100/80 text-[#be185d] font-bold px-2.5 py-0.5 rounded-full text-[11px]">
                    Giá: {priceRange === 'under-300k' ? '<300k' : priceRange === '300k-600k' ? '300k-600k' : priceRange === '600k-1000k' ? '600k-1tr' : '>1tr'}
                    <button onClick={() => setPriceRange('all')} className="hover:text-red-500 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {minRating > 0 && (
                  <span className="inline-flex items-center gap-1 bg-pink-100/80 text-[#be185d] font-bold px-2.5 py-0.5 rounded-full text-[11px]">
                    Đánh giá: &gt;={minRating}★
                    <button onClick={() => setMinRating(0)} className="hover:text-red-500 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {onlyAvailableToday && (
                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full text-[11px]">
                    Trống slot hôm nay
                    <button onClick={() => setOnlyAvailableToday(false)} className="hover:text-red-500 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#e1146c] hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Đặt lại tất cả ({activeFiltersCount})</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 4. Main Service Cards Grid or List */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Loading State */}
        {loading && (
          <div className="grid h-64 place-items-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#e1146c]" />
              <p className="text-xs font-semibold text-slate-500">Đang tải danh sách dịch vụ sắc đẹp...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-6 text-sm font-semibold text-rose-700 text-center">
            <p>{error}</p>
            <button
              onClick={() => {
                setLoading(true);
                beautyApi.services(activeCategorySlug, locationId || undefined)
                  .then(setAllServices)
                  .catch(() => {})
                  .finally(() => setLoading(false));
              }}
              className="mt-3 px-4 py-1.5 rounded-full bg-[#e1146c] text-white text-xs font-bold cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && totalItems === 0 && (
          <div className="rounded-3xl border border-pink-100 bg-white p-12 text-center shadow-xs max-w-lg mx-auto my-6">
            <div className="w-14 h-14 rounded-full bg-pink-50 flex items-center justify-center mx-auto mb-4 text-[#e1146c]">
              <SlidersHorizontal className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Không tìm thấy dịch vụ nào phù hợp
            </h3>
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
              Hãy thử nới lỏng bộ lọc giá, chọn khu vực khác hoặc tìm kiếm với từ khóa ngắn gọn hơn.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-5 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs font-bold shadow-md hover:opacity-95 transition cursor-pointer"
            >
              Xóa bộ lọc & Xem tất cả
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: GRID MODE */}
        {/* ========================================================================= */}
        {!loading && !error && totalItems > 0 && viewMode === 'grid' && (
          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
            {paginatedServices.map((item) => {
              const discountPercent =
                item.originalPrice && item.originalPrice > item.price
                  ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
                  : 0;
              const savingsAmount =
                item.originalPrice && item.originalPrice > item.price
                  ? item.originalPrice - item.price
                  : 0;
              const isPopoverOpen =
                hoveredScheduleServiceId === item.id || pinnedScheduleServiceId === item.id;
              const slotsForPopover = getServiceSlotsForDate(item, activePopoverDate);

              return (
                <article
                  key={item.id}
                  onMouseLeave={() => {
                    if (pinnedScheduleServiceId !== item.id) {
                      setHoveredScheduleServiceId(null);
                    }
                  }}
                  className={`group relative flex flex-col justify-between bg-white rounded-2xl border transition-all duration-200 ${
                    isPopoverOpen
                      ? 'z-30 border-pink-400 shadow-xl shadow-pink-500/15 ring-2 ring-pink-300/40'
                      : 'z-10 border-pink-100 hover:border-pink-300 shadow-2xs hover:shadow-lg hover:shadow-pink-500/8'
                  }`}
                >
                  {/* Top Thumbnail Image & Overlay Badges */}
                  <div>
                    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-2xl bg-pink-50">
                      <OptimizedImage
                        src={item.imageUrl}
                        alt={item.name}
                        preset="service-card"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        containerClassName="w-full h-full"
                      />

                      {/* Top Left Badges: Rating & Discount */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1 z-10">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-xs px-2 py-0.5 text-[11px] font-bold text-slate-800 shadow-xs">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span>{item.rating.toFixed(1)}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({item.supplierReviewCount || 10})
                          </span>
                        </span>

                        {discountPercent > 0 && (
                          <span className="rounded-full bg-gradient-to-r from-rose-500 to-[#e1146c] px-2 py-0.5 text-[10px] font-black text-white shadow-xs">
                            -{discountPercent}%
                          </span>
                        )}
                      </div>

                      {/* Top Right: Quick Preview Icon */}
                      <button
                        type="button"
                        onClick={() => setPreviewService(item)}
                        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/90 backdrop-blur-xs text-slate-700 hover:text-[#e1146c] hover:bg-white flex items-center justify-center transition shadow-xs z-10 cursor-pointer"
                        title="Xem chi tiết dịch vụ"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Bottom Duration Pill */}
                      <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 z-10">
                        <span className="rounded-full bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-pink-300" />
                          <span>{item.durationMinutes} phút</span>
                        </span>
                      </div>
                    </div>

                    {/* Card Content Details (Compact & Clean) */}
                    <div className="p-3.5 sm:p-4">
                      {/* Supplier & Location */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1 gap-1">
                        <div className="flex items-center gap-1 font-bold text-[#be185d] truncate min-w-0">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="truncate">{item.supplierName}</span>
                        </div>
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 shrink-0">
                          <MapPin className="w-2.5 h-2.5 text-[#e1146c] shrink-0" />
                          <span className="truncate max-w-[80px]">
                            {item.district || 'Trung tâm'}
                          </span>
                        </span>
                      </div>

                      {/* Service Title */}
                      <h3
                        onClick={() => setPreviewService(item)}
                        className="text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-[#e1146c] transition-colors cursor-pointer min-h-[2.4rem]"
                        title={item.name}
                      >
                        {item.name}
                      </h3>

                      {/* Description excerpt */}
                      <p className="mt-1 text-[11px] text-slate-500 line-clamp-1 leading-relaxed">
                        {item.description}
                      </p>

                      {/* Xem chi tiết ảnh các bước & Đánh giá của dịch vụ đó */}
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewTab('steps');
                            setPreviewService(item);
                          }}
                          className="py-1 px-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200/80 text-[10px] font-bold text-purple-700 flex items-center justify-center gap-1 transition cursor-pointer"
                          title="Xem chi tiết ảnh từng bước thực hiện liệu trình"
                        >
                          <Camera className="w-3 h-3 text-purple-600" />
                          <span className="truncate">Ảnh các bước</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewTab('reviews');
                            setPreviewService(item);
                          }}
                          className="py-1 px-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200/80 text-[10px] font-bold text-amber-800 flex items-center justify-center gap-1 transition cursor-pointer"
                          title="Xem nhận xét & đánh giá từ khách hàng"
                        >
                          <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                          <span className="truncate">Đánh giá ({item.supplierReviewCount || 10})</span>
                        </button>
                      </div>

                      {/* Schedule & Available Slots Trigger Bar (Hover or Click to float up) */}
                      <div
                        onMouseEnter={() => setHoveredScheduleServiceId(item.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPinnedScheduleServiceId((prev) => (prev === item.id ? null : item.id));
                        }}
                        className="mt-2 py-1.5 px-2 rounded-xl bg-pink-50/80 hover:bg-pink-100/70 border border-pink-200/70 hover:border-[#e1146c]/50 flex items-center justify-between text-[11px] cursor-pointer transition-all group/bar"
                        title="Rê chuột hoặc bấm để xem lịch & khung giờ trống"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Calendar className="w-3.5 h-3.5 text-[#e1146c] shrink-0" />
                          <span className="font-bold text-[#be185d] truncate">
                            {item.availableTodaySlots && item.availableTodaySlots.length > 0
                              ? `${item.availableTodaySlots.length} slot trống hôm nay`
                              : 'Xem lịch & slot trống'}
                          </span>
                        </div>
                        <span className="text-[10px] font-extrabold text-[#e1146c] shrink-0 flex items-center gap-0.5 group-hover/bar:translate-x-0.5 transition-transform">
                          <span>Xem giờ</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* FLOATING SCHEDULE POPOVER (Nổi lên khi di chuột hoặc dí vào) */}
                  {isPopoverOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-[66px] left-1 right-1 sm:-left-2 sm:-right-2 z-40 bg-white/98 backdrop-blur-md rounded-2xl border border-pink-200 shadow-2xl shadow-pink-900/25 p-3.5 animate-in fade-in zoom-in-95 duration-150"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-pink-100 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Sparkles className="w-3.5 h-3.5 text-[#e1146c] shrink-0" />
                          <span className="text-xs font-black text-slate-900 truncate">
                            Lịch hẹn & Slot trống
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPinnedScheduleServiceId(null);
                            setHoveredScheduleServiceId(null);
                          }}
                          className="w-5 h-5 rounded-full bg-pink-100 hover:bg-pink-200 text-slate-600 flex items-center justify-center text-xs transition cursor-pointer shrink-0"
                          title="Đóng lịch"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Quick links to Steps & Reviews right inside popover */}
                      <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-pink-100/80">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewTab('steps');
                            setPreviewService(item);
                          }}
                          className="flex-1 py-1 px-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer border border-purple-200/60"
                        >
                          <Camera className="w-3 h-3 text-purple-600" />
                          <span>Xem ảnh các bước</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewTab('reviews');
                            setPreviewService(item);
                          }}
                          className="flex-1 py-1 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer border border-amber-200/60"
                        >
                          <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                          <span>Xem đánh giá</span>
                        </button>
                      </div>

                      {/* Quick Day Selector Tabs */}
                      <div className="flex gap-1 mb-2">
                        {[
                          { label: 'Hôm nay', val: todayStr },
                          { label: 'Ngày mai', val: tomorrowStr },
                          { label: 'Ngày kia', val: dayAfterStr },
                        ].map((tab) => (
                          <button
                            key={tab.label}
                            type="button"
                            onClick={() => {
                              setActivePopoverDate(tab.val);
                              setActivePopoverSlot(null);
                            }}
                            className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                              activePopoverDate === tab.val
                                ? 'bg-[#e1146c] text-white border-[#e1146c] shadow-xs'
                                : 'bg-pink-50/50 text-slate-600 border-pink-100 hover:bg-pink-100'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Available Time Slots Chips */}
                      <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto pr-0.5">
                        {slotsForPopover.map((slot) => {
                          const isSelected = activePopoverSlot === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setActivePopoverSlot(slot)}
                              className={`py-1 rounded-lg text-[10px] font-bold border transition text-center cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-pink-50/40 text-slate-700 border-pink-200 hover:border-[#e1146c] hover:bg-pink-100/50'
                              }`}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>

                      {/* Popover Action: Đặt lịch với slot đã chọn */}
                      <div className="mt-2.5 pt-2 border-t border-pink-100 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-500 font-semibold truncate">
                          {activePopoverSlot ? `Giờ: ${activePopoverSlot}` : 'Chọn một khung giờ'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const slotToUse = activePopoverSlot || slotsForPopover[0] || '10:00';
                            setPinnedScheduleServiceId(null);
                            setHoveredScheduleServiceId(null);
                            handleOpenBooking(item, slotToUse, activePopoverDate);
                          }}
                          className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-[11px] font-black shadow-xs hover:opacity-95 transition cursor-pointer flex items-center gap-1 shrink-0"
                        >
                          <Calendar className="w-3 h-3" />
                          <span>Đặt lịch ngay</span>
                        </button>
                      </div>

                      {/* Popover Arrow */}
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-pink-200 rotate-45" />
                    </div>
                  )}

                  {/* Card Bottom: Price, Savings & Đặt Lịch Action */}
                  <div className="p-3.5 sm:p-4 pt-2 border-t border-pink-50 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-base sm:text-lg font-black text-[#e1146c] leading-none">
                        {formatCurrency(item.price)}
                      </div>
                      {savingsAmount > 0 && (
                        <span className="text-[10px] text-slate-400 line-through block mt-0.5">
                          {formatCurrency(item.originalPrice || 0)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Quick Add To Cart Icon */}
                      <button
                        type="button"
                        onClick={(e) => handleQuickAdd(e, item)}
                        className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          addedServiceId === item.id
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-white text-slate-700 border-pink-200 hover:border-[#e1146c] hover:bg-pink-50'
                        }`}
                        title="Thêm vào giỏ dịch vụ"
                      >
                        {addedServiceId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <Tag className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </button>

                      {/* Primary Đặt Lịch Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenBooking(item)}
                        className="py-2 px-3 sm:px-3.5 rounded-xl bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs font-bold shadow-xs hover:opacity-95 active:scale-98 transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Đặt lịch</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: LIST MODE */}
        {/* ========================================================================= */}
        {!loading && !error && totalItems > 0 && viewMode === 'list' && (
          <div className="space-y-3.5">
            {paginatedServices.map((item) => {
              const discountPercent =
                item.originalPrice && item.originalPrice > item.price
                  ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
                  : 0;
              const savingsAmount =
                item.originalPrice && item.originalPrice > item.price
                  ? item.originalPrice - item.price
                  : 0;
              const isPopoverOpen =
                hoveredScheduleServiceId === item.id || pinnedScheduleServiceId === item.id;
              const slotsForPopover = getServiceSlotsForDate(item, activePopoverDate);

              return (
                <article
                  key={item.id}
                  onMouseLeave={() => {
                    if (pinnedScheduleServiceId !== item.id) {
                      setHoveredScheduleServiceId(null);
                    }
                  }}
                  className={`relative bg-white rounded-2xl border transition-all duration-200 p-3.5 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 ${
                    isPopoverOpen
                      ? 'z-30 border-pink-400 shadow-xl shadow-pink-500/15 ring-2 ring-pink-300/40'
                      : 'z-10 border-pink-100 hover:border-pink-300 shadow-2xs hover:shadow-md'
                  }`}
                >
                  {/* Left: Thumbnail & Info */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="relative w-24 sm:w-28 aspect-video sm:aspect-square rounded-xl overflow-hidden shrink-0 bg-pink-50 border border-pink-100">
                      <OptimizedImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      {discountPercent > 0 && (
                        <span className="absolute top-1.5 left-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-black text-white shadow-xs">
                          -{discountPercent}%
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-xs font-bold text-[#be185d] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>{item.supplierName}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5 text-[#e1146c]" />
                          <span>{item.district || 'Trung tâm'}</span>
                        </span>
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                          <span>{item.rating.toFixed(1)}</span>
                        </span>
                      </div>

                      <h3
                        onClick={() => setPreviewService(item)}
                        className="text-xs sm:text-sm font-bold text-slate-900 hover:text-[#e1146c] transition cursor-pointer truncate"
                      >
                        {item.name}
                      </h3>

                      <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-pink-400" />
                          <span>{item.durationMinutes} phút</span>
                        </span>

                        {/* Interactive schedule trigger button */}
                        <button
                          type="button"
                          onMouseEnter={() => setHoveredScheduleServiceId(item.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPinnedScheduleServiceId((prev) => (prev === item.id ? null : item.id));
                          }}
                          className="flex items-center gap-1 text-[#be185d] font-bold hover:text-[#e1146c] bg-pink-50 px-2 py-0.5 rounded-lg border border-pink-200 transition cursor-pointer"
                        >
                          <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                          <span>
                            {item.availableTodaySlots && item.availableTodaySlots.length > 0
                              ? `${item.availableTodaySlots.length} slot trống hôm nay`
                              : 'Xem lịch & slot'}
                          </span>
                        </button>
                      </div>

                      {/* Xem chi tiết ảnh các bước & Đánh giá */}
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewTab('steps');
                            setPreviewService(item);
                          }}
                          className="py-1 px-2 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-[10px] font-bold text-purple-700 flex items-center gap-1 transition cursor-pointer"
                          title="Xem chi tiết ảnh từng bước thực hiện"
                        >
                          <Camera className="w-3 h-3 text-purple-600" />
                          <span>Ảnh các bước</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewTab('reviews');
                            setPreviewService(item);
                          }}
                          className="py-1 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-[10px] font-bold text-amber-800 flex items-center gap-1 transition cursor-pointer"
                          title="Xem đánh giá từ khách hàng"
                        >
                          <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                          <span>Xem đánh giá ({item.supplierReviewCount || 10})</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* FLOATING SCHEDULE POPOVER FOR LIST VIEW */}
                  {isPopoverOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-full mt-2 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-40 bg-white/98 backdrop-blur-md rounded-2xl border border-pink-200 shadow-2xl shadow-pink-900/25 p-3.5 animate-in fade-in zoom-in-95 duration-150"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-pink-100 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Sparkles className="w-3.5 h-3.5 text-[#e1146c] shrink-0" />
                          <span className="text-xs font-black text-slate-900 truncate">
                            Lịch hẹn & Slot trống
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPinnedScheduleServiceId(null);
                            setHoveredScheduleServiceId(null);
                          }}
                          className="w-5 h-5 rounded-full bg-pink-100 hover:bg-pink-200 text-slate-600 flex items-center justify-center text-xs transition cursor-pointer shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Day tabs */}
                      <div className="flex gap-1 mb-2">
                        {[
                          { label: 'Hôm nay', val: todayStr },
                          { label: 'Ngày mai', val: tomorrowStr },
                          { label: 'Ngày kia', val: dayAfterStr },
                        ].map((tab) => (
                          <button
                            key={tab.label}
                            type="button"
                            onClick={() => {
                              setActivePopoverDate(tab.val);
                              setActivePopoverSlot(null);
                            }}
                            className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                              activePopoverDate === tab.val
                                ? 'bg-[#e1146c] text-white border-[#e1146c]'
                                : 'bg-pink-50/50 text-slate-600 border-pink-100 hover:bg-pink-100'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Slots grid */}
                      <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto pr-0.5">
                        {slotsForPopover.map((slot) => {
                          const isSelected = activePopoverSlot === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setActivePopoverSlot(slot)}
                              className={`py-1 rounded-lg text-[10px] font-bold border transition text-center cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-pink-50/40 text-slate-700 border-pink-200 hover:border-[#e1146c] hover:bg-pink-100/50'
                              }`}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>

                      {/* Action */}
                      <div className="mt-2.5 pt-2 border-t border-pink-100 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-500 font-semibold truncate">
                          {activePopoverSlot ? `Giờ: ${activePopoverSlot}` : 'Chọn khung giờ'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const slotToUse = activePopoverSlot || slotsForPopover[0] || '10:00';
                            setPinnedScheduleServiceId(null);
                            setHoveredScheduleServiceId(null);
                            handleOpenBooking(item, slotToUse, activePopoverDate);
                          }}
                          className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-[11px] font-black shadow-xs hover:opacity-95 transition cursor-pointer flex items-center gap-1 shrink-0"
                        >
                          <Calendar className="w-3 h-3" />
                          <span>Đặt lịch</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Right: Price & Đặt Lịch (NO direct payment button) */}
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-2.5 pt-2.5 md:pt-0 border-t md:border-t-0 border-pink-50 shrink-0">
                    <div className="text-left md:text-right">
                      <div className="text-base sm:text-lg font-black text-[#e1146c]">
                        {formatCurrency(item.price)}
                      </div>
                      {savingsAmount > 0 && (
                        <div className="text-[10px] text-slate-400 line-through">
                          {formatCurrency(item.originalPrice || 0)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => handleQuickAdd(e, item)}
                        className={`p-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          addedServiceId === item.id
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-white text-slate-700 border-pink-200 hover:bg-pink-50'
                        }`}
                        title="Thêm vào giỏ"
                      >
                        {addedServiceId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <Tag className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenBooking(item)}
                        className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs font-bold shadow-xs hover:opacity-95 transition cursor-pointer flex items-center gap-1"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Đặt lịch</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. PAGINATION CONTROLS (Phân trang đầy đủ) */}
        {/* ========================================================================= */}
        {!loading && !error && totalItems > 0 && (
          <div className="mt-10 pt-6 border-t border-pink-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left: Summary text & page size selector */}
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>
                Hiển thị{' '}
                <strong className="text-slate-900 font-bold">
                  {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalItems)}
                </strong>{' '}
                trên <strong className="text-slate-900 font-bold">{totalItems}</strong> dịch vụ
              </span>

              <span className="text-slate-300">|</span>

              <div className="flex items-center gap-1.5">
                <span>Số lượng mỗi trang:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 rounded-lg border border-pink-200 bg-white font-bold text-slate-800 text-xs focus:outline-none focus:border-[#e1146c]"
                >
                  <option value={6}>6</option>
                  <option value={9}>9</option>
                  <option value={12}>12</option>
                  <option value={18}>18</option>
                </select>
              </div>
            </div>

            {/* Right: Page numbers & Prev/Next buttons */}
            <div className="flex items-center gap-1.5">
              {/* Prev Button */}
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-xl border border-pink-200 bg-white text-slate-600 hover:bg-pink-50 hover:text-[#e1146c] disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                title="Trang trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page Number Buttons */}
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNumber = idx + 1;
                // Show first, last, and pages close to currentPage
                if (
                  totalPages > 7 &&
                  pageNumber !== 1 &&
                  pageNumber !== totalPages &&
                  Math.abs(pageNumber - currentPage) > 2
                ) {
                  if (pageNumber === 2 || pageNumber === totalPages - 1) {
                    return (
                      <span key={pageNumber} className="px-1 text-slate-400 text-xs">
                        ...
                      </span>
                    );
                  }
                  return null;
                }

                const isActive = currentPage === pageNumber;
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => handlePageChange(pageNumber)}
                    className={`w-9 h-9 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white shadow-xs'
                        : 'bg-white border border-pink-200 text-slate-700 hover:bg-pink-50 hover:border-pink-300'
                    }`}
                  >
                    {pageNumber}
                  </button>
                );
              })}

              {/* Next Button */}
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl border border-pink-200 bg-white text-slate-600 hover:bg-pink-50 hover:text-[#e1146c] disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                title="Trang tiếp theo"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 6. SERVICE DETAIL QUICK VIEW MODAL (Quy trình các bước có ảnh & Đánh giá) */}
      {/* ========================================================================= */}
      {previewService && (() => {
        const procedureSteps = reviewService.getProcedureSteps(previewService.categorySlug, previewService.name);
        const serviceReviews = reviewService.getReviewsForService(previewService.name, previewService.id);

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setPreviewService(null)}
          >
            <div
              className="relative w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-pink-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header image banner */}
              <div className="relative aspect-video sm:aspect-[21/9] w-full bg-pink-50 shrink-0">
                <OptimizedImage
                  src={previewService.imageUrl}
                  alt={previewService.name}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPreviewService(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white hover:bg-black/80 flex items-center justify-center transition cursor-pointer z-10"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="absolute bottom-3 left-3 flex items-center gap-2 z-10">
                  <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-slate-800 shadow">
                    ⭐ {previewService.rating.toFixed(1)} ({serviceReviews.length} đánh giá)
                  </span>
                  <span className="rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs font-bold text-white flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-pink-300" />
                    <span>{previewService.durationMinutes} phút</span>
                  </span>
                </div>
              </div>

              {/* 3 Tabs: Tổng quan, Quy trình các bước thực hiện (Ảnh), Đánh giá của khách */}
              <div className="flex border-b border-pink-100 bg-pink-50/40 px-4 sm:px-6 pt-2.5 gap-2 text-xs font-bold shrink-0 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setPreviewTab('overview')}
                  className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    previewTab === 'overview'
                      ? 'border-[#e1146c] text-[#be185d]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Tổng quan liệu trình</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab('steps')}
                  className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    previewTab === 'steps'
                      ? 'border-[#e1146c] text-[#be185d]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5 text-purple-600" />
                  <span>Ảnh các bước thực hiện ({procedureSteps.length} bước)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab('reviews')}
                  className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    previewTab === 'reviews'
                      ? 'border-[#e1146c] text-[#be185d]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                  <span>Đánh giá khách hàng ({serviceReviews.length})</span>
                </button>
              </div>

              {/* Scrollable details container */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
                {/* General Service Heading Info */}
                <div>
                  <span className="text-xs font-bold text-[#be185d] flex items-center gap-1 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{previewService.supplierName}</span>
                  </span>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                    {previewService.name}
                  </h2>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-[#e1146c]" />
                    <span>{previewService.supplierAddress}</span>
                  </p>
                </div>

                {/* TAB 1: OVERVIEW */}
                {previewTab === 'overview' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    {/* Price Row */}
                    <div className="p-4 rounded-2xl bg-pink-50/70 border border-pink-100 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-slate-500 block">Giá dịch vụ niêm yết</span>
                        <div className="text-xl font-black text-[#e1146c]">
                          {formatCurrency(previewService.price)}
                        </div>
                      </div>
                      {previewService.originalPrice && previewService.originalPrice > previewService.price && (
                        <div className="text-right">
                          <span className="text-xs text-slate-400 line-through">
                            {formatCurrency(previewService.originalPrice)}
                          </span>
                          <span className="block text-xs font-bold text-emerald-600">
                            Tiết kiệm {formatCurrency(previewService.originalPrice - previewService.price)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Full Description */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                        Mô tả chi tiết liệu trình
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {previewService.description ||
                          'Liệu trình được thực hiện bởi các chuyên viên được đào tạo chuyên sâu, sử dụng dòng mỹ phẩm cao cấp an toàn và trang thiết bị hiện đại đã qua kiểm định y tế nghiêm ngặt.'}
                      </p>
                    </div>

                    {/* Highlights & Guarantees */}
                    <div className="pt-2 border-t border-pink-50 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Cam kết vệ sinh y tế, dụng cụ tiệt trùng Autoclave dùng riêng từng khách</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-[#e1146c] shrink-0" />
                        <span>Kỹ thuật viên có chứng chỉ hành nghề chính thức</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Đổi dời lịch miễn phí trước 2 tiếng</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: STEP-BY-STEP PROCEDURE WITH DETAILED PHOTOS */}
                {previewTab === 'steps' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-2xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-purple-900 font-bold">
                        <Camera className="w-4 h-4 text-purple-600 shrink-0" />
                        <span>Quy trình tiêu chuẩn {procedureSteps.length} bước y khoa</span>
                      </div>
                      <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                        Tổng thời gian: {previewService.durationMinutes} phút
                      </span>
                    </div>

                    <div className="space-y-4">
                      {procedureSteps.map((step) => (
                        <div
                          key={step.stepNumber}
                          className="p-4 rounded-2xl border border-pink-100 bg-white hover:border-pink-300 shadow-2xs transition space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-[11px] font-black uppercase">
                              Bước {step.stepNumber}
                            </span>
                            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-pink-400" />
                              <span>{step.durationMinutes} phút</span>
                            </span>
                          </div>

                          <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                            {step.title}
                          </h4>

                          {/* Step photo */}
                          <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden border border-pink-100 bg-pink-50">
                            <img
                              src={step.imageUrl}
                              alt={step.title}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed">
                            {step.description}
                          </p>

                          {step.keyProducts && (
                            <div className="pt-2 border-t border-pink-50 text-[11px] text-pink-800 bg-pink-50/50 p-2 rounded-xl flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3 text-[#e1146c] shrink-0" />
                              <span><strong>Sản phẩm / Thiết bị:</strong> {step.keyProducts}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: CUSTOMER REVIEWS */}
                {previewTab === 'reviews' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    {/* Rating Overview Card */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-pink-50 border border-amber-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3 text-center sm:text-left">
                        <div className="w-14 h-14 rounded-2xl bg-amber-400 text-white flex flex-col items-center justify-center font-black shadow-sm">
                          <span className="text-xl leading-none">{previewService.rating.toFixed(1)}</span>
                          <span className="text-[10px] leading-tight">★/5</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-amber-500 mb-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />
                            ))}
                          </div>
                          <span className="text-xs font-bold text-slate-800 block">
                            Đánh giá thực tế từ khách hàng
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {serviceReviews.length} lượt nhận xét có xác thực đặt lịch
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsReviewModalOpen(true)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs font-bold shadow-xs hover:opacity-95 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-200 text-amber-200" />
                        <span>Viết đánh giá dịch vụ</span>
                      </button>
                    </div>

                    {/* List of customer reviews */}
                    <div className="space-y-3">
                      {serviceReviews.map((rev) => (
                        <div
                          key={rev.id}
                          className="p-4 rounded-2xl border border-pink-100 bg-white hover:border-pink-200 shadow-2xs space-y-2.5 transition"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={
                                  rev.authorAvatar ||
                                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
                                }
                                alt={rev.authorName}
                                className="w-9 h-9 rounded-xl object-cover border border-pink-200"
                              />
                              <div>
                                <span className="text-xs font-black text-slate-900 block leading-tight">
                                  {rev.authorName}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded font-bold flex items-center gap-0.5">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    <span>Đã trải nghiệm</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400">· {rev.date}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((st) => (
                                <Star
                                  key={st}
                                  className={`w-3.5 h-3.5 ${
                                    st <= rev.rating
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-slate-200'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Content */}
                          <p className="text-xs text-slate-700 leading-relaxed">
                            {rev.content}
                          </p>

                          {/* Tags */}
                          {rev.tags && rev.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {rev.tags.map((t, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] px-2 py-0.5 rounded-md bg-pink-50 text-[#be185d] font-bold"
                                >
                                  ✓ {t}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Photos if any */}
                          {rev.images && rev.images.length > 0 && (
                            <div className="flex gap-2 pt-1">
                              {rev.images.map((img, i) => (
                                <img
                                  key={i}
                                  src={img}
                                  alt="Review feedback"
                                  className="w-16 h-16 rounded-xl object-cover border border-pink-200 shadow-2xs"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="p-4 sm:p-5 border-t border-pink-100 bg-pink-50/30 flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    handleQuickAdd(e, previewService);
                    setPreviewService(null);
                  }}
                  className="py-3 px-4 rounded-xl border border-pink-200 bg-white hover:bg-pink-50 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  + Thêm vào giỏ
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const svc = previewService;
                    setPreviewService(null);
                    handleOpenBooking(svc);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs sm:text-sm font-bold shadow-md hover:opacity-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Đặt lịch hẹn</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Review Modal for Service */}
      {isReviewModalOpen && previewService && (
        <ServiceReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          serviceTitle={previewService.name}
          salonName={previewService.supplierName}
          customerName={currentUser?.name || 'Khách hàng BeautyLink'}
          customerAvatar={currentUser?.avatar}
          onSuccess={() => {
            setReviewsUpdateTrigger((c) => c + 1);
          }}
        />
      )}

      {/* 7. Booking Modal when user clicks "Đặt lịch" or time slot */}
      {selectedServiceForBooking && (
        <BookingModal
          service={selectedServiceForBooking}
          currentUser={currentUser}
          initialDate={preselectedDate || undefined}
          initialSlot={preselectedSlot || undefined}
          onClose={() => {
            setSelectedServiceForBooking(null);
            setPreselectedSlot(null);
            setPreselectedDate(null);
          }}
          onNeedLogin={onNeedLogin}
          onCreated={(code) => {
            onBookingCreated(`Đặt lịch thành công · Mã hẹn ${code}. Bạn có thể chia sẻ lịch hẹn ngay bên dưới.`);
          }}
          onProceedToCheckout={(svc, date, slot) => {
            setSelectedServiceForBooking(null);
            setPreselectedSlot(null);
            setPreselectedDate(null);
            if (onDirectCheckout) {
              onDirectCheckout(svc, date, slot);
            }
          }}
          onViewMyBookings={() => {
            setSelectedServiceForBooking(null);
            setPreselectedSlot(null);
            setPreselectedDate(null);
            window.location.hash = '#bookings';
          }}
        />
      )}
    </div>
  );
};
