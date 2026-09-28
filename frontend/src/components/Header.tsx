import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  ShoppingCart,
  Sparkles,
  Menu,
  X,
  ChevronRight,
  User,
  LogOut,
  Flame,
  Volume2,
  Bell,
  LayoutGrid,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import type { PushNotification } from '../types';
import { getCategoryShortcuts } from '../data/categoryCatalog';
import type { ServiceCategory } from '../types';
import { NotificationCenterDropdown } from './NotificationCenterDropdown';

export interface CurrentUser {
  name: string;
  phone: string;
  avatar?: string;
  points?: number;
}

interface HeaderProps {
  cartCount: number;
  onOpenCart: () => void;
  onOpenPartnerModal: () => void;
  onOpenLocationModal?: () => void;
  onOpenAuthModal: (mode: 'login' | 'register') => void;
  onSearch: (query: string) => void;
  selectedCity?: string;
  currentUser?: CurrentUser | null;
  onLogout?: () => void;
  unreadNotificationsCount?: number;
  notifications?: PushNotification[];
  onMarkAllAsRead?: () => void;
  onMarkAsRead?: (id: string) => void;
  onClearAllNotifications?: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onOpenAccount?: () => void;
  serviceCategories?: ServiceCategory[];
  onSelectServiceCategory?: (category: ServiceCategory) => void;
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
  soundEnabled = true,
  onToggleSound,
  onOpenAccount,
  serviceCategories = [],
  onSelectServiceCategory,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [activeCategorySlug, setActiveCategorySlug] = useState('');

  useEffect(() => {
    if (!activeCategorySlug && serviceCategories.length) {
      setActiveCategorySlug(serviceCategories[0].slug);
    }
  }, [activeCategorySlug, serviceCategories]);

