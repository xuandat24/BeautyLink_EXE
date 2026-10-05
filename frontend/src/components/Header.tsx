import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  ShoppingCart,
  Sparkles,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  MapPin,
  Flame,
  Bell,
  ArrowRight,
} from 'lucide-react';
import { PushNotification } from '../data/notificationsData';
import { NotificationCenterDropdown } from './NotificationCenterDropdown';
import { BackendCategory, CurrentUser, SearchFilters, HotDeal } from '../types';
import { SearchFilterChips } from './SearchFilterChips';
import { Star } from 'lucide-react';

interface HeaderProps {
  cartCount: number;
  onOpenCart: () => void;
  onOpenPartnerModal: () => void;
  onOpenLocationModal?: () => void;
  onOpenAuthModal: (mode: 'login' | 'register') => void;
  onSearch: (query: string, filters?: SearchFilters) => void;
  selectedCity?: string;
  currentUser?: CurrentUser | null;
  onLogout?: () => void;
  unreadNotificationsCount?: number;
  notifications?: PushNotification[];
  onMarkAllAsRead?: () => void;
  onMarkAsRead?: (id: string) => void;
  onClearAllNotifications?: () => void;
  onTriggerTestPush?: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  autoSimulationEnabled?: boolean;
  onToggleAutoSimulation?: () => void;
  onOpenDeal?: (dealTitle: string, salonName: string, price: number, originalPrice: number) => void;
  onOpenVouchers?: () => void;
  onOpenAccount?: () => void;
  serviceCategories?: BackendCategory[];
  onSelectServiceCategory?: (category: BackendCategory) => void;
  deals?: HotDeal[];
  searchFilters?: SearchFilters;
  onFiltersChange?: (filters: SearchFilters) => void;
  onOpenFilterPage?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cartCount,
  onOpenCart,
  onOpenPartnerModal,
  onOpenLocationModal,
  onOpenAuthModal,
  onSearch,
  selectedCity,
  currentUser,
  onLogout,
  unreadNotificationsCount = 0,
  notifications,
  onMarkAllAsRead,
  onMarkAsRead,
  onClearAllNotifications,
  onTriggerTestPush,
  soundEnabled = true,
  onToggleSound,
  autoSimulationEnabled = true,
  onToggleAutoSimulation,
  onOpenDeal,
  onOpenVouchers,
  onOpenAccount,
  serviceCategories = [],
  onSelectServiceCategory,
  deals = [],
  searchFilters,
  onFiltersChange,
  onOpenFilterPage,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');

  const [internalFilters, setInternalFilters] = useState<SearchFilters>({
    priceRange: 'all',
    minRating: 0,
    maxDistance: 0,
  });

  const activeFilters = searchFilters || internalFilters;

  const handleFiltersChange = (newFilters: SearchFilters) => {
    if (onFiltersChange) {
      onFiltersChange(newFilters);
    } else {
      setInternalFilters(newFilters);
    }
    if (searchInput.trim()) {
      onSearch(searchInput.trim(), newFilters);
    }
  };

  const isTyping = searchInput.trim().length > 0;

