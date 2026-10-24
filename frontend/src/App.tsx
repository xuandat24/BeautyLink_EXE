import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import type { AdminSection } from './components/admin/AdminNav';
import { AuthPage } from './components/AuthPage';
import { continuationDestination, setPaymentBookingId } from './lib/paymentNavigation';
import type { ExploreContext } from './components/FilterExplorePage';
import { PageLoadBoundary } from './components/PageLoadBoundary';
import { useSessionLifecycle } from './hooks/useSessionLifecycle';
import { eligibleOnboardingVisit } from './lib/onboarding';
import type { SessionPhase } from './lib/authSession';

// Modals
import { BookingModal } from './components/BookingModal';
import { CartDrawer } from './components/CartDrawer';
import { VoucherModal } from './components/VoucherModal';
import { LocationSelectModal } from './components/LocationSelectModal';
import { BlogModal } from './components/BlogModal';
import { ViewAllServicesModal, ViewAllContext } from './components/ViewAllServicesModal';
import { FavoriteToast, FavoriteToastInfo } from './components/FavoriteToast';

const AdminDashboardPage = React.lazy(() => import('./components/admin/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })));
const SupplierDashboard = React.lazy(() => import('./components/SupplierDashboard').then(module => ({ default: module.SupplierDashboard })));
const SupplierRegisterPage = React.lazy(() => import('./components/SupplierRegisterPage').then(module => ({ default: module.SupplierRegisterPage })));
const BookingsPage = React.lazy(() => import('./components/BookingsPage').then(module => ({ default: module.BookingsPage })));
const ReportsPage = React.lazy(() => import('./components/ReportsPage').then(module => ({ default: module.ReportsPage })));
const AdminCustomersPage = React.lazy(() => import('./components/AdminCustomersPage').then(module => ({ default: module.AdminCustomersPage })));
const AccountPage = React.lazy(() => import('./components/AccountPage').then(module => ({ default: module.AccountPage })));
const CheckoutPage = React.lazy(() => import('./components/CheckoutPage').then(module => ({ default: module.CheckoutPage })));
const FilterExplorePage = React.lazy(() => import('./components/FilterExplorePage').then(module => ({ default: module.FilterExplorePage })));
const PartnerDetailPage = React.lazy(() => import('./components/PartnerDetailPage').then(module => ({ default: module.PartnerDetailPage })));

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
import { beautyApi, DEFAULT_CATEGORIES, getAccessToken } from './services/beautyApi';
import { serviceReviewSummary, supplierReviewSummary } from './lib/reviewScope';
import { updateMetaTags } from './lib/seo';
import { CheckCircle2 } from 'lucide-react';
import { mapBackendUser } from './lib/authUser';
import { disableGoogleAutoSelect } from './lib/googleIdentity';

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
  supplierId: item.supplierId,
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
  ...serviceReviewSummary(item),
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
    supplierId: item.supplierId,
    name: item.supplierName,
    category: mapCategorySlug(item.categorySlug),
    categoryLabel: item.supplierBusinessType,
    address: item.supplierAddress,
    district: extractDistrict(item.supplierAddress),
    distanceKm:
      calculatedDist != null
        ? Number(calculatedDist.toFixed(1))
        : 0.8 + (idx % 8) * 0.7,
    ...supplierReviewSummary(item),
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
  supplierId: item.supplierId,
  serviceId: item.id,
  ...supplierReviewSummary(item),
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
  | 'admin-customers'
  | 'admin-dashboard'
  | 'admin-bookings'
  | 'admin-payments'
  | 'login'
  | 'register'
  | 'account'
  | 'checkout'
  | 'filter-explore'
  | 'partner-detail';

function BeautyLinkApp({ sessionPhase, retrySession, logoutSession }: {
  sessionPhase: SessionPhase; retrySession: () => void; logoutSession: () => void;
}) {
  const {
    selectedCity,
    selectedLocationId,
    locationConfirmed,
    selectedIntentCategory,
    onboardingCompleted,
    onboardingReady,
    validateOnboardingOptions,
    completeOnboarding,
    setSelectedLocation,
    cartItems: storedCartItems,
    addToCart,
    removeFromCart,
    clearCart,
    currentUser: storedCurrentUser,
    setCurrentUser,
    notifications: storedNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearAllNotifications,
    soundEnabled,
    setSoundEnabled,
    favorites: storedFavorites,
    toggleFavorite,
  } = useBeautyStore();
  // /me is the only authority for restored account data. Keep public pages
  // visible while the verification request runs, without mounting private UI.
  const currentUser = sessionPhase === 'verified' ? storedCurrentUser : null;
  const hideAccountState = sessionPhase === 'checking' || sessionPhase === 'locked'
    || (sessionPhase !== 'verified' && storedCurrentUser !== null);
  const cartItems = hideAccountState ? [] : storedCartItems;
  const notifications = sessionPhase === 'verified' ? storedNotifications : [];
  const favorites = hideAccountState ? [] : storedFavorites;


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
  const isVisitorOnboardingRequired = onboardingReady && !onboardingCompleted;

  // Modals state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isBlogModalOpen, setIsBlogModalOpen] = useState(false);


  // Page Routing & Hash Navigation
  const [currentPage, setCurrentPage] = useState<AppView>(() => {
    // Resolve the URL before the first paint; hashchange runs only after effects.
    if (continuationDestination()) return 'bookings';
    const hash = window.location.hash.slice(1).toLowerCase();
    const aliases: Record<string, AppView> = { logout: 'account', schedule: 'supplier-dashboard',
      admin: 'admin-dashboard', filter: 'filter-explore', explore: 'filter-explore' };
    const direct: AppView[] = ['login', 'register', 'account', 'bookings', 'checkout', 'supplier-register',
      'supplier-dashboard', 'reports', 'admin-dashboard', 'admin-bookings', 'admin-customers',
      'admin-payments', 'filter-explore', 'partner-detail'];
    return aliases[hash] ?? (direct.includes(hash as AppView) ? hash as AppView : 'home');
  });
  const continuationAccount = useRef(currentUser?.id);
  useEffect(() => {
    if (continuationAccount.current != null && currentUser?.id != null && String(continuationAccount.current) !== String(currentUser.id)) setPaymentBookingId(null);
    if (currentUser?.id != null) continuationAccount.current = currentUser.id;
  }, [currentUser?.id]);
  const [selectedCategory, setSelectedCategory] = useState<BackendCategory | null>(null);
  const [serviceCategories, setServiceCategories] = useState<BackendCategory[]>([]);
  const [onboardingLocations, setOnboardingLocations] = useState<Awaited<ReturnType<typeof beautyApi.locations>>>([]);
  const [returnTarget, setReturnTarget] = useState<string>('home');
  const [selectedPartner, setSelectedPartner] = useState<NewPartner | null>(null);
  const [filterExploreContext, setFilterExploreContext] = useState<ExploreContext>('all');
  const [filterExploreCategory, setFilterExploreCategory] = useState<string>('all');
  const [directCheckoutConfig, setDirectCheckoutConfig] = useState<{
    service: BackendService;
    preselectedDate?: string;
    preselectedTime?: string;
    practitionerId?: number;
  } | null>(null);
  const [adminBookedCustomerRange, setAdminBookedCustomerRange] = useState<{ from: string; to: string } | null>(null);

  // Load categories
  useEffect(() => {
    let active = true;
    Promise.all([beautyApi.categories(), beautyApi.locations()]).then(([categories, locations]) => {
      if (!active) return;
      setServiceCategories(categories); setOnboardingLocations(locations);
      validateOnboardingOptions(locations, categories.map(category => category.slug));
    }).catch(() => { if (active) setServiceCategories([]); });
    return () => { active = false; };
  }, [validateOnboardingOptions]);

  // Listen to hash changes
  useEffect(() => {
    const handleHash = () => {
      if (continuationDestination()) { setCurrentPage('bookings'); return; }
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
      } else if (hash === '#admin-customers') {
        setCurrentPage('admin-customers');
      } else if (hash === '#admin-dashboard' || hash === '#admin') {
        setCurrentPage('admin-dashboard');
      } else if (hash === '#admin-bookings') {
        setCurrentPage('admin-bookings');
      } else if (hash === '#admin-payments') {
        setCurrentPage('admin-payments');
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
    window.addEventListener('popstate', handleHash);
    return () => { window.removeEventListener('hashchange', handleHash); window.removeEventListener('popstate', handleHash); };
  }, []);

  const navigateTo = useCallback((view: AppView, fallbackReturn = 'home') => {
    setReturnTarget(fallbackReturn);
    setCurrentPage(view);
    window.location.hash = view;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleOpenAccount = () => {
    if (currentUser?.role === 'SUPPLIER') {
      navigateTo('supplier-dashboard');
      return;
    }
    if (currentUser?.role === 'ADMIN') {
      navigateTo('admin-dashboard');
      return;
    }
    if (currentUser?.role === 'STAFF') {
      navigateTo('reports');
      return;
    }
    navigateTo('account');
  };

  const handleBackToHome = () => {
    setPaymentBookingId(null);
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
      '#admin-customers',
      '#admin-dashboard',
      '#admin',
      '#admin-bookings',
      '#admin-payments',
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
    if (sessionPhase === 'checking' || sessionPhase === 'locked') return;
    const params = new URLSearchParams(window.location.search);
    const paymentResult = params.get('payment');
    if (!paymentResult || !['success', 'cancelled'].includes(paymentResult)) return;

    const orderCode = params.get('orderCode') || sessionStorage.getItem('beautylink_payos_order_code');
    const hasAuthenticatedSession = Boolean(currentUser && getAccessToken());
    const destination = hasAuthenticatedSession ? 'bookings' : 'login';
    // Retain untrusted return identifiers through verification/reauthentication; they never prove payment.
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${destination}`);
    setCurrentPage(destination);

    if (!hasAuthenticatedSession) {
      setReturnTarget('bookings');
      showToast(
        paymentResult === 'success'
          ? 'Thanh toán đã quay về BeautyLink. Vui lòng đăng nhập để xem trạng thái lịch hẹn.'
          : 'Bạn đã hủy thanh toán PayOS. Vui lòng đăng nhập để tiếp tục.'
      );
      return;
    }

    if (!orderCode || !/^\d{1,19}$/.test(orderCode)) {
      params.delete('payment'); params.delete('orderCode');
      window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}#bookings`);
      showToast('Không tìm thấy mã giao dịch hợp lệ để xác minh.');
      return;
    }

    let stopped = false;
    let timer: number | undefined;
    let attempts = 0;
    const initiatingToken = getAccessToken();
    const verify = async () => {
      if (stopped) return;
      attempts += 1;
      try {
        const payment = await beautyApi.payOSPaymentStatus(orderCode);
        if (stopped || initiatingToken !== getAccessToken()) return;
        params.delete('payment'); params.delete('orderCode');
        window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}#bookings`);
        window.dispatchEvent(new Event('beautylink-bookings-refresh'));
        if (payment.requiresManualReview || payment.status === 'REVIEW_REQUIRED') {
          showToast('Giao dịch cần hỗ trợ đối soát. Không thanh toán lại; vui lòng gửi Phản hồi trong lịch hẹn.');
          return;
        }
        if (payment.status === 'PAID') {
          sessionStorage.removeItem('beautylink_payos_order_code');
          if (!stopped) showToast('Thanh toán PayOS đã được máy chủ xác thực thành công.');
          return;
        }
        if (['CANCELLED', 'EXPIRED', 'FAILED'].includes(payment.status)) {
          showToast('Máy chủ đã xác minh phiên thanh toán kết thúc. Vui lòng kiểm tra trạng thái lịch hẹn.');
          return;
        }
      } catch {
        // The final message below covers temporary webhook/API propagation delays.
      }
      if (!stopped && attempts < 10) {
        timer = window.setTimeout(verify, 1500);
      } else if (!stopped) {
        showToast('PayOS đang đối soát giao dịch. Trạng thái sẽ tự cập nhật trong lịch hẹn.');
      }
    };
    void verify();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [currentUser, showToast, sessionPhase]);

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
    } else if (user.role === 'ADMIN') {
      navigateTo('admin-dashboard');
    } else if (user.role === 'STAFF') {
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
    logoutSession();
    handleBackToHome();
    showToast('Đã đăng xuất tài khoản.');
  };

  // Booking Modal State
  const [activeBookingService, setActiveBookingService] = useState<BackendService | null>(null);
  const eligibleHomeVisit = eligibleOnboardingVisit(currentPage, window.location.search, window.location.hash, Boolean(activeBookingService));
  useEffect(() => {
    if (!eligibleHomeVisit) setIsLocationModalOpen(false);
    else if (isVisitorOnboardingRequired) setIsLocationModalOpen(true);
  }, [eligibleHomeVisit, isVisitorOnboardingRequired]);

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
      if (found && found.price <= 0) {
        showToast('Dịch vụ này cần liên hệ cơ sở để được tư vấn và báo giá.');
      } else if (found) {
        setActiveBookingService(found);
      } else {
        showToast('Dịch vụ này chưa sẵn sàng để đặt lịch.');
      }
    },
    [rawServices, showToast]
  );

  const handleOpenService = useCallback(
    (service: BackendService) => {
      if (service.price <= 0) {
        showToast('Dịch vụ này cần liên hệ cơ sở để được tư vấn và báo giá.');
      } else {
        setActiveBookingService(service);
      }
    },
    [showToast]
  );

  const handleOpenServiceById = useCallback(
    (id: number) => {
      const found = rawServices.find((s) => s.id === id);
      if (found) {
        handleOpenService(found);
      } else {
        showToast('Không tìm thấy dịch vụ trong cơ sở dữ liệu.');
      }
    },
    [handleOpenService, rawServices, showToast]
  );

  const handleOpenPartnerBySupplier = useCallback(
    (supplierId?: number) => {
      const supplierService = rawServices.find((service) => service.supplierId === supplierId);
      if (!supplierService) {
        showToast('Không tìm thấy cửa hàng của đối tác này.');
        return;
      }
      setSelectedPartner(mapServiceToPartner(supplierService));
      navigateTo('partner-detail');
    },
    [navigateTo, rawServices, showToast]
  );

  const handleProceedToCheckout = useCallback(
    (service: BackendService, date: string, slot: string, practitionerId?: number) => {
      if (service.price <= 0) {
        showToast('Dịch vụ này cần liên hệ cơ sở để được tư vấn và báo giá.');
        return;
      }
      setActiveBookingService(null);
      setDirectCheckoutConfig({
        service,
        preselectedDate: date,
        preselectedTime: slot,
        practitionerId,
      });
      navigateTo('checkout');
    },
    [navigateTo, showToast]
  );

  const handleAdminNavigate = useCallback((section: AdminSection) => {
    const destinations: Record<AdminSection, AppView> = {
      overview: 'admin-dashboard',
      bookings: 'admin-bookings',
      customers: 'admin-customers',
      payments: 'admin-payments',
      reports: 'reports',
    };
    if (section !== 'customers') setAdminBookedCustomerRange(null);
    navigateTo(destinations[section]);
  }, [navigateTo]);

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
  const adminPages: AppView[] = ['admin-dashboard', 'admin-bookings', 'admin-customers', 'admin-payments'];
  const protectedPages: AppView[] = [...adminPages, 'supplier-dashboard', 'reports', 'account', 'bookings', 'checkout'];
  if (protectedPages.includes(currentPage) && (sessionPhase === 'checking' || sessionPhase === 'locked')) {
    return <section role="status" aria-live="polite" className="mx-auto max-w-md px-5 py-12 text-center text-sm text-slate-600">
      {sessionPhase === 'checking' ? 'Đang kiểm tra quyền truy cập…' : 'Chưa thể xác minh phiên đăng nhập. Dữ liệu tài khoản đang được khóa.'}
      {sessionPhase === 'locked' && <div className="mt-4 flex justify-center gap-4">
        <button type="button" className="font-semibold text-pink-700 underline" onClick={retrySession}>Thử lại</button>
        <button type="button" className="font-semibold text-slate-600 underline" onClick={logoutSession}>Đăng xuất</button>
      </div>}
    </section>;
  }
  if (protectedPages.includes(currentPage) && !currentUser) {
    return <AuthPage initialMode="login" onBackToHome={handleBackToHome}
      onSuccess={user => {
        handleUserSuccess(user);
        if (user.role === 'CUSTOMER' && ['account', 'bookings', 'checkout'].includes(currentPage)) navigateTo(currentPage);
      }} onNavigateSupplierRegister={() => navigateTo('supplier-register')} onModeChange={mode => navigateTo(mode)} />;
  }
  if (adminPages.includes(currentPage) && currentUser?.role !== 'ADMIN') {
    if (!currentUser) {
      return <AuthPage initialMode="login" onBackToHome={handleBackToHome} onSuccess={handleUserSuccess}
        onNavigateSupplierRegister={() => navigateTo('supplier-register')} onModeChange={(mode) => navigateTo(mode)} />;
    }
    return <div className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center"><div><h1 className="text-2xl font-black">Không có quyền truy cập</h1><p className="mt-2 text-sm text-slate-500">Trang quản trị chỉ dành cho tài khoản ADMIN.</p><button onClick={handleBackToHome} className="mt-5 rounded-2xl bg-pink-600 px-5 py-3 text-sm font-black text-white">Về trang chủ</button></div></div>;
  }

  if (currentPage === 'admin-dashboard' || currentPage === 'admin-bookings' || currentPage === 'admin-payments') {
    const mode = currentPage === 'admin-bookings' ? 'bookings' : currentPage === 'admin-payments' ? 'payments' : 'overview';
    return <React.Suspense fallback={<div className="grid min-h-screen place-items-center bg-slate-50 text-sm font-bold text-slate-500">Đang tải trang quản trị...</div>}><AdminDashboardPage mode={mode} adminName={currentUser?.name || 'Quản trị viên'}
      onNavigate={handleAdminNavigate} onHome={handleBackToHome} onLogout={handleLogout}
      onOpenBookedCustomers={(from, to) => { setAdminBookedCustomerRange({ from, to }); navigateTo('admin-customers'); }} /></React.Suspense>;
  }

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
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'STAFF')) {
      return <div className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center"><div><h1 className="text-2xl font-black">Không có quyền truy cập</h1><button onClick={handleBackToHome} className="mt-5 rounded-2xl bg-pink-600 px-5 py-3 text-sm font-black text-white">Về trang chủ</button></div></div>;
    }
    return (
      <ReportsPage
        onBack={handleBackToHome}
        onOpenCustomers={currentUser.role === 'ADMIN' ? () => navigateTo('admin-customers') : undefined}
        adminName={currentUser.role === 'ADMIN' ? currentUser.name : undefined}
        onAdminNavigate={currentUser.role === 'ADMIN' ? handleAdminNavigate : undefined}
        onLogout={currentUser.role === 'ADMIN' ? handleLogout : undefined}
      />
    );
  }

  if (currentPage === 'admin-customers') {
    return (
      <AdminCustomersPage
        onBack={handleBackToHome}
        onNavigate={handleAdminNavigate}
        onLogout={handleLogout}
        adminName={currentUser?.name || 'Quản trị viên'}
        bookedRange={adminBookedCustomerRange}
      />
    );
  }

  if (currentPage === 'login' || currentPage === 'register') {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased selection:bg-[#fce7f3] selection:text-[#B42D58]">
        <AuthPage
          initialMode={currentPage === 'register' ? 'register' : 'login'}
          onBackToHome={handleBackToHome}
          onSuccess={handleUserSuccess}
          onNavigateSupplierRegister={() => navigateTo('supplier-register')}
          onModeChange={(mode) => navigateTo(mode, returnTarget)}
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
          preselectedPractitionerId={directCheckoutConfig?.practitionerId}
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
            onProceedToCheckout={handleProceedToCheckout}
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
            onBookService={handleOpenService}
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
          availableLocations={onboardingLocations} availableCategories={serviceCategories}
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
            onProceedToCheckout={handleProceedToCheckout}
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
            onSelectPartner={(partner) => {
              setSelectedPartner(partner);
              navigateTo('partner-detail');
            }}
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
                reviewsCount: svc.serviceReviewCount ?? 0,
                supplierId: svc.supplierId,
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
              onSelectPartner={(deal) => handleOpenPartnerBySupplier(deal.supplierId)}
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

            {import.meta.env?.DEV && <CustomerReviewsSection />}

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
          onProceedToCheckout={handleProceedToCheckout}
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

      <LocationSelectModal
        availableLocations={onboardingLocations} availableCategories={serviceCategories}
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        required={isVisitorOnboardingRequired && eligibleHomeVisit}
        selectedLocationId={selectedLocationId}
        selectedIntentCategory={selectedIntentCategory}
        onSelectLocation={(loc, name, categorySlug) => {
          completeOnboarding(loc.id, name, categorySlug || 'all');
          if (categorySlug && categorySlug !== 'all') {
            const matched = serviceCategories.find((c) => c.slug === categorySlug);

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

export default function App() {
  const session = useSessionLifecycle();
  const logoutSession = () => { disableGoogleAutoSelect(); session.logout(); };
  return <PageLoadBoundary>
    <BeautyLinkApp sessionPhase={session.phase} retrySession={session.retry} logoutSession={logoutSession} />
    {session.phase === 'locked' && <aside role="alert" className="fixed bottom-4 right-4 z-50 max-w-72 rounded-xl border border-pink-200 bg-white p-3 text-xs text-slate-700 shadow-lg">
      Chưa thể xác minh phiên đăng nhập.
      <button type="button" className="ml-2 font-bold text-pink-700 underline" onClick={session.retry}>Thử lại</button>
    </aside>}
  </PageLoadBoundary>;
}
