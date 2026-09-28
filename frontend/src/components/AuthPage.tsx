import React, { useState } from 'react';
import { ArrowLeft, Building2, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Phone, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { getApiErrorMessage } from '../lib/api';
import { useLanguage } from '../lib/language';
import { platformApi } from '../services/platformApi';
import type { CurrentUser } from '../types';

interface AuthPageProps {
  initialMode: 'login' | 'register';
  onBackToHome: () => void;
  onSuccess: (user: CurrentUser, rememberSession: boolean) => void;
  onPartnerRegistration: () => void;
}

const REMEMBERED_IDENTIFIER_KEY = 'beautylink_remembered_identifier';

const mapUser = (user: { id: number; fullName: string; phone: string; email?: string | null; role: CurrentUser['role']; loyaltyPoints: number }): CurrentUser => ({
  id: user.id,
  name: user.fullName,
  phone: user.phone,
  email: user.email || undefined,
  role: user.role,
  loyaltyPoints: user.loyaltyPoints,
  memberTier: user.loyaltyPoints >= 1000 ? 'VIP' : 'Standard',
});

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode, onBackToHome, onSuccess, onPartnerRegistration }) => {
  const { text } = useLanguage();
  const [mode, setMode] = useState(initialMode);
  const [fullName, setFullName] = useState('');
  const [identifier, setIdentifier] = useState(() => localStorage.getItem(REMEMBERED_IDENTIFIER_KEY) || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem(REMEMBERED_IDENTIFIER_KEY)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const normalizedIdentifier = identifier.replace(/[\s.-]/g, '');
    if (mode === 'register' && password !== confirmPassword) {
      setError('Mật khẩu xác nhận chưa khớp.');
      return;
    }
    setLoading(true);
    try {
      const response = mode === 'login'
        ? await platformApi.login(identifier.trim(), password, rememberMe)
        : await platformApi.register({ fullName: fullName.trim(), phone: normalizedIdentifier, email: email.trim() || undefined, password });
      if (mode === 'login' && rememberMe) localStorage.setItem(REMEMBERED_IDENTIFIER_KEY, identifier.trim());
      else localStorage.removeItem(REMEMBERED_IDENTIFIER_KEY);
      onSuccess(mapUser(response.user), mode === 'register' || rememberMe);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Không thể đăng nhập. Vui lòng kiểm tra lại thông tin.'));
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await platformApi.login('0900000001', 'Demo123!', rememberMe);
      if (rememberMe) localStorage.setItem(REMEMBERED_IDENTIFIER_KEY, '0900000001');
      onSuccess(mapUser(response.user), rememberMe);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Hãy khởi động backend để dùng tài khoản demo.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen grid lg:grid-cols-[1.05fr_.95fr] bg-[#FFF0F3]">
      <section className="hidden lg:flex relative overflow-hidden bg-slate-950 p-12 text-white">
        <img src="https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=1400&q=88" alt={text('Chuyên viên trang điểm BeautyLink', 'BeautyLink makeup artist')} className="absolute inset-0 h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-[#6b153f]/60 to-[#EB0F51]/35" />
        <div className="relative z-10 flex w-full flex-col justify-between">
          <button onClick={onBackToHome} className="flex w-fit items-center gap-3 text-left" type="button">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 backdrop-blur"><Sparkles className="h-5 w-5" /></span>
            <span className="text-2xl font-black">Beauty<span className="text-pink-300">Link</span></span>
          </button>
          <div className="max-w-xl pb-10">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-pink-200">{text('Đặt lịch làm đẹp đáng tin cậy', 'Beauty booking you can trust')}</p>
            <h1 className="text-5xl font-black leading-[1.08]">{text('Một tài khoản.', 'One account.')}<br />{text('Mọi trải nghiệm làm đẹp.', 'Every beauty experience.')}</h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-white/75">{text('Khám phá chuyên viên đã xác minh, xem lịch trống thực tế và quản lý mọi cuộc hẹn tại một nơi.', 'Discover verified professionals, see real availability, and manage every appointment in one place.')}</p>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <button type="button" onClick={onBackToHome} className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-pink-700">
            <ArrowLeft className="h-4 w-4" /> {text('Về trang chủ', 'Back to homepage')}
          </button>
          <div className="rounded-[2rem] border border-pink-100 bg-white p-6 shadow-2xl shadow-pink-900/10 sm:p-8">
            <div className="mb-7">
              <p className="text-sm font-bold text-pink-600">{mode === 'login' ? text('Chào mừng trở lại', 'Welcome back') : text('Bắt đầu với BeautyLink', 'Get started with BeautyLink')}</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900">{mode === 'login' ? text('Đăng nhập', 'Log in') : text('Tạo tài khoản', 'Create an account')}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{mode === 'login' ? text('Tiếp tục quản lý lịch hẹn của bạn.', 'Continue managing your appointments.') : text('Đăng ký miễn phí trong chưa đầy một phút.', 'Create your free account in under a minute.')}</p>
            </div>

            <form className="space-y-4" onSubmit={submit}>
              {mode === 'register' && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-700">{text('Họ và tên', 'Full name')}</span>
                  <span className="relative block"><UserRound className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input required minLength={2} value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-100" placeholder="Nguyễn Minh Anh" /></span>
                </label>
              )}
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700">{mode === 'login' ? text('Số điện thoại hoặc email', 'Phone number or email') : text('Số điện thoại', 'Phone number')}</span>
                <span className="relative block"><Phone className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input required value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-100" placeholder={mode === 'login' ? '0900000001 hoặc email' : '09xxxxxxxx'} /></span>
              </label>
              {mode === 'register' && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-700">Email <span className="font-normal text-slate-400">{text('(không bắt buộc)', '(optional)')}</span></span>
                  <span className="relative block"><Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-100" placeholder="ban@example.com" /></span>
                </label>
              )}
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700">{text('Mật khẩu', 'Password')}</span>
                <span className="relative block"><LockKeyhole className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input required minLength={8} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-11 text-sm outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-100" placeholder="Tối thiểu 8 ký tự" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3.5 top-3.5 text-slate-400">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
              </label>
              {mode === 'register' && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-700">{text('Xác nhận mật khẩu', 'Confirm password')}</span>
                  <input required minLength={8} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-100" />
                </label>
              )}
              {mode === 'login' && (
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#EB0F51]" />
                  <span><span className="block text-xs font-extrabold text-slate-700">{text('Ghi nhớ đăng nhập', 'Remember me')}</span><span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{text('Lưu tài khoản và phiên đăng nhập trên thiết bị này. Mật khẩu không được lưu.', 'Keep your account and session on this device. Your password is never stored.')}</span></span>
                </label>
              )}
              {error && <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
              <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#B42D58] to-[#EB0F51] py-3.5 text-sm font-extrabold text-white shadow-lg shadow-pink-500/25 transition hover:-translate-y-0.5 disabled:opacity-60">
                {loading && <LoaderCircle className="h-4 w-4 animate-spin" />} {mode === 'login' ? text('Đăng nhập', 'Log in') : text('Tạo tài khoản', 'Create account')}
              </button>
            </form>

            {mode === 'login' && <button type="button" disabled={loading} onClick={demoLogin} className="mt-3 w-full rounded-2xl border border-pink-200 bg-pink-50 py-3 text-xs font-bold text-pink-700 hover:bg-pink-100">{text('Dùng tài khoản khách hàng demo', 'Use demo customer account')}</button>}
            <div className="mt-6 flex items-center justify-center gap-1 text-sm text-slate-500">
              {mode === 'login' ? text('Chưa có tài khoản?', 'New to BeautyLink?') : text('Đã có tài khoản?', 'Already have an account?')}
              <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="font-extrabold text-pink-700">{mode === 'login' ? text('Đăng ký', 'Sign up') : text('Đăng nhập', 'Log in')}</button>
            </div>
            <button type="button" onClick={onPartnerRegistration} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#EB0F51]/25 bg-[#FFF0F3] py-3 text-xs font-extrabold text-[#B42D58] transition hover:border-[#EB0F51] hover:bg-pink-100"><Building2 className="h-4 w-4" />{text('Đăng ký trở thành đối tác', 'Register as a partner')}</button>
            <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-[11px] font-semibold text-slate-400"><ShieldCheck className="h-4 w-4 text-emerald-500" /> {text('Mật khẩu được mã hóa, phiên đăng nhập được bảo vệ', 'Encrypted passwords and protected sessions')}</div>
          </div>
        </div>
      </section>
    </main>
  );
};
