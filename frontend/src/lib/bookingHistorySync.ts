import type { BackendBooking, PayOSPayment } from '../types';
export const needsPaymentSync = (b: BackendBooking) => b.paymentStatus === 'UNPAID'
  && (b.paymentOption != null || ['PAYMENT_RECONCILING', 'PAYMENT_REVIEW_REQUIRED', 'PAYMENT_STATE_CONFLICT'].includes(b.paymentBlockerReason ?? ''));
export async function reconcileHistoryPayment(booking: BackendBooking,
  status: (id: number) => Promise<PayOSPayment>, reload: (id: number) => Promise<BackendBooking>): Promise<BackendBooking> {
  const blocked = { ...booking, paymentEligible: false, paymentBlockerReason: 'PAYMENT_RECONCILING' };
  try {
    const payment = await status(booking.id);
    if (payment.bookingId !== booking.id || !['PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'FAILED', 'REVIEW_REQUIRED'].includes(payment.status)) return blocked;
    const current = await reload(booking.id);
    if (current.id !== booking.id) return blocked;
    if (payment.verificationPending || payment.requiresManualReview) return { ...current, paymentEligible: false,
      paymentBlockerReason: payment.requiresManualReview ? 'PAYMENT_REVIEW_REQUIRED' : 'PAYMENT_RECONCILING' };
    if (payment.status === 'PAID' && !['PAID', 'PARTIALLY_PAID'].includes(current.paymentStatus)) return blocked;
    return current;
  } catch { return blocked; } // Inconclusive GET is never evidence of unpaid money or permission to pay again.
}
