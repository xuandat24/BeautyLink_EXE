import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  LogOut,
  User,
  Phone,
  Mail,
  ShieldCheck,
  Gift,
  Calendar,
  Star,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Clock,
  MapPin,
  RefreshCw,
  Award,
  Bell,
  Check,
  ShoppingBag,
} from 'lucide-react';
import { getApiErrorMessage } from '../lib/api';
import { platformApi } from '../services/platformApi';
import type { BookingRecord, BookingReview, CurrentUser, ReviewTarget } from '../types';
import { BookingReviewModal } from './BookingReviewModal';

const bookingStatusLabel: Record<BookingRecord['status'], string> = {
  PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', COMPLETED: 'Đã hoàn thành', CANCELLED: 'Đã hủy',
};

const appointmentLabel = (booking: BookingRecord) => {
  const date = new Date(`${booking.appointmentDate}T00:00:00`).toLocaleDateString('vi-VN');
  return `${booking.startTime.slice(0, 5)}, ${date}`;
};
const formatMoney = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

interface AccountPageProps {
  currentUser: CurrentUser | null;
  onBackToHome: () => void;
  onLogoutConfirm: () => void;
  onNavigateLogin: () => void;
  onOpenAppointments: () => void;
  onOpenVouchers: () => void;
  onOpenShop: (supplierId: number, supplierName: string) => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  currentUser,
  onBackToHome,
  onLogoutConfirm,
  onNavigateLogin,
  onOpenAppointments,
  onOpenVouchers,
  onOpenShop,
}) => {
  // If user is already logged out, display the Logout Success screen
  const [isLoggedOutSuccess, setIsLoggedOutSuccess] = useState(!currentUser);
  const [showConfirmLogoutModal, setShowConfirmLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(Boolean(currentUser));
  const [bookingsError, setBookingsError] = useState('');
  const [reviewBooking, setReviewBooking] = useState<BookingRecord | null>(null);

  // Active tab inside Account Page
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'security' | 'logout'>('overview');

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    setBookingsLoading(true);
    setBookingsError('');
    platformApi.myBookings()
      .then((result) => { if (active) setBookings(result); })
      .catch((requestError) => { if (active) setBookingsError(getApiErrorMessage(requestError, 'Không thể tải lịch hẹn.')); })
      .finally(() => { if (active) setBookingsLoading(false); });
    return () => { active = false; };
  }, [currentUser?.id]);

  const upcomingBookings = useMemo(() => bookings.filter((booking) => booking.status === 'CONFIRMED' || booking.status === 'PENDING'), [bookings]);
  const recentBookings = useMemo(() => bookings.slice(0, 3), [bookings]);

  const handleExecuteLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      setIsLoggingOut(false);
      setShowConfirmLogoutModal(false);
      setIsLoggedOutSuccess(true);
      onLogoutConfirm();
    }, 600);
  };

  const handleReviewSaved = (targetType: ReviewTarget, review: BookingReview) => {
    setBookings((items) => items.map((booking) => booking.id !== review.bookingId ? booking : {
      ...booking,
      ...(targetType === 'SERVICE' ? { serviceReview: review } : { supplierReview: review }),
    }));
    setReviewBooking((booking) => booking?.id === review.bookingId ? {
      ...booking,
      ...(targetType === 'SERVICE' ? { serviceReview: review } : { supplierReview: review }),
    } : booking);
  };

  // If user is logged out, render the Dedicated Logout Success Page
  if (isLoggedOutSuccess || !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50/70 via-white to-pink-50/50 flex flex-col justify-between">
        {/* Top Navbar */}
        <header className="w-full bg-white/95 backdrop-blur-md border-b border-pink-100 py-3.5 px-4 sm:px-8 sticky top-0 z-30 shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <button
              type="button"
              onClick={onBackToHome}
              className="flex items-center gap-2.5 group cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#B42D58] via-[#D28474] to-[#EB0F51] flex items-center justify-center text-white shadow-md shadow-pink-500/25 group-hover:scale-105 transition-transform duration-300">
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-slate-900 group-hover:text-[#EB0F51] transition-colors leading-none">
                  Beauty<span className="text-[#EB0F51]">Pink</span>
                </span>
                <span className="text-[11px] text-pink-600 font-semibold tracking-wide mt-0.5">
                  Nền tảng làm đẹp & Spa chuẩn 5 sao
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-slate-700 hover:text-[#B42D58] bg-pink-50/80 hover:bg-pink-100 border border-pink-200 transition-all cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Về trang chủ</span>
            </button>
          </div>
        </header>

        {/* Main Content: Dedicated Logout Success Screen */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-pink-100 p-8 sm:p-10 text-center animate-in zoom-in-95 duration-200">
            {/* Animated Success Badge */}
            <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-500 border-4 border-emerald-100 flex items-center justify-center mx-auto mb-5 shadow-sm">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>

            <span className="px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-[11px] font-extrabold uppercase tracking-wider inline-block mb-3">
              Đã đăng xuất an toàn
            </span>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight mb-2">
              Hẹn gặp lại bạn lần sau!
            </h1>

            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-sm mx-auto mb-8">
              Tài khoản của bạn đã được đăng xuất an toàn khỏi hệ thống BeautyPink trên thiết bị này. Các dữ liệu lịch hẹn và voucher của bạn luôn được bảo vệ an toàn.
            </p>

            {/* Action Buttons */}
            <div className="space-y-3 max-w-xs mx-auto">
              <button
                type="button"
                onClick={onNavigateLogin}
                className="w-full py-3 px-5 rounded-full bg-gradient-to-r from-[#EB0F51] to-[#B42D58] hover:from-[#B42D58] hover:to-[#B42D58] text-white text-xs sm:text-sm font-bold shadow-md shadow-pink-600/25 hover:shadow-pink-600/35 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <span>Đăng nhập lại ngay</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onBackToHome}
                className="w-full py-2.5 px-5 rounded-full bg-pink-50 hover:bg-pink-100 text-slate-700 hover:text-[#B42D58] border border-pink-200 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Trở về Trang chủ BeautyPink</span>
              </button>
            </div>
          </div>
        </main>

        <footer className="py-4 px-4 text-center text-xs text-slate-400 border-t border-pink-100/60 bg-white/60">
          © 2026 BeautyPink. Toàn bộ thông tin được bảo mật và mã hóa chuẩn SSL 256-bit.
        </footer>
      </div>
    );
  }

  // If user is currently logged in, render the Dedicated Account Dashboard with Logout Panel
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50/60 via-white to-pink-50/40 flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="w-full bg-white/95 backdrop-blur-md border-b border-pink-100 py-3.5 px-4 sm:px-8 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToHome}
            className="flex items-center gap-2.5 group cursor-pointer text-left"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#B42D58] via-[#D28474] to-[#EB0F51] flex items-center justify-center text-white shadow-md shadow-pink-500/25 group-hover:scale-105 transition-transform duration-300">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-slate-900 group-hover:text-[#EB0F51] transition-colors leading-none">
                Beauty<span className="text-[#EB0F51]">Pink</span>
              </span>
              <span className="text-[11px] text-pink-600 font-semibold tracking-wide mt-0.5">
                Trang Quản lý Tài khoản & Hội viên
              </span>
            </div>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-slate-700 hover:text-[#B42D58] bg-pink-50/80 hover:bg-pink-100 border border-pink-200 transition-all cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại trang chủ</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfirmLogoutModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 transition-all cursor-pointer shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Account Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {/* Profile Hero Card */}
        <div className="bg-gradient-to-r from-[#831843] via-[#B42D58] to-[#EB0F51] rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-6 relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-60 h-60 rounded-full bg-white/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
              {/* Avatar */}
              <div className="relative">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white text-[#B42D58] flex items-center justify-center font-black text-3xl shadow-xl border-4 border-white/30">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center text-xs font-black shadow-md border-2 border-white" title="Hội viên Vàng VIP">
                  ★
                </div>
              </div>

              {/* Info */}
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-bold text-amber-200 mb-1.5">
                  <Award className="w-3.5 h-3.5" />
                  <span>Hội viên Vàng VIP</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {currentUser.name}
                </h1>
                <p className="text-xs text-pink-100/90 font-medium mt-0.5">
                  {currentUser.phone || '0988 123 456'} · Thành viên từ tháng 01/2026
                </p>
              </div>
            </div>

            {/* Quick Points Widget */}
            <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5 text-center sm:text-right shrink-0">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-pink-200 block">
                Điểm thưởng PinkPoints
              </span>
              <div className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight my-0.5">
                {currentUser.loyaltyPoints ?? 0} <span className="text-sm font-bold text-white">xu</span>
              </div>
              <p className="text-[11px] text-pink-100/80">Quy đổi = 250.000đ dịch vụ Spa</p>
            </div>
          </div>
        </div>

        {/* 4 Stat Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4 mb-8">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-pink-100 shadow-sm flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-pink-100 text-[#EB0F51] flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-800">{bookingsLoading ? '—' : upcomingBookings.length}</div>
              <div className="text-xs font-semibold text-slate-500">Lịch hẹn sắp tới</div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-pink-100 shadow-sm flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-800">3</div>
              <div className="text-xs font-semibold text-slate-500">Voucher khả dụng</div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-pink-100 shadow-sm flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-800">100%</div>
              <div className="text-xs font-semibold text-slate-500">Bảo mật thông tin</div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-pink-100 shadow-sm flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <Star className="w-6 h-6 fill-purple-600" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-800">VIP</div>
              <div className="text-xs font-semibold text-slate-500">Hạng Hội Viên</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-pink-100 gap-2 mb-6 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-[#EB0F51] text-[#B42D58]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Tổng quan & Lịch hẹn
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-[#EB0F51] text-[#B42D58]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Thông tin cá nhân
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-[#EB0F51] text-[#B42D58]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Bảo mật & Mật khẩu
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logout')}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'logout'
                ? 'border-rose-500 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-rose-600'
            }`}
          >
            Đăng xuất tài khoản
          </button>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-3xl border border-pink-100 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-extrabold text-slate-800">Lịch hẹn làm đẹp gần đây</h3>
                  <button
                    type="button"
                    onClick={onOpenAppointments}
                    className="text-xs font-bold text-[#B42D58] hover:underline"
                  >
                    Xem tất cả lịch hẹn
                  </button>
                </div>

                <div className="space-y-3">
                  {bookingsLoading && <div className="flex items-center justify-center gap-2 rounded-2xl bg-pink-50/60 p-8 text-xs font-bold text-[#B42D58]"><RefreshCw className="h-4 w-4 animate-spin" /> Đang tải lịch hẹn từ hệ thống...</div>}
                  {bookingsError && <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs font-semibold text-rose-700">{bookingsError}</div>}
                  {!bookingsLoading && !bookingsError && recentBookings.length === 0 && <div className="rounded-2xl border border-dashed border-pink-200 bg-pink-50/40 p-8 text-center"><Calendar className="mx-auto h-7 w-7 text-pink-400" /><p className="mt-2 text-sm font-bold text-slate-700">Bạn chưa có lịch hẹn</p><button type="button" onClick={onBackToHome} className="mt-3 text-xs font-black text-[#B42D58] hover:underline">Khám phá dịch vụ</button></div>}
                  {!bookingsLoading && recentBookings.map((booking) => (
                    <article key={booking.id} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-2xl border border-pink-100 bg-pink-50/60 p-3 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:p-4">
                      <div className="relative h-[72px] w-[72px] overflow-hidden rounded-2xl bg-gradient-to-br from-pink-100 to-rose-50 sm:h-[88px] sm:w-[88px]">
                        <div className="absolute inset-0 grid place-items-center"><Sparkles className="h-7 w-7 text-pink-400" /></div>
                        {(booking.serviceImageUrl || booking.supplierImageUrl) && <img src={booking.serviceImageUrl || booking.supplierImageUrl || ''} alt={booking.serviceName} className="relative h-full w-full object-cover" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${booking.status === 'CANCELLED' ? 'bg-slate-200 text-slate-600' : booking.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{bookingStatusLabel[booking.status]}</span>
                          <span className="text-[11px] font-semibold text-slate-400">{booking.bookingCode}</span>
                        </div>
                        <h4 className="truncate text-sm font-black text-slate-900 sm:text-base">{booking.serviceName}</h4>
                        <button type="button" onClick={() => onOpenShop(booking.supplierId, booking.supplierName)} className="mt-1 inline-flex max-w-full items-center gap-1 text-left text-xs font-extrabold text-[#B42D58] hover:underline"><ShoppingBag className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{booking.supplierName}</span><ChevronRight className="h-3 w-3 shrink-0" /></button>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-500"><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-[#EB0F51]" />{appointmentLabel(booking)}</span><span>· {booking.practitionerName}</span></div>
                        <p className="mt-1 truncate text-[11px] text-slate-400"><MapPin className="mr-1 inline h-3 w-3" />{booking.supplierAddress}</p>
                      </div>
                      <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 border-t border-pink-100 pt-3 sm:col-span-1 sm:block sm:border-0 sm:pt-0 sm:text-right">
                        <p className="text-sm font-black text-[#B42D58]">{formatMoney(booking.totalAmount)}</p>
                        <div className="flex flex-wrap items-center gap-2 sm:mt-3 sm:justify-end">
                          {booking.reviewEligible && <button type="button" onClick={() => setReviewBooking(booking)} className="inline-flex items-center gap-1 rounded-full bg-[#EB0F51] px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#B42D58]"><Star className="h-3.5 w-3.5" />{booking.serviceReview || booking.supplierReview ? 'Sửa đánh giá' : 'Đánh giá'}</button>}
                          <button type="button" onClick={onOpenAppointments} className="rounded-full border border-pink-200 bg-white px-3.5 py-2 text-xs font-bold text-[#B42D58] hover:bg-pink-100">Chi tiết</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="space-y-4">
              <div className="bg-white rounded-3xl border border-pink-100 p-6 shadow-sm">
                <h3 className="text-base font-extrabold text-slate-800 mb-3">Ví Voucher & Quà tặng</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Bạn có 3 mã ưu đãi đang khả dụng. Hãy áp dụng ngay khi đặt chỗ để nhận ưu đãi tốt nhất!
                </p>
                <button
                  type="button"
                  onClick={onOpenVouchers}
                  className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-pink-50 to-pink-100 hover:from-pink-100 hover:to-pink-200 border border-pink-200 text-xs font-bold text-[#B42D58] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Gift className="w-4 h-4 text-[#EB0F51]" />
                  <span>Mở ví Voucher của tôi</span>
                </button>
              </div>

              {/* Dedicated Logout Action Prompt */}
              <div className="bg-rose-50/70 rounded-3xl border border-rose-200/80 p-6">
                <div className="flex items-center gap-2.5 text-rose-700 mb-2">
                  <LogOut className="w-5 h-5" />
                  <h4 className="text-sm font-extrabold">Đăng xuất khỏi thiết bị</h4>
                </div>
                <p className="text-xs text-rose-600/90 leading-relaxed mb-4">
                  Bạn muốn đăng xuất khỏi tài khoản trên thiết bị này? Bạn có thể đăng nhập lại bất kỳ lúc nào.
                </p>
                <button
                  type="button"
                  onClick={() => setShowConfirmLogoutModal(true)}
                  className="w-full py-2.5 px-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất ngay</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Profile Info */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl bg-white rounded-3xl border border-pink-100 p-6 sm:p-8 shadow-sm">
            <h3 className="text-lg font-extrabold text-slate-800 mb-4">Thông tin cá nhân</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Họ và tên</label>
                <input
                  type="text"
                  readOnly
                  value={currentUser.name}
                  className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-2xl border border-pink-200 bg-slate-50 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Số điện thoại</label>
                <input
                  type="text"
                  readOnly
                  value={currentUser.phone || '0988 123 456'}
                  className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-2xl border border-pink-200 bg-slate-50 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Email liên hệ</label>
                <input
                  type="email"
                  readOnly
                  value="phuongthao.beauty@gmail.com"
                  className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-2xl border border-pink-200 bg-slate-50 font-medium"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#EB0F51] to-[#B42D58] text-white text-xs font-bold shadow-md shadow-pink-600/25"
                >
                  Cập nhật thông tin
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Security & Password */}
        {activeTab === 'security' && (
          <div className="max-w-2xl bg-white rounded-3xl border border-pink-100 p-6 sm:p-8 shadow-sm">
            <h3 className="text-lg font-extrabold text-slate-800 mb-4">Bảo mật & Đổi mật khẩu</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-2xl border border-pink-200"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-2xl border border-pink-200"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#EB0F51] to-[#B42D58] text-white text-xs font-bold shadow-md shadow-pink-600/25"
                >
                  Lưu mật khẩu mới
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Dedicated Logout View */}
        {activeTab === 'logout' && (
          <div className="max-w-xl bg-white rounded-3xl border border-rose-200 p-6 sm:p-8 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <LogOut className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-extrabold text-slate-900 mb-2">Đăng xuất tài khoản</h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-6">
              Bạn có chắc chắn muốn đăng xuất khỏi tài khoản <strong className="text-slate-800">{currentUser.name}</strong>? Khi đăng xuất, thông tin đăng nhập trên thiết bị này sẽ được xóa và bạn có thể đăng nhập lại bất cứ lúc nào.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExecuteLogout}
                disabled={isLoggingOut}
                className="py-3 px-6 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang đăng xuất...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    <span>Xác nhận Đăng xuất</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="py-3 px-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Logout Confirmation Dialog (When triggered from topbar or quick widget) */}
      {reviewBooking && <BookingReviewModal booking={reviewBooking} onClose={() => setReviewBooking(null)} onSaved={handleReviewSaved} />}

      {showConfirmLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 text-center animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black text-slate-900 mb-1">Xác nhận đăng xuất?</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Bạn có chắc chắn muốn đăng xuất khỏi tài khoản <strong>{currentUser.name}</strong> trên thiết bị này?
            </p>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmLogoutModal(false)}
                className="flex-1 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Ở lại
              </button>
              <button
                type="button"
                onClick={handleExecuteLogout}
                disabled={isLoggingOut}
                className="flex-1 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-md shadow-rose-600/30 disabled:opacity-50"
              >
                {isLoggingOut ? 'Đang thoát...' : 'Đăng xuất'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simple Footer */}
      <footer className="py-4 px-4 text-center text-xs text-slate-400 border-t border-pink-100/60 bg-white/60">
        © 2026 BeautyPink. Toàn bộ thông tin được bảo mật và mã hóa chuẩn SSL 256-bit.
      </footer>
    </div>
  );
};
