import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { PaymentContinuationDialog } from '../src/components/PaymentContinuationDialog';
import { BookingsPage } from '../src/components/BookingsPage';
import { CheckoutPage } from '../src/components/CheckoutPage';
import { beautyApi, setAccessToken } from '../src/services/beautyApi';
import { paymentBookingId, setPaymentBookingId, continuationDestination } from '../src/lib/paymentNavigation';
import { bookingToday, bookingDay, bookingMaxDate, validBookingDate } from '../src/lib/bookingTime';
import { safeCheckout } from '../src/lib/bookingPolicy';
import type { BackendBooking, PayOSPayment, CurrentUser } from '../src/types';

const pending = { id: 42, bookingCode: 'RESUME-42', serviceName: 'Backend service', supplierName: 'Backend supplier', practitionerName: 'Test',
  status: 'PENDING', paymentStatus: 'UNPAID', appointmentDate: '2030-01-01', startTime: '10:00', endTime: '11:00', totalAmount: 500000,
  paymentEligible: true, paymentOption: 'FULL_100', paymentVoucherCode: 'SERVER-VOUCHER', paymentAttemptActive: true } as BackendBooking;
function environment(query = '') {
  const dom = new JSDOM('<div id="root"></div>', { url: `http://localhost/${query}` });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, sessionStorage: dom.window.sessionStorage, localStorage: dom.window.localStorage });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  setAccessToken('test-session');
  return { dom, root: createRoot(document.getElementById('root')!) };
}
const click = async (text: string, twice = false) => act(async () => {
  const button = [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text));
  assert.ok(button); button.click(); if (twice) button.click();
});
test('Vietnam calendar dates remain correct at UTC midnight, leap month and invalid dates', () => {
  const at = new Date('2028-01-30T17:00:00Z');
  assert.equal(bookingToday(at), '2028-01-31'); assert.equal(bookingDay(1, at), '2028-02-01'); assert.equal(bookingMaxDate(at), '2028-02-29');
  assert.equal(validBookingDate('2028-02-29', at), true); assert.equal(validBookingDate('2028-03-01', at), false);
  assert.equal(validBookingDate('2028-02-30', at), false); assert.equal(validBookingDate('2028-01-30', at), false);
});
test('checkout URL rejects credentials, non-HTTPS, foreign host and non-default port', () => {
  const payment = { bookingId: 42, status: 'PENDING', requiresManualReview: false } as PayOSPayment;
  for (const url of ['http://pay.payos.vn/x', 'https://evil.test/x', 'https://pay.payos.vn:444/x', 'https://u:p@pay.payos.vn/x', 'javascript:alert(1)'])
    assert.equal(safeCheckout({ ...payment, checkoutUrl: url }, 42), null);
  assert.equal(safeCheckout({ ...payment, checkoutUrl: 'https://pay.payos.vn:443/web/x' }, 42), 'https://pay.payos.vn:443/web/x');
});
test('URL restores only a positive booking identifier, never price/URL/eligibility', async () => {
  const { dom, root } = environment('?bookingPayment=42&price=1&checkout=https://evil.test');
  try {
    assert.equal(paymentBookingId(), 42); setPaymentBookingId(73); assert.equal(paymentBookingId(), 73);
    for (const hash of ['#account', '#home', '#checkout', '#bookings']) {
      window.history.replaceState(null, '', `/?bookingPayment=73${hash}`); assert.equal(continuationDestination(), 'bookings');
    }
    window.history.replaceState(null, '', '/?bookingPayment=73#login'); assert.equal(continuationDestination(), null);
    window.history.replaceState(null, '', '/?bookingPayment=73&payment=success'); assert.equal(continuationDestination(), null);
    for (const value of ['-1', '0', '1e3', '9007199254740993', 'wrong']) {
      window.history.replaceState(null, '', `/?bookingPayment=${value}`); assert.equal(paymentBookingId(), null);
    }
    setPaymentBookingId(null); assert.equal(paymentBookingId(), null);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
test('continuation rereads same booking, preserves pending options and double submit never creates a booking', async () => {
  const { dom, root } = environment(); const old = { read: beautyApi.myBooking, pay: beautyApi.createPayOSPayment, create: beautyApi.createBooking };
  let reads = 0, pays = 0, creates = 0; let finish!: (value: PayOSPayment) => void;
  beautyApi.myBooking = async id => { assert.equal(id, 42); reads++; return pending; };
  beautyApi.createBooking = async () => { creates++; throw new Error('must not create booking'); };
  beautyApi.createPayOSPayment = async (id, input) => { assert.equal(id, 42); assert.equal(input.paymentOption, 'FULL_100'); assert.equal(input.voucherCode, 'SERVER-VOUCHER'); pays++; return new Promise(resolve => { finish = resolve; }); };
  try {
    await act(async () => root.render(React.createElement(PaymentContinuationDialog, { bookingId: 42, onClose() {} })));
    assert.equal((document.querySelector('select') as HTMLSelectElement).value, 'FULL_100'); assert.equal((document.querySelector('select') as HTMLSelectElement).disabled, true);
    assert.equal((document.querySelector('input') as HTMLInputElement).value, 'SERVER-VOUCHER');
    await click('Tiếp tục tới PayOS', true); assert.equal(reads, 2); assert.equal(pays, 1); assert.equal(creates, 0);
    await act(async () => finish({ bookingId: 42, status: 'PENDING', requiresManualReview: false, checkoutUrl: 'https://evil.test/checkout' } as PayOSPayment));
    assert.match(document.body.textContent ?? '', /checkout an toàn/); assert.equal(sessionStorage.getItem('beautylink_payos_order_code'), null);
  } finally { await act(async () => root.unmount()); beautyApi.myBooking = old.read; beautyApi.createPayOSPayment = old.pay; beautyApi.createBooking = old.create; dom.window.close(); }
});
test('inactive legacy booking starts a new 5% attempt from a server quote', async () => {
  const { dom, root } = environment();
  const old = { read: beautyApi.myBooking, quote: beautyApi.bookingPaymentQuote };
  let quotedOption = '';
  beautyApi.myBooking = async () => ({ ...pending, paymentAttemptActive: false, paymentOption: 'DEPOSIT_50', paymentVoucherCode: 'OLD50', paymentAmount: 250000, paymentRemainingAmount: 250000 });
  beautyApi.bookingPaymentQuote = async (_id, option) => {
    quotedOption = option;
    return { originalAmount: 500000, discountAmount: 0, payableAmount: 500000, amount: 25000, remainingAmount: 475000,
      paymentOption: option, paymentAvailable: true, unavailableReason: null };
  };
  try {
    await act(async () => root.render(React.createElement(PaymentContinuationDialog, { bookingId: 42, onClose() {} })));
    assert.equal((document.querySelector('select') as HTMLSelectElement).value, 'DEPOSIT_05');
    assert.equal((document.querySelector('select') as HTMLSelectElement).disabled, false);
    assert.equal((document.querySelector('input') as HTMLInputElement).value, '');
    assert.equal(quotedOption, 'DEPOSIT_05');
    assert.match(document.body.textContent ?? '', /25\.000đ/);
    assert.match(document.body.textContent ?? '', /475\.000đ/);
  } finally {
    await act(async () => root.unmount());
    beautyApi.myBooking = old.read;
    beautyApi.bookingPaymentQuote = old.quote;
    dom.window.close();
  }
});
test('server blockers and stale capability stop checkout; missing fields fail closed', async () => {
  const { dom, root } = environment(); const old = { read: beautyApi.myBooking, pay: beautyApi.createPayOSPayment };
  let payments = 0; beautyApi.createPayOSPayment = async () => { payments++; throw new Error('must not pay'); };
  try {
    let id = 42;
    for (const delta of [ { paymentEligible: undefined }, { paymentStatus: 'PAID' }, { paymentStatus: 'PARTIALLY_PAID' }, { paymentStatus: 'REFUNDED' },
      { status: 'COMPLETED' }, { status: 'CANCELLED', paymentEligible: false }, { paymentBlockerReason: 'PAYMENT_REVIEW_REQUIRED' }, { paymentBlockerReason: 'PAYMENT_RECONCILING' } ]) {
      id++; beautyApi.myBooking = async () => ({ ...pending, ...delta, id } as BackendBooking);
      await act(async () => root.render(React.createElement(PaymentContinuationDialog, { bookingId: id, onClose() {} })));
      const button = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Tiếp tục tới PayOS'))!; assert.equal(button.disabled, true);
    }
    let calls = 0; beautyApi.myBooking = async () => ++calls === 1 ? pending : { ...pending, paymentEligible: false, paymentBlockerReason: 'PAYMENT_REVIEW_REQUIRED' };
    await act(async () => root.render(React.createElement(PaymentContinuationDialog, { bookingId: 42, onClose() {} })));
    await click('Tiếp tục tới PayOS'); assert.match(document.body.textContent ?? '', /không còn được phép/); assert.equal(payments, 0);
  } finally { await act(async () => root.unmount()); beautyApi.myBooking = old.read; beautyApi.createPayOSPayment = old.pay; dom.window.close(); }
});
test('stale booking/account responses are discarded, failed read has retry and missing token never pays', async () => {
  const { dom, root } = environment(); const read = beautyApi.myBooking;
  const loads: Array<(value: BackendBooking) => void> = [];
  beautyApi.myBooking = () => new Promise(resolve => loads.push(resolve));
  try {
    await act(async () => root.render(React.createElement(PaymentContinuationDialog, { bookingId: 42, onClose() {} })));
    await act(async () => root.render(React.createElement(PaymentContinuationDialog, { bookingId: 43, onClose() {} })));
    await act(async () => loads[1]({ ...pending, id: 43, bookingCode: 'CURRENT-43' }));
    await act(async () => loads[0](pending)); assert.match(document.body.textContent ?? '', /CURRENT-43/); assert.doesNotMatch(document.body.textContent ?? '', /RESUME-42/);
    beautyApi.myBooking = async () => { throw new Error('Network failure'); }; await click('Làm mới'); assert.match(document.body.textContent ?? '', /Network failure/);
    sessionStorage.clear(); localStorage.clear(); await act(async () => window.dispatchEvent(new dom.window.Event('storage')));
    assert.match(document.body.textContent ?? '', /đăng nhập lại/); assert.equal(document.querySelector('select'), null);
  } finally { await act(async () => root.unmount()); beautyApi.myBooking = read; dom.window.close(); }
});
test('checkout remount with booking identifier uses backend booking, even with empty cart', async () => {
  const { dom, root } = environment('?bookingPayment=42'); const old = { read: beautyApi.myBooking, create: beautyApi.createBooking };
  let creates = 0; beautyApi.myBooking = async () => pending; beautyApi.createBooking = async () => { creates++; throw new Error('must not create'); };
  try {
    await act(async () => root.render(React.createElement(CheckoutPage, { currentUser: { id: 1, role: 'CUSTOMER' } as CurrentUser, onBack() {}, onViewBookings() {}, onNeedLogin() {} })));
    assert.match(document.body.textContent ?? '', /RESUME-42/); assert.equal(creates, 0);
    await click('Quay lại'); assert.equal(paymentBookingId(), null); assert.equal(creates, 0);
  } finally { await act(async () => root.unmount()); beautyApi.myBooking = old.read; beautyApi.createBooking = old.create; dom.window.close(); }
});
test('bookings restores continuation after mount and reacts to browser navigation', async () => {
  const { dom, root } = environment('?bookingPayment=42'); const old = { read: beautyApi.myBooking, list: beautyApi.myBookings };
  beautyApi.myBooking = async () => pending; beautyApi.myBookings = async () => [pending];
  try {
    await act(async () => root.render(React.createElement(BookingsPage, { onBack() {}, onBookNew() {} })));
    assert.ok(document.querySelector('[role="dialog"]'));
    await click('Quay lại'); assert.equal(document.querySelector('[role="dialog"]'), null);
    await act(async () => { setPaymentBookingId(42); window.dispatchEvent(new dom.window.PopStateEvent('popstate')); });
    assert.ok(document.querySelector('[role="dialog"]'));
  } finally { await act(async () => root.unmount()); beautyApi.myBooking = old.read; beautyApi.myBookings = old.list; dom.window.close(); }
});
