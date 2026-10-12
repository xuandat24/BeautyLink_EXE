import type { BackendBooking } from '../types';
const hasPayment = (booking: BackendBooking) => booking.paymentStatus === 'PAID' || booking.paymentStatus === 'PARTIALLY_PAID';
// Missing server flags must never open customer actions.
export const canReviewBooking = (booking: BackendBooking) => booking.reviewEligible === true && booking.status === 'COMPLETED' && hasPayment(booking);
export const canCompleteBooking = (booking: BackendBooking) => booking.completionEligible === true && booking.status === 'CONFIRMED' && hasPayment(booking);

export function eligibleReviewBookings(bookings: BackendBooking[], scope: { bookingId?: number; serviceId?: number; supplierId?: number }) {
  const validId = (value: number | undefined) => value !== undefined && Number.isSafeInteger(value) && value > 0;
  if (scope.bookingId !== undefined && !validId(scope.bookingId)) return [];
  if (scope.bookingId === undefined && !validId(scope.serviceId) && !validId(scope.supplierId)) return [];
  return bookings.filter((item) => canReviewBooking(item) && (scope.bookingId !== undefined
    ? item.id === scope.bookingId
    : (scope.serviceId === undefined || item.serviceId === scope.serviceId)
      && (scope.supplierId === undefined || item.supplierId === scope.supplierId)));
}
