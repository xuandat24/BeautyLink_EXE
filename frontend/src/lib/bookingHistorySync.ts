import type { BackendBooking, PayOSPayment } from '../types';
export const needsPaymentSync = (b: BackendBooking) => b.paymentStatus === 'UNPAID'
  && (b.paymentOption != null || ['PAYMENT_RECONCILING', 'PAYMENT_REVIEW_REQUIRED', 'PAYMENT_STATE_CONFLICT'].includes(b.paymentBlockerReason ?? ''));
export const hasPaymentHistory = (b: BackendBooking) => b.paymentAttemptActive === true || b.paymentOption != null
  || ['PAYMENT_RECONCILING', 'PAYMENT_REVIEW_REQUIRED', 'PAYMENT_STATE_CONFLICT'].includes(b.paymentBlockerReason ?? '');
const manual = (b: BackendBooking) => ['PAYMENT_REVIEW_REQUIRED', 'PAYMENT_STATE_CONFLICT'].includes(b.paymentBlockerReason ?? '');

/** A raw list refresh alone does not resolve an earlier inconclusive payment observation. */
export function mergeHistorySnapshot(previous: BackendBooking[], incoming: BackendBooking[]): BackendBooking[] {
  const known = new Map(previous.map(b => [b.id, b]));
  return incoming.map(b => {
    const old = known.get(b.id);
    if (!old || !needsPaymentSync(b) || !old.paymentBlockerReason) return b;
    if (['PAYMENT_RECONCILING', 'PAYMENT_REVIEW_REQUIRED', 'PAYMENT_STATE_CONFLICT'].includes(b.paymentBlockerReason ?? '')) return b;
    if (!['PAYMENT_RECONCILING', 'PAYMENT_REVIEW_REQUIRED', 'PAYMENT_STATE_CONFLICT'].includes(old.paymentBlockerReason)) return b;
    return { ...b, paymentEligible: false, reviewEligible: false, completionEligible: false, paymentBlockerReason: old.paymentBlockerReason };
  });
}
export async function reconcileHistoryPayment(booking: BackendBooking,
  status: (id: number) => Promise<PayOSPayment>, reload: (id: number) => Promise<BackendBooking>): Promise<BackendBooking> {
  const blocked = { ...booking, paymentEligible: false, reviewEligible: false, completionEligible: false, paymentBlockerReason: ['PAYMENT_REVIEW_REQUIRED', 'PAYMENT_STATE_CONFLICT'].includes(booking.paymentBlockerReason ?? '') ? booking.paymentBlockerReason : 'PAYMENT_RECONCILING' };
  try {
    const payment = await status(booking.id);
    if (payment.bookingId !== booking.id || !['PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'FAILED', 'REVIEW_REQUIRED'].includes(payment.status)) return blocked;
    const current = await reload(booking.id);
    if (current.id !== booking.id) return blocked;
    if (manual(current)) return current;
    if (payment.verificationPending || payment.requiresManualReview) return { ...current, paymentEligible: false,
      reviewEligible: false, completionEligible: false,
      paymentBlockerReason: payment.requiresManualReview ? 'PAYMENT_REVIEW_REQUIRED' : 'PAYMENT_RECONCILING' };
    if (payment.status === 'PAID' && !['PAID', 'PARTIALLY_PAID'].includes(current.paymentStatus ?? '')) return blocked;
    return current;
  } catch { return blocked; } // Inconclusive GET is never evidence of unpaid money or permission to pay again.
}
