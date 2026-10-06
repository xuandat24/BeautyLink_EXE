import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { FeaturedCategories } from './components/FeaturedCategories';
import { HotDealsSection } from './components/HotDealsSection';
import { NearYouSection } from './components/NearYouSection';
import { CampaignBanners } from './components/CampaignBanners';
import { NewPartnersSection } from './components/NewPartnersSection';
import { CustomerReviewsSection } from './components/CustomerReviewsSection';
import { WhyChooseUs } from './components/WhyChooseUs';
import { Footer } from './components/Footer';

// Pages
import { CategoryServicePage } from './components/CategoryServicePage';
import { SupplierDashboard } from './components/SupplierDashboard';
import { SupplierRegisterPage } from './components/SupplierRegisterPage';
import { BookingsPage } from './components/BookingsPage';
import { ReportsPage } from './components/ReportsPage';
import { AuthPage } from './components/AuthPage';
import { AccountPage } from './components/AccountPage';
import { CheckoutPage } from './components/CheckoutPage';
import { FilterExplorePage, ExploreContext } from './components/FilterExplorePage';
import { PartnerDetailPage } from './components/PartnerDetailPage';

// Modals
import { BookingModal } from './components/BookingModal';
import { CartDrawer } from './components/CartDrawer';
import { VoucherModal } from './components/VoucherModal';
import { CommunityModal } from './components/CommunityModal';
import { RewardsModal } from './components/RewardsModal';
import { LocationSelectModal } from './components/LocationSelectModal';
import { BlogModal } from './components/BlogModal';
import { ViewAllServicesModal, ViewAllContext } from './components/ViewAllServicesModal';
import { FavoriteToast, FavoriteToastInfo } from './components/FavoriteToast';

// Central Store & Types
import { useBeautyStore } from './store/beautyStore';
import {
  HotDeal,
  Salon,
  NewPartner,
  BackendService,
  BackendCategory,
  CurrentUser,
  SearchFilters,
} from './types';
import { beautyApi, DEFAULT_CATEGORIES } from './services/beautyApi';
import { updateMetaTags } from './lib/seo';
import { CheckCircle2 } from 'lucide-react';

// ==========================================
// Data Transformation Helpers
// ==========================================
const getInitials = (str: string) =>
  str
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();

const mapCategorySlug = (slug: string) => {
  const map: Record<string, string> = {
    spa: 'spa',
    nails: 'nail',
    hair: 'salon-toc',
    skincare: 'clinic',
    makeup: 'tham-my-vien',
  };
  return map[slug] || 'spa';
};

const extractDistrict = (address: string) => {
  const match = address.match(
    /(Quận\s+[^,]+|Phú Nhuận|Bình Thạnh|Tân Bình|Thủ Đức|Cầu Giấy|Đống Đa|Ba Đình|Hoàn Kiếm|Hai Bà Trưng|Tây Hồ|Thanh Xuân|Nam Từ Liêm|Bắc Từ Liêm)/i
  );
  return match?.[1] || 'TP. Hồ Chí Minh';
};

