import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BackendBooking } from '../src/types';
import { bookingEndAt, emptyHistoryFilters, isUpcomingBooking, paymentView, selectHistoryBookings } from '../src/lib/bookingHistoryView';
import { mergeHistorySnapshot, reconcileHistoryPayment } from '../src/lib/bookingHistorySync';

const b = (id: number, date: string, status: BackendBooking['status'] = 'PENDING') => ({ id, bookingCode: `BL-${id}`, appointmentDate: date, startTime: '09:00', endTime: '10:00', serviceName: 'Cắt tóc nữ', supplierName: 'Salon Hà Nội', practitionerName: 'Nguyễn Ánh', status, paymentStatus: 'UNPAID', paymentEligible: true, totalAmount: 50000 } as BackendBooking);
const now = Date.parse('2026-10-29T09:30:00+07:00');

test('history grouping uses Vietnam appointment end including overnight, without inventing completion', () => {
  const overnight = { ...b(1, '2026-10-28', 'CONFIRMED'), startTime: '23:30', endTime: '01:00' };
  assert.equal(bookingEndAt(overnight), Date.parse('2026-10-29T01:00:00+07:00'));
  assert.equal(isUpcomingBooking(overnight, Date.parse('2026-10-29T00:30:00+07:00')), true);
  assert.equal(isUpcomingBooking(overnight, Date.parse('2026-10-29T01:00:00+07:00')), false);
  assert.equal(overnight.status, 'CONFIRMED');
  assert.equal(isUpcomingBooking(b(2, '2026-11-01', 'CANCELLED'), now), false);
});

test('nearest sort is deterministic: upcoming first, then most recent history; source array is unchanged', () => {
  const input = [b(1, '2026-10-27'), b(2, '2026-11-01'), b(3, '2026-10-29'), b(4, '2026-10-28', 'COMPLETED')];
  assert.deepEqual(selectHistoryBookings(input, emptyHistoryFilters, now).map(x => x.id), [3, 2, 4, 1]);
  assert.deepEqual(input.map(x => x.id), [1, 2, 3, 4]);
  assert.deepEqual(selectHistoryBookings(input, { ...emptyHistoryFilters, scope: 'history' }, now).map(x => x.id), [4, 1]);
});

test('search, status, payment and inclusive appointment dates combine without mixing deposit/manual/refund', () => {
  const rows = [b(1, '2026-10-29'), { ...b(2, '2026-10-30', 'CONFIRMED'), paymentStatus: 'PARTIALLY_PAID', paymentOption: 'DEPOSIT_50' }, { ...b(3, '2026-10-30'), paymentBlockerReason: 'PAYMENT_RECONCILING' }] as BackendBooking[];
  const filters = { ...emptyHistoryFilters, query: 'cat toc nu', from: '2026-10-29', to: '2026-10-30', payment: 'PARTIALLY_PAID', status: 'CONFIRMED' };
  assert.deepEqual(selectHistoryBookings(rows, filters, now).map(x => x.id), [2]);
  assert.match(paymentView(rows[1]).label, /50%/);
  assert.deepEqual(selectHistoryBookings(rows, { ...emptyHistoryFilters, payment: 'UNPAID' }, now).map(x => x.id), [1]);
  assert.deepEqual(selectHistoryBookings(rows, { ...filters, from: '2026-11-01' }, now), []);
  assert.equal(paymentView({ ...rows[1], paymentBlockerReason: 'PAYMENT_REVIEW_REQUIRED' }).filter, 'REVIEW');
  assert.equal(paymentView({ ...rows[0], paymentStatus: 'REFUNDED' }).filter, 'REFUNDED');
  assert.equal(paymentView({ ...rows[0], paymentStatus: undefined }).filter, 'VERIFYING');
});

test('raw refresh cannot clear unresolved evidence, but a verified update may; another account/list is not retained', async () => {
  const raw = { ...b(1, '2026-10-29'), paymentOption: 'DEPOSIT_05' } as BackendBooking;
  const blocked = { ...raw, paymentEligible: false, paymentBlockerReason: 'PAYMENT_RECONCILING' };
  assert.equal(mergeHistorySnapshot([blocked], [raw])[0].paymentEligible, false);
  assert.equal(mergeHistorySnapshot([blocked], [raw])[0].paymentBlockerReason, 'PAYMENT_RECONCILING');
  assert.deepEqual(mergeHistorySnapshot([blocked], []), []);
  assert.equal(mergeHistorySnapshot([blocked], [b(2, '2026-10-29')])[0].paymentBlockerReason, undefined);
  const paid = { ...raw, status: 'CONFIRMED', paymentStatus: 'PARTIALLY_PAID', paymentEligible: false } as BackendBooking;
  assert.equal(mergeHistorySnapshot([blocked], [paid])[0], paid);
  const manual = { ...raw, paymentBlockerReason: 'PAYMENT_REVIEW_REQUIRED', paymentEligible: false };
  const result = await reconcileHistoryPayment(raw, async () => ({ bookingId: 1, status: 'PENDING', verificationPending: true } as any), async () => manual);
  assert.equal(result.paymentBlockerReason, 'PAYMENT_REVIEW_REQUIRED', 'a newer server manual decision must survive an older pending response');
});
