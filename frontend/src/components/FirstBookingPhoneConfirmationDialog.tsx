import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Phone, ShieldCheck, X } from 'lucide-react';
import { vietnamPhoneSchema } from '../lib/validation';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export type FirstBookingPhoneDialogPhase = 'loading' | 'confirm' | 'error' | 'updating';

interface FirstBookingPhoneConfirmationDialogProps {
  open: boolean;
  currentPhone: string;
  phase: FirstBookingPhoneDialogPhase;
  error: string;
  onCancel: () => void;
  onRetry: () => void;
  onConfirm: (phone: string) => void;
}

export const FirstBookingPhoneConfirmationDialog: React.FC<FirstBookingPhoneConfirmationDialogProps> = ({
  open,
  currentPhone,
  phase,
  error,
  onCancel,
  onRetry,
  onConfirm,
}) => {
  const [phone, setPhone] = useState(currentPhone);
  const [phoneError, setPhoneError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    setPhone(currentPhone || '');
    setPhoneError('');
    return () => previousFocus.current?.focus();
  }, [open, currentPhone]);

  useEffect(() => {
    if (open && phase === 'confirm') window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, phase]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && phase !== 'updating') onCancel();
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, phase, onCancel]);

  if (!open) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = vietnamPhoneSchema.safeParse(phone.replace(/[\s.-]/g, ''));
    if (!parsed.success) {
      setPhoneError(parsed.error.issues[0].message);
      return;
    }
    setPhoneError('');
    onConfirm(parsed.data);
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="first-booking-phone-title">
      <button type="button" className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" onClick={phase === 'updating' ? undefined : onCancel} aria-label="Quay lại" />
      <div ref={dialogRef} className="relative w-full max-w-md rounded-[2rem] border border-pink-100 bg-white p-6 shadow-2xl sm:p-7">
        <button type="button" onClick={onCancel} disabled={phase === 'updating'} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 disabled:opacity-40" aria-label="Đóng hộp thoại">
          <X className="h-4 w-4" />
        </button>
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-pink-700"><Phone className="h-6 w-6" /></div>
        <h2 id="first-booking-phone-title" className="pr-10 text-xl font-black text-slate-900">Xác nhận số điện thoại liên hệ</h2>

        {phase === 'loading' && <div className="mt-6 flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600"><Loader2 className="h-5 w-5 animate-spin text-pink-600" />Đang kiểm tra lịch sử đặt lịch từ hệ thống...</div>}

        {phase === 'error' && (
          <div className="mt-6">
            <p role="alert" className="flex gap-2 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>
            <div className="mt-5 flex gap-3"><button type="button" onClick={onCancel} className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-bold">Quay lại</button><button type="button" onClick={onRetry} className="flex-1 rounded-2xl bg-pink-700 py-3 text-sm font-bold text-white">Thử lại</button></div>
          </div>
        )}

        {(phase === 'confirm' || phase === 'updating') && (
          <form onSubmit={submit} className="mt-4">
            <p className="text-sm leading-6 text-slate-600">Spa sẽ sử dụng số điện thoại này để liên hệ với bạn về lịch hẹn. Bạn có chắc chắn đây là số điện thoại hiện tại của mình không?</p>
            <label className="mt-5 block text-xs font-black text-slate-700" htmlFor="first-booking-phone">Số điện thoại liên hệ</label>
            <input ref={inputRef} id="first-booking-phone" inputMode="numeric" autoComplete="tel" maxLength={10} value={phone} disabled={phase === 'updating'} onChange={(event) => { setPhone(event.target.value.replace(/\D/g, '').slice(0, 10)); setPhoneError(''); }} aria-invalid={Boolean(phoneError || error)} aria-describedby="first-booking-phone-help" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base font-bold outline-none focus:border-pink-500 disabled:bg-slate-50" />
            <p id="first-booking-phone-help" className="mt-2 text-xs leading-5 text-slate-500">Nếu thay đổi, số mới sẽ được lưu vào tài khoản BeautyLink và có thể dùng để đăng nhập. Đây là thông tin bạn tự xác nhận, không phải xác thực sở hữu SIM.</p>
            {(phoneError || error) && <p role="alert" className="mt-3 text-xs font-semibold text-rose-700">{phoneError || error}</p>}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <button type="button" onClick={onCancel} disabled={phase === 'updating'} className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-bold disabled:opacity-40">Quay lại</button>
              <button type="submit" disabled={phase === 'updating'} className="inline-flex flex-[1.7] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-pink-800 py-3 text-sm font-black text-white disabled:opacity-60">{phase === 'updating' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Xác nhận và tiếp tục đặt lịch</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
