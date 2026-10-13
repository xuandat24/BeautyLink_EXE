import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { BookingsPage } from '../src/components/BookingsPage';
import { CheckoutPage } from '../src/components/CheckoutPage';
import { beautyApi } from '../src/services/beautyApi';
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
      { ...unpaid, id: 3, cancelEligible: false, paymentBlockerReason: 'PAYMENT_REVIEW_REQUIRED' }, { ...unpaid, id: 4, cancelEligible: undefined }]));
    assert.equal([...document.querySelectorAll('button')].filter(b => b.textContent?.includes('Hủy lịch')).length, 1);
    assert.match(document.body.textContent ?? '', /Không thanh toán lại/);
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
  const originals = { create: beautyApi.createBooking, pay: beautyApi.createPayOSPayment, load: beautyApi.myBookings };
  let created = 0, payCalls = 0, readCalls = 0;
  beautyApi.createBooking = async () => { created++; return unpaid; };
  beautyApi.createPayOSPayment = async () => { payCalls++; throw new Error('Provider timeout'); };
  beautyApi.myBookings = async () => { readCalls++; return [{ ...unpaid, paymentEligible: false, paymentBlockerReason: 'PAYMENT_REVIEW_REQUIRED' }]; };
  const service: BackendService = { id: 1, name: 'Test service', supplierId: 1, supplierName: 'Test supplier', supplierAddress: '', supplierBusinessType: 'SPA', supplierReviewCount: 0, imageUrl: '', price: 500000, durationMinutes: 60, categorySlug: 'spa', rating: 0, practitioners: [] };
  const user = { id: 1, name: 'Customer', role: 'CUSTOMER', phone: '0900000001', email: 'test@example.test' } as CurrentUser;
  try {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 7);
    await act(async () => root.render(React.createElement(CheckoutPage, { currentUser: user, directService: service, preselectedDate: tomorrow.toISOString().slice(0, 10), preselectedTime: '10:00', onBack() {}, onViewBookings() {}, onNeedLogin() {} })));
    await click('Tiếp tục: Chọn hình thức'); await click('Tiếp tục: Tóm tắt');
    await click('Xác nhận thanh toán', true);
    assert.equal(created, 1); assert.equal(payCalls, 1); assert.match(document.body.textContent ?? '', /Provider timeout/);
    await click('Xác nhận thanh toán');
    assert.equal(created, 1); assert.equal(payCalls, 1); assert.equal(readCalls, 1);
    assert.match(document.body.textContent ?? '', /chưa được máy chủ cho phép/);
  } finally { await act(async () => root.unmount()); beautyApi.createBooking = originals.create; beautyApi.createPayOSPayment = originals.pay; beautyApi.myBookings = originals.load; dom.window.close(); }
});
