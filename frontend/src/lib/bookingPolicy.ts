import type { BackendBooking, PayOSPayment } from '../types';
const hasPayment = (booking: BackendBooking) => booking.paymentStatus === 'PAID' || booking.paymentStatus === 'PARTIALLY_PAID';
const unresolved = (booking: BackendBooking) => ['PAYMENT_REVIEW_REQUIRED', 'PAYMENT_RECONCILING', 'PAYMENT_STATE_CONFLICT'].includes(booking.paymentBlockerReason ?? '');
// Missing server flags must never open customer actions.
export const canReviewBooking = (booking: BackendBooking) => !unresolved(booking) && booking.reviewEligible === true && ['CONFIRMED', 'COMPLETED'].includes(booking.status) && hasPayment(booking);
export const canCompleteBooking = (booking: BackendBooking) => !unresolved(booking) && booking.completionEligible === true && booking.status === 'CONFIRMED' && hasPayment(booking);
export const canCancelBooking = (booking: BackendBooking) => booking.cancelEligible === true && booking.paymentStatus === 'UNPAID' && !['COMPLETED', 'CANCELLED'].includes(booking.status) && booking.paymentBlockerReason !== 'PAYMENT_REVIEW_REQUIRED';
export const canPayBooking = (booking: BackendBooking) => booking.paymentEligible === true && booking.paymentStatus === 'UNPAID' && !booking.paymentBlockerReason && ['PENDING', 'CONFIRMED', 'CANCELLED'].includes(booking.status);
export const paymentSupportMessage = (booking: BackendBooking) => unresolved(booking)
  ? 'Giao dịch đang cần đối soát. Không thanh toán lại; vui lòng gửi Phản hồi để liên hệ hỗ trợ.'
  : hasPayment(booking) && booking.status !== 'COMPLETED' ? 'Lịch hẹn đã thanh toán/đặt cọc không thể tự hủy. Cần hỗ trợ, vui lòng gửi Phản hồi.' : null;
export function safeCheckout(payment: PayOSPayment, bookingId: number): string | null {
  if (payment.bookingId !== bookingId || payment.status !== 'PENDING' || payment.requiresManualReview !== false || payment.checkoutAllowed === false || payment.verificationPending === true || !payment.checkoutUrl) return null;
  try {
    const url = new URL(payment.checkoutUrl);
    return url.protocol === 'https:' && url.hostname === 'pay.payos.vn' && !url.port && !url.username && !url.password ? payment.checkoutUrl : null;
  } catch { return null; }
}

export function eligibleReviewBookings(bookings: BackendBooking[], scope: { bookingId?: number; serviceId?: number; supplierId?: number }) {
  const validId = (value: number | undefined) => value !== undefined && Number.isSafeInteger(value) && value > 0;
  if (scope.bookingId !== undefined && !validId(scope.bookingId)) return [];
  if (scope.bookingId === undefined && !validId(scope.serviceId) && !validId(scope.supplierId)) return [];
  return bookings.filter((item) => canReviewBooking(item) && (scope.bookingId !== undefined
    ? item.id === scope.bookingId
    : (scope.serviceId === undefined || item.serviceId === scope.serviceId)
      && (scope.supplierId === undefined || item.supplierId === scope.supplierId)));
}
