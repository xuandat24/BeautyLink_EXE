import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Search,
  Star,
  Store,
} from 'lucide-react';
import type { BackendCategory, BackendService, CurrentUser, NewPartner } from '../types';
import { beautyApi, DEFAULT_CATEGORIES, getApiErrorMessage } from '../services/beautyApi';
import { OptimizedImage } from './OptimizedImage';

interface CategoryServicePageProps {
  category: BackendCategory;
  categories?: BackendCategory[];
  onSelectCategory?: (category: BackendCategory) => void;
  onSelectPartner?: (partner: NewPartner) => void;
  locationId: number | null;
  locationLabel: string;
  onBack: () => void;
  onOpenLocationModal?: () => void;
  currentUser?: CurrentUser | null;
  onNeedLogin?: () => void;
  onBookingCreated?: (message: string) => void;
  onAddToCart?: (service: BackendService) => void;
  onDirectCheckout?: (
    service: BackendService,
    preselectedDate?: string,
    preselectedTime?: string
  ) => void;
}

interface PartnerSummary {
  supplierId: number;
  name: string;
  businessType: string;
  address: string;
  district: string;
  image: string;
  rating: number;
  reviewCount: number;
  services: BackendService[];
  representative: BackendService;
  minPrice: number;
  maxPrice: number;
}

const FEATURED_CATEGORY_SLUGS = ['makeup', 'hair', 'spa', 'nails', 'skincare'] as const;
const FEATURED_CATEGORY_NAMES: Record<(typeof FEATURED_CATEGORY_SLUGS)[number], string> = {
  makeup: 'Trang điểm',
  hair: 'Làm tóc',
  spa: 'Spa & Massage',
  nails: 'Nail',
  skincare: 'Chăm sóc da',
};
const PAGE_SIZE = 9;