  useEffect(() => {
    if (!isCategoryOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCategoryOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isCategoryOpen]);

  const activeCategory = serviceCategories.find((category) => category.slug === activeCategorySlug) || serviceCategories[0];

  const openCategoryPage = (category: ServiceCategory) => {
    onSelectServiceCategory?.(category);
    setIsCategoryOpen(false);
    setMobileMenuOpen(false);
  };

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchInput);
    setIsSearchFocused(false);
  };

  const handleSelectKeyword = (keyword: string) => {
    setSearchInput(keyword);
    onSearch(keyword);
    setIsSearchFocused(false);
  };

  return (
    <header className="sticky top-0 z-[60] bg-white/95 backdrop-blur-md border-b border-pink-100 shadow-[0_2px_15px_-3px_rgba(244,114,182,0.12)]">
      {/* Top Banner Notice */}
      <div className="relative z-30 border-b border-pink-100 bg-[#FFF0F3] px-4 py-1.5 text-xs font-medium text-[#B42D58] sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-pink-200 bg-white px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider shadow-xs sm:text-[11px]">
              <span className="text-[#EB0F51]">🌸</span>
              <span>{language === 'vi' ? 'Tự tin tỏa sáng' : 'Radiant Beauty'}</span>
            </span>
            <span className="hidden font-medium text-slate-600 sm:inline">
              {language === 'vi' ? (
                <>
                  Đánh thức nét đẹp tự nhiên của bạn –{' '}
                  <span className="font-semibold text-[#B42D58]">
                    Trải nghiệm không gian thư giãn & liệu trình chăm sóc chuẩn chuyên gia!
                  </span>
                </>
              ) : (
                <>
                  Awaken your natural elegance –{' '}
                  <span className="font-semibold text-[#B42D58]">
                    Experience exquisite relaxation and certified specialist beauty care!
                  </span>
                </>
              )}
            </span>
            <span className="max-w-[220px] truncate font-medium text-slate-600 sm:hidden">
              {language === 'vi'
                ? 'Đánh thức nét đẹp tự nhiên cùng chuyên gia!'
                : 'Radiant beauty with certified specialists!'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs shrink-0">
            {currentUser && (
              <span className="hidden font-medium text-slate-500 md:inline">
                Chào mừng <strong className="text-[#B42D58]">{currentUser.name}</strong>
              </span>
            )}
            <a
              href="#categories"
              className="flex items-center gap-1 rounded-full border border-pink-200 bg-white px-2.5 py-0.5 font-bold text-[#B42D58] transition-colors hover:border-pink-300 hover:text-[#EB0F51]"
            >
              <span>{language === 'vi' ? 'Khám phá ngay' : 'Explore Now'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="relative z-30 mx-auto max-w-[1536px] bg-white/95 px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <a href="#" className="flex items-center gap-2 group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-[#B42D58] via-[#D28474] to-[#EB0F51] flex items-center justify-center text-white shadow-md shadow-pink-500/30 group-hover:scale-105 transition-transform duration-300">
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
                <span className="text-[10px] text-pink-600 font-semibold tracking-wider uppercase -mt-1 hidden sm:block">
                  Sắc Đẹp & Spa Uy Tín
                </span>
              </div>
            </a>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsCategoryOpen((open) => !open);
              setIsSearchFocused(false);
            }}
            className={`hidden items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-sm font-extrabold transition lg:inline-flex ${isCategoryOpen ? 'border-[#EB0F51] bg-[#EB0F51] text-white shadow-lg shadow-pink-500/20' : 'border-pink-200 bg-pink-50 text-[#B42D58] hover:border-pink-300 hover:bg-pink-100'}`}
            aria-expanded={isCategoryOpen}
            aria-haspopup="dialog"
          >
            <LayoutGrid className="h-4 w-4" />
            <span>Danh mục</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onOpenLocationModal}
            className="hidden min-[1500px]:flex max-w-40 items-center gap-2 rounded-2xl border border-pink-100 bg-pink-50/70 px-3 py-2 text-left text-xs font-bold text-slate-700 transition hover:border-pink-300 hover:bg-pink-50"
            title="Thay đổi khu vực"
          >
            <span className="text-pink-600">●</span>
            <span className="truncate">{selectedCity || 'Chọn khu vực'}</span>
          </button>

          {/* Search Box with embedded prominent 'Tìm kiếm' button */}
          <div className="relative hidden min-w-0 flex-1 md:block">
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

                {/* Embedded button 'Tìm kiếm' */}
                <button
                  type="submit"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-9 px-4 sm:px-5 rounded-full bg-gradient-to-r from-[#EB0F51] to-[#B42D58] hover:from-[#B42D58] hover:to-[#B42D58] text-white text-xs sm:text-sm font-bold shadow-md shadow-pink-500/20 hover:shadow-pink-500/35 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                >
                  <span>Tìm kiếm</span>
                </button>
              </div>
            </form>

            {/* Quick Keyword Dropdown */}
            {isSearchFocused && (
              <div
                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-pink-100 p-3 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
                  Gợi ý tìm kiếm phổ biến
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {quickKeywords.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => handleSelectKeyword(kw)}
                      className="px-3 py-1 rounded-full bg-pink-50/80 hover:bg-[#EB0F51] text-[#B42D58] hover:text-white text-xs font-medium transition-colors cursor-pointer"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons (Tightly grouped, balanced, with VI/EN button to the right of cart) */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Trở thành đối tác */}
            <button
              onClick={onOpenPartnerModal}
              className="hidden min-[1700px]:inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-pink-200 text-xs font-semibold text-[#B42D58] bg-pink-50/70 hover:bg-pink-100 hover:border-pink-300 transition-all whitespace-nowrap cursor-pointer"
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
                  className="flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-full bg-pink-50/90 border border-pink-200 text-xs font-bold text-[#B42D58] hover:bg-pink-100 transition-all shadow-xs cursor-pointer group"
                  title={`Đang đăng nhập: ${currentUser.name}. Bấm để mở trang Quản lý tài khoản.`}
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-[#EB0F51] to-[#D28474] text-white flex items-center justify-center text-[10px] font-black shadow-xs group-hover:scale-105 transition-transform">
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
                  className="hidden sm:inline-flex px-2.5 py-1.5 rounded-full text-xs font-semibold text-slate-700 hover:text-[#B42D58] hover:bg-pink-50 transition-colors cursor-pointer"
                >
                  {language === 'vi' ? 'Đăng ký' : 'Sign up'}
                </button>
                <button
                  onClick={() => onOpenAuthModal('login')}
                  className="px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#EB0F51] to-[#B42D58] hover:from-[#B42D58] hover:to-[#B42D58] shadow-sm shadow-pink-500/25 transition-all whitespace-nowrap cursor-pointer"
                >
                  {language === 'vi' ? 'Đăng nhập' : 'Log in'}
                </button>
              </div>
            )}

            {/* Notification Bell with interactive hover ("dí vào hiển thị") & click trigger */}
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
                  className="relative p-2 rounded-full bg-pink-50 hover:bg-pink-100 text-[#B42D58] border border-pink-200/70 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title="Thông báo tài khoản và lịch hẹn"
                  aria-label="Thông báo"
                >
                  <Bell className="w-4 h-4 text-[#EB0F51]" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#EB0F51] text-white text-[9px] font-black flex items-center justify-center border-2 border-white shadow-xs">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </button>

                {/* Dropdown rendered directly relative to the bell button */}
                <NotificationCenterDropdown
                  isOpen={isNotifOpen}
                  onClose={() => setIsNotifOpen(false)}
                  onMouseEnter={handleMouseEnterNotif}
                  onMouseLeave={handleMouseLeaveNotif}
                  notifications={notifications}
                  onMarkAllAsRead={onMarkAllAsRead || (() => {})}
                  onMarkAsRead={onMarkAsRead || (() => {})}
                  onClearAll={onClearAllNotifications || (() => {})}
                  soundEnabled={soundEnabled}
                  onToggleSound={onToggleSound || (() => {})}
                />
              </div>
            )}

            {/* Cart icon */}
            <button
              onClick={onOpenCart}
              className="relative p-2 rounded-full bg-pink-50 hover:bg-pink-100 text-[#B42D58] border border-pink-200/70 transition-colors cursor-pointer"
              title="Giỏ dịch vụ & Lịch hẹn"
            >
              <ShoppingCart className="w-4 h-4 text-[#EB0F51]" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-[#EB0F51] text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Language Toggle VN / EN with Country Flags (Placed to the right of Cart) */}
            <div className="hidden items-center rounded-full border border-pink-200 bg-pink-50 p-0.5 text-[11px] font-bold shadow-xs xl:flex">
              <button
                type="button"
                onClick={() => setLanguage('vi')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                  language === 'vi'
                    ? 'bg-[#EB0F51] text-white shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-[#B42D58]'
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
                    : 'text-slate-600 hover:text-[#B42D58]'
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
              className="md:hidden p-2 rounded-full bg-pink-50 text-slate-700 hover:text-[#B42D58] cursor-pointer"
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
        </div>
      </div>

      {isCategoryOpen && createPortal(
        <button
          type="button"
          aria-label="Đóng danh mục dịch vụ"
          onClick={() => setIsCategoryOpen(false)}
          className="fixed inset-0 z-50 cursor-default bg-slate-950/45 backdrop-blur-[5px]"
        />,
        document.body,
      )}

      {isCategoryOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Danh mục dịch vụ làm đẹp"
          className="absolute left-1/2 top-full z-40 w-[min(1120px,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-b-[1.75rem] border border-pink-100 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)] sm:mt-2 sm:rounded-[1.75rem]"
        >
          <div className="flex items-center justify-between border-b border-pink-100 bg-[#FFF0F3] px-4 py-3 sm:px-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#EB0F51]">BeautyLink services</p>
              <h2 className="text-lg font-black text-slate-900 sm:text-xl">Bạn đang cần dịch vụ nào?</h2>
            </div>
            <button type="button" onClick={() => setIsCategoryOpen(false)} className="grid h-9 w-9 place-items-center rounded-full border border-pink-200 bg-white text-slate-500 transition hover:border-pink-300 hover:text-[#EB0F51]" aria-label="Đóng">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid max-h-[min(640px,calc(100vh-9rem))] overflow-y-auto md:grid-cols-[310px_1fr]">
            <div className="border-b border-slate-100 p-3 md:border-b-0 md:border-r md:p-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
                {serviceCategories.map((category) => {
                  const selected = category.slug === activeCategory?.slug;
                  return (
                    <button
                      key={category.slug}
                      type="button"
                      onClick={() => setActiveCategorySlug(category.slug)}
                      className={`group flex min-w-0 items-center gap-3 rounded-2xl border p-2.5 text-left transition ${selected ? 'border-pink-200 bg-pink-50 shadow-sm' : 'border-transparent hover:border-slate-100 hover:bg-slate-50'}`}
                      aria-pressed={selected}
                    >
                      <img src={category.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm font-extrabold ${selected ? 'text-[#B42D58]' : 'text-slate-800'}`}>{category.name}</span>
                        <span className="hidden truncate text-[11px] text-slate-500 sm:block">{category.description}</span>
                      </span>
                      <ChevronRight className={`hidden h-4 w-4 shrink-0 md:block ${selected ? 'text-[#EB0F51]' : 'text-slate-300 group-hover:text-slate-500'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {activeCategory && (
              <div className="p-4 sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-[#EB0F51]">{activeCategory.name}</span>
                    <h3 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">Chọn dịch vụ phù hợp với bạn</h3>
                    <p className="mt-1 text-sm text-slate-500">{activeCategory.description}</p>
                  </div>
                  <img src={activeCategory.imageUrl} alt="" className="hidden h-20 w-28 rounded-2xl object-cover sm:block" />
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {getCategoryShortcuts(activeCategory.slug).map((item) => (
                    <button key={item.label} type="button" onClick={() => openCategoryPage(activeCategory)} className="group rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left transition hover:-translate-y-0.5 hover:border-pink-200 hover:bg-pink-50 hover:shadow-md">
                      <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-white text-xl shadow-sm">{item.icon}</span>
                      <span className="block text-sm font-extrabold text-slate-800 group-hover:text-[#B42D58]">{item.label}</span>
                      <span className="mt-1 hidden text-[11px] leading-4 text-slate-500 sm:block">{item.caption}</span>
                    </button>
                  ))}
                </div>

                <button type="button" onClick={() => openCategoryPage(activeCategory)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#EB0F51] to-[#B42D58] px-5 py-3 text-sm font-black text-white shadow-lg shadow-pink-500/20 transition hover:-translate-y-0.5 hover:shadow-pink-500/30 sm:w-auto">
                  Xem tất cả dịch vụ {activeCategory.name}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="relative z-30 md:hidden bg-white border-t border-pink-100 px-4 py-4 space-y-3 shadow-lg">
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
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#EB0F51] to-[#D28474] text-white flex items-center justify-center text-xs font-black group-hover:scale-105 transition-transform">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 group-hover:text-[#EB0F51] transition-colors">{currentUser.name}</div>
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
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setIsCategoryOpen(true);
              }}
              className="col-span-2 flex items-center justify-between rounded-xl border border-pink-200 bg-pink-50 p-2.5 text-left text-xs font-bold text-[#B42D58]"
            >
              <span className="flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-[#EB0F51]" /> Danh mục dịch vụ</span>
              <ChevronRight className="h-4 w-4" />
            </button>
            {notifications && (
              <button
                onClick={() => {
                  setIsNotifOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="col-span-2 p-2.5 rounded-xl bg-gradient-to-r from-pink-50 to-pink-100 border border-pink-200 text-xs font-bold text-[#B42D58] flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-[#EB0F51]" />
                  <span>Thông báo</span>
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
              className="p-2.5 rounded-xl bg-pink-50 text-xs font-semibold text-[#B42D58] text-left"
            >
              🌸 Trở thành đối tác
            </button>
            <button
              onClick={() => {
                onOpenCart();
                setMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl bg-pink-50 text-xs font-semibold text-[#B42D58] text-left"
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
