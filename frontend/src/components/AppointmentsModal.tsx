import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { BookingDetails } from '../types';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { BookingsPage } from './BookingsPage';
interface AppointmentsModalProps {
  isOpen: boolean; onClose: () => void; appointments: BookingDetails[]; onBookNew: () => void;
}
export const AppointmentsModal: React.FC<AppointmentsModalProps> = ({ isOpen, onClose, onBookNew }) => {
  useBodyScrollLock(isOpen);
  useEffect(() => {
    if (!isOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !document.querySelector('[aria-labelledby="review-title"], [aria-labelledby="complete-title"]')) onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Lịch hẹn của tôi">
    <div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-4">
      <button type="button" className="absolute right-4 top-4" aria-label="Đóng lịch hẹn" onClick={onClose}><X /></button>
      <BookingsPage embedded onBack={onClose} onBookNew={() => { onClose(); onBookNew(); }} />
    </div>
  </div>;
};
