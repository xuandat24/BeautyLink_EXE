import type { BackendBooking } from '../types';

export type BookingHistoryScope = 'all' | 'upcoming' | 'history';
export interface BookingHistoryFilters {
  scope: BookingHistoryScope; query: string; status: string; payment: string; from: string; to: string;
  sort: 'nearest' | 'appointment-desc' | 'newest';
}
export const emptyHistoryFilters: BookingHistoryFilters = { scope: 'all', query: '', status: '', payment: '', from: '', to: '', sort: 'nearest' };
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const startAt = (b: BackendBooking) => Date.parse(`${b.appointmentDate}T${b.startTime}+07:00`);
export function bookingEndAt(b: BackendBooking): number {
  const end = Date.parse(`${b.appointmentDate}T${b.endTime}+07:00`);
  return end <= startAt(b) ? end + 86400000 : end;
}
export const isUpcomingBooking = (b: BackendBooking, now = Date.now()) => !['COMPLETED', 'CANCELLED'].includes(b.status) && bookingEndAt(b) > now;
export function paymentView(b: BackendBooking): { label: string; tone: string; filter: string } {
  // A manual blocker must remain visible even on an already-paid primary attempt.
  if (['PAYMENT_REVIEW_REQUIRED', 'PAYMENT_STATE_CONFLICT'].includes(b.paymentBlockerReason ?? '')) return { label: 'Cần đối soát thanh toán', tone: 'border-rose-200 bg-rose-50 text-rose-800', filter: 'REVIEW' };
  if (b.paymentBlockerReason === 'PAYMENT_RECONCILING') return { label: 'Chờ xác minh thanh toán', tone: 'border-amber-200 bg-amber-50 text-amber-900', filter: 'VERIFYING' };
  if (b.paymentStatus === 'PAID') return { label: 'Đã thanh toán đủ', tone: 'border-emerald-200 bg-emerald-50 text-emerald-800', filter: 'PAID' };
  if (b.paymentStatus === 'PARTIALLY_PAID') return { label: b.paymentOption === 'DEPOSIT_50' ? 'Đã cọc 50% (giao dịch cũ)' : b.paymentOption === 'DEPOSIT_05' ? 'Đã cọc 5%' : 'Đã đặt cọc', tone: 'border-amber-200 bg-amber-50 text-amber-900', filter: 'PARTIALLY_PAID' };
  if (b.paymentStatus === 'REFUNDED') return { label: 'Đã hoàn tiền', tone: 'border-purple-200 bg-purple-50 text-purple-800', filter: 'REFUNDED' };
  if (b.paymentStatus !== 'UNPAID') return { label: 'Chưa xác định thanh toán', tone: 'border-slate-200 bg-slate-50 text-slate-700', filter: 'VERIFYING' };
  return { label: b.status === 'CANCELLED' ? 'Chưa thanh toán · đã hủy' : 'Chưa thanh toán', tone: 'border-slate-200 bg-slate-50 text-slate-700', filter: 'UNPAID' };
}
export function selectHistoryBookings(bookings: BackendBooking[], f: BookingHistoryFilters, now = Date.now()): BackendBooking[] {
  if (f.from && f.to && f.from > f.to) return [];
  const query = fold(f.query.trim());
  return bookings.filter(b => (!query || fold(`${b.bookingCode} ${b.serviceName} ${b.supplierName} ${b.practitionerName ?? ''}`).includes(query))
    && (f.scope === 'all' || (f.scope === 'upcoming' ? isUpcomingBooking(b, now) : !isUpcomingBooking(b, now)))
    && (!f.status || b.status === f.status) && (!f.payment || paymentView(b).filter === f.payment)
    && (!f.from || b.appointmentDate >= f.from) && (!f.to || b.appointmentDate <= f.to))
    .sort((a, b) => {
      if (f.sort === 'nearest') {
        const aa = isUpcomingBooking(a, now), bb = isUpcomingBooking(b, now);
        if (aa !== bb) return aa ? -1 : 1;
        return (aa ? startAt(a) - startAt(b) : startAt(b) - startAt(a)) || b.id - a.id;
      }
      if (f.sort === 'newest') return (Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? '') || startAt(b) - startAt(a)) || b.id - a.id;
      return startAt(b) - startAt(a) || b.id - a.id;
    });
}
export function bookingDateLabel(value: string): string {
  const [year, month, day] = value.split('-'); return day && month && year ? `${day}/${month}/${year}` : value;
}
