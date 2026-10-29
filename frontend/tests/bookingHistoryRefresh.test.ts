import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { BookingsPage } from '../src/components/BookingsPage';
import { CheckoutPage } from '../src/components/CheckoutPage';
import { beautyApi, setAccessToken } from '../src/services/beautyApi';
import { sessionToken } from './sessionFixtures';
import { bookingDay } from '../src/lib/bookingTime';
import { closePaymentNavigation, paymentBookingId } from '../src/lib/paymentNavigation';
import type { BackendBooking, PayOSPayment } from '../src/types';

const booking = { id: 1, bookingCode: 'HISTORY-1', serviceId: 42, serviceName: 'Cắt tóc', supplierName: 'Salon kiểm thử', practitionerName: 'Chuyên viên', appointmentDate: bookingDay(1), startTime: '13:00', endTime: '14:00', totalAmount: 220000, status: 'PENDING', paymentStatus: 'UNPAID', paymentOption: 'DEPOSIT_05', paymentAttemptActive: true, paymentEligible: true } as BackendBooking;
const payment = { bookingId: 1, bookingCode: 'HISTORY-1', orderCode: 123, paymentLinkId: null, amount: 11000, remainingAmount: 209000, paymentOption: 'DEPOSIT_05', expiresAt: new Date(Date.now() + 600000).toISOString(), status: 'PENDING', requiresManualReview: false, verificationPending: true, checkoutAllowed: false } as PayOSPayment;
async function run(check: (root: ReturnType<typeof createRoot>) => Promise<void>) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/#bookings' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  setAccessToken(sessionToken());
  const root = createRoot(document.getElementById('root')!);
  const original = { ...beautyApi };
  try { await check(root); }
  finally { await act(async () => root.unmount()); Object.assign(beautyApi, original); dom.window.close(); }
}
const viewButton = () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Xem thanh toán');

test('background refresh retains card/button and payment label; inconclusive evidence stays blocked across raw refresh', async () => run(async root => {
  let reads = 0; const finish: Array<(value: PayOSPayment) => void> = [];
  beautyApi.myBookings = async () => [booking];
  beautyApi.myBooking = async () => booking;
  beautyApi.currentBookingPayment = () => { reads++; return new Promise(resolve => finish.push(resolve)); };
  await act(async () => root.render(React.createElement(BookingsPage, { onBack() {}, onBookNew() {} })));
  const card = document.querySelector('article'), button = viewButton();
  assert.ok(button); assert.equal(button.disabled, false);
  assert.match(card?.textContent ?? '', /Chưa thanh toán/);
  assert.doesNotMatch(card?.textContent ?? '', /Đang đối soát/);
  await act(async () => finish[0]({ ...payment, paymentLinkId: 'verified-test-link', checkoutAllowed: true, verificationPending: false }));
  await act(async () => window.dispatchEvent(new window.Event('beautylink-bookings-refresh')));
  assert.equal(reads, 2); assert.equal(viewButton(), button); assert.equal(document.querySelector('article'), card);
  assert.match(card?.textContent ?? '', /Chưa thanh toán/);
  await act(async () => finish[1](payment));
  assert.match(card?.textContent ?? '', /Chờ xác minh thanh toán/);
  await act(async () => window.dispatchEvent(new window.Event('beautylink-bookings-refresh')));
  assert.equal(reads, 3); assert.equal(viewButton(), button);
  assert.match(card?.textContent ?? '', /Chờ xác minh thanh toán/, 'raw UNPAID list cannot silently clear an unresolved observation');
  await act(async () => finish[2](payment));
}));

test('unknown payment has a read-only observer; account ownership/status is reloaded before rendering, no POST', async () => run(async root => {
  let posts = 0;
  beautyApi.myBookings = async () => [{ ...booking, paymentBlockerReason: 'PAYMENT_RECONCILING', paymentEligible: false }];
  beautyApi.myBooking = async () => ({ ...booking, paymentBlockerReason: 'PAYMENT_RECONCILING', paymentEligible: false });
  beautyApi.currentBookingPayment = async () => payment;
  beautyApi.payOSPaymentStatus = async () => payment;
  beautyApi.createPayOSPayment = async () => { posts++; throw new Error('Unexpected POST'); };
  await act(async () => root.render(React.createElement(BookingsPage, { onBack() {}, onBookNew() {} })));
  await act(async () => viewButton()!.click());
  assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'), 'VERIFYING');
  assert.equal(posts, 0); assert.equal(document.querySelector('img[alt^="Mã QR PayOS"]'), null);
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Quay lại lịch hẹn'))!.click());
  assert.doesNotMatch(locationSearch(), /bookingPayment/); assert.equal(document.querySelector('[data-checkout-state]'), null);
}));
function locationSearch() { return window.location.search; }

test('observer exit normalizes standalone history bookmark but preserves embedded account navigation and unrelated query', async () => run(async () => {
  window.history.replaceState(null, '', '/?bookingPayment=1&location=7#account');
  const length = window.history.length;
  closePaymentNavigation(true);
  assert.equal(paymentBookingId(), null); assert.equal(window.location.hash, '#bookings');
  assert.equal(window.location.search, '?location=7'); assert.equal(window.history.length, length);
  window.history.replaceState(null, '', '/?bookingPayment=1#account');
  closePaymentNavigation(false);
  assert.equal(paymentBookingId(), null); assert.equal(window.location.hash, '#account');
}));

