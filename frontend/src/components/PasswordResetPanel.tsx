import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { beautyApi, getApiErrorMessage } from '../services/beautyApi';
import { strongPasswordSchema, vietnamPhoneSchema } from '../lib/validation';

interface PasswordResetPanelProps {
  initialIdentifier?: string;
  onBackToLogin: () => void;
}

type ResetStep = 'request' | 'verify' | 'success';

export const PasswordResetPanel: React.FC<PasswordResetPanelProps> = ({ initialIdentifier = '', onBackToLogin }) => {
  const [step, setStep] = useState<ResetStep>('request');
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [challengeId, setChallengeId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const validIdentifier = (value: string) => {
    const normalized = value.trim();
    if (normalized.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
    return vietnamPhoneSchema.safeParse(normalized).success;
  };

  const requestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!validIdentifier(identifier)) {
      setError('Nhập email hợp lệ hoặc số điện thoại 10 chữ số bắt đầu bằng 03, 05, 07, 08 hoặc 09.');
      return;
    }
    setLoading(true);
    try {
      const response = await beautyApi.startPasswordReset(identifier.trim());
      setChallengeId(response.challengeId);
      setNotice(response.message);
      setStep('verify');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể gửi mã OTP. Vui lòng thử lại.'));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(otpCode)) {
      setError('Mã OTP phải gồm đúng 6 chữ số.');
      return;
    }
    const parsedPassword = strongPasswordSchema.safeParse(newPassword);
    if (!parsedPassword.success) {
      setError(parsedPassword.error.issues[0].message);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận chưa khớp.');
      return;
    }
    setLoading(true);
    try {
      const response = await beautyApi.confirmPasswordReset({ challengeId, otpCode, newPassword });
      setNotice(response.message);
      setStep('success');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể đặt lại mật khẩu. Vui lòng thử lại.'));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="mt-3 text-base font-black text-slate-900">Đặt lại mật khẩu thành công</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{notice}</p>
        <button type="button" onClick={onBackToLogin}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#be185d] px-4 py-3 text-sm font-black text-white transition hover:bg-[#9d174d]">
          Đăng nhập bằng mật khẩu mới <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={step === 'request' ? requestCode : resetPassword}>
      {step === 'request' ? (
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700">Số điện thoại hoặc email tài khoản</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input type="text" required autoFocus maxLength={254} value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="0908433898 hoặc user@example.com"
              className="w-full rounded-xl border border-pink-200 bg-pink-50/20 py-2.5 pl-10 pr-3.5 text-xs font-medium text-slate-800 outline-hidden focus:border-[#be185d] focus:ring-2 focus:ring-pink-200/50" />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Nếu tài khoản tồn tại, mã OTP sẽ được gửi đến email đã đăng ký. BeautyLink không hiển thị email để bảo vệ tài khoản.
          </p>
        </div>
      ) : (
        <>
          {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium leading-relaxed text-emerald-800">{notice}</div>}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Mật khẩu mới</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input type={showPassword ? 'text' : 'password'} required minLength={8} maxLength={72}
                value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="••••••••••••"
                className="w-full rounded-xl border border-pink-200 bg-pink-50/20 py-2.5 pl-10 pr-10 text-xs font-medium outline-hidden focus:border-[#be185d] focus:ring-2 focus:ring-pink-200/50" />
              <button type="button" onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số. Không bắt buộc ký tự đặc biệt.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Xác nhận mật khẩu mới</label>
            <input type={showPassword ? 'text' : 'password'} required minLength={8} maxLength={72}
              value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="••••••••••••"
              className="w-full rounded-xl border border-pink-200 bg-pink-50/20 px-3.5 py-2.5 text-xs font-medium outline-hidden focus:border-[#be185d] focus:ring-2 focus:ring-pink-200/50" />
          </div>
          <div className="rounded-2xl border-2 border-[#be185d]/35 bg-pink-50/60 p-4">
            <label className="mb-2 block text-center text-sm font-black text-slate-800">Mã OTP trong email</label>
            <input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6}
              value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))}
              placeholder="000000" autoFocus
              className="min-h-16 w-full rounded-2xl border-2 border-pink-300 bg-white px-4 py-4 text-center text-2xl font-black tracking-[0.45em] text-[#9d174d] shadow-inner outline-hidden placeholder:text-pink-200 focus:border-[#be185d] focus:ring-4 focus:ring-pink-200/60 sm:text-3xl" />
            <p className="mt-2 text-center text-[10px] font-semibold text-slate-500">Nhập đủ 6 chữ số rồi bấm xác nhận ngay bên dưới.</p>
          </div>
        </>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" /> <span>{error}</span>
        </div>
      )}

      <button type="submit" disabled={loading} aria-busy={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-[#db2777] to-[#be185d] px-4 py-3 text-sm font-black text-white shadow-lg shadow-pink-500/20 transition hover:opacity-95 disabled:opacity-60">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang xử lý...</> : <>{step === 'request' ? 'Gửi mã OTP qua email' : 'Xác nhận và đổi mật khẩu'} <ArrowRight className="h-4 w-4" /></>}
      </button>

      <button type="button" onClick={step === 'verify' ? () => { setStep('request'); setError(''); } : onBackToLogin}
        className="flex w-full items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#be185d]">
        <ArrowLeft className="h-3.5 w-3.5" /> {step === 'verify' ? 'Dùng tài khoản khác' : 'Quay lại đăng nhập'}
      </button>
    </form>
  );
};
