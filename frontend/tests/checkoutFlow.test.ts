import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { CheckoutPage } from '../src/components/CheckoutPage';
import { PaymentContinuationDialog } from '../src/components/PaymentContinuationDialog';
import { beautyApi, setAccessToken } from '../src/services/beautyApi';
import type { BackendBooking, BackendService, CurrentUser, PaymentQuote, PayOSPayment } from '../src/types';
import { sessionToken } from './sessionFixtures';
import { bookingDay } from '../src/lib/bookingTime';
import { useBeautyStore } from '../src/store/beautyStore';

const service = { id: 42, name: 'Dịch vụ kiểm thử', supplierId: 7, supplierName: 'Salon kiểm thử', price: 220000, rating: 5, durationMinutes: 60, imageUrl: '', categorySlug: 'spa' } as BackendService;
const user = { id: 1, role: 'CUSTOMER', name: 'Khách kiểm thử', phone: '0900000001', bookingContactConfirmed: true } as CurrentUser;
const quote = { paymentOption: 'DEPOSIT_05', originalAmount: 220000, payableAmount: 220000, discountAmount: 0, amount: 11000, remainingAmount: 209000, paymentAvailable: true } as PaymentQuote;
const booking = { id: 99, bookingCode: 'LOCAL-99', status: 'PENDING', paymentStatus: 'UNPAID', paymentEligible: true, serviceId: 42, serviceName: service.name, supplierName: service.supplierName } as BackendBooking;
const pending = { bookingId: 99, bookingCode: 'LOCAL-99', orderCode: 12345, paymentLinkId: null, paymentOption: 'DEPOSIT_05', amount: 11000, remainingAmount: 209000, status: 'PENDING', requiresManualReview: false, verificationPending: true, checkoutAllowed: false, expiresAt: new Date(Date.now() + 600000).toISOString() } as PayOSPayment;

async function environment(check: (render: (element: React.ReactNode) => Promise<void>, calls: { capacity: number; creates: number; payments: number; payload?: unknown; navigations: number }) => Promise<void>) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/#checkout' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  setAccessToken(sessionToken());
  const original = { capacity: beautyApi.serviceCapacity, quote: beautyApi.servicePaymentQuote, create: beautyApi.createBooking, payment: beautyApi.createPayOSPayment, status: beautyApi.payOSPaymentStatus, booking: beautyApi.myBooking, current: beautyApi.currentBookingPayment };
  const calls = { capacity: 0, creates: 0, payments: 0, payload: undefined as unknown, navigations: 0 };
  beautyApi.serviceCapacity = async (_id, date) => { calls.capacity++; return { date, qualifiedPractitioners: 1, reason: null, slots: [{ time: '13:00:00', availablePractitioners: 1, state: 'AVAILABLE' }, { time: '14:00:00', availablePractitioners: 0, state: 'FULLY_BOOKED' }] }; };
  beautyApi.servicePaymentQuote = async (_id, option) => ({ ...quote, paymentOption: option });
  beautyApi.createBooking = async data => { calls.creates++; calls.payload = data; return booking; };
  beautyApi.createPayOSPayment = async () => { calls.payments++; return pending; };
  beautyApi.payOSPaymentStatus = async () => pending;
  beautyApi.myBooking = async () => ({ ...booking, paymentAttemptActive: true, paymentEligible: false, paymentBlockerReason: 'PAYMENT_RECONCILING' });
  beautyApi.currentBookingPayment = async () => pending;
  const root = createRoot(document.getElementById('root')!);
  try { await check(async element => { await act(async () => root.render(element)); }, calls); }
  finally {
    await act(async () => root.unmount());
    Object.assign(beautyApi, { serviceCapacity: original.capacity, servicePaymentQuote: original.quote, createBooking: original.create, createPayOSPayment: original.payment, payOSPaymentStatus: original.status, myBooking: original.booking, currentBookingPayment: original.current });
    dom.window.close();
  }
}
const click = async (text: RegExp) => { const button = [...document.querySelectorAll('button')].find(b => text.test(b.textContent ?? '')); assert.ok(button); await act(async () => button.click()); };

test('one schedule shows full slots; two steps do not refetch capacity or duplicate booking after uncertain PayOS create', async () => {
  await environment(async (render, calls) => {
    await render(React.createElement(CheckoutPage, { currentUser: user, directService: service, preselectedDate: bookingDay(1), onBack() {}, onViewBookings() { calls.navigations++; }, onNeedLogin() { assert.fail('Unexpected login'); } }));
    const full = [...document.querySelectorAll('button')].find(b => /14:00/.test(b.textContent ?? ''))!;
    assert.ok(full.disabled); assert.match(full.textContent!, /Hết chỗ/);
    await click(/13:00/); await click(/Tiếp tục: Chọn hình thức/);
    assert.equal(calls.capacity, 1, 'step changes must not fetch the same capacity again');
    assert.match(document.body.textContent!, /Tóm tắt dịch vụ đã chọn/);
    assert.doesNotMatch(document.body.textContent!, /Tiếp tục: Tóm tắt/);
    await click(/Mở thanh toán QR/);
    assert.equal(calls.creates, 1); assert.equal(calls.payments, 1); assert.equal(calls.navigations, 0);
    assert.equal((calls.payload as { startTime: string }).startTime, '13:00');
    assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'), 'VERIFYING');
    assert.equal(document.querySelector('img[alt^="Mã QR PayOS"]'), null);
    assert.equal([...document.querySelectorAll('button')].some(b => /Mở thanh toán QR/.test(b.textContent ?? '')), false);
  });
});

test('reopening an unresolved owned booking observes its attempt despite payment creation being blocked', async () => {
  await environment(async (render, calls) => {
    await render(React.createElement(PaymentContinuationDialog, { bookingId: 99, onClose() {} }));
    assert.equal(document.querySelector('[data-checkout-state]')?.getAttribute('data-checkout-state'), 'VERIFYING');
    assert.equal(calls.payments, 0); assert.equal(calls.creates, 0);
    assert.doesNotMatch(document.body.textContent!, /Lịch hẹn chưa thể mở PayOS/);
  });
});

test('cart checkout chooses one service without modifying the saved cart or quantity', async () => {
  await environment(async (render) => {
    let store!: ReturnType<typeof useBeautyStore>;
    function Setup() { store = useBeautyStore(); return null; }
    await render(React.createElement(Setup));
    const deal = { id: 'cart-42', serviceId: 42, title: service.name, brandName: service.supplierName, salePrice: 220000 } as any;
    await act(async () => { store.clearCart(); store.addToCart(deal); store.addToCart(deal); store.addToCart({ ...deal, id: 'cart-43', serviceId: 43, title: 'Dịch vụ thứ hai' }); });
    function Cart() { store = useBeautyStore(); return React.createElement(CheckoutPage, { currentUser: user, onBack() {}, onViewBookings() {}, onNeedLogin() {} }); }
    await render(React.createElement(Cart));
    await click(/Dịch vụ thứ hai/);
    const pressed = document.querySelector('[aria-label="Chọn dịch vụ đặt lịch"] [aria-pressed="true"]');
    assert.match(pressed?.textContent ?? '', /Dịch vụ thứ hai/);
    assert.equal(store.cartItems.length, 2); assert.equal(store.cartItems[0].quantity, 2);
    await act(async () => store.clearCart());
  });
});
