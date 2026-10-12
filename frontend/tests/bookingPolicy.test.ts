import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canCompleteBooking, canReviewBooking, eligibleReviewBookings } from '../src/lib/bookingPolicy';
import type { BackendBooking } from '../src/types';
for (const status of ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const) {
  for (const paymentStatus of ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'] as const) {
    test(`${status}/${paymentStatus}: state and server flags both required`, () => {
      const booking = { status, paymentStatus, reviewEligible: true, completionEligible: true } as BackendBooking;
      const paid = paymentStatus === 'PAID' || paymentStatus === 'PARTIALLY_PAID';
      assert.equal(canReviewBooking(booking), status === 'COMPLETED' && paid);
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
