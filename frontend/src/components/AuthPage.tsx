import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Sparkles,
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
  Store,
  ArrowRight,
  CheckCircle2,
  Award,
  Check,
  Gift,
  HeartHandshake,
  Star,
  Clock,
  Radio,
  CreditCard,
  ChevronRight,
} from 'lucide-react';
import { CurrentUser } from '../types';
import { beautyApi, getApiErrorMessage } from '../services/beautyApi';
import { customerAuthSchema, FieldErrors, zodFieldErrors } from '../lib/validation';
import { FieldError } from './FieldError';

interface AuthPageProps {
  initialMode: 'login' | 'register';
  onBackToHome: () => void;
  onSuccess: (user: CurrentUser) => void;
  onNavigateSupplierRegister?: () => void;
}

const LIVE_BOOKINGS = [
  {
    id: 1,
    name: 'Phương Thảo',
    service: 'Liệu trình Trẻ hóa da Meso Thụy Sĩ',
    salon: 'Gangnam Luxury Clinic',
    time: 'Vừa xong · 1 phút trước',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    badge: 'Đã xác nhận 5★',
  },
  {
    id: 2,
    name: 'Khánh Linh',
    service: 'Gội đầu Dưỡng sinh Thảo mộc Cổ truyền',
    salon: 'An Yên Beauty Spa',
    time: '2 phút trước',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80',
    badge: 'Đã nhận voucher -50K',
  },
  {
    id: 3,
    name: 'Thùy Trang',
    service: 'Aqua Peel Làm sạch sâu & Trị Mụn Chuẩn Y Khoa',
    salon: 'Seoul Medical Spa',
    time: '4 phút trước',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=80',
    badge: 'Khách hàng VIP Gold',
  },
  {
    id: 4,
    name: 'Bảo Trâm',
    service: 'Căng chỉ Collagen Nano & Massage Nâng cơ',
    salon: 'Viện Thẩm Mỹ Quốc Tế',
    time: '6 phút trước',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
    badge: 'Thanh toán trực tuyến qua PayOS',
  },
];

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode,
  onBackToHome,
  onSuccess,
  onNavigateSupplierRegister,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [fullName, setFullName] = useState<string>('');
  const [identifier, setIdentifier] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [verificationChallengeId, setVerificationChallengeId] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [emailCode, setEmailCode] = useState('');

  // Dynamic live booking ticker
  const [activeBookingIndex, setActiveBookingIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBookingIndex((prev) => (prev + 1) % LIVE_BOOKINGS.length);
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validation = customerAuthSchema.safeParse({
      mode,
      fullName,
      identifier,
      email,
      password,
      confirmPassword,
    });
    if (!validation.success) {
      const errors = zodFieldErrors(validation.error);
      setFieldErrors(errors);
      setError('Vui lòng kiểm tra các trường được đánh dấu.');
      return;
    }
    setFieldErrors({});

    const cleanPhone = identifier.replace(/[\s.-]/g, '');

    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await beautyApi.login(identifier.trim(), password);
        const mappedUser: CurrentUser = {
          id: res.user.id,
          name: res.user.fullName || res.user.name || 'Khách hàng',
          phone: res.user.phone,
          email: res.user.email,
          role: res.user.role || 'CUSTOMER',
          memberTier: 'Gold',
          loyaltyPoints: 350,
          points: 350,
        };
        onSuccess(mappedUser);
      } else {
        if (!verificationChallengeId) {
          const challenge = await beautyApi.startRegistrationVerification({
            phone: cleanPhone,
            email: email.trim() || undefined,
          });
          setVerificationChallengeId(challenge.challengeId);
          setError('Mã OTP đã được gửi. Vui lòng nhập mã để xác minh quyền sở hữu liên hệ.');
          return;
        }
        const verification = await beautyApi.confirmRegistrationVerification({
          challengeId: verificationChallengeId,
          phoneCode,
          emailCode: email.trim() ? emailCode : undefined,
        });
        const res = await beautyApi.register({
          fullName: fullName.trim(),
          phone: cleanPhone,
          email: email.trim() || undefined,
          password,
          verificationToken: verification.registrationToken,
        });
        const mappedUser: CurrentUser = {
          id: res.user.id,
          name: res.user.fullName || res.user.name || fullName.trim(),
          phone: cleanPhone,
          email: email.trim() || undefined,
          role: res.user.role || 'CUSTOMER',
          memberTier: 'Standard',
          loyaltyPoints: 100,
          points: 100,
        };
        onSuccess(mappedUser);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể xác thực tài khoản. Vui lòng kiểm tra lại thông tin.'));
    } finally {
      setLoading(false);
    }
  };

  const activeBooking = LIVE_BOOKINGS[activeBookingIndex];

  return (
    <main className="min-h-screen bg-[#FFF5F7] relative overflow-hidden flex flex-col justify-between">
      {/* Dynamic Animated Ambient Glow Spots */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-pink-300/40 rounded-full blur-3xl pointer-events-none animate-pulse-slow" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 bg-rose-200/50 rounded-full blur-3xl pointer-events-none animate-float-reverse" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl pointer-events-none animate-pulse-slow" />

      {/* Top Navbar */}
      <header className="relative z-20 max-w-7xl w-full mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
        <button
          onClick={onBackToHome}
          type="button"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-[#be185d] bg-white/80 hover:bg-white backdrop-blur-md px-3.5 py-2 rounded-xl border border-pink-200/80 shadow-2xs transition-all cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Về trang chủ</span>
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#be185d] to-[#e1146c] flex items-center justify-center text-white shadow-md shadow-pink-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-slate-900 leading-none">
              Beauty<span className="text-[#be185d]">Pink</span>
            </span>
            <span className="text-[9px] font-bold text-pink-600 block uppercase tracking-wider">
              Chuẩn Y Khoa
            </span>
          </div>
        </div>

        {onNavigateSupplierRegister && (
          <button
            type="button"
            onClick={onNavigateSupplierRegister}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-[#be185d] hover:text-[#9d174d] bg-pink-50 hover:bg-pink-100/80 px-3 py-1.5 rounded-xl border border-pink-200 transition cursor-pointer"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Kênh Người Bán / Spa</span>
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 my-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* ========================================================================= */}
          {/* LEFT: PRIMARY SLEEK AUTH CARD (7 COLS - PROMINENT, SPACIOUS, NOT SQUEEZED) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 flex justify-center order-2 lg:order-1">
            <div className="w-full max-w-xl bg-white/95 backdrop-blur-xl rounded-3xl border-2 border-pink-100 shadow-xl shadow-pink-900/5 p-6 sm:p-9 relative">
              {/* Card Mode Tabs */}
              <div className="flex p-1 bg-pink-50/90 rounded-2xl mb-6 gap-1 border border-pink-200/70">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    mode === 'login'
                      ? 'bg-white text-[#be185d] shadow-sm border border-pink-200/60'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Đăng nhập</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    mode === 'register'
                      ? 'bg-white text-[#be185d] shadow-sm border border-pink-200/60'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Đăng ký thành viên mới</span>
                </button>
              </div>

              {/* Header Title */}
              <div className="mb-5">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>{mode === 'login' ? 'Chào mừng bạn quay lại!' : 'Đăng ký tài khoản làm đẹp'}</span>
                  <span className="text-lg">🌸</span>
                </h1>
                <p className="mt-1 text-xs text-slate-500 font-medium">
                  {mode === 'login'
                    ? 'Nhập thông tin bên dưới để quản lý lịch hẹn & tích điểm đổi voucher 50K.'
                    : 'Nhận ngay Voucher chào mừng 50.000đ và trải nghiệm hàng trăm spa 5 sao.'}
                </p>
              </div>

              {/* SUPPLIER CTA ON REGISTER MODE */}
              {mode === 'register' && onNavigateSupplierRegister && (
                <div className="mb-5 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-pink-50 to-pink-100/90 border border-purple-200/80 shadow-2xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#be185d] to-purple-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Store className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-900">
                            Bạn là Chủ Cơ sở Spa / Clinic?
                          </span>
                          <span className="px-1.5 py-0.5 rounded-full bg-purple-200 text-purple-900 text-[9px] font-black uppercase">
                            ĐỐI TÁC
                          </span>
                        </div>
                        <p className="text-[11px] text-pink-900 mt-0.5 leading-snug">
                          Mở gian hàng & tiếp cận hơn 50,000+ khách hàng tiềm năng 0đ phí đăng ký.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onNavigateSupplierRegister}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-700 to-[#be185d] text-white hover:opacity-95 text-xs font-black shadow-xs transition cursor-pointer shrink-0 flex items-center gap-1"
                    >
                      <span>Đăng ký đối tác</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Form */}
              <form className="space-y-3.5" onSubmit={handleSubmit}>
                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Họ và tên của bạn
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => { setFullName(e.target.value); setFieldErrors((prev) => ({ ...prev, fullName: '' })); }}
                        minLength={2}
                        maxLength={120}
                        aria-invalid={Boolean(fieldErrors.fullName)}
                        aria-describedby="fullName-error"
                        placeholder="Ví dụ: Nguyễn Minh Anh"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-pink-200 focus:border-[#be185d] focus:ring-2 focus:ring-pink-200/50 outline-hidden text-xs text-slate-800 font-medium placeholder:text-slate-400 bg-pink-50/20"
                      />
                    </div>
                    <FieldError id="fullName-error" message={fieldErrors.fullName} />
                  </div>
                )}

                {mode === 'register' && verificationChallengeId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">OTP số điện thoại</label>
                      <input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6}
                        value={phoneCode} onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, ''))}
                        className="w-full rounded-xl border border-emerald-200 px-3 py-2.5 text-xs font-bold tracking-[0.3em] outline-hidden focus:ring-2 focus:ring-emerald-200"
                        placeholder="000000" />
                    </div>
                    {email.trim() && <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">OTP email</label>
                      <input inputMode="numeric" required pattern="[0-9]{6}" maxLength={6}
                        value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, ''))}
                        className="w-full rounded-xl border border-emerald-200 px-3 py-2.5 text-xs font-bold tracking-[0.3em] outline-hidden focus:ring-2 focus:ring-emerald-200"
                        placeholder="000000" />
                    </div>}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {mode === 'login' ? 'Số điện thoại hoặc Email' : 'Số điện thoại đăng ký'}
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => { setIdentifier(e.target.value); setVerificationChallengeId(''); setPhoneCode(''); setEmailCode(''); setFieldErrors((prev) => ({ ...prev, identifier: '' })); }}
                      maxLength={254}
                      aria-invalid={Boolean(fieldErrors.identifier)}
                      aria-describedby="identifier-error"
                      placeholder={mode === 'login' ? '0901234567 hoặc user@example.com' : '0901234567'}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-pink-200 focus:border-[#be185d] focus:ring-2 focus:ring-pink-200/50 outline-hidden text-xs text-slate-800 font-medium placeholder:text-slate-400 bg-pink-50/20"
                    />
                  </div>
                  <FieldError id="identifier-error" message={fieldErrors.identifier} />
                </div>

                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email nhận hóa đơn & voucher <span className="text-slate-400 font-normal">(Không bắt buộc)</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setVerificationChallengeId(''); setPhoneCode(''); setEmailCode(''); setFieldErrors((prev) => ({ ...prev, email: '' })); }}
                        maxLength={254}
                        aria-invalid={Boolean(fieldErrors.email)}
                        aria-describedby="email-error"
                        placeholder="name@example.com"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-pink-200 focus:border-[#be185d] focus:ring-2 focus:ring-pink-200/50 outline-hidden text-xs text-slate-800 font-medium placeholder:text-slate-400 bg-pink-50/20"
                      />
                    </div>
                    <FieldError id="email-error" message={fieldErrors.email} />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">Mật khẩu</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => alert('Vui lòng liên hệ hotline 1900 8899 để lấy lại mật khẩu.')}
                        className="text-[11px] font-bold text-[#be185d] hover:underline cursor-pointer"
                      >
                        Quên mật khẩu?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setFieldErrors((prev) => ({ ...prev, password: '' })); }}
                      minLength={8}
                      maxLength={72}
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby="password-error"
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-pink-200 focus:border-[#be185d] focus:ring-2 focus:ring-pink-200/50 outline-hidden text-xs text-slate-800 font-medium bg-pink-50/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <FieldError id="password-error" message={fieldErrors.password} />
                </div>

                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Xác nhận lại mật khẩu
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((prev) => ({ ...prev, confirmPassword: '' })); }}
                        minLength={8}
                        maxLength={72}
                        aria-invalid={Boolean(fieldErrors.confirmPassword)}
                        aria-describedby="confirmPassword-error"
                        placeholder="••••••••"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-pink-200 focus:border-[#be185d] focus:ring-2 focus:ring-pink-200/50 outline-hidden text-xs text-slate-800 font-medium bg-pink-50/20"
                      />
                    </div>
                    <FieldError id="confirmPassword-error" message={fieldErrors.confirmPassword} />
                  </div>
                )}

                {/* Remember me checkbox */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded-md border-pink-300 text-[#be185d] focus:ring-pink-200"
                    />
                    <span className="text-slate-600 font-medium">Ghi nhớ đăng nhập trên thiết bị này</span>
                  </label>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2 animate-in fade-in">
                    <ShieldCheck className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-500 via-[#db2777] to-[#be185d] text-white text-xs sm:text-sm font-black shadow-lg shadow-pink-500/25 hover:opacity-95 hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang xử lý dữ liệu...</span>
                    </>
                  ) : (
                    <>
                      <span>{mode === 'login' ? 'Đăng nhập ngay' : verificationChallengeId ? 'Xác minh OTP & đăng ký' : 'Gửi mã xác minh OTP'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT: DYNAMIC ANIMATED SHOWCASE (5 COLS - MOTION, HIGHLIGHTS, BEAUTIFUL) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 space-y-4 order-1 lg:order-2">
            {/* 1. REAL-TIME TICKER (CHUYỂN ĐỘNG LIÊN TỤC VỚI HIỆU ỨNG TRỰC TIẾP) */}
            <div className="p-4 rounded-3xl bg-white/90 backdrop-blur-md border border-pink-200 shadow-md relative overflow-hidden">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span className="text-[11px] font-black uppercase text-emerald-800 tracking-wider">
                    Hoạt động đặt lịch trực tiếp
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  {activeBookingIndex + 1}/{LIVE_BOOKINGS.length}
                </span>
              </div>

              {/* Animated Booking Notification Item */}
              <div
                key={activeBooking.id}
                className="flex items-center gap-3 p-2.5 rounded-2xl bg-gradient-to-r from-pink-50/70 to-rose-50/50 border border-pink-100 animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <img
                  src={activeBooking.avatar}
                  alt={activeBooking.name}
                  className="w-10 h-10 rounded-xl object-cover border border-pink-300 shadow-xs shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black text-slate-900 truncate">
                      {activeBooking.name}
                    </span>
                    <span className="text-[9px] font-bold text-[#be185d] bg-pink-100 px-1.5 py-0.5 rounded-md shrink-0">
                      {activeBooking.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-700 font-medium truncate mt-0.5">
                    {activeBooking.service}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                    <span>{activeBooking.salon}</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-bold">{activeBooking.time}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. HOLOGRAPHIC VIP PRIVILEGE CARD WITH FLOATING MOTION */}
            <div className="relative animate-float-slow group cursor-default">
              {/* Outer Glow */}
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-pink-500 via-purple-500 to-amber-500 opacity-30 blur-lg group-hover:opacity-50 transition duration-500" />

              <div className="relative rounded-3xl p-6 bg-gradient-to-br from-slate-900 via-[#4c0519] to-[#be185d] text-white shadow-2xl border border-white/20 overflow-hidden">
                {/* Holographic Shimmer Streak */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300 font-black">
                      <Sparkles className="w-4 h-4 text-amber-300" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono tracking-widest text-pink-200 uppercase block">
                        BeautyLink Privilege
                      </span>
                      <span className="text-xs font-black text-white">Thẻ Hội Viên VIP Diamond</span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-300 text-[10px] font-black uppercase">
                    Ưu đãi trọn đời
                  </span>
                </div>

                {/* Chip Icon Simulation */}
                <div className="w-9 h-7 rounded-md bg-gradient-to-tr from-amber-300 to-amber-100 border border-amber-400 shadow-inner mb-4 flex items-center justify-center">
                  <div className="w-6 h-4 border border-amber-600/40 rounded-xs" />
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-pink-200 tracking-widest">
                    THÀNH VIÊN ĐẶC QUYỀN
                  </div>
                  <div className="text-base font-black tracking-wider text-white">
                    NGUYỄN MINH ANH
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-white/15 flex items-center justify-between text-[11px] text-pink-100">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Hoàn 10% điểm thưởng</span>
                  </span>
                  <span className="font-bold text-amber-300">0đ Phí mở thẻ</span>
                </div>
              </div>
            </div>

            {/* 3. TRUST & SATISFACTION METRICS (FLOATING BUBBLE) */}
            <div className="grid grid-cols-2 gap-3 animate-float-reverse">
              <div className="p-3.5 rounded-2xl bg-white/90 backdrop-blur-md border border-pink-200 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-500 flex items-center justify-center text-lg font-black shrink-0">
                  ★
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 leading-none">
                    4.95 / 5.0
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold mt-1">
                    50,000+ Đánh giá thật
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/90 backdrop-blur-md border border-pink-200 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-lg font-black shrink-0">
                  ✓
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 leading-none">
                    100% Y Tế
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold mt-1">
                    Chứng chỉ đã kiểm định
                  </div>
                </div>
              </div>
            </div>

            {/* 4. PERK HIGHLIGHTS LIST */}
            <div className="p-3.5 rounded-2xl bg-pink-50/80 border border-pink-200/70 text-xs text-slate-700 space-y-2">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#be185d] shrink-0" />
                <span>
                  <strong>Tặng 50.000đ</strong> vào ví voucher ngay khi đăng ký tài khoản.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Dời hoặc hủy lịch miễn phí</strong> trước 2 tiếng chỉ với 1 chạm.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer copyright */}
      <footer className="relative z-20 py-4 text-center text-slate-400 text-xs border-t border-pink-100 bg-white/50 backdrop-blur-xs">
        © 2026 BeautyPink Vietnam · Nền tảng Đặt lịch Thẩm mỹ & Làm đẹp Chuẩn Y Khoa Toàn Quốc
      </footer>
    </main>
  );
};
