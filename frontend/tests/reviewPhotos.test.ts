import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { ServiceReviewModal } from '../src/components/ServiceReviewModal';
import { beautyApi } from '../src/services/beautyApi';
import type { BackendBooking, BookingReview } from '../src/types';
const image = 'https://res.cloudinary.com/test/image/upload/v1/experience.webp';
const existing = { id: 1, bookingId: 8, targetType: 'SERVICE', rating: 4, comment: 'Trải nghiệm', images: [image], createdAt: '', updatedAt: '' } as BookingReview;
const booking = { id: 8, bookingCode: 'PHOTO-8', serviceId: 3, supplierId: 4, status: 'CONFIRMED', paymentStatus: 'PARTIALLY_PAID', reviewEligible: true, serviceReview: existing } as BackendBooking;
test('midpoint review retains photos on failed save, rejects invalid files and prevents duplicate submit', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const root = createRoot(document.getElementById('root')!);
  const originals = { list: beautyApi.myBookings, save: beautyApi.upsertBookingReview };
  let calls = 0, fail = true, closed = 0, release!: (review: BookingReview) => void;
  beautyApi.myBookings = async () => [booking];
  beautyApi.upsertBookingReview = async (_id, target, payload) => {
    calls++; assert.equal(target, 'SERVICE'); assert.deepEqual(payload.images, [image]);
    if (fail) throw new Error('Không thể tải ảnh');
    return new Promise(resolve => { release = resolve; });
  };
  try {
    await act(async () => root.render(React.createElement(ServiceReviewModal, { isOpen: true, onClose() { closed++; }, serviceTitle: 'Test', salonName: 'Salon', booking })));
    assert.equal(document.querySelectorAll('img').length, 1);
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [new dom.window.File(['<svg/>'], 'unsafe.svg', { type: 'image/svg+xml' })] });
    await act(async () => input.dispatchEvent(new dom.window.Event('change', { bubbles: true })));
    assert.ok(document.querySelector('[role=alert]')); assert.equal(calls, 0);
    const submit = () => document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await act(async () => { submit(); });
    assert.equal(closed, 0); assert.equal(calls, 1); assert.equal(document.querySelectorAll('img').length, 1);
    fail = false;
    await act(async () => { submit(); submit(); });
    assert.equal(calls, 2);
    await act(async () => release(existing)); assert.equal(closed, 1);
  } finally { await act(async () => root.unmount()); beautyApi.myBookings = originals.list; beautyApi.upsertBookingReview = originals.save; dom.window.close(); }
});