const calculateDistanceKm = (
  coord1: { latitude: number; longitude: number },
  coord2: { latitude: number; longitude: number }
) => {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(coord1.latitude)) *
      Math.cos(toRad(coord2.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const mapServiceToDeal = (item: BackendService, idx: number): HotDeal => ({
  id: `service-${item.id}`,
  serviceId: item.id,
  title: item.name,
  brandName: item.supplierName,
  brandLogo: getInitials(item.supplierName),
  image: item.imageUrl,
  originalPrice: item.originalPrice || item.price,
  salePrice: item.price,
  discountPercent:
    item.originalPrice && item.originalPrice > item.price
      ? Math.round((1 - item.price / item.originalPrice) * 100)
      : 0,
  isNew: idx < 4,
  rating: item.rating,
  reviewsCount: item.supplierReviewCount,
  duration: `${item.durationMinutes} phút`,
  category: mapCategorySlug(item.categorySlug),
  highlightText: item.highlightText || item.description || '',
  distanceKm: 0.8 + (idx % 7) * 0.6,
  district: extractDistrict(item.supplierAddress),
});

const mapServiceToSalon = (
  item: BackendService,
  idx: number,
  userCoords: { latitude: number; longitude: number } | null
): Salon => {
  const hasCoords = item.supplierLatitude != null && item.supplierLongitude != null;
  const calculatedDist =
    userCoords && hasCoords
      ? calculateDistanceKm(userCoords, {
          latitude: item.supplierLatitude!,
          longitude: item.supplierLongitude!,
        })
      : null;

  return {
    id: `supplier-${item.supplierId}`,
    serviceId: item.id,
    name: item.supplierName,
    category: mapCategorySlug(item.categorySlug),
    categoryLabel: item.supplierBusinessType,
    address: item.supplierAddress,
    district: extractDistrict(item.supplierAddress),
    distanceKm:
      calculatedDist != null
        ? Number(calculatedDist.toFixed(1))
        : 0.8 + (idx % 8) * 0.7,
    rating: item.rating,
    reviewsCount: item.supplierReviewCount,
    image: item.supplierImageUrl || item.imageUrl,
    logo: getInitials(item.supplierName),
    badge: 'Đã xác minh',
    isFeatured: true,
    minPrice: item.price,
    maxPrice: item.originalPrice || item.price,
    hasExactDistance: calculatedDist != null,
  };
};

const mapServiceToPartner = (item: BackendService): NewPartner => ({
  id: `new-supplier-${item.supplierId}`,
  serviceId: item.id,
  name: item.supplierName,
  subTitle: item.supplierBusinessType.toUpperCase(),
  address: item.supplierAddress,
  image: item.supplierImageUrl || item.imageUrl,
  logo: getInitials(item.supplierName),
  specialty: item.name,
  promoNotice: 'Đối tác mới · Ưu đãi độc quyền',
});

type AppView =
  | 'home'
  | 'service'
  | 'supplier-dashboard'
  | 'supplier-register'
  | 'bookings'
  | 'reports'
  | 'login'
  | 'register'
  | 'account'
  | 'checkout'
  | 'filter-explore'
  | 'partner-detail';

export default function App() {
  const {
    selectedCity,
    selectedLocationId,
    locationConfirmed,
    selectedIntentCategory,
    onboardingCompleted,
    completeOnboarding,
    setSelectedLocation,
    cartItems,
    addToCart,
    removeFromCart,
    clearCart,
    currentUser,
    setCurrentUser,
    logout,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearAllNotifications,
    soundEnabled,
    setSoundEnabled,
    favorites,
    toggleFavorite,
  } = useBeautyStore();

  // Favorite Toast System
  const [favoriteToast, setFavoriteToast] = useState<FavoriteToastInfo | null>(null);

  const handleToggleFavoriteDeal = useCallback((deal: HotDeal) => {
    const isNowFav = toggleFavorite(deal.id);
    setFavoriteToast({
      id: deal.id,
      title: deal.title,
      salonName: deal.brandName,
      image: deal.image,
      isFavorited: isNowFav,
    });
  }, [toggleFavorite]);

  const handleToggleFavoriteSalon = useCallback((salon: Salon) => {
    const isNowFav = toggleFavorite(salon.id);
    setFavoriteToast({
      id: salon.id,
      title: salon.name,
      salonName: salon.address,
      image: salon.image,
      isFavorited: isNowFav,
    });
  }, [toggleFavorite]);

  useEffect(() => {
    updateMetaTags();
  }, []);

  // Check if onboarding is required (not logged in and hasn't completed city + service selection)
  const isVisitorOnboardingRequired = !currentUser && !onboardingCompleted;

  // Modals state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false);
  const [isRewardsModalOpen, setIsRewardsModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(isVisitorOnboardingRequired);
  const [isBlogModalOpen, setIsBlogModalOpen] = useState(false);

  // If visitor is not logged in and hasn't chosen city & service, keep selection modal open
  useEffect(() => {
    if (isVisitorOnboardingRequired) {
      setIsLocationModalOpen(true);
    }
  }, [isVisitorOnboardingRequired]);

  // Page Routing & Hash Navigation
  const [currentPage, setCurrentPage] = useState<AppView>('home');
  const [selectedCategory, setSelectedCategory] = useState<BackendCategory | null>(null);
  const [serviceCategories, setServiceCategories] = useState<BackendCategory[]>([]);
  const [returnTarget, setReturnTarget] = useState<string>('home');
  const [selectedPartner, setSelectedPartner] = useState<NewPartner | null>(null);
  const [filterExploreContext, setFilterExploreContext] = useState<ExploreContext>('all');
  const [filterExploreCategory, setFilterExploreCategory] = useState<string>('all');
  const [directCheckoutConfig, setDirectCheckoutConfig] = useState<{
    service: BackendService;
    preselectedDate?: string;
    preselectedTime?: string;
  } | null>(null);

  // Load categories
  useEffect(() => {
    beautyApi
      .categories()
      .then((data) => setServiceCategories(data))
      .catch(() => setServiceCategories([]));
  }, []);

  // Listen to hash changes
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#login') {
        setCurrentPage('login');
      } else if (hash === '#register') {
        setCurrentPage('register');
      } else if (hash === '#account' || hash === '#logout') {
        setCurrentPage('account');
      } else if (hash === '#supplier-register') {
        setCurrentPage('supplier-register');
      } else if (hash === '#supplier-dashboard' || hash === '#schedule') {
        setCurrentPage('supplier-dashboard');
      } else if (hash === '#bookings') {
        setCurrentPage('bookings');
      } else if (hash === '#reports') {
        setCurrentPage('reports');
      } else if (hash === '#checkout') {
        setCurrentPage('checkout');
      } else if (hash === '#filter-explore' || hash === '#filter' || hash === '#explore') {
        setCurrentPage('filter-explore');
      } else if (hash === '#partner-detail') {
        setCurrentPage('partner-detail');
      } else if (!hash || hash === '#home') {
        setCurrentPage('home');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const navigateTo = (view: AppView, fallbackReturn = 'home') => {
    setReturnTarget(fallbackReturn);
    setCurrentPage(view);
    window.location.hash = view;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAccount = () => {
    if (currentUser?.role === 'SUPPLIER') {
      navigateTo('supplier-dashboard');
      return;
    }
    if (currentUser?.role === 'STAFF' || currentUser?.role === 'ADMIN') {
      navigateTo('reports');
      return;
    }
    navigateTo('account');
  };

  const handleBackToHome = () => {
    setCurrentPage('home');
    const hashes = [
      '#login',
      '#register',
      '#supplier-register',
      '#account',
      '#logout',
      '#schedule',
      '#supplier-dashboard',
      '#service',
      '#bookings',
      '#reports',
      '#checkout',
      '#filter-explore',
      '#filter',
      '#explore',
      '#partner-detail',
    ];
    if (hashes.includes(window.location.hash)) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Toast Notification System
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentResult = params.get('payment');
    if (!paymentResult || !['success', 'cancelled', 'pending', 'invalid'].includes(paymentResult)) return;

    const reference = params.get('reference') || params.get('orderCode')
      || sessionStorage.getItem('beautylink_payment_reference')
      || sessionStorage.getItem('beautylink_payos_order_code');
    const legacyPayOSReference = sessionStorage.getItem('beautylink_payos_order_code');
    const rawProvider = params.get('provider') || sessionStorage.getItem('beautylink_payment_provider')
      || (legacyPayOSReference ? 'PAYOS' : null);
    const provider = rawProvider === 'PAYOS' ? 'PayOS' : 'VNPAY';
    window.history.replaceState(null, '', `${window.location.pathname}#bookings`);
    setCurrentPage('bookings');

    if (paymentResult === 'cancelled') {
      showToast(`Bạn đã hủy thanh toán ${provider}. Hệ thống sẽ đối soát trạng thái.`);
      return;
    }
    if (paymentResult === 'invalid') {
      showToast('Kết quả trả về có chữ ký không hợp lệ. Giao dịch chưa được xác nhận.');
      return;
    }
    if (!reference || !/^[A-Za-z0-9_-]{1,64}$/.test(reference)) {
      showToast('Không tìm thấy mã giao dịch hợp lệ để xác minh.');
      return;
    }

    let stopped = false;
    let attempts = 0;
    const verify = async () => {
      attempts += 1;
      try {
        const payment = await beautyApi.paymentStatus(reference);
        if (payment.status === 'PAID') {
          sessionStorage.removeItem('beautylink_payment_reference');
          sessionStorage.removeItem('beautylink_payment_provider');
          sessionStorage.removeItem('beautylink_payos_order_code');
          if (!stopped) showToast(`Thanh toán ${provider} đã được máy chủ xác thực thành công.`);
          return;
        }
        if (payment.status === 'REVIEW_REQUIRED') {
          if (!stopped) showToast('Giao dịch đang được kiểm tra an toàn. Vui lòng không thanh toán lại.');
          return;
        }
      } catch {
        // The final message below covers temporary webhook/API propagation delays.
      }
      if (!stopped && attempts < 10) {
        window.setTimeout(verify, 1500);
      } else if (!stopped) {
        showToast(`${provider} đang được đối soát. Trạng thái sẽ tự cập nhật trong lịch hẹn.`);
      }
    };
    void verify();
    return () => {
      stopped = true;
    };
  }, [showToast]);

  // Geolocation state
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<'idle' | 'loading' | 'ready' | 'denied'>('idle');

  const handleEnableLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationPermission('denied');
      showToast('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }
    setLocationPermission('loading');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserCoords({ latitude: coords.latitude, longitude: coords.longitude });
        setLocationPermission('ready');
        showToast('Đã sắp xếp cơ sở theo khoảng cách thật từ bạn.');
      },
      () => {
        setLocationPermission('denied');
        showToast('Không thể lấy vị trí. Bạn có thể cấp quyền GPS rồi thử lại.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 }
    );
  }, [showToast]);

  // Load Homepage Services
  const [loadingServices, setLoadingServices] = useState<boolean>(true);
  const [rawServices, setRawServices] = useState<BackendService[]>([]);

  useEffect(() => {
    let isMounted = true;
    setLoadingServices(true);

    (async () => {
      try {
        let list = await beautyApi.homepageServices(selectedLocationId || undefined);
        if (list.length === 0 && selectedLocationId) {
          list = await beautyApi.homepageServices();
        }
        if (isMounted) setRawServices(list);
      } catch {
        if (isMounted) {
          setRawServices([]);
          showToast('Không thể tải danh mục từ cơ sở dữ liệu.');
        }
      } finally {
        if (isMounted) setLoadingServices(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [selectedLocationId, showToast]);

  // Auth Callbacks
  const handleUserSuccess = (user: CurrentUser) => {
    setCurrentUser(user);
    if (user.role === 'SUPPLIER') {
      navigateTo('supplier-dashboard');
    } else if (user.role === 'STAFF' || user.role === 'ADMIN') {
      navigateTo('reports');
    } else if (returnTarget === 'bookings') {
      navigateTo('bookings');
    } else if (returnTarget === 'service' && selectedCategory) {
      navigateTo('service');
    } else {
      handleBackToHome();
    }
    showToast(`🌸 Chào mừng ${user.name} đã đăng nhập thành công!`);
  };

  const handleSupplierSuccess = (user: CurrentUser) => {
    setCurrentUser(user);
    navigateTo('supplier-dashboard');
    showToast('Đăng ký thành công. Hãy hoàn thiện đội ngũ và giờ làm việc của bạn.');
  };

  const handleOpenAppointments = () => {
    if (!currentUser) {
      navigateTo('login', 'bookings');
      return;
    }
    navigateTo('bookings');
  };

  const handleLogout = () => {
    logout();
    handleBackToHome();
    showToast('Đã đăng xuất tài khoản.');
  };

  // Booking Modal State
  const [activeBookingService, setActiveBookingService] = useState<BackendService | null>(null);

  // View All Services Modal
  const [viewAllModal, setViewAllModal] = useState<{
    isOpen: boolean;
    context: ViewAllContext;
    initialCategory?: string;
  }>({
    isOpen: false,
    context: 'deals',
  });

  const openViewAll = useCallback((context: ViewAllContext, initialCategory?: string) => {
    setFilterExploreContext(context as any);
    if (initialCategory) setFilterExploreCategory(initialCategory);
    navigateTo('filter-explore');
  }, []);

  const handleAddToCart = useCallback(
    (deal: HotDeal) => {
      addToCart(deal);
      showToast(`Đã thêm "${deal.title}" vào giỏ dịch vụ!`);
    },
    [addToCart, showToast]
  );

  const handleRemoveFromCart = useCallback(
    (dealId: string) => {
      removeFromCart(dealId);
      showToast('Đã xóa dịch vụ khỏi giỏ.');
    },
    [removeFromCart, showToast]
  );

  const handleBookDeal = useCallback(
    (dealTitle: string, salonName: string) => {
      const found =
        rawServices.find((s) => s.name === dealTitle || s.supplierName === salonName) ||
        rawServices[0];
      if (found) {
        setActiveBookingService(found);
      } else {
        showToast('Dịch vụ này chưa sẵn sàng để đặt lịch.');
      }
    },
    [rawServices, showToast]
  );

  const handleOpenServiceById = useCallback(
    (id: number) => {
      const found = rawServices.find((s) => s.id === id);
      if (found) {
        setActiveBookingService(found);
      } else {
        showToast('Không tìm thấy dịch vụ trong cơ sở dữ liệu.');
      }
    },
    [rawServices, showToast]
  );

  // Search Filter & Chips State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    priceRange: 'all',
    minRating: 0,
    maxDistance: 0,
  });

  const handleSearch = useCallback(
    (query: string, filters?: SearchFilters) => {
      setSearchQuery(query);
      if (filters) {
        setSearchFilters(filters);
      }
      if (query.trim()) {
        const filterDetails: string[] = [];
        const active = filters || searchFilters;
        if (active.priceRange === 'under-300') filterDetails.push('Giá < 300k');
        if (active.priceRange === '300-800') filterDetails.push('Giá 300k-800k');
        if (active.priceRange === 'over-800') filterDetails.push('Giá > 800k');
        if (active.minRating > 0) filterDetails.push(`Đánh giá ${active.minRating}★+`);
        if (active.maxDistance > 0) filterDetails.push(`Bán kính < ${active.maxDistance}km`);

        const extraText = filterDetails.length > 0 ? ` (${filterDetails.join(' · ')})` : '';
        showToast(`Tìm kiếm: "${query}"${extraText}`);
        const dealsEl = document.getElementById('deals');
        dealsEl?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    [showToast, searchFilters]
  );

  const handleResetSearch = useCallback(() => {
    setSearchQuery('');
    setSearchFilters({
      priceRange: 'all',
      minRating: 0,
      maxDistance: 0,
    });
    showToast('Đã xóa tìm kiếm và bộ lọc.');
  }, [showToast]);

  const handleSelectServiceCategory = useCallback((cat: BackendCategory) => {
    setSelectedCategory(cat);
    setCurrentPage('service');
    window.location.hash = 'service';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Mapped Data Sets from Live Backend Services
  const deals = useMemo(() => rawServices.filter((s) => s.featured).map(mapServiceToDeal), [
    rawServices,
  ]);

  const salons = useMemo(() => {
    const map = new Map<number, BackendService>();
    rawServices
      .filter((s) => s.supplierNearbyFeatured)
      .forEach((s) => {
        if (!map.has(s.supplierId)) map.set(s.supplierId, s);
      });
    return [...map.values()]
      .map((s, idx) => mapServiceToSalon(s, idx, userCoords))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [rawServices, userCoords]);

  const partners = useMemo(() => {
    const map = new Map<number, BackendService>();
    rawServices
      .filter((s) => s.supplierNewPartner)
      .forEach((s) => {
        if (!map.has(s.supplierId)) map.set(s.supplierId, s);
      });
    return [...map.values()].map(mapServiceToPartner);
  }, [rawServices]);

  const filteredDeals = useMemo(() => {
    let result = deals;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.brandName.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q) ||
          (d.district && d.district.toLowerCase().includes(q))
      );
    }

    // Filter by Price Range
    if (searchFilters.priceRange === 'under-300') {
      result = result.filter((d) => d.salePrice < 300000);
    } else if (searchFilters.priceRange === '300-800') {
      result = result.filter((d) => d.salePrice >= 300000 && d.salePrice <= 800000);
    } else if (searchFilters.priceRange === 'over-800') {
      result = result.filter((d) => d.salePrice > 800000);
    }

    // Filter by Rating
    if (searchFilters.minRating > 0) {
      result = result.filter((d) => d.rating >= searchFilters.minRating);
    }

    // Filter by Distance
    if (searchFilters.maxDistance > 0) {
      result = result.filter((d) => d.distanceKm != null && d.distanceKm <= searchFilters.maxDistance);
    }

    return result;
  }, [searchQuery, searchFilters, deals]);

  // =========================================================================
  // STANDALONE ROUTING SCREENS (No background overlay)
  // =========================================================================
  if (currentPage === 'supplier-dashboard') {
    return <SupplierDashboard onBack={handleBackToHome} onLogout={handleLogout} />;
  }

  if (currentPage === 'supplier-register') {
    return (
      <SupplierRegisterPage
        onBack={handleBackToHome}
        onSuccess={handleSupplierSuccess}
        onLogin={() => navigateTo('login')}
      />
    );
  }

  if (currentPage === 'bookings') {
    return <BookingsPage onBack={handleBackToHome} onBookNew={handleBackToHome} />;
  }

  if (currentPage === 'reports') {
    return <ReportsPage onBack={handleBackToHome} />;
  }

  if (currentPage === 'login' || currentPage === 'register') {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased selection:bg-[#fce7f3] selection:text-[#B42D58]">
        <AuthPage
          initialMode={currentPage === 'register' ? 'register' : 'login'}
          onBackToHome={handleBackToHome}
          onSuccess={handleUserSuccess}
          onNavigateSupplierRegister={() => navigateTo('supplier-register')}
        />
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2">
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  if (currentPage === 'account') {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased selection:bg-[#fce7f3] selection:text-[#B42D58]">
        <AccountPage
          currentUser={currentUser}
          onBackToHome={handleBackToHome}
          onLogoutConfirm={handleLogout}
          onNavigateLogin={() => navigateTo('login')}
          onOpenAppointments={handleOpenAppointments}
          onOpenVouchers={() => setIsVoucherModalOpen(true)}
        />
        <VoucherModal
          isOpen={isVoucherModalOpen}
          onClose={() => setIsVoucherModalOpen(false)}
          onApplyVoucher={(code) => {
            showToast(`Đã chọn mã voucher: ${code}`);
            setIsVoucherModalOpen(false);
          }}
        />
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2">
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  if (currentPage === 'checkout') {
    return (
      <div className="min-h-screen bg-[#FFF8F9] font-sans text-slate-800 antialiased selection:bg-[#fce7f3] selection:text-[#B42D58]">
        <CheckoutPage
          currentUser={currentUser}
          directService={directCheckoutConfig?.service || null}
          preselectedDate={directCheckoutConfig?.preselectedDate}
          preselectedTime={directCheckoutConfig?.preselectedTime}
          onBack={() => {
            setDirectCheckoutConfig(null);
            handleBackToHome();
          }}
          onViewBookings={() => {
            setDirectCheckoutConfig(null);
            navigateTo('bookings');
          }}
          onNeedLogin={() => navigateTo('login', 'checkout')}
        />
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2">
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  if (currentPage === 'filter-explore') {
    return (
      <div className="min-h-screen bg-[#FFF5F7] font-sans text-slate-800 antialiased selection:bg-[#fce7f3] selection:text-[#B42D58]">
        <FilterExplorePage
          initialContext={filterExploreContext}
          initialCategory={filterExploreCategory}
          onBack={handleBackToHome}
          onBookDeal={handleBookDeal}
          onAddToCart={handleAddToCart}
          onSelectPartner={(partner) => {
            setSelectedPartner(partner);
            navigateTo('partner-detail');
          }}
          deals={deals}
          salons={salons}
          partners={partners}
          currentUser={currentUser}
        />
        {activeBookingService && (
          <BookingModal
            service={activeBookingService}
            currentUser={currentUser}
            onClose={() => setActiveBookingService(null)}
            onNeedLogin={() => navigateTo('login')}
            onCreated={(bookingCode) => {
              showToast(`Đặt lịch thành công · Mã ${bookingCode}. Bạn có thể chia sẻ lịch hẹn ngay.`);
            }}
            onViewMyBookings={() => {
              setActiveBookingService(null);
              navigateTo('account');
            }}
          />
        )}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2">
            <span>{toastMessage}</span>
          </div>
        )}
        <FavoriteToast
          toast={favoriteToast}
          onClose={() => setFavoriteToast(null)}
        />
      </div>
    );
  }

  if (currentPage === 'partner-detail') {
    return (
      <div className="min-h-screen bg-[#FFF9FA] font-sans text-slate-800 antialiased selection:bg-[#fce7f3] selection:text-[#B42D58] flex flex-col justify-between">
        {/* Unified Platform Header */}
        <Header
          cartCount={cartItems.length}
          onOpenCart={() => setIsCartOpen(true)}
          onOpenPartnerModal={() => navigateTo('supplier-register')}
          onOpenLocationModal={() => setIsLocationModalOpen(true)}
          onOpenAuthModal={(mode) => navigateTo(mode)}
          onOpenAccount={handleOpenAccount}
          onOpenFilterPage={() => {
            setFilterExploreContext('all');
            navigateTo('filter-explore');
          }}
          onSearch={handleSearch}
          deals={deals}
          searchFilters={searchFilters}
          onFiltersChange={setSearchFilters}
          selectedCity={selectedCity}
          currentUser={currentUser}
          onLogout={handleLogout}
          serviceCategories={serviceCategories}
          onSelectServiceCategory={handleSelectServiceCategory}
          unreadNotificationsCount={notifications.filter((n) => !n.isRead).length}
          notifications={notifications}
          onMarkAllAsRead={() => {
            markAllNotificationsRead();
            showToast('Đã đánh dấu tất cả thông báo là đã đọc.');
          }}
          onMarkAsRead={markNotificationRead}
          onClearAllNotifications={() => {
            clearAllNotifications();
            showToast('Đã xóa danh sách thông báo.');
          }}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled((prev) => !prev)}
        />

        <main className="flex-1">
          <PartnerDetailPage
            partner={selectedPartner || partners[0]}
            currentUser={currentUser}
            onBack={handleBackToHome}
            onBookService={handleBookDeal}
            onNeedLogin={() => navigateTo('login')}
          />
        </main>

        {/* Unified Platform Footer */}
        <Footer />

        {/* Drawers & Modals */}
        <CartDrawer
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          items={cartItems}
          onRemoveItem={handleRemoveFromCart}
          onClearCart={clearCart}
          onCheckout={() => {
            setIsCartOpen(false);
            setDirectCheckoutConfig(null);
            navigateTo('checkout');
          }}
        />

        <LocationSelectModal
          isOpen={isLocationModalOpen}
          onClose={() => setIsLocationModalOpen(false)}
          required={false}
          selectedLocationId={selectedLocationId}
          selectedIntentCategory={selectedIntentCategory}
          onSelectLocation={(loc, name, categorySlug) => {
            completeOnboarding(loc.id, name, categorySlug || 'all');
            showToast(`Đã chuyển khu vực sang ${name}`);
          }}
        />

        {activeBookingService && (
          <BookingModal
            service={activeBookingService}
            currentUser={currentUser}
            onClose={() => setActiveBookingService(null)}
            onNeedLogin={() => navigateTo('login')}
            onCreated={(bookingCode) => {
              showToast(`Đặt lịch thành công · Mã ${bookingCode}. Bạn có thể chia sẻ lịch hẹn ngay.`);
            }}
            onViewMyBookings={() => {
              setActiveBookingService(null);
              navigateTo('account');
            }}
          />
        )}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2">
            <span>{toastMessage}</span>
          </div>
        )}
        <FavoriteToast
          toast={favoriteToast}
          onClose={() => setFavoriteToast(null)}
        />
      </div>
    );
  }

  // =========================================================================
  // MAIN HOMEPAGE
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#FFF0F3] flex flex-col selection:bg-pink-200 selection:text-pink-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl border border-pink-400/30 flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-pink-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <Header
        cartCount={cartItems.length}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenPartnerModal={() => navigateTo('supplier-register')}
        onOpenLocationModal={() => setIsLocationModalOpen(true)}
        onOpenAuthModal={(mode) => navigateTo(mode)}
        onOpenAccount={handleOpenAccount}
        onOpenFilterPage={() => {
          setFilterExploreContext('all');
          navigateTo('filter-explore');
        }}
        onSearch={handleSearch}
        deals={deals}
        searchFilters={searchFilters}
        onFiltersChange={setSearchFilters}
        selectedCity={selectedCity}
        currentUser={currentUser}
        onLogout={handleLogout}
        serviceCategories={serviceCategories}
        onSelectServiceCategory={handleSelectServiceCategory}
        unreadNotificationsCount={notifications.filter((n) => !n.isRead).length}
        notifications={notifications}
        onMarkAllAsRead={() => {
          markAllNotificationsRead();
          showToast('Đã đánh dấu tất cả thông báo là đã đọc.');
        }}
        onMarkAsRead={markNotificationRead}
        onClearAllNotifications={() => {
          clearAllNotifications();
          showToast('Đã xóa danh sách thông báo.');
        }}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
      />

      {/* Main Content Sections */}
      <main className="flex-1">
        {currentPage === 'service' && selectedCategory ? (
          <CategoryServicePage
            category={selectedCategory}
            categories={serviceCategories}
            onSelectCategory={handleSelectServiceCategory}
            locationId={selectedLocationId}
            locationLabel={selectedCity}
            currentUser={currentUser}
            onBack={handleBackToHome}
            onNeedLogin={() => navigateTo('login', 'service')}
            onBookingCreated={showToast}
            onOpenLocationModal={() => setIsLocationModalOpen(true)}
            onAddToCart={(svc) => {
              handleAddToCart({
                id: String(svc.id),
                title: svc.name,
                brandName: svc.supplierName,
                brandLogo: svc.supplierName.slice(0, 2).toUpperCase(),
                highlightText: svc.highlightText || 'Ưu đãi đặt lịch',
                originalPrice: svc.originalPrice || svc.price,
                salePrice: svc.price,
                discountPercent:
                  svc.originalPrice && svc.originalPrice > svc.price
                    ? Math.round(((svc.originalPrice - svc.price) / svc.originalPrice) * 100)
                    : 0,
                rating: svc.rating,
                reviewsCount: svc.supplierReviewCount,
                image: svc.imageUrl,
                category: svc.categorySlug,
                duration: `${svc.durationMinutes} phút`,
                serviceId: svc.id,
              });
            }}
            onDirectCheckout={(svc, preDate, preTime) => {
              setDirectCheckoutConfig({
                service: svc,
                preselectedDate: preDate,
                preselectedTime: preTime,
              });
              navigateTo('checkout');
            }}
          />
        ) : (
          <>
            <HeroSection
              onOpenCommunity={() => setIsCommunityModalOpen(true)}
              onOpenAppointments={handleOpenAppointments}
              onOpenVouchers={() => setIsVoucherModalOpen(true)}
              onOpenRewards={() => setIsRewardsModalOpen(true)}
              onBookDirect={(title, price, orig) =>
                handleBookDeal(title, 'Paradise Skin Clinic')
              }
            />

            <FeaturedCategories
              onSelectCategory={handleSelectServiceCategory}
              activeCategorySlug={selectedIntentCategory}
            />

            <HotDealsSection
              deals={filteredDeals}
              isLoading={loadingServices}
              searchQuery={searchQuery}
              searchFilters={searchFilters}
              onResetSearch={handleResetSearch}
              onBookDeal={(deal) => {
                if (deal.serviceId) {
                  handleOpenServiceById(deal.serviceId);
                } else {
                  handleBookDeal(deal.title, deal.brandName);
                }
              }}
              onAddToCart={handleAddToCart}
              onViewAll={() => openViewAll('deals')}
              favorites={favorites}
              onToggleFavorite={handleToggleFavoriteDeal}
            />

            <NearYouSection
              salons={salons}
              isLoading={loadingServices}
              locationPermission={locationPermission}
              onEnableLocation={handleEnableLocation}
              onSelectSalon={(salon) => {
                if (salon.serviceId) {
                  handleOpenServiceById(salon.serviceId);
                } else {
                  handleBookDeal(salon.name, salon.name);
                }
              }}
              onViewAll={() => openViewAll('nearby')}
              favoritesList={favorites}
              onToggleFavorite={handleToggleFavoriteSalon}
            />

            <CampaignBanners
              onOpenCampaign={(title) => {
                handleBookDeal(title, 'Hệ Thống Thẩm Mỹ & Spa Đối Tác');
              }}
              onBookDeal={handleBookDeal}
            />

            <NewPartnersSection
              partners={partners}
              onSelectPartner={(partner) => {
                setSelectedPartner(partner);
                navigateTo('partner-detail');
              }}
              onViewAll={() => openViewAll('new-partners')}
            />

            <CustomerReviewsSection />

            <WhyChooseUs onBookService={handleBookDeal} />
          </>
        )}
      </main>

      <Footer />

      {/* Modals & Drawers */}
      {activeBookingService && (
        <BookingModal
          service={activeBookingService}
          currentUser={currentUser}
          onClose={() => setActiveBookingService(null)}
          onNeedLogin={() => navigateTo('login')}
          onCreated={(bookingCode) => {
            showToast(`Đặt lịch thành công · Mã ${bookingCode}. Bạn có thể chia sẻ lịch hẹn ngay bên dưới.`);
          }}
          onViewMyBookings={() => {
            setActiveBookingService(null);
            navigateTo('bookings');
          }}
        />
      )}

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={clearCart}
        onCheckout={() => {
          setIsCartOpen(false);
          setDirectCheckoutConfig(null);
          navigateTo('checkout');
        }}
      />

      <VoucherModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        onApplyVoucher={(code) => {
          showToast(`Đã kích hoạt voucher: ${code}!`);
        }}
      />

      <CommunityModal
        isOpen={isCommunityModalOpen}
        onClose={() => setIsCommunityModalOpen(false)}
      />

      <RewardsModal
        isOpen={isRewardsModalOpen}
        onClose={() => setIsRewardsModalOpen(false)}
      />

      <LocationSelectModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        required={isVisitorOnboardingRequired}
        selectedLocationId={selectedLocationId}
        selectedIntentCategory={selectedIntentCategory}
        onSelectLocation={(loc, name, categorySlug) => {
          completeOnboarding(loc.id, name, categorySlug || 'all');
          if (categorySlug && categorySlug !== 'all') {
            const slugToMatch = categorySlug === 'duong-sinh' ? 'spa' : categorySlug;
            const matched =
              serviceCategories.find((c) => c.slug === slugToMatch) ||
              DEFAULT_CATEGORIES.find((c) => c.slug === slugToMatch) ||
              DEFAULT_CATEGORIES[0];

            if (matched) {
              setSelectedCategory(matched);
              setCurrentPage('service');
              window.location.hash = 'service';
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          } else {
            setCurrentPage('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          const catLabel =
            categorySlug && categorySlug !== 'all'
              ? ` · ${categorySlug.toUpperCase()}`
              : '';
          showToast(`Chào mừng bạn đến với BeautyLink tại ${name}${catLabel}!`);
        }}
      />

      <BlogModal
        isOpen={isBlogModalOpen}
        onClose={() => setIsBlogModalOpen(false)}
      />

      <ViewAllServicesModal
        isOpen={viewAllModal.isOpen}
        onClose={() => setViewAllModal((prev) => ({ ...prev, isOpen: false }))}
        context={viewAllModal.context}
        initialCategory={viewAllModal.initialCategory}
        onBookDeal={handleBookDeal}
        onAddToCart={handleAddToCart}
        deals={deals}
        salons={salons}
        partners={partners}
      />

      {/* Professional Favorite Toast */}
      <FavoriteToast
        toast={favoriteToast}
        onClose={() => setFavoriteToast(null)}
      />
    </div>
  );
}