  // Real-time live matching services based on keyword + active filters
  const matchingDeals = useMemo(() => {
    if (!deals || !searchInput.trim()) return [];
    const q = searchInput.toLowerCase().trim();
    let res = deals.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.brandName.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        (d.district && d.district.toLowerCase().includes(q))
    );

    if (activeFilters.priceRange === 'under-300') {
      res = res.filter((d) => d.salePrice < 300000);
    } else if (activeFilters.priceRange === '300-800') {
      res = res.filter((d) => d.salePrice >= 300000 && d.salePrice <= 800000);
    } else if (activeFilters.priceRange === 'over-800') {
      res = res.filter((d) => d.salePrice > 800000);
    }

    if (activeFilters.minRating > 0) {
      res = res.filter((d) => d.rating >= activeFilters.minRating);
    }

    if (activeFilters.maxDistance > 0) {
      res = res.filter((d) => d.distanceKm != null && d.distanceKm <= activeFilters.maxDistance);
    }

    return res;
  }, [deals, searchInput, activeFilters]);

  // Hover and Click state for Notification Center ("dí vào hiển thị")
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnterNotif = () => {
    if (notifTimeoutRef.current) {
      clearTimeout(notifTimeoutRef.current);
      notifTimeoutRef.current = null;
    }
    setIsNotifOpen(true);
  };

  const handleMouseLeaveNotif = () => {
    notifTimeoutRef.current = setTimeout(() => {
      setIsNotifOpen(false);
    }, 280);
  };

  const quickKeywords = [
    'Trị mụn lưng',
    'Gội đầu dưỡng sinh',
    'Massage tinh dầu',
    'Nail Hàn Quốc',
    'Laser trị thâm',
    'Nối mi thiết kế',
  ];

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchInput.trim()) {
      onSearch(searchInput.trim(), activeFilters);
      setIsSearchFocused(false);
    }
  };

  const handleSelectKeyword = (keyword: string) => {
    setSearchInput(keyword);
    onSearch(keyword, activeFilters);
    setIsSearchFocused(false);
  };

  const tickerItems = [
    { tag: 'FLASH SALE', text: 'Giảm 50% Gói Massage Thảo Dược Đông Y - Chỉ còn 499k' },
    { tag: 'HOT DEAL', text: 'Liệu Trình Cấy Trắng Da Hoa Hồng - Tặng Voucher 100k' },
    { tag: 'ĐỘC QUYỀN', text: 'Nail Art Phong Cách Hàn Quốc Giảm 30% Khi Đặt Trước' },
    { tag: 'MỚI RA MẮT', text: 'Gội Đầu Dưỡng Sinh Trung Hoa 75 Phút - Mua 1 Tặng 1' },
    { tag: 'GIỜ VÀNG', text: '12:00 - 14:00 Hàng Ngày: Đồng Giá Dịch Vụ 199k Toàn Hệ Thống' },
  ];

  const renderTickerItems = () => (
    <>
      {tickerItems.map((item, idx) => (
        <span key={idx} className="inline-flex items-center gap-2 cursor-pointer group">
          <span className="bg-[#e1146c] text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
            {item.tag}
          </span>
          <span className="text-slate-800 font-medium hover:text-[#e1146c] transition-colors">
            {item.text}
          </span>
          <span className="text-pink-300 font-bold ml-2">✦</span>
        </span>
      ))}
    </>
  );

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-pink-100 shadow-[0_2px_15px_-3px_rgba(244,114,182,0.12)]">
      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-3 md:gap-5">
          {/* Logo BeautyLink */}
          <div className="flex items-center gap-3 shrink-0">
            <a href="#" className="flex items-center gap-2 group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-[#be185d] via-[#db2777] to-[#EB0F51] flex items-center justify-center text-white shadow-md shadow-pink-500/30 group-hover:scale-105 transition-transform duration-300">
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-baseline tracking-tight">
                  <span className="text-xl sm:text-2xl font-black text-slate-800">
                    Beauty
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-[#EB0F51]">
                    Link
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#EB0F51] ml-0.5" />
                </div>
                <span className="text-[10px] text-[#B42D58] font-semibold tracking-wider uppercase -mt-1 hidden sm:block">
                  Sắc Đẹp & Spa Uy Tín
                </span>
              </div>
            </a>
          </div>

          {/* Location Selector Button */}
          {onOpenLocationModal && (
            <button
              type="button"
              onClick={onOpenLocationModal}
              className="hidden min-[1100px]:flex max-w-44 items-center gap-2 rounded-2xl border border-pink-100 bg-pink-50/70 px-3 py-2 text-left text-xs font-bold text-slate-700 transition hover:border-pink-300 hover:bg-pink-50 shrink-0 cursor-pointer"
              title="Thay đổi khu vực"
            >
              <span className="text-[#EB0F51]">●</span>
              <span className="truncate">{selectedCity || 'Chọn khu vực'}</span>
            </button>
          )}

          {/* Search Box with embedded prominent 'Tìm kiếm' button */}
          <div className="flex-1 max-w-xl relative hidden md:block">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <div className="relative w-full">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  placeholder="Tìm kiếm dịch vụ, spa, clinic, trị mụn, uốn tóc..."
                  className="w-full h-11 pl-10 pr-28 rounded-full border border-pink-200/90 bg-pink-50/40 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#EB0F51] focus:bg-white focus:ring-2 focus:ring-pink-300/40 shadow-xs transition-all"
                />
                <Search className="w-4 h-4 text-[#EB0F51] absolute left-3.5 top-1/2 -translate-y-1/2" />

                <button
                  type="submit"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-9 px-4 sm:px-5 rounded-full bg-gradient-to-r from-[#EB0F51] to-[#B42D58] hover:from-[#c2185b] hover:to-[#9d174d] text-white text-xs sm:text-sm font-bold shadow-md shadow-pink-500/20 hover:shadow-pink-500/35 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                >
                  <span>Tìm kiếm</span>
                </button>
              </div>
            </form>

            {/* Filter chips below search bar when user starts typing */}
            {isTyping && (
              <SearchFilterChips
                filters={activeFilters}
                onChange={handleFiltersChange}
                className="mt-1.5"
                onChipInteraction={() => setIsSearchFocused(true)}
                onOpenFullFilterPage={onOpenFilterPage}
              />
            )}

            {/* Quick Keyword Suggestions & Live Results Popup */}
            {isSearchFocused && (
              <div
                className="absolute top-full left-0 right-0 mt-2 p-3 bg-white rounded-2xl border border-pink-100 shadow-xl z-50 animate-fadeIn"
                onMouseDown={(e) => e.preventDefault()}
              >
                {!isTyping ? (
                  <>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 mb-2">
                      <Flame className="w-3.5 h-3.5 text-[#EB0F51]" />
                      <span>Gợi ý tìm kiếm phổ biến</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {quickKeywords.map((kw) => (
                        <button
                          key={kw}
                          type="button"
                          onClick={() => handleSelectKeyword(kw)}
                          className="px-3 py-1 rounded-full bg-pink-50/80 hover:bg-[#EB0F51] text-[#be185d] hover:text-white text-xs font-medium transition-colors cursor-pointer"
                        >
                          {kw}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2 pb-1.5 border-b border-pink-50">
                      <span>Dịch vụ phù hợp ({matchingDeals.length})</span>
                      <span className="text-[11px] text-pink-600 font-semibold">Gợi ý trực tiếp</span>
                    </div>

                    {matchingDeals.length > 0 ? (
                      <div className="space-y-1.5 max-h-60 overflow-y-auto overscroll-contain">
                        {matchingDeals.slice(0, 4).map((deal: HotDeal) => (
                          <div
                            key={deal.id}
                            onClick={() => {
                              if (onOpenDeal) {
                                onOpenDeal(deal.title, deal.brandName, deal.salePrice, deal.originalPrice);
                              } else {
                                handleSearchSubmit({ preventDefault: () => {} } as React.FormEvent);
                              }
                              setIsSearchFocused(false);
                            }}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-pink-50/70 transition cursor-pointer group"
                          >
                            <img
                              src={deal.image}
                              alt={deal.title}
                              className="w-10 h-10 rounded-xl object-cover border border-pink-100 shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?auto=format&fit=crop&w=150&q=80';
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 group-hover:text-[#EB0F51] truncate">
                                {deal.title}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {deal.brandName} · {deal.district}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                                <span className="font-extrabold text-[#EB0F51]">
                                  {new Intl.NumberFormat('vi-VN').format(deal.salePrice)}đ
                                </span>
                                <span className="flex items-center gap-0.5 text-amber-600 font-bold">
                                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                  {deal.rating}
                                </span>
                                <span className="text-slate-400">· {deal.distanceKm} km</span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#EB0F51] group-hover:translate-x-0.5 transition shrink-0" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-3 text-center text-xs text-slate-500">
                        Không tìm thấy dịch vụ nào khớp với bộ lọc hiện tại.
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenFilterPage) {
                          onOpenFilterPage();
                        } else {
                          handleSearchSubmit();
                        }
                      }}
                      className="w-full mt-2 py-1.5 rounded-xl bg-gradient-to-r from-pink-50 to-pink-100/70 hover:from-[#EB0F51] hover:to-[#B42D58] text-[#be185d] hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <span>Mở trang lọc & xem tất cả {matchingDeals.length} kết quả</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Trở thành đối tác */}
            <button
              onClick={onOpenPartnerModal}
              className="hidden lg:inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-pink-200 text-xs font-semibold text-[#be185d] bg-pink-50/70 hover:bg-pink-100 hover:border-pink-300 transition-all whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#EB0F51]" />
              <span>{language === 'vi' ? 'Trở thành đối tác' : 'Partner with us'}</span>
            </button>

            {/* User Profile / Login & Register */}
            {currentUser ? (
              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={() => (onOpenAccount ? onOpenAccount() : onOpenAuthModal('login'))}
                  className="flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-full bg-pink-50/90 border border-pink-200 text-xs font-bold text-[#be185d] hover:bg-pink-100 transition-all shadow-xs cursor-pointer group"
                  title={`Đang đăng nhập: ${currentUser.name}. Bấm để mở trang Quản lý tài khoản.`}
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-[#EB0F51] to-[#f43f5e] text-white flex items-center justify-center text-[10px] font-black shadow-xs group-hover:scale-105 transition-transform">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="max-w-[75px] sm:max-w-[110px] truncate">
                    {currentUser.name}
                  </span>
                </button>

                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="text-[11px] font-semibold text-slate-400 hover:text-[#EB0F51] transition-colors px-1 cursor-pointer"
                    title="Đăng xuất"
                  >
                    Thoát
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  onClick={() => onOpenAuthModal('register')}
                  className="hidden sm:inline-flex px-2.5 py-1.5 rounded-full text-xs font-semibold text-slate-700 hover:text-[#be185d] hover:bg-pink-50 transition-colors cursor-pointer"
                >
                  {language === 'vi' ? 'Đăng ký' : 'Sign up'}
                </button>
                <button
                  onClick={() => onOpenAuthModal('login')}
                  className="px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#EB0F51] to-[#B42D58] hover:from-[#c2185b] hover:to-[#9d174d] shadow-sm shadow-pink-500/25 transition-all whitespace-nowrap cursor-pointer"
                >
                  {language === 'vi' ? 'Đăng nhập' : 'Log in'}
                </button>
              </div>
            )}

            {/* Notification Bell */}
            {notifications && (
              <div
                className="relative"
                onMouseEnter={handleMouseEnterNotif}
                onMouseLeave={handleMouseLeaveNotif}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (notifTimeoutRef.current) {
                      clearTimeout(notifTimeoutRef.current);
                      notifTimeoutRef.current = null;
                    }
                    setIsNotifOpen((prev) => !prev);
                  }}
                  className="relative p-2 rounded-full bg-pink-50 hover:bg-pink-100 text-[#be185d] border border-pink-200/70 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title="Thông báo & Flash Sale"
                  aria-label="Thông báo và khuyến mãi"
                >
                  <Bell className="w-4 h-4 text-[#EB0F51]" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#EB0F51] text-white text-[9px] font-black flex items-center justify-center border-2 border-white shadow-xs">
                      {unreadNotificationsCount}
                      <span className="absolute inset-0 rounded-full bg-[#EB0F51] animate-ping opacity-60 pointer-events-none" />
                    </span>
                  )}
                </button>

                <NotificationCenterDropdown
                  isOpen={isNotifOpen}
                  onClose={() => setIsNotifOpen(false)}
                  onMouseEnter={handleMouseEnterNotif}
                  onMouseLeave={handleMouseLeaveNotif}
                  notifications={notifications}
                  onMarkAllAsRead={onMarkAllAsRead || (() => {})}
                  onMarkAsRead={onMarkAsRead || (() => {})}
                  onClearAll={onClearAllNotifications || (() => {})}
                  onTriggerTestPush={onTriggerTestPush || (() => {})}
                  soundEnabled={soundEnabled}
                  onToggleSound={onToggleSound || (() => {})}
                  autoSimulationEnabled={autoSimulationEnabled}
                  onToggleAutoSimulation={onToggleAutoSimulation || (() => {})}
                  onOpenDeal={onOpenDeal || (() => {})}
                  onOpenVouchers={onOpenVouchers || (() => {})}
                />
              </div>
            )}

            {/* Cart icon */}
            <button
              onClick={onOpenCart}
              className="relative p-2 rounded-full bg-pink-50 hover:bg-pink-100 text-[#be185d] border border-pink-200/70 transition-colors cursor-pointer"
              title="Giỏ dịch vụ & Lịch hẹn"
            >
              <ShoppingCart className="w-4 h-4 text-[#EB0F51]" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-[#EB0F51] text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Language Toggle VN / EN */}
            <div className="flex items-center p-0.5 rounded-full bg-pink-50 border border-pink-200 text-[11px] font-bold shadow-xs">
              <button
                type="button"
                onClick={() => setLanguage('vi')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                  language === 'vi'
                    ? 'bg-[#EB0F51] text-white shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-[#be185d]'
                }`}
                title="Việt Nam (VN)"
              >
                <span className="text-xs leading-none">🇻🇳</span>
                <span>VN</span>
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                  language === 'en'
                    ? 'bg-[#EB0F51] text-white shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-[#be185d]'
                }`}
                title="English (EN)"
              >
                <span className="text-xs leading-none">🇬🇧</span>
                <span>EN</span>
              </button>
            </div>

            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-full bg-pink-50 text-slate-700 hover:text-[#be185d] cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="mt-2 md:hidden">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm spa, thẩm mỹ, trị mụn..."
              className="w-full h-9 pl-8 pr-16 rounded-full border border-pink-200 bg-pink-50/50 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#EB0F51] focus:bg-white"
            />
            <Search className="w-3.5 h-3.5 text-[#EB0F51] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <button
              type="submit"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-3 rounded-full bg-[#EB0F51] text-white text-[11px] font-bold"
            >
              Tìm
            </button>
          </form>

          {/* Filter chips below search bar when user starts typing on mobile */}
          {isTyping && (
            <SearchFilterChips
              filters={activeFilters}
              onChange={handleFiltersChange}
              className="mt-1.5"
            />
          )}
        </div>
      </div>

      {/* Running Marquee Ticker */}
      <div className="bg-gradient-to-r from-pink-50/95 via-white to-pink-50/95 border-t border-b border-pink-100/90 py-1.5 sm:py-2 px-3 sm:px-6 relative overflow-hidden backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#EB0F51] to-[#B42D58] text-white text-[10px] sm:text-[11px] font-black uppercase tracking-wider shrink-0 shadow-xs z-10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-200 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <span>BẢN TIN HOT</span>
          </div>

          <div className="relative flex-1 overflow-hidden">
            <div className="animate-marquee whitespace-nowrap text-xs font-semibold text-slate-700 flex items-center gap-8 py-0.5">
              {renderTickerItems()}
              {renderTickerItems()}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-pink-100 px-4 py-4 space-y-3 shadow-lg">
          {currentUser && (
            <div className="p-3 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (onOpenAccount) onOpenAccount();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 text-left cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#EB0F51] to-[#f43f5e] text-white flex items-center justify-center text-xs font-black group-hover:scale-105 transition-transform">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 group-hover:text-[#EB0F51] transition-colors">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-slate-500">Xem trang tài khoản ›</div>
                </div>
              </button>
              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="text-xs font-bold text-[#EB0F51] hover:underline"
                >
                  Đăng xuất
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            {onOpenLocationModal && (
              <button
                onClick={() => {
                  onOpenLocationModal();
                  setMobileMenuOpen(false);
                }}
                className="col-span-2 p-2.5 rounded-xl bg-pink-50 border border-pink-200 text-xs font-bold text-[#be185d] flex items-center gap-2"
              >
                <MapPin className="h-4 w-4 text-[#EB0F51]" />
                <span>Khu vực: {selectedCity || 'Chọn thành phố'}</span>
              </button>
            )}

            {notifications && (
              <button
                onClick={() => {
                  setIsNotifOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="col-span-2 p-2.5 rounded-xl bg-gradient-to-r from-pink-50 to-pink-100 border border-pink-200 text-xs font-bold text-[#be185d] flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-[#EB0F51]" />
                  <span>Thông báo & Flash Sale</span>
                </span>
                {unreadNotificationsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#EB0F51] text-white text-[10px] font-black">
                    {unreadNotificationsCount} mới
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => {
                onOpenPartnerModal();
                setMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl bg-pink-50 text-xs font-semibold text-[#be185d] text-left"
            >
              🌸 Trở thành đối tác
            </button>
            <button
              onClick={() => {
                onOpenCart();
                setMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl bg-pink-50 text-xs font-semibold text-[#be185d] text-left"
            >
              🛍️ Giỏ hàng ({cartCount})
            </button>
          </div>

          {!currentUser && (
            <div className="flex gap-2 pt-2 border-t border-pink-50">
              <button
                onClick={() => {
                  onOpenAuthModal('register');
                  setMobileMenuOpen(false);
                }}
                className="flex-1 py-2 rounded-xl border border-pink-200 text-xs font-bold text-slate-700 text-center"
              >
                Đăng ký
              </button>
              <button
                onClick={() => {
                  onOpenAuthModal('login');
                  setMobileMenuOpen(false);
                }}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#EB0F51] to-[#B42D58] text-white text-xs font-bold text-center"
              >
                Đăng nhập
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
