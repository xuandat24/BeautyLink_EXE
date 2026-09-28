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
import { PartnerBlogCTA } from './components/PartnerBlogCTA';
import { Footer } from './components/Footer';

// Modals
import { CartDrawer } from './components/CartDrawer';
import { VoucherModal } from './components/VoucherModal';
import { CommunityModal } from './components/CommunityModal';
import { RewardsModal } from './components/RewardsModal';
import { SupplierRegisterPage } from './components/SupplierRegisterPage';
import { LocationSelectModal } from './components/LocationSelectModal';
import { BlogModal } from './components/BlogModal';
import { ViewAllServicesModal, ViewAllContext } from './components/ViewAllServicesModal';
import { AuthPage } from './components/AuthPage';
import { AccountPage } from './components/AccountPage';
import { BookingDialog, ServicePage } from './components/ServicePage';
import { SupplierSchedulePage } from './components/SupplierSchedulePage';
import { MyBookingsPage } from './components/MyBookingsPage';
import { StaffReportsPage } from './components/StaffReportsPage';

// Central Store & Types (Enterprise Modular Architecture)
import { useBeautyStore } from './store/beautyStore';
import {
  HotDeal,
  Salon,
  NewPartner,
  CurrentUser,
  ServiceCategory,
  BeautyService,
} from './types';
import { updateMetaTags } from './lib/seo';

import { platformApi } from './services/platformApi';
import { CheckCircle2 } from 'lucide-react';

const logoFor = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const categoryForCard = (slug: string): Salon['category'] => ({ spa: 'spa', nails: 'nail', hair: 'salon-toc', skincare: 'clinic', makeup: 'tham-my-vien' }[slug] as Salon['category']) || 'spa';
const districtFrom = (address: string) => address.match(/(Quận\s+[^,]+|Phú Nhuận|Bình Thạnh|Tân Bình|Thủ Đức)/i)?.[1] || 'TP. Hồ Chí Minh';

