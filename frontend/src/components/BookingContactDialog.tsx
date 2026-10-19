import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Phone, ShieldCheck, X } from 'lucide-react';
import { CurrentUser } from '../types';
import { beautyApi, getApiErrorMessage } from '../services/beautyApi';
import { mapBackendUser } from '../lib/authUser';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface Props {
  currentUser: CurrentUser;
  onComplete: (user: CurrentUser) => void;
  onCancel: () => void;
}

const PHONE_PATTERN = /^0(?:3|5|7|8|9)[0-9]{8}$/;

export const BookingContactDialog: React.FC<Props> = ({ currentUser, onComplete, onCancel }) => {
  const savedPhone = useMemo(() => (currentUser.phone || '').replace(/[^0-9]/g, ''), [currentUser.phone]);
  const [phone, setPhone] = useState(savedPhone);
  const [step, setStep] = useState<'edit' | 'confirm'>(PHONE_PATTERN.test(savedPhone) ? 'confirm' : 'edit');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submissionBusy = useRef(false);
  const confirmingUnchangedSavedPhone = Boolean(savedPhone) && phone === savedPhone;
  useBodyScrollLock(true);

  const reviewPhone = () => {
    if (!PHONE_PATTERN.test(phone)) {
      setError('Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09.');
      return;
    }
    setError('');
    setStep('confirm');
  };

  const confirm = async () => {
    if (submissionBusy.current) return;
    submissionBusy.current = true;
    setSaving(true);
    setError('');
    try {
      const response = await beautyApi.updateCustomerProfile({ phone, confirmBookingContact: true });
      onComplete({ ...currentUser, ...mapBackendUser(response.user) });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Không thể lưu số điện thoại. Vui lòng thử lại.'));
    } finally {
      submissionBusy.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="booking-contact-title">
      <div className="w-full max-w-md rounded-3xl border border-pink-100 bg-white p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-pink-50 text-pink-600"><Phone className="h-5 w-5" /></span>
            <div><p className="text-[11px] font-black uppercase tracking-wider text-pink-600">Thông tin liên hệ đặt lịch</p><h2 id="booking-contact-title" className="text-lg font-black text-slate-900">Xác nhận trước khi tiếp tục</h2></div>
          </div>
          <button type="button" onClick={onCancel} aria-label="Quay lại đặt lịch" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"><X className="h-4 w-4" /></button>
        </div>

        {step === 'edit' ? (
          <div className="mt-6">
            <p className="text-sm leading-6 text-slate-600">BeautyLink chỉ cần số điện thoại để cơ sở liên hệ về lịch hẹn. Bạn chưa cần bổ sung ngày sinh.</p>
            <label className="mt-4 block text-xs font-black text-slate-700" htmlFor="booking-contact-phone">Số điện thoại di động Việt Nam</label>
            <input id="booking-contact-phone" inputMode="numeric" autoComplete="tel" maxLength={10} value={phone}
              onChange={(event) => { setPhone(event.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
              className="mt-2 w-full rounded-2xl border border-pink-200 px-4 py-3 text-base font-bold outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100" placeholder="0901234567" />
            <button type="button" onClick={reviewPhone} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-pink-500 to-pink-700 px-5 py-3 text-sm font-black text-white shadow-md">Tiếp tục xác nhận</button>
          </div>
        ) : (
          <div className="mt-6">
            <div className="rounded-2xl border border-pink-100 bg-pink-50/70 p-4">
              <p className="text-sm font-semibold leading-6 text-slate-700">
                {confirmingUnchangedSavedPhone
                  ? 'Chúng tôi sẽ sử dụng số điện thoại này để liên hệ về lịch hẹn. Bạn có muốn xác nhận không?'
                  : 'Bạn có chắc chắn muốn sử dụng số điện thoại này để liên hệ khi đặt lịch không?'}
              </p>
              <p className="mt-3 text-xl font-black tracking-wide text-pink-700">{phone}</p>
            </div>
            <p className="mt-3 flex items-start gap-2 text-[11px] font-semibold leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Xác nhận này ghi nhận lựa chọn liên hệ của bạn; đây không phải xác minh SMS OTP.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setStep('edit')} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700"><ArrowLeft className="h-4 w-4" />Sửa số</button>
              <button type="button" onClick={confirm} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-pink-700 px-4 py-3 text-sm font-black text-white disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Xác nhận
              </button>
            </div>
          </div>
        )}
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>}
        <button type="button" onClick={onCancel} disabled={saving} className="mt-3 w-full px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800">Hủy và quay lại đặt lịch</button>
      </div>
    </div>
  );
};
