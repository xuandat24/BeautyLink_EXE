import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsPaymentSync, reconcileHistoryPayment } from '../src/lib/bookingHistorySync';
import type { BackendBooking, PayOSPayment } from '../src/types';
const booking = { id: 7, status: 'PENDING', paymentStatus: 'UNPAID', paymentOption: 'DEPOSIT_05', paymentEligible: true } as BackendBooking;
test('history reconciles the existing payment before exposing paid status or another checkout', async () => {
  const calls: string[] = [];
  const paid = { ...booking, status: 'CONFIRMED', paymentStatus: 'PARTIALLY_PAID', paymentEligible: false } as BackendBooking;
  const actual = await reconcileHistoryPayment(booking, async id => { calls.push(`status:${id}`); return { bookingId: id, status: 'PAID', requiresManualReview: false } as PayOSPayment; }, async id => { calls.push(`booking:${id}`); return paid; });
  assert.deepEqual(calls, ['status:7', 'booking:7']); assert.equal(actual, paid); assert.equal(actual.paymentEligible, false);
});
test('history timeout, uncertain evidence, manual and wrong identity fail closed without creating a replacement', async () => {
  const current = async () => booking;
  const uncertain = await reconcileHistoryPayment(booking, async () => { throw new Error('timeout'); }, current);
  assert.equal(uncertain.paymentEligible, false); assert.equal(uncertain.paymentBlockerReason, 'PAYMENT_RECONCILING');
  for (const payment of [{ bookingId: 99 }, { bookingId: 7, verificationPending: true }, { bookingId: 7, requiresManualReview: true }]) {
    const result = await reconcileHistoryPayment(booking, async () => payment as PayOSPayment, current);
    assert.equal(result.paymentEligible, false);
  }
});
test('paid/refunded and bookings without attempts do not poll PayOS in history', () => {
  assert.equal(needsPaymentSync(booking), true);
  assert.equal(needsPaymentSync({ ...booking, paymentStatus: 'PAID' }), false);
  assert.equal(needsPaymentSync({ ...booking, paymentStatus: 'REFUNDED' }), false);
  assert.equal(needsPaymentSync({ ...booking, paymentOption: undefined }), false);
  assert.equal(needsPaymentSync({ ...booking, paymentOption: undefined, paymentBlockerReason: 'PAYMENT_REVIEW_REQUIRED' }), true);
});