type GeoPoint = { latitude: number; longitude: number };
const distanceInKm = (from: GeoPoint, to: GeoPoint) => {
  const radius = 6371;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const toDeal = (service: BeautyService, index: number): HotDeal => ({
  id: `service-${service.id}`, serviceId: service.id, title: service.name, brandName: service.supplierName,
  brandLogo: logoFor(service.supplierName), image: service.imageUrl, originalPrice: service.originalPrice || service.price,
  salePrice: service.price, discountPercent: service.originalPrice > service.price ? Math.round((1 - service.price / service.originalPrice) * 100) : 0,
  isNew: index < 4, rating: service.rating, reviewsCount: service.supplierReviewCount,
  duration: `${service.durationMinutes} phút`, category: categoryForCard(service.categorySlug),
  highlightText: service.highlightText || service.description, distanceKm: 0.8 + (index % 7) * 0.6,
  district: districtFrom(service.supplierAddress),
});

const toSalon = (service: BeautyService, index: number, userLocation: GeoPoint | null): Salon => {
  const hasCoordinates = service.supplierLatitude != null && service.supplierLongitude != null;
  const exactDistance = userLocation && hasCoordinates
    ? distanceInKm(userLocation, { latitude: service.supplierLatitude!, longitude: service.supplierLongitude! })
    : null;
  return ({
  id: `supplier-${service.supplierId}`, serviceId: service.id, name: service.supplierName,
  category: categoryForCard(service.categorySlug), categoryLabel: service.supplierBusinessType,
  address: service.supplierAddress, district: districtFrom(service.supplierAddress), distanceKm: exactDistance == null ? 0.8 + (index % 8) * 0.7 : Number(exactDistance.toFixed(1)),
  rating: service.rating, reviewsCount: service.supplierReviewCount, image: service.supplierImageUrl || service.imageUrl,
  logo: logoFor(service.supplierName), badge: 'Đã xác minh',
  isFeatured: true, minPrice: service.price, maxPrice: service.originalPrice || service.price,
  hasExactDistance: exactDistance != null,
  });
};

const toNewPartner = (service: BeautyService): NewPartner => ({
  id: `new-supplier-${service.supplierId}`, serviceId: service.id, name: service.supplierName,
  subTitle: service.supplierBusinessType.toUpperCase(), address: service.supplierAddress,
  image: service.supplierImageUrl || service.imageUrl, logo: logoFor(service.supplierName),
  specialty: service.name, promoNotice: service.highlightText || 'Ưu đãi trải nghiệm dành cho khách hàng mới',
});

export default function App() {
  // Use persistent store (instant F5 hydration, zero lag, state preserved)
  const {
    selectedCity,
    setSelectedCity,
    selectedLocationId,
    locationConfirmed,
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
  } = useBeautyStore();

  // Initialize SEO meta tags once
  useEffect(() => {
    updateMetaTags();
  }, []);

  // Modal open states
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false);
  const [isRewardsModalOpen, setIsRewardsModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isBlogModalOpen, setIsBlogModalOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [locationPermission, setLocationPermission] = useState<'idle' | 'loading' | 'ready' | 'denied'>('idle');

  useEffect(() => {
    if (!locationConfirmed) setIsLocationModalOpen(true);
  }, [locationConfirmed]);
  // Dedicated Page View Navigation ('home' | 'login' | 'register' | 'account')
  // Allows Login/Register and Account/Logout to be standalone pages with zero background overlap
  const [currentPage, setCurrentPage] = useState<'home' | 'login' | 'register' | 'supplier-register' | 'account' | 'service' | 'supplier-dashboard' | 'bookings' | 'reports'>('home');
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [returnAfterAuth, setReturnAfterAuth] = useState<'home' | 'service' | 'bookings'>('home');

  useEffect(() => {
    platformApi.categories().then(setServiceCategories).catch(() => setServiceCategories([]));
  }, []);

  // Support URL hash routing (#login, #register, #account, #logout)
  useEffect(() => {
    const handleHashChange = () => {
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
      } else if (!hash || hash === '#home') {
        setCurrentPage('home');
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleOpenAuth = (mode: 'login' | 'register', returnTo: 'home' | 'service' | 'bookings' = 'home') => {
    setReturnAfterAuth(returnTo);
    setCurrentPage(mode);
    window.location.hash = mode;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAccount = () => {
    if (currentUser?.role === 'SUPPLIER') {
      setCurrentPage('supplier-dashboard');
      window.location.hash = 'supplier-dashboard';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (currentUser?.role === 'STAFF' || currentUser?.role === 'ADMIN') {
      setCurrentPage('reports');
      window.location.hash = 'reports';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setCurrentPage('account');
    window.location.hash = 'account';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToHome = () => {
    setCurrentPage('home');
    if (['#login', '#register', '#supplier-register', '#account', '#logout', '#schedule', '#supplier-dashboard', '#service', '#bookings', '#reports'].includes(window.location.hash)) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Data loading state with Skeleton Effect support to avoid Layout Shift
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [homepageServices, setHomepageServices] = useState<BeautyService[]>([]);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  const requestUserLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocationPermission('denied'); showToast('Trình duyệt không hỗ trợ định vị GPS.'); return; }
    setLocationPermission('loading');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setUserLocation({ latitude: coords.latitude, longitude: coords.longitude }); setLocationPermission('ready'); showToast('Đã sắp xếp cơ sở theo khoảng cách thật từ bạn.'); },
      () => { setLocationPermission('denied'); showToast('Không thể lấy vị trí. Bạn có thể cấp quyền GPS rồi thử lại.'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 },
    );
  }, [showToast]);

  useEffect(() => {
    let active = true;
    setIsLoadingServices(true);
    const load = async () => {
      try {
        let result = await platformApi.homepageServices(selectedLocationId);
        if (result.length === 0 && selectedLocationId) result = await platformApi.homepageServices();
        if (active) setHomepageServices(result);
      } catch {
        if (active) { setHomepageServices([]); showToast('Không thể tải danh mục từ cơ sở dữ liệu.'); }
      } finally {
        if (active) setIsLoadingServices(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [selectedLocationId, showToast]);

  const handleLoginSuccess = (user: CurrentUser) => {
    setCurrentUser(user);
    if (user.role === 'SUPPLIER') {
      setCurrentPage('supplier-dashboard');
      window.location.hash = 'supplier-dashboard';
    } else if (user.role === 'STAFF' || user.role === 'ADMIN') {
      setCurrentPage('reports');
      window.location.hash = 'reports';
    } else if (returnAfterAuth === 'bookings') {
      setCurrentPage('bookings');
      window.location.hash = 'bookings';
    } else if (returnAfterAuth === 'service' && selectedCategory) {
      setCurrentPage('service');
      window.location.hash = 'service';
    } else {
      handleBackToHome();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setReturnAfterAuth('home');
    showToast(`🌸 Chào mừng ${user.name} đã đăng nhập thành công!`);
  };

  const handleSupplierRegistrationSuccess = (user: CurrentUser) => {
    setCurrentUser(user);
    setCurrentPage('supplier-dashboard');
    window.location.hash = 'supplier-dashboard';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Đăng ký thành công. Hãy hoàn thiện đội ngũ và giờ làm việc của bạn.');
  };

  const handleOpenSupplierRegistration = () => {
    setCurrentPage('supplier-register');
    window.location.hash = 'supplier-register';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenBookings = () => {
    if (!currentUser) {
      handleOpenAuth('login', 'bookings');
      return;
    }
    setCurrentPage('bookings');
    window.location.hash = 'bookings';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    logout();
    showToast('Đã đăng xuất tài khoản.');
  };

  const handleImmediateLogout = () => {
    logout();
    setCurrentPage('home');
    window.history.replaceState(null, '', window.location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Đã đăng xuất tài khoản.');
  };

  const handleMarkAllAsRead = () => {
    markAllNotificationsRead();
    showToast('Đã đánh dấu tất cả thông báo là đã đọc.');
  };

  const handleMarkAsRead = (id: string) => {
    markNotificationRead(id);
  };

  const handleClearAllNotifications = () => {
    clearAllNotifications();
    showToast('Đã xóa danh sách thông báo.');
  };

  const [bookingService, setBookingService] = useState<BeautyService | null>(null);

  // View All Services & Partners Modal State (with full filter and sort system)
  const [viewAllModal, setViewAllModal] = useState<{
    isOpen: boolean;
    context: ViewAllContext;
    initialCategory?: string;
  }>({
    isOpen: false,
    context: 'deals',
  });

  const handleOpenViewAll = useCallback((context: ViewAllContext, initialCategory?: string) => {
    setViewAllModal({
      isOpen: true,
      context,
      initialCategory,
    });
  }, []);

  const handleViewAllDeals = useCallback(() => {
    handleOpenViewAll('deals');
  }, [handleOpenViewAll]);

  const handleViewAllNearby = useCallback(() => {
    handleOpenViewAll('nearby');
  }, [handleOpenViewAll]);

  const handleViewAllNewPartners = useCallback(() => {
    handleOpenViewAll('new-partners');
  }, [handleOpenViewAll]);

  // Add to cart handler
  const handleAddToCart = useCallback((deal: HotDeal) => {
    addToCart(deal);
    showToast(`Đã thêm "${deal.title}" vào giỏ dịch vụ!`);
  }, [addToCart, showToast]);

  const handleRemoveFromCart = useCallback((id: string) => {
    removeFromCart(id);
    showToast('Đã xóa dịch vụ khỏi giỏ.');
  }, [removeFromCart, showToast]);

  // Direct booking handlers
  const handleOpenBooking = useCallback((
    title: string,
    salonName: string,
    _price: number,
    _originalPrice: number
  ) => {
    const match = homepageServices.find((service) => service.name === title || service.supplierName === salonName) || homepageServices[0];
    if (match) setBookingService(match);
    else showToast('Dịch vụ này chưa sẵn sàng để đặt lịch.');
  }, [homepageServices, showToast]);

  const openServiceById = useCallback((serviceId?: number) => {
    const service = homepageServices.find((item) => item.id === serviceId);
    if (service) setBookingService(service);
    else showToast('Không tìm thấy dịch vụ trong cơ sở dữ liệu.');
  }, [homepageServices, showToast]);

  const handleBookDeal = useCallback((deal: HotDeal) => {
    openServiceById(deal.serviceId);
  }, [openServiceById]);

  const handleSelectSalon = useCallback((salon: Salon) => {
    openServiceById(salon.serviceId);
  }, [openServiceById]);

  const handleSelectPartner = useCallback((partner: NewPartner) => {
    openServiceById(partner.serviceId);
  }, [openServiceById]);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      showToast(`Đang tìm kiếm dịch vụ: "${query}"`);
      const dealsSection = document.getElementById('deals');
      dealsSection?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showToast]);

  const handleSelectCategory = useCallback((category: ServiceCategory) => {
    setSelectedCategory(category);
    setCurrentPage('service');
    window.location.hash = 'service';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const homepageDeals = useMemo(() => homepageServices.filter((service) => service.featured).map(toDeal), [homepageServices]);
  const nearbySalons = useMemo(() => {
    const unique = new Map<number, BeautyService>();
    homepageServices.filter((service) => service.supplierNearbyFeatured).forEach((service) => { if (!unique.has(service.supplierId)) unique.set(service.supplierId, service); });
    return [...unique.values()].map((service, index) => toSalon(service, index, userLocation))
      .sort((left, right) => left.distanceKm - right.distanceKm);
  }, [homepageServices, userLocation]);
  const newPartners = useMemo(() => {
    const unique = new Map<number, BeautyService>();
    homepageServices.filter((service) => service.supplierNewPartner).forEach((service) => { if (!unique.has(service.supplierId)) unique.set(service.supplierId, service); });
    return [...unique.values()].map(toNewPartner);
  }, [homepageServices]);

  const filteredDeals = useMemo(() => {
    if (!searchQuery.trim()) return homepageDeals;
    const q = searchQuery.toLowerCase();
    return homepageDeals.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.brandName.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
    );
  }, [searchQuery, homepageDeals]);

  // =========================================================================
  // DEDICATED FULL-PAGE ROUTING (No background overlay blur)
  // =========================================================================
  if (currentPage === 'service' && selectedCategory) {
    return (
      <ServicePage
        category={selectedCategory}
        locationId={selectedLocationId}
        locationLabel={selectedCity}
        currentUser={currentUser}
        onBack={handleBackToHome}
        onNeedLogin={() => handleOpenAuth('login', 'service')}
        onBookingCreated={showToast}
      />
    );
  }

  if (currentPage === 'supplier-dashboard') {
    return <SupplierSchedulePage onBack={handleBackToHome} onLogout={handleImmediateLogout} />;
  }

  if (currentPage === 'supplier-register') {
    return <SupplierRegisterPage onBack={handleBackToHome} onSuccess={handleSupplierRegistrationSuccess} onLogin={() => handleOpenAuth('login')} />;
  }

  if (currentPage === 'bookings') {
    return <MyBookingsPage onBack={handleBackToHome} onBookNew={handleBackToHome} />;
  }

  if (currentPage === 'reports') {
    return <StaffReportsPage onBack={handleBackToHome} />;
  }

  if (currentPage === 'login' || currentPage === 'register') {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased selection:bg-[#fce7f3] selection:text-[#B42D58]">
        <AuthPage
          initialMode={currentPage === 'register' ? 'register' : 'login'}
          onBackToHome={handleBackToHome}
          onSuccess={handleLoginSuccess}
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
          onNavigateLogin={() => {
            setCurrentPage('login');
            window.location.hash = 'login';
          }}
          onOpenAppointments={() => {
            setCurrentPage('bookings');
            window.location.hash = 'bookings';
          }}
          onOpenVouchers={() => setIsVoucherModalOpen(true)}
        />
        <VoucherModal
          isOpen={isVoucherModalOpen}
          onClose={() => setIsVoucherModalOpen(false)}
          onApplyVoucher={(code: string) => {
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

  return (
    <div className="min-h-screen bg-[#FFF0F3] flex flex-col selection:bg-pink-200 selection:text-pink-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl border border-pink-400/30 flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-pink-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header
        cartCount={cartItems.length}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenPartnerModal={handleOpenSupplierRegistration}
        onOpenLocationModal={() => setIsLocationModalOpen(true)}
        onOpenAuthModal={(mode) => handleOpenAuth(mode)}
        onOpenAccount={() => handleOpenAccount()}
        onSearch={handleSearch}
        selectedCity={selectedCity}
        currentUser={currentUser}
        onLogout={handleImmediateLogout}
        serviceCategories={serviceCategories}
        onSelectServiceCategory={handleSelectCategory}
        unreadNotificationsCount={notifications.filter((n) => !n.isRead).length}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllAsRead}
        onMarkAsRead={handleMarkAsRead}
        onClearAllNotifications={handleClearAllNotifications}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
      />

      {/* Main Homepage Flow (Replicating exact UI/UX from the screenshots) */}
      <main className="flex-1">
        {/* 1. Hero Section + 4 Quick Hub Buttons */}
        <HeroSection
          onOpenCommunity={() => setIsCommunityModalOpen(true)}
          onOpenAppointments={handleOpenBookings}
          onOpenVouchers={() => setIsVoucherModalOpen(true)}
          onOpenRewards={() => setIsRewardsModalOpen(true)}
          onBookDirect={(title, price, originalPrice) =>
            handleOpenBooking(title, 'Paradise Skin Clinic', price, originalPrice)
          }
        />

        {/* 2. Danh mục nổi bật (Featured Circular Categories) */}
        <FeaturedCategories
          onSelectCategory={handleSelectCategory}
        />

        {/* 3. Khuyến Mãi Hot (Hot Deals & Flash Sales) */}
        <HotDealsSection
          deals={filteredDeals}
          isLoading={isLoadingServices}
          onBookDeal={handleBookDeal}
          onAddToCart={handleAddToCart}
          onViewAll={handleViewAllDeals}
        />

        {/* 4. Gần Bạn (Nearby Verified Salons & Spa) */}
        <NearYouSection
          salons={nearbySalons}
          isLoading={isLoadingServices}
          locationPermission={locationPermission}
          onEnableLocation={requestUserLocation}
          onSelectSalon={handleSelectSalon}
          onViewAll={handleViewAllNearby}
        />

        {/* 5. Phun Xăm Thẩm Mỹ, Quảng Cáo & Bí Kíp Sắc Đẹp Carousel */}
        <CampaignBanners
          onOpenCampaign={(title) => {
            handleOpenBooking(title, 'Hệ Thống Thẩm Mỹ & Spa Đối Tác', 450000, 900000);
          }}
          onBookDeal={handleOpenBooking}
        />

        {/* 6. Doanh nghiệp mới tham gia (Newly Joined Partners) */}
        <NewPartnersSection
          partners={newPartners}
          onSelectPartner={handleSelectPartner}
          onViewAll={handleViewAllNewPartners}
        />

        {/* 7. Vì sao nên chọn BeautyPink? (Why Choose Us) */}
        <WhyChooseUs />

        {/* 8. Trở thành Đối tác & Khám phá Blog */}
        <PartnerBlogCTA
          onOpenPartnerModal={handleOpenSupplierRegistration}
          onOpenBlogModal={() => setIsBlogModalOpen(true)}
        />

        {/* 9. Đánh giá & Bình luận khách hàng đã trải nghiệm (Customer Reviews & Ratings) */}
        <CustomerReviewsSection
          onBookService={handleOpenBooking}
        />
      </main>

      {/* Footer */}
      <Footer />

      {/* Modals & Slide-Overs */}
      {bookingService && (
        <BookingDialog
          service={bookingService}
          currentUser={currentUser}
          onClose={() => setBookingService(null)}
          onNeedLogin={() => handleOpenAuth('login')}
          onCreated={(code) => {
            setBookingService(null);
            showToast(`Đặt lịch thành công · Mã ${code}. Lịch đã được lưu vào tài khoản.`);
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
          if (cartItems.length > 0) {
            const first = cartItems[0];
            if (first.deal.serviceId) openServiceById(first.deal.serviceId);
            else handleOpenBooking(first.deal.title, first.deal.brandName, first.deal.salePrice, first.deal.originalPrice);
          }
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
        required={!locationConfirmed}
        selectedLocationId={selectedLocationId}
        onSelectLocation={(location, label) => {
          const city = label;
          setSelectedLocation(location.id, label);
          showToast(`Đã chuyển vị trí sang: ${city}`);
        }}
      />

      <BlogModal
        isOpen={isBlogModalOpen}
        onClose={() => setIsBlogModalOpen(false)}
      />

      {/* Global View All Modal with Full Filter & Sort System */}
      <ViewAllServicesModal
        isOpen={viewAllModal.isOpen}
        onClose={() => setViewAllModal((prev) => ({ ...prev, isOpen: false }))}
        context={viewAllModal.context}
        initialCategory={viewAllModal.initialCategory}
        onBookDeal={handleOpenBooking}
        onAddToCart={handleAddToCart}
        deals={homepageDeals}
        salons={nearbySalons}
        partners={newPartners}
      />
    </div>
  );
}
