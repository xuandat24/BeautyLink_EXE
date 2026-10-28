import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { BookingsPage } from '../src/components/BookingsPage';
import { CheckoutPage } from '../src/components/CheckoutPage';
import { beautyApi, setAccessToken } from '../src/services/beautyApi';
import { sessionToken } from './sessionFixtures';
import type { BackendBooking, BackendService, CurrentUser } from '../src/types';

const unpaid = { id: 1, bookingCode: 'TEST-UNPAID', serviceName: 'Test service', supplierName: 'Test supplier', practitionerName: 'Test',
  status: 'PENDING', paymentStatus: 'UNPAID', appointmentDate: '2026-10-25', startTime: '10:00', endTime: '11:00', totalAmount: 500000,
  cancelEligible: true, paymentEligible: true } as BackendBooking;
function environment() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, sessionStorage: dom.window.sessionStorage, localStorage: dom.window.localStorage });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  return { dom, root: createRoot(document.getElementById('root')!) };
}
const click = async (text: string, twice = false) => act(async () => {
  const button = [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text));
  assert.ok(button, text); button.click(); if (twice) button.click();
});
test('bookings hide paid/manual/legacy cancellation, guard double submit and reject stale list', async () => {
  const { dom, root } = environment();
  const originalLoad = beautyApi.myBookings, originalCancel = beautyApi.cancelBooking;
  const loads: Array<(b: BackendBooking[]) => void> = []; let cancelCalls = 0;
  let cancelResolve!: (b: BackendBooking) => void;
  beautyApi.myBookings = () => new Promise(resolve => loads.push(resolve));
  beautyApi.cancelBooking = () => { cancelCalls++; return new Promise(resolve => { cancelResolve = resolve; }); };
  try {
    await act(async () => root.render(React.createElement(BookingsPage, { onBack() {}, onBookNew() {} })));
    await act(async () => loads[0]([unpaid, { ...unpaid, id: 2, paymentStatus: 'PAID' },
      { ...unpaid, id: 3, cancelEligible: false, paymentBlockerReason: 'PAYMENT_REVIEW_REQUIRED' }, { ...unpaid, id: 4, cancelEligible: undefined },
      { ...unpaid, id: 5, paymentStatus: 'PARTIALLY_PAID', paymentOption: 'DEPOSIT_05', cancelEligible: false },
      { ...unpaid, id: 6, paymentStatus: 'PARTIALLY_PAID', paymentOption: 'DEPOSIT_50', cancelEligible: false }]));
    assert.equal([...document.querySelectorAll('button')].filter(b => b.textContent?.includes('Hủy lịch')).length, 1);
    assert.match(document.body.textContent ?? '', /Không thanh toán lại/);
    assert.match(document.body.textContent ?? '', /Cần đối soát thanh toán/);
    assert.match(document.body.textContent ?? '', /Đã cọc 5%/);
    assert.match(document.body.textContent ?? '', /Đã cọc 50% \(giao dịch cũ\)/);
    await act(async () => window.dispatchEvent(new dom.window.Event('beautylink-bookings-refresh')));
    await click('Hủy lịch', true); assert.equal(cancelCalls, 1);
    // Complete the mutation while an older readonly list request is still in flight.
    await act(async () => cancelResolve({ ...unpaid, status: 'CANCELLED', cancelEligible: false }));
    assert.equal(loads.length, 3);
    await act(async () => loads[2]([{ ...unpaid, status: 'CANCELLED', cancelEligible: false }]));
    await act(async () => loads[1]([unpaid]));
    assert.equal([...document.querySelectorAll('button')].filter(b => b.textContent?.includes('Hủy lịch')).length, 0);
    assert.match(document.body.textContent ?? '', /Đã hủy/);
  } finally { await act(async () => root.unmount()); beautyApi.myBookings = originalLoad; beautyApi.cancelBooking = originalCancel; dom.window.close(); }
});
test('checkout retains booking after provider failure, rereads backend and blocks manual checkout', async () => {
  const { dom, root } = environment();
  setAccessToken(sessionToken());
  const originals = { create: beautyApi.createBooking, pay: beautyApi.createPayOSPayment, load: beautyApi.myBooking, quote: beautyApi.servicePaymentQuote, capacity: beautyApi.serviceCapacity };
  let created = 0, payCalls = 0, readCalls = 0;
  beautyApi.createBooking = async () => { created++; return unpaid; };
  beautyApi.serviceCapacity = async (_id, date) => ({ date, qualifiedPractitioners: 1, slots: [{ time: '10:00', availablePractitioners: 1, state: 'AVAILABLE' }], reason: null });
  beautyApi.servicePaymentQuote = async (_id, paymentOption) => ({ originalAmount: 500000, discountAmount: 0, payableAmount: 500000,
    amount: paymentOption === 'DEPOSIT_05' ? 25000 : 500000, remainingAmount: paymentOption === 'DEPOSIT_05' ? 475000 : 0,
    paymentOption, paymentAvailable: true, unavailableReason: null });
  beautyApi.createPayOSPayment = async () => { payCalls++; throw new Error('Provider timeout'); };
  beautyApi.myBooking = async id => { assert.equal(id, unpaid.id); readCalls++; return { ...unpaid, paymentEligible: false, paymentBlockerReason: 'PAYMENT_REVIEW_REQUIRED' }; };
  const service: BackendService = { id: 1, name: 'Test service', supplierId: 1, supplierName: 'Test supplier', supplierAddress: '', supplierBusinessType: 'SPA', supplierReviewCount: 0, imageUrl: '', price: 500000, durationMinutes: 60, categorySlug: 'spa', rating: 0, practitioners: [] };
  const user = { id: 1, name: 'Customer', role: 'CUSTOMER', phone: '0900000001', email: 'test@example.test', bookingContactConfirmed: true } as CurrentUser;
  try {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 7);
    await act(async () => root.render(React.createElement(CheckoutPage, { currentUser: user, directService: service, preselectedDate: tomorrow.toISOString().slice(0, 10), preselectedTime: '10:00', onBack() {}, onViewBookings() {}, onNeedLogin() {} })));
    await click('Tiếp tục: Chọn hình thức');
    await click('Mở thanh toán QR', true);
    assert.match(window.location.search, /bookingPayment=1/);
    assert.equal([...document.querySelectorAll('button')].some(b => !b.disabled && b.textContent?.includes('Mở thanh toán QR')), false);
    assert.equal(created, 1); assert.equal(payCalls, 1); assert.equal(readCalls, 1);
    assert.match(document.body.textContent ?? '', /chưa thể mở PayOS/);
  } finally { await act(async () => root.unmount()); beautyApi.createBooking = originals.create; beautyApi.createPayOSPayment = originals.pay; beautyApi.myBooking = originals.load; beautyApi.servicePaymentQuote = originals.quote; beautyApi.serviceCapacity = originals.capacity; dom.window.close(); }
});