test('a failed background retry cannot downgrade a known manual-review flag from the previous observation', async () => run(async root => {
  let reads = 0;
  beautyApi.myBookings = async () => [booking];
  beautyApi.myBooking = async () => booking;
  beautyApi.currentBookingPayment = async () => { if (++reads > 1) throw new Error('503 test'); return { ...payment, requiresManualReview: true, status: 'REVIEW_REQUIRED' }; };
  await act(async () => root.render(React.createElement(BookingsPage, { onBack() {}, onBookNew() {} })));
  assert.match(document.querySelector('article')?.textContent ?? '', /Cần đối soát thanh toán/);
  await act(async () => window.dispatchEvent(new window.Event('beautylink-bookings-refresh')));
  assert.equal(reads, 2);
  assert.match(document.querySelector('article')?.textContent ?? '', /Cần đối soát thanh toán/);
  assert.equal(viewButton()?.disabled, false);
}));

test('late provider response after leaving preparation cannot restore QR navigation intent', async () => run(async root => {
  let finish!: (value: PayOSPayment) => void, posts = 0;
  beautyApi.serviceCapacity = async (_id, date) => ({ date, qualifiedPractitioners: 1, reason: null, slots: [{ time: '13:00', availablePractitioners: 1, state: 'AVAILABLE' }] });
  beautyApi.servicePaymentQuote = async () => ({ paymentOption: 'DEPOSIT_05', originalAmount: 220000, discountAmount: 0, payableAmount: 220000, amount: 11000, remainingAmount: 209000, paymentAvailable: true } as any);
  beautyApi.createBooking = async () => ({ ...booking, paymentAttemptActive: false, paymentOption: null });
  beautyApi.createPayOSPayment = () => { posts++; return new Promise(resolve => { finish = resolve; }); };
  const props = { currentUser: { id: 1, role: 'CUSTOMER', name: 'Khách test', phone: '0900000001', bookingContactConfirmed: true } as any, directService: { id: 42, name: booking.serviceName, supplierName: booking.supplierName, price: 220000, imageUrl: '', categorySlug: 'hair', rating: 5 } as any, preselectedDate: booking.appointmentDate, preselectedTime: '13:00', onBack() {}, onNeedLogin() {}, onViewBookings() {} };
  await act(async () => root.render(React.createElement(CheckoutPage, props)));
  const click = async (text: string) => act(async () => [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text))!.click());
  await click('Tiếp tục: Chọn hình thức'); await click('Mở thanh toán QR');
  assert.equal(posts, 1); assert.match(locationSearch(), /bookingPayment=1/);
  await click('Quay lại lịch hẹn');
  await act(async () => finish(payment));
  assert.equal(locationSearch(), ''); assert.equal(document.querySelector('[data-checkout-state]'), null); assert.equal(posts, 1);
}));

test('manual refresh network failure retains the last list instead of blanking it', async () => run(async root => {
  let calls = 0;
  beautyApi.myBookings = async () => { if (++calls > 1) throw new Error('Test network unavailable'); return [{ ...booking, paymentOption: null, paymentAttemptActive: false }]; };
  await act(async () => root.render(React.createElement(BookingsPage, { onBack() {}, onBookNew() {} })));
  const card = document.querySelector('article');
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Làm mới'))!.click());
  assert.equal(calls, 2); assert.equal(document.querySelector('article'), card);
  assert.match(document.body.textContent ?? '', /Test network unavailable/);
}));

test('direct checkout exits clear payment intent before history navigation; no QR reopens or second payment starts', async () => run(async root => {
  let navigations = 0, posts = 0;
  beautyApi.serviceCapacity = async (_id, date) => ({ date, qualifiedPractitioners: 1, reason: null, slots: [{ time: '13:00', availablePractitioners: 1, state: 'AVAILABLE' }] });
  beautyApi.servicePaymentQuote = async () => ({ paymentOption: 'DEPOSIT_05', originalAmount: 220000, discountAmount: 0, payableAmount: 220000, amount: 11000, remainingAmount: 209000, paymentAvailable: true } as any);
  beautyApi.createBooking = async () => ({ ...booking, paymentAttemptActive: false, paymentOption: null });
  beautyApi.createPayOSPayment = async () => { posts++; return payment; };
  beautyApi.payOSPaymentStatus = async () => payment;
  const user = { id: 1, role: 'CUSTOMER', name: 'Khách test', phone: '0900000001', bookingContactConfirmed: true } as any;
  const service = { id: 42, name: booking.serviceName, supplierName: booking.supplierName, price: 220000, imageUrl: '', categorySlug: 'hair', rating: 5 } as any;
  await act(async () => root.render(React.createElement(CheckoutPage, { currentUser: user, directService: service, preselectedDate: booking.appointmentDate, preselectedTime: '13:00', onBack() {}, onNeedLogin() {}, onViewBookings() { assert.equal(locationSearch(), ''); navigations++; } })));
  const click = async (text: string) => act(async () => [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text))!.click());
  await click('Tiếp tục: Chọn hình thức'); await click('Mở thanh toán QR');
  assert.match(locationSearch(), /bookingPayment=1/);
  await click('Quay lại lịch hẹn');
  assert.equal(navigations, 1); assert.equal(posts, 1); assert.equal(document.querySelector('[data-checkout-state]'), null);
}));
