const key = 'bookingPayment';
export function paymentBookingId(search = window.location.search): number | null {
  const raw = new URLSearchParams(search).get(key);
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw); return Number.isSafeInteger(id) ? id : null;
}
export function setPaymentBookingId(id: number | null, push = false) {
  const url = new URL(window.location.href);
  if (id === null) url.searchParams.delete(key); else url.searchParams.set(key, String(id));
  window.history[push ? 'pushState' : 'replaceState'](null, '', url);
}
export function continuationDestination(): 'bookings' | null {
  const paymentReturn = new URLSearchParams(window.location.search).get('payment');
  if (['success', 'cancelled'].includes(paymentReturn ?? '') || ['#login', '#register', '#logout'].includes(window.location.hash.toLowerCase())) return null;
  return paymentBookingId() === null ? null : 'bookings';
}