test('history keeps checkout hidden until provider reconciliation and shows paid instead of stale unpaid', async () => {
  const { dom, root } = environment();
  const originals = { list: beautyApi.myBookings, status: beautyApi.currentBookingPayment, one: beautyApi.myBooking };
  let finish!: (p: any) => void;
  beautyApi.myBookings = async () => [{ ...unpaid, paymentOption: 'DEPOSIT_05' }];
  beautyApi.currentBookingPayment = () => new Promise(resolve => { finish = resolve; });
  beautyApi.myBooking = async () => ({ ...unpaid, status: 'CONFIRMED', paymentStatus: 'PARTIALLY_PAID', paymentOption: 'DEPOSIT_05', paymentEligible: false });
  try {
    await act(async () => root.render(React.createElement(BookingsPage, { onBack() {}, onBookNew() {} })));
    assert.match(document.body.textContent ?? '', /Đang đối soát/);
    assert.equal([...document.querySelectorAll('button')].some(b => b.textContent?.includes('Tiếp tục thanh toán')), false);
    await act(async () => finish({ bookingId: 1, status: 'PAID', requiresManualReview: false }));
    assert.match(document.body.textContent ?? '', /Đã cọc 5%/);
    assert.equal([...document.querySelectorAll('button')].some(b => b.textContent?.includes('Tiếp tục thanh toán')), false);
  } finally { await act(async () => root.unmount()); Object.assign(beautyApi, { myBookings: originals.list, currentBookingPayment: originals.status, myBooking: originals.one }); dom.window.close(); }
});
