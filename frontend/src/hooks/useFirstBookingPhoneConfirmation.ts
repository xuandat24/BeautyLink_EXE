import { useCallback, useEffect, useRef, useState } from 'react';
import { CurrentUser } from '../types';
import { beautyApi, getApiErrorMessage } from '../services/beautyApi';
import { useBeautyStore } from '../store/beautyStore';
import { FirstBookingPhoneDialogPhase } from '../components/FirstBookingPhoneConfirmationDialog';
import { requiresFirstBookingPhoneConfirmation } from '../lib/firstBookingPhoneConfirmation';

export function useFirstBookingPhoneConfirmation(currentUser: CurrentUser | null) {
  const { setCurrentUser } = useBeautyStore();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<FirstBookingPhoneDialogPhase>('loading');
  const [error, setError] = useState('');
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const promiseRef = useRef<Promise<boolean> | null>(null);
  const requestIdRef = useRef(0);

  const finish = useCallback((confirmed: boolean) => {
    requestIdRef.current += 1;
    const resolve = resolverRef.current;
    resolverRef.current = null;
    promiseRef.current = null;
    setOpen(false);
    setError('');
    resolve?.(confirmed);
  }, []);

  const loadStatus = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setPhase('loading');
    setError('');
    try {
      const status = await beautyApi.bookingHistoryStatus();
      if (requestId !== requestIdRef.current) return;
      if (status.hasPreviousBooking) finish(true);
      else setPhase('confirm');
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setPhase('error');
      setError(getApiErrorMessage(err, 'Không thể kiểm tra lịch sử đặt lịch. Vui lòng thử lại.'));
    }
  }, [finish]);

  const confirmBeforeFirstBooking = useCallback((): Promise<boolean> => {
    if (!currentUser) return Promise.resolve(false);
    if (!requiresFirstBookingPhoneConfirmation(currentUser)) return Promise.resolve(true);
    if (promiseRef.current) return promiseRef.current;
    const promise = new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
    promiseRef.current = promise;
    setOpen(true);
    void loadStatus();
    return promise;
  }, [currentUser, loadStatus]);

  const confirmPhone = useCallback(async (phone: string) => {
    setPhase('updating');
    setError('');
    try {
      if (phone !== (currentUser?.phone || '')) {
        const response = await beautyApi.updateMyPhone(phone);
        const account = response.user;
        setCurrentUser({
          ...currentUser!,
          id: account.id,
          name: account.fullName || currentUser?.name || 'Khách hàng',
          phone: account.phone,
          email: account.email,
          role: account.role || currentUser?.role || 'CUSTOMER',
          loyaltyPoints: account.loyaltyPoints,
          gender: account.gender === 'MALE' ? 'Nam' : account.gender === 'FEMALE' ? 'Nữ' : account.gender === 'OTHER' ? 'Others' : currentUser?.gender,
          dateOfBirth: account.dateOfBirth || currentUser?.dateOfBirth,
        });
      }
      finish(true);
    } catch (err) {
      setPhase('confirm');
      setError(getApiErrorMessage(err, 'Không thể cập nhật số điện thoại. Vui lòng thử lại.'));
    }
  }, [currentUser, finish, setCurrentUser]);

  useEffect(() => () => resolverRef.current?.(false), []);

  return {
    confirmBeforeFirstBooking,
    dialogProps: {
      open,
      currentPhone: currentUser?.phone || '',
      phase,
      error,
      onCancel: () => finish(false),
      onRetry: () => void loadStatus(),
      onConfirm: (phone: string) => void confirmPhone(phone),
    },
  };
}
