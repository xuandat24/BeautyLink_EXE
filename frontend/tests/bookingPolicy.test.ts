import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canCancelBooking, canPayBooking, canCompleteBooking, canReviewBooking, eligibleReviewBookings, safeCheckout } from '../src/lib/bookingPolicy';
import type { BackendBooking, PayOSPayment } from '../src/types';
for (const status of ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const) {
  for (const paymentStatus of ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'] as const) {
    test(`${status}/${paymentStatus}: state and server flags both required`, () => {
      const booking = { status, paymentStatus, reviewEligible: true, completionEligible: true } as BackendBooking;
      const paid = paymentStatus === 'PAID' || paymentStatus === 'PARTIALLY_PAID';
      assert.equal(canReviewBooking(booking), ['CONFIRMED', 'COMPLETED'].includes(status) && paid);
      assert.equal(canCompleteBooking(booking), status === 'CONFIRMED' && paid);
      assert.equal(canReviewBooking({ ...booking, reviewEligible: false }), false);
      assert.equal(canCompleteBooking({ ...booking, completionEligible: false }), false);
    });
  }
}
test('missing flags never allow either action', () => {
  assert.equal(canReviewBooking({ status: 'COMPLETED', paymentStatus: 'PAID' } as BackendBooking), false);
  assert.equal(canCompleteBooking({ status: 'CONFIRMED', paymentStatus: 'PAID' } as BackendBooking), false);
});
test('cancel and checkout fail closed without flags, paid/refunded cannot cancel or pay', () => {
  for (const paymentStatus of ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'] as const) {
    const b = { status: 'PENDING', paymentStatus } as BackendBooking;
    assert.equal(canCancelBooking(b), false); assert.equal(canPayBooking(b), false);
    assert.equal(canCancelBooking({ ...b, cancelEligible: true }), paymentStatus === 'UNPAID');
    assert.equal(canPayBooking({ ...b, paymentEligible: true }), paymentStatus === 'UNPAID');
  }
});
test('manual-review/reconciling server reasons override stale eligibility', () => {
  for (const paymentBlockerReason of ['PAYMENT_REVIEW_REQUIRED', 'PAYMENT_RECONCILING', 'PAYMENT_STATE_CONFLICT']) {
    const b = { status: 'COMPLETED', paymentStatus: 'PAID', reviewEligible: true, completionEligible: true, paymentEligible: true, cancelEligible: true, paymentBlockerReason } as BackendBooking;
    assert.equal(canReviewBooking(b), false); assert.equal(canCompleteBooking({ ...b, status: 'CONFIRMED' }), false);
    assert.equal(canPayBooking({ ...b, paymentStatus: 'UNPAID' }), false);
  }
});
test('checkout rejects manual, terminal, missing flags, wrong booking and unsafe URL', () => {
  const p = { bookingId: 1, status: 'PENDING', requiresManualReview: false, checkoutUrl: 'https://pay.payos.vn/web/test' } as PayOSPayment;
  assert.equal(safeCheckout(p, 1), p.checkoutUrl);
  assert.equal(safeCheckout(p, 2), null);
  for (const status of ['PAID', 'CANCELLED', 'EXPIRED', 'FAILED', 'REVIEW_REQUIRED'] as const) assert.equal(safeCheckout({ ...p, status }, 1), null);
  assert.equal(safeCheckout({ ...p, requiresManualReview: true }, 1), null);
  assert.equal(safeCheckout({ ...p, requiresManualReview: undefined } as unknown as PayOSPayment, 1), null);
  for (const checkoutUrl of [null, 'http://pay.payos.vn/web/test', 'https://pay.payos.vn.evil.test', 'https://user@pay.payos.vn/web/test', 'bad']) assert.equal(safeCheckout({ ...p, checkoutUrl }, 1), null);
});

const reviewBookings = [
  { id: 1, serviceId: 17, supplierId: 42, status: 'COMPLETED', paymentStatus: 'PAID', reviewEligible: true },
  { id: 2, serviceId: 33, supplierId: 42, status: 'COMPLETED', paymentStatus: 'PARTIALLY_PAID', reviewEligible: true },
  { id: 3, serviceId: 17, supplierId: 99, status: 'COMPLETED', paymentStatus: 'PAID', reviewEligible: true },
  { id: 4, serviceId: 17, supplierId: 42, status: 'CONFIRMED', paymentStatus: 'PAID', reviewEligible: false },
] as BackendBooking[];

test('service review respects both service and stable supplier IDs', () => {
  assert.deepEqual(eligibleReviewBookings(reviewBookings, { serviceId: 17, supplierId: 42 }).map((item) => item.id), [1]);
});
test('supplier review selects eligible bookings at that supplier only', () => {
  assert.deepEqual(eligibleReviewBookings(reviewBookings, { supplierId: 42 }).map((item) => item.id), [1, 2]);
});
test('missing or invalid IDs fail closed', () => {
  for (const scope of [{}, { supplierId: NaN }, { supplierId: 0 }, { bookingId: -1 }, { serviceId: Infinity }]) {
    assert.deepEqual(eligibleReviewBookings(reviewBookings, scope), []);
  }
});
test('explicit booking scope never selects another or an ineligible booking', () => {
  assert.deepEqual(eligibleReviewBookings(reviewBookings, { bookingId: 2 }).map((item) => item.id), [2]);
  assert.deepEqual(eligibleReviewBookings(reviewBookings, { bookingId: 4 }), []);
});