const formatCurrency = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)}đ`;

const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

export const CategoryServicePage: React.FC<CategoryServicePageProps> = ({
  category,
  categories = DEFAULT_CATEGORIES,
  onSelectCategory,
  onSelectPartner,
  locationId,
  locationLabel,
  onBack,
  onOpenLocationModal,
}) => {
  const [activeCategorySlug, setActiveCategorySlug] = useState(category.slug);
  const [allServices, setAllServices] = useState<BackendService[]>(() => beautyApi.cachedServices(category.slug, locationId || undefined) ?? []);
  const [loading, setLoading] = useState(() => beautyApi.cachedServices(category.slug, locationId || undefined) === null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'price' | 'services'>('popular');
  const [currentPage, setCurrentPage] = useState(1);
  const catalogTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveCategorySlug(category.slug);
    setCurrentPage(1);
  }, [category.slug]);

  useEffect(() => {
    let active = true;
    const cached = beautyApi.cachedServices(activeCategorySlug, locationId || undefined);
    setAllServices(cached ?? []); setLoading(cached === null);
    setError('');

    beautyApi
      .services(activeCategorySlug, locationId || undefined)
      .then((items) => {
        if (!active) return;
        setAllServices(items);
        setCurrentPage(1);
      })
      .catch((requestError) => {
        if (!active) return;
        if (!cached) setAllServices([]);
        setError(getApiErrorMessage(requestError, 'Không thể tải danh sách đối tác.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeCategorySlug, locationId]);

  const supportedCategories = useMemo(() => {
    const available = categories.length > 0 ? categories : DEFAULT_CATEGORIES;
    return FEATURED_CATEGORY_SLUGS.map((slug) => {
      const item =
        available.find((candidate) => candidate.slug === slug) ||
        DEFAULT_CATEGORIES.find((candidate) => candidate.slug === slug);
      return item ? { ...item, name: FEATURED_CATEGORY_NAMES[slug] } : undefined;
    }).filter((item): item is BackendCategory => Boolean(item));
  }, [categories]);

  const activeCategory = useMemo(
    () =>
      supportedCategories.find((item) => item.slug === activeCategorySlug) ||
      category,
    [activeCategorySlug, category, supportedCategories]
  );

  const partners = useMemo<PartnerSummary[]>(() => {
    const grouped = new Map<number, BackendService[]>();
    allServices.forEach((service) => {
      const existing = grouped.get(service.supplierId);
      if (existing) existing.push(service);
      else grouped.set(service.supplierId, [service]);
    });

    return Array.from(grouped.entries()).map(([supplierId, services]) => {
      const representative = services[0];
      const ratings = services
        .map((service) => service.supplierRating ?? service.rating)
        .filter((rating) => Number.isFinite(rating));

      return {
        supplierId,
        name: representative.supplierName,
        businessType: representative.supplierBusinessType,
        address: representative.supplierAddress,
        district: representative.district || '',
        image: representative.supplierImageUrl || representative.imageUrl,
        rating: ratings.length > 0 ? Math.max(...ratings) : 0,
        reviewCount: Math.max(...services.map((service) => service.supplierReviewCount || 0)),
        services,
        representative,
        minPrice: Math.min(...services.map((service) => service.price)),
        maxPrice: Math.max(...services.map((service) => service.price)),
      };
    });
  }, [allServices]);

  const districts = useMemo(
    () =>
      Array.from(new Set(partners.map((partner) => partner.district).filter(Boolean))).sort(
        (left, right) => left.localeCompare(right, 'vi')
      ),
    [partners]
  );

  const filteredPartners = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('vi');
    const result = partners.filter((partner) => {
      const searchableText = [
        partner.name,
        partner.businessType,
        partner.address,
        ...partner.services.map((service) => service.name),
      ]
        .join(' ')
        .toLocaleLowerCase('vi');

      return (
        (!normalizedQuery || searchableText.includes(normalizedQuery)) &&
        (selectedDistrict === 'all' || partner.district === selectedDistrict) &&
        partner.rating >= minRating
      );
    });

    return result.sort((left, right) => {
      if (sortBy === 'rating') return right.rating - left.rating;
      if (sortBy === 'price') return left.minPrice - right.minPrice;
      if (sortBy === 'services') return right.services.length - left.services.length;
      return right.reviewCount - left.reviewCount || right.rating - left.rating;
    });
  }, [minRating, partners, searchQuery, selectedDistrict, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredPartners.length / PAGE_SIZE));
  const visiblePartners = filteredPartners.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const selectCategory = (nextCategory: BackendCategory) => {
    setActiveCategorySlug(nextCategory.slug);
    setSearchQuery('');
    setSelectedDistrict('all');
    setMinRating(0);
    setCurrentPage(1);
    onSelectCategory?.(nextCategory);
  };

  const openPartner = (partner: PartnerSummary) => {
    onSelectPartner?.({
      id: `category-supplier-${partner.supplierId}`,
      supplierId: partner.supplierId,
      serviceId: partner.representative.id,
      rating: partner.rating,
      reviewsCount: partner.reviewCount,
      name: partner.name,
      subTitle: partner.businessType,
      address: partner.address,
      image: partner.image,
      logo: getInitials(partner.name),
      specialty: activeCategory.name,
      promoNotice: `${partner.services.length} dịch vụ ${activeCategory.name}`,
    });
  };

  const changePage = (page: number) => {
    setCurrentPage(page);
    catalogTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50/60 via-white to-white">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <button
          type="button"
          onClick={onBack}
          className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-[#be185d]"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại trang chủ
        </button>

        <section className="overflow-hidden rounded-3xl border border-pink-100 bg-white shadow-sm">
          <div className="relative h-40 overflow-hidden sm:h-48">
            <OptimizedImage
              src={activeCategory.imageUrl}
              alt={activeCategory.name}
              preset="modal-banner"
              vignette
              className="h-full w-full object-cover"
              containerClassName="h-full w-full"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-transparent" />
            <div className="absolute inset-0 flex items-center px-6 sm:px-10">
              <div className="max-w-xl text-white">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur-sm">
                  Danh mục nổi bật
                </div>
                <h1 className="text-2xl font-black sm:text-4xl">{activeCategory.name}</h1>
                <p className="mt-2 text-sm text-white/85">
                  Chọn đối tác phù hợp, sau đó xem toàn bộ dịch vụ tại cửa hàng.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto p-3 sm:p-4">
            {supportedCategories.map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => selectCategory(item)}
                aria-current={item.slug === activeCategorySlug ? 'page' : undefined}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition ${
                  item.slug === activeCategorySlug
                    ? 'border-[#e1146c] bg-[#e1146c] text-white'
                    : 'border-pink-100 bg-white text-slate-600 hover:border-pink-300 hover:text-[#be185d]'
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </section>

        <div ref={catalogTopRef} className="scroll-mt-24 pt-6">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
                Đối tác {activeCategory.name}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {loading ? 'Đang tìm đối tác…' : `${filteredPartners.length} đối tác tại ${locationLabel}`}
              </p>
            </div>
            {onOpenLocationModal && (
              <button
                type="button"
                onClick={onOpenLocationModal}
                className="inline-flex items-center gap-2 self-start rounded-full border border-pink-200 bg-white px-4 py-2 text-sm font-bold text-[#be185d] transition hover:bg-pink-50 lg:self-auto"
              >
                <MapPin className="h-4 w-4" /> {locationLabel}
              </button>
            )}
          </div>

          <div className="mb-6 grid gap-3 rounded-2xl border border-pink-100 bg-white p-3 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
            <label className="relative sm:col-span-2 lg:col-span-1">
              <span className="sr-only">Tìm đối tác hoặc dịch vụ</span>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm đối tác hoặc dịch vụ…"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-pink-400 focus:bg-white focus:ring-2 focus:ring-pink-100"
              />
            </label>

            <label>
              <span className="sr-only">Khu vực</span>
              <select
                value={selectedDistrict}
                onChange={(event) => {
                  setSelectedDistrict(event.target.value);
                  setCurrentPage(1);
                }}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
              >
                <option value="all">Tất cả khu vực</option>
                {districts.map((district) => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="sr-only">Đánh giá tối thiểu</span>
              <select
                value={minRating}
                onChange={(event) => {
                  setMinRating(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
              >
                <option value={0}>Mọi đánh giá</option>
                <option value={4}>Từ 4.0 sao</option>
                <option value={4.5}>Từ 4.5 sao</option>
              </select>
            </label>

            <label>
              <span className="sr-only">Sắp xếp</span>
              <select
                value={sortBy}
                onChange={(event) => {
                  setSortBy(event.target.value as typeof sortBy);
                  setCurrentPage(1);
                }}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
              >
                <option value="popular">Phổ biến nhất</option>
                <option value="rating">Đánh giá cao nhất</option>
                <option value="price">Giá từ thấp đến cao</option>
                <option value="services">Nhiều dịch vụ nhất</option>
              </select>
            </label>
          </div>

          {loading && (
            <div className="grid min-h-64 place-items-center rounded-3xl border border-pink-100 bg-white">
              <div className="text-center text-slate-500" role="status">
                <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-[#e1146c]" />
                Đang tải danh sách đối tác…
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-semibold text-rose-700" role="alert">
              {error}
            </div>
          )}

          {!loading && !error && visiblePartners.length === 0 && (
            <div className="rounded-3xl border border-pink-100 bg-white p-10 text-center">
              <Store className="mx-auto h-10 w-10 text-pink-300" />
              <h3 className="mt-3 font-black text-slate-900">Chưa tìm thấy đối tác phù hợp</h3>
              <p className="mt-1 text-sm text-slate-500">Hãy thử từ khóa hoặc bộ lọc khác.</p>
            </div>
          )}

          {!loading && visiblePartners.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visiblePartners.map((partner) => (
                <button
                  key={partner.supplierId}
                  type="button"
                  onClick={() => openPartner(partner)}
                  aria-label={`Xem cửa hàng ${partner.name}`}
                  className="group overflow-hidden rounded-3xl border border-pink-100 bg-white text-left shadow-xs transition duration-200 hover:-translate-y-1 hover:border-pink-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1146c]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-pink-50">
                    <OptimizedImage
                      src={partner.image}
                      alt={partner.name}
                      preset="salon-card"
                      vignette
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      containerClassName="h-full w-full"
                    />
                    <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-black text-[#be185d] shadow-sm backdrop-blur-sm">
                      {activeCategory.name}
                    </div>
                    <div className="absolute bottom-3 right-3 rounded-full bg-slate-950/70 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                      {partner.services.length} dịch vụ
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-pink-600">
                          {partner.businessType || 'Đối tác BeautyLink'}
                        </p>
                        <h3 className="mt-1 line-clamp-1 text-lg font-black text-slate-900 transition group-hover:text-[#be185d]">
                          {partner.name}
                        </h3>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {partner.rating > 0 ? partner.rating.toFixed(1) : 'Mới'}
                      </div>
                    </div>

                    <p className="mt-3 flex min-h-10 items-start gap-1.5 text-sm text-slate-500">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-pink-500" />
                      <span className="line-clamp-2">{partner.address}</span>
                    </p>

                    <div className="mt-4 flex items-end justify-between border-t border-pink-50 pt-4">
                      <div>
                        <span className="text-xs text-slate-500">Giá từ</span>
                        <p className="text-lg font-black text-[#be185d]">{formatCurrency(partner.minPrice)}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-sm font-black text-[#be185d]">
                        Xem cửa hàng <ChevronRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Phân trang đối tác">
              <button
                type="button"
                onClick={() => changePage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                aria-label="Trang trước"
                className="grid h-10 w-10 place-items-center rounded-full border border-pink-200 bg-white text-slate-700 transition hover:border-pink-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-sm font-bold text-slate-600">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => changePage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                aria-label="Trang tiếp theo"
                className="grid h-10 w-10 place-items-center rounded-full border border-pink-200 bg-white text-slate-700 transition hover:border-pink-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
};
