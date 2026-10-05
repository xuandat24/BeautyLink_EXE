import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Phone,
  User,
  Mail,
  Sparkles,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  Gift,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Star,
  Check,
  RefreshCw,
  KeyRound,
  Heart,
} from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: 'login' | 'register';
  onSuccess?: (user: { name: string; phone: string }) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');

  // Form Fields
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'female' | 'male' | 'other'>('female');
  const [referralCode, setReferralCode] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Forgot Password flow step
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Sync mode with initialMode whenever dialog opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
      setSuccessMsg(null);
      setForgotStep(1);
    }
  }, [isOpen, initialMode]);

  // Countdown timer for OTP
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  // Lock body scroll when modal is open
  useBodyScrollLock(isOpen);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-slate-200' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) || /[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: 'Yếu', color: 'bg-rose-500' };
    if (score <= 2) return { score: 2, label: 'Trung bình', color: 'bg-amber-500' };
    return { score: 3, label: 'Mạnh & An toàn', color: 'bg-emerald-500' };
  };

  const passwordStrength = getPasswordStrength(password);

  const handleSendOtp = () => {
    if (!phone && !email) {
      setErrorMsg('Vui lòng nhập số điện thoại hoặc email để nhận mã OTP.');
      return;
    }
    setErrorMsg(null);
    setOtpCountdown(60);
    setSuccessMsg('Mã OTP (mô phỏng: 888999) đã được gửi đến thiết bị của bạn!');
    setTimeout(() => setSuccessMsg(null), 6000);
  };

  // Quick 1-click Demo Login for seamless preview
  const handleQuickDemoLogin = () => {
    setIsLoading(true);
    setErrorMsg(null);
    setTimeout(() => {
      setIsLoading(false);
      if (onSuccess) {
        onSuccess({
          name: 'Phương Thảo (Hội viên VIP)',
          phone: '0988 123 456',
        });
      }
      onClose();
    }, 400);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation
    if (mode === 'register') {
      if (!name.trim()) {
        setErrorMsg('Vui lòng nhập họ và tên của bạn.');
        return;
      }
      if (!phone.trim()) {
        setErrorMsg('Vui lòng nhập số điện thoại.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Mật khẩu phải có ít nhất 6 ký tự.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Mật khẩu xác nhận không trùng khớp.');
        return;
      }
      if (!agreeTerms) {
        setErrorMsg('Bạn cần đồng ý với Điều khoản dịch vụ & Chính sách bảo mật.');
        return;
      }
    } else if (mode === 'login') {
      if (!phone.trim()) {
        setErrorMsg('Vui lòng nhập số điện thoại hoặc email.');
        return;
      }
      if (loginMethod === 'password' && !password.trim()) {
        setErrorMsg('Vui lòng nhập mật khẩu.');
        return;
      }
      if (loginMethod === 'otp' && !otpCode.trim()) {
        setErrorMsg('Vui lòng nhập mã OTP.');
        return;
      }
    } else if (mode === 'forgot') {
      if (forgotStep === 1) {
        if (!phone.trim()) {
          setErrorMsg('Vui lòng nhập số điện thoại hoặc email đã đăng ký.');
          return;
        }
        handleSendOtp();
        setForgotStep(2);
        return;
      }
      if (forgotStep === 2) {
        if (!otpCode.trim()) {
          setErrorMsg('Vui lòng nhập mã OTP nhận được.');
          return;
        }
        setForgotStep(3);
        return;
      }
      if (forgotStep === 3) {
        if (password.length < 6) {
          setErrorMsg('Mật khẩu mới phải có ít nhất 6 ký tự.');
          return;
        }
        if (password !== confirmPassword) {
          setErrorMsg('Mật khẩu xác nhận không trùng khớp.');
          return;
        }
        setSuccessMsg('Đổi mật khẩu thành công! Hãy đăng nhập với mật khẩu mới.');
        setTimeout(() => {
          setMode('login');
          setForgotStep(1);
          setSuccessMsg(null);
        }, 1500);
        return;
      }
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      const displayName =
        name.trim() || (phone ? `Thành viên (${phone.slice(-4)})` : 'Phương Thảo');
      if (onSuccess) {
        onSuccess({ name: displayName, phone });
      }
      onClose();
    }, 600);
  };

  const handleSocialLogin = (provider: 'Google' | 'Facebook' | 'Apple') => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      if (onSuccess) {
        onSuccess({
          name: `Khách hàng (${provider})`,
          phone: '0909 888 999',
        });
      }
      onClose();
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Blurred & Dimmed Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Pristine Modal Card */}
      <div
        className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-pink-100 overflow-hidden flex flex-col md:flex-row transition-all animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* =========================================================================
            LEFT PANEL: Branding, Member Privileges & Visual Inspiration (Desktop)
        ========================================================================= */}
        <div className="hidden md:flex md:w-5/12 bg-gradient-to-br from-[#831843] via-[#be185d] to-[#e1146c] text-white p-8 flex-col justify-between relative overflow-hidden shrink-0">
          {/* Ambient Background Accents */}
          <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-56 h-56 rounded-full bg-pink-400/20 blur-2xl pointer-events-none" />

          {/* Top Brand Info */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-semibold text-pink-100 mb-6 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Nền tảng Làm Đẹp & Spa #1</span>
            </div>

            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-white text-[#e1146c] flex items-center justify-center font-black text-xl shadow-lg shadow-black/15">
                B
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight leading-none text-white">
                  Beauty<span className="text-pink-200">Pink</span>
                </span>
                <span className="text-[11px] text-pink-200 font-medium">
                  Đánh thức nét đẹp tự nhiên
                </span>
              </div>
            </div>

            <p className="text-xs text-pink-100/90 leading-relaxed mt-2 font-normal">
              Tham gia cộng đồng hơn 50.000+ tín đồ làm đẹp để trải nghiệm đặt lịch làm đẹp chuẩn chuyên gia, tiết kiệm và an tâm tuyệt đối.
            </p>
          </div>

          {/* Core Member Privileges */}
          <div className="relative z-10 my-6 space-y-3.5">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-pink-200">
              Đặc quyền dành riêng cho bạn
            </div>

            <div className="flex items-start gap-3 bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/10">
              <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                <Gift className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Quà chào mừng thành viên</div>
                <div className="text-[11px] text-pink-100/80 leading-snug">
                  Tặng voucher 100K & Miễn phí soi da 3D cho lịch hẹn đầu tiên.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/10">
              <div className="w-8 h-8 rounded-xl bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                <Star className="w-4 h-4 fill-emerald-300" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Tích điểm PinkPoints 10%</div>
                <div className="text-[11px] text-pink-100/80 leading-snug">
                  Hoàn xu sau mỗi lần đặt chỗ để đổi liệu trình spa miễn phí.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/10">
              <div className="w-8 h-8 rounded-xl bg-sky-400/20 text-sky-300 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">100% Cơ sở kiểm định</div>
                <div className="text-[11px] text-pink-100/80 leading-snug">
                  Cam kết cơ sở uy tín, chuẩn Y khoa và niêm yết giá minh bạch.
                </div>
              </div>
            </div>
          </div>

          {/* Testimonial Quote */}
          <div className="relative z-10 pt-3 border-t border-white/15">
            <div className="flex items-center gap-2 mb-1.5 text-amber-300">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-amber-300" />
              ))}
              <span className="text-[11px] font-bold text-white ml-1">5.0</span>
            </div>
            <p className="text-[11px] text-pink-100 italic leading-relaxed">
              "Đặt lịch trên BeautyPink rất nhanh, đến nơi được phục vụ ngay không phải chờ đợi. Nhiều voucher siêu hời!"
            </p>
            <div className="text-[10px] text-pink-200 font-semibold mt-1">
              — Thùy Trang, Hội viên Vàng (Hà Nội)
            </div>
          </div>
        </div>

        {/* =========================================================================
            RIGHT PANEL: Interactive Form (Login / Register / Forgot Password)
        ========================================================================= */}
        <div className="flex-1 p-5 sm:p-7 md:p-8 flex flex-col justify-between relative max-h-[90vh] overflow-y-auto">
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="absolute right-4 top-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-pink-100 text-slate-500 hover:text-[#e1146c] flex items-center justify-center transition-all cursor-pointer z-20"
          >
            <X className="w-5 h-5" />
          </button>

          <div>
            {/* Form Top Switcher: Tab Header (When not in Forgot mode) */}
            {mode !== 'forgot' ? (
              <div className="mb-6">
                <div className="flex items-center justify-between pr-8 mb-3">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                      {mode === 'login' ? 'Chào mừng bạn trở lại! 👋' : 'Đăng ký thành viên ✨'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {mode === 'login'
                        ? 'Đăng nhập để quản lý lịch hẹn và nhận ưu đãi riêng'
                        : 'Nhận ngay gói quà làm đẹp 100K & Miễn phí soi da 3D'}
                    </p>
                  </div>
                </div>

                {/* Segmented Switcher */}
                <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200/70 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMsg(null);
                    }}
                    className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      mode === 'login'
                        ? 'bg-white text-[#be185d] shadow-sm font-extrabold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span>Đăng nhập</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setErrorMsg(null);
                    }}
                    className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
                      mode === 'register'
                        ? 'bg-white text-[#be185d] shadow-sm font-extrabold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span>Đăng ký mới</span>
                    <span className="w-2 h-2 rounded-full bg-[#e1146c]" />
                  </button>
                </div>
              </div>
            ) : (
              /* Forgot Password Header */
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#be185d] hover:underline mb-2 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Quay lại Đăng nhập</span>
                </button>
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  Khôi phục mật khẩu 🔐
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {forgotStep === 1 && 'Nhập số điện thoại hoặc email để nhận mã xác thực OTP'}
                  {forgotStep === 2 && 'Nhập mã OTP 6 số đã được gửi đến bạn'}
                  {forgotStep === 3 && 'Tạo mật khẩu mới cho tài khoản của bạn'}
                </p>
              </div>
            )}

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Success Message Alert */}
            {successMsg && (
              <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* =========================================================
                FORM 1: LOGIN MODE
            ========================================================= */}
            {mode === 'login' && (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* Login Method Toggle: Password vs Quick SMS OTP */}
                <div className="flex items-center gap-2 pb-1 text-xs">
                  <span className="text-[11px] font-semibold text-slate-400">Phương thức:</span>
                  <button
                    type="button"
                    onClick={() => setLoginMethod('password')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      loginMethod === 'password'
                        ? 'bg-pink-100 text-[#be185d]'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Mật khẩu
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMethod('otp')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                      loginMethod === 'otp'
                        ? 'bg-pink-100 text-[#be185d]'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Smartphone className="w-3 h-3" />
                    <span>Mã OTP SMS</span>
                  </button>
                </div>

                {/* Phone or Email Input */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Số điện thoại hoặc Email
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="09xx xxx xxx hoặc email@domain.com"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-2xl border border-pink-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100 transition-all font-medium"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Password Input (If Password Method) */}
                {loginMethod === 'password' ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">Mật khẩu</label>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setForgotStep(1);
                        }}
                        className="text-[11px] font-bold text-[#be185d] hover:underline cursor-pointer"
                      >
                        Quên mật khẩu?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-2xl border border-pink-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100 transition-all font-medium"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* OTP Input (If OTP Method) */
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Mã xác thực OTP (6 chữ số)
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          maxLength={6}
                          required
                          placeholder="Nhập 6 số (VD: 888999)"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm tracking-widest font-mono rounded-2xl border border-pink-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100 transition-all"
                        />
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={otpCountdown > 0}
                        className="px-3.5 py-2.5 rounded-2xl bg-pink-50 hover:bg-pink-100 text-[#be185d] border border-pink-200 text-xs font-bold whitespace-nowrap transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {otpCountdown > 0 ? `Gửi lại (${otpCountdown}s)` : 'Gửi mã OTP'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Remember Me Checkbox */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-[#e1146c] focus:ring-pink-400 accent-[#e1146c] cursor-pointer"
                    />
                    <span>Ghi nhớ đăng nhập trên thiết bị này</span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] hover:from-[#c2185b] hover:to-[#9d174d] text-white text-xs sm:text-sm font-bold shadow-md shadow-pink-600/30 hover:shadow-pink-600/40 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-70 mt-3"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang xác thực...</span>
                    </>
                  ) : (
                    <>
                      <span>Đăng nhập ngay</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Quick 1-Click Demo Login Bar */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleQuickDemoLogin}
                    className="w-full py-2 px-3 rounded-2xl bg-pink-50/80 hover:bg-pink-100/80 border border-pink-200 text-xs font-bold text-[#be185d] transition-all flex items-center justify-center gap-2 cursor-pointer group shadow-xs"
                    title="Bấm để đăng nhập thử nghiệm ngay với tài khoản mẫu"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#e1146c] group-hover:scale-110 transition-transform" />
                    <span>Đăng nhập thử: Hội viên VIP Phương Thảo</span>
                  </button>
                </div>
              </form>
            )}

            {/* =========================================================
                FORM 2: REGISTER MODE
            ========================================================= */}
            {mode === 'register' && (
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Welcome Perk Pill */}
                <div className="bg-pink-50/90 border border-pink-200/80 rounded-2xl p-2.5 flex items-center gap-2.5 text-xs text-[#be185d]">
                  <Gift className="w-4 h-4 text-[#e1146c] shrink-0" />
                  <span className="font-semibold">
                    Đăng ký hôm nay: Tặng ngay voucher <strong className="font-black text-[#e1146c]">100K</strong> & Miễn phí soi da 3D!
                  </span>
                </div>

                {/* Full Name */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Họ và tên của bạn <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Nguyễn Phương Thảo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2 text-xs sm:text-sm rounded-2xl border border-pink-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100 transition-all font-medium"
                    />
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Phone & Gender Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Phone */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Số điện thoại <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        placeholder="09xx xxx xxx"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2 text-xs sm:text-sm rounded-2xl border border-pink-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100 transition-all font-medium"
                      />
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  {/* Gender Selector */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Giới tính (để tư vấn chuẩn)
                    </label>
                    <div className="flex p-0.5 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-semibold h-[38px] items-center">
                      <button
                        type="button"
                        onClick={() => setGender('female')}
                        className={`flex-1 h-full rounded-xl transition-all ${
                          gender === 'female'
                            ? 'bg-white text-[#be185d] font-bold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Nữ
                      </button>
                      <button
                        type="button"
                        onClick={() => setGender('male')}
                        className={`flex-1 h-full rounded-xl transition-all ${
                          gender === 'male'
                            ? 'bg-white text-[#be185d] font-bold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Nam
                      </button>
                      <button
                        type="button"
                        onClick={() => setGender('other')}
                        className={`flex-1 h-full rounded-xl transition-all ${
                          gender === 'other'
                            ? 'bg-white text-[#be185d] font-bold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Khác
                      </button>
                    </div>
                  </div>
                </div>

                {/* Email (Optional) */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Email <span className="text-slate-400 font-normal">(để nhận voucher sinh nhật)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="ban@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2 text-xs sm:text-sm rounded-2xl border border-pink-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100 transition-all font-medium"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Password & Strength Meter */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Tạo mật khẩu <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Ít nhất 6 ký tự..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2 text-xs sm:text-sm rounded-2xl border border-pink-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100 transition-all font-medium"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {password && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden flex gap-0.5">
                        <div
                          className={`h-full transition-all ${
                            passwordStrength.score >= 1 ? passwordStrength.color : 'bg-transparent'
                          }`}
                          style={{ width: '33.3%' }}
                        />
                        <div
                          className={`h-full transition-all ${
                            passwordStrength.score >= 2 ? passwordStrength.color : 'bg-transparent'
                          }`}
                          style={{ width: '33.3%' }}
                        />
                        <div
                          className={`h-full transition-all ${
                            passwordStrength.score >= 3 ? passwordStrength.color : 'bg-transparent'
                          }`}
                          style={{ width: '33.4%' }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">
                        Độ mạnh: {passwordStrength.label}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nhập lại mật khẩu <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="Xác nhận mật khẩu giống ở trên..."
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2 text-xs sm:text-sm rounded-2xl border border-pink-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#e1146c] focus:ring-2 focus:ring-pink-100 transition-all font-medium"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Referral Code (Optional) */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Mã giới thiệu bạn bè <span className="text-slate-400 font-normal">(tùy chọn - nhận thêm 50K xu)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập mã nếu có (VD: PINKFRIEND)"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-2xl border border-pink-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#e1146c] uppercase font-mono"
                  />
                </div>

                {/* Terms Agreement */}
                <div className="pt-1">
                  <label className="flex items-start gap-2 cursor-pointer select-none text-[11px] text-slate-600 leading-tight">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="w-4 h-4 rounded text-[#e1146c] focus:ring-pink-400 accent-[#e1146c] cursor-pointer mt-0.5"
                    />
                    <span>
                      Tôi đồng ý với{' '}
                      <a href="#" className="text-[#be185d] font-bold hover:underline">
                        Điều khoản dịch vụ
                      </a>{' '}
                      và{' '}
                      <a href="#" className="text-[#be185d] font-bold hover:underline">
                        Chính sách bảo mật
                      </a>{' '}
                      của BeautyPink.
                    </span>
                  </label>
                </div>

                {/* Submit Register Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] hover:from-[#c2185b] hover:to-[#9d174d] text-white text-xs sm:text-sm font-bold shadow-md shadow-pink-600/30 hover:shadow-pink-600/40 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-70 mt-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang tạo tài khoản...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Tạo tài khoản & Nhận quà chào mừng</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* =========================================================
                FORM 3: FORGOT PASSWORD FLOW
            ========================================================= */}
            {mode === 'forgot' && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Step indicators */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className={`flex-1 h-1.5 rounded-full ${forgotStep >= 1 ? 'bg-[#e1146c]' : 'bg-slate-200'}`} />
                  <div className={`flex-1 h-1.5 rounded-full ${forgotStep >= 2 ? 'bg-[#e1146c]' : 'bg-slate-200'}`} />
                  <div className={`flex-1 h-1.5 rounded-full ${forgotStep >= 3 ? 'bg-[#e1146c]' : 'bg-slate-200'}`} />
                </div>

                {forgotStep === 1 && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Số điện thoại hoặc Email tài khoản
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="Nhập số điện thoại đã đăng ký..."
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-2xl border border-pink-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#e1146c] font-medium"
                      />
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Hệ thống sẽ gửi mã OTP xác nhận đến số điện thoại hoặc email của bạn.
                    </p>
                  </div>
                )}

                {forgotStep === 2 && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Nhập mã OTP xác thực (6 số)
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          maxLength={6}
                          required
                          placeholder="VD: 888999"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm tracking-widest font-mono rounded-2xl border border-pink-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#e1146c]"
                        />
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={otpCountdown > 0}
                        className="px-3 py-2 rounded-2xl bg-pink-50 text-[#be185d] border border-pink-200 text-xs font-bold disabled:opacity-50"
                      >
                        {otpCountdown > 0 ? `(${otpCountdown}s)` : 'Gửi lại'}
                      </button>
                    </div>
                  </div>
                )}

                {forgotStep === 3 && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Mật khẩu mới
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Nhập mật khẩu mới..."
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-2xl border border-pink-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#e1146c]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Xác nhận mật khẩu mới
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Nhập lại mật khẩu mới..."
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-2xl border border-pink-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#e1146c]"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-full bg-gradient-to-r from-[#e1146c] to-[#be185d] text-white text-xs sm:text-sm font-bold shadow-md shadow-pink-600/30 hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer mt-3"
                >
                  <span>
                    {forgotStep === 1 && 'Tiếp tục nhận mã OTP'}
                    {forgotStep === 2 && 'Xác thực mã OTP'}
                    {forgotStep === 3 && 'Lưu mật khẩu mới'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Social Logins Divider (Shown in Login and Register) */}
            {mode !== 'forgot' && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="relative text-center mb-3">
                  <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 relative z-10">
                    Hoặc tiếp tục với
                  </span>
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-slate-200/70" />
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  {/* Google */}
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('Google')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl border border-slate-200 hover:border-pink-300 hover:bg-pink-50/40 text-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span className="hidden sm:inline">Google</span>
                  </button>

                  {/* Facebook */}
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('Facebook')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 text-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                  >
                    <svg className="w-4 h-4 fill-[#1877F2]" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    <span className="hidden sm:inline">Facebook</span>
                  </button>

                  {/* Apple */}
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('Apple')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                  >
                    <svg className="w-4 h-4 fill-slate-900" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.87c.61-.75 1.04-1.8 0.92-2.87-.93.04-2.02.63-2.66 1.38-.56.65-.98 1.7-0.86 2.74 1.05.08 2.01-.52 2.6-1.25z" />
                    </svg>
                    <span className="hidden sm:inline">Apple</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="mt-4 pt-3 border-t border-slate-100 text-center text-[11px] text-slate-400">
            {mode === 'login' ? (
              <p>
                Chưa có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg(null);
                  }}
                  className="font-bold text-[#be185d] hover:underline cursor-pointer"
                >
                  Đăng ký nhận quà 100K ngay
                </button>
              </p>
            ) : mode === 'register' ? (
              <p>
                Đã có tài khoản BeautyPink?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                  }}
                  className="font-bold text-[#be185d] hover:underline cursor-pointer"
                >
                  Đăng nhập tại đây
                </button>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
