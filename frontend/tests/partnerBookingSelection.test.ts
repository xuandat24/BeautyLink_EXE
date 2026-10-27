import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { PartnerDetailPage } from '../src/components/PartnerDetailPage';
import { CheckoutPage } from '../src/components/CheckoutPage';
import { beautyApi } from '../src/services/beautyApi';
import type { BackendService, CurrentUser, NewPartner } from '../src/types';

function environment() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    sessionStorage: dom.window.sessionStorage,
    localStorage: dom.window.localStorage,
  });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  return { dom, root: createRoot(document.getElementById('root')!) };
}

const service = (id: number, name: string): BackendService => ({
  id,
  name,
  price: 100_000 + id,
  originalPrice: 120_000 + id,
  durationMinutes: 60,
  imageUrl: `https://example.test/${id}.jpg`,
  categorySlug: 'nails',
  rating: 0,
  supplierId: 77,
  supplierName: 'Nail nhà Chuối',
  supplierAddress: 'Hà Nội',
  supplierBusinessType: 'NAIL',
  supplierReviewCount: 0,
  practitioners: [],
});

test('partner booking passes the exact clicked backend service', async () => {
  const { dom, root } = environment();
  const services = [
    service(701, 'Phụ phí design nặn, đính đá, vẽ'),
    service(702, 'Sơn gel dưỡng móng'),
  ];
  const originalServices = beautyApi.publicSupplierServices;
  const originalReviews = beautyApi.publicBookingReviews;
  beautyApi.publicSupplierServices = async () => services;
  beautyApi.publicBookingReviews = async () => ({ content: [], totalElements: 0, totalPages: 0, page: 0, size: 20, rating: 0 });
  const selected: BackendService[] = [];
  const partner: NewPartner = {
    id: 'supplier-77',
    supplierId: 77,
    serviceId: 701,
    name: 'Nail nhà Chuối',
    subTitle: 'NAIL',
    address: 'Hà Nội',
    image: services[0].imageUrl,
    logo: 'NC',
    specialty: services[0].name,
    promoNotice: '',
    rating: 0,
    reviewsCount: 0,
  };

  try {
    await act(async () => root.render(React.createElement(PartnerDetailPage, {
      partner,
      currentUser: null,
      onBack() {},
      onNeedLogin() {},
      onBookService(value: BackendService) { selected.push(value); },
    })));
    const buttons = [...document.querySelectorAll('button')].filter((button) => button.textContent?.includes('Đặt lịch ngay'));
    assert.equal(buttons.length, 2);
    await act(async () => buttons[1].click());
    assert.equal(selected[0]?.id, 702);
    assert.equal(selected[0]?.name, 'Sơn gel dưỡng móng');
  } finally {
    await act(async () => root.unmount());
    beautyApi.publicSupplierServices = originalServices;
    beautyApi.publicBookingReviews = originalReviews;
    dom.window.close();
  }
});

test('unavailable payment quote gives visible feedback instead of a dead button', async () => {
  const { dom, root } = environment();
  const originalQuote = beautyApi.servicePaymentQuote;
  const originalCapacity = beautyApi.serviceCapacity;
  beautyApi.serviceCapacity = async (_id, date) => ({ date, qualifiedPractitioners: 1, slots: [{ time: '10:00', availablePractitioners: 1, state: 'AVAILABLE' }], reason: null });
  beautyApi.servicePaymentQuote = async (_id, paymentOption) => ({
    originalAmount: 1_000,
    discountAmount: 0,
    payableAmount: 1_000,
    amount: paymentOption === 'DEPOSIT_05' ? 50 : 1_000,
    remainingAmount: paymentOption === 'DEPOSIT_05' ? 950 : 0,
    paymentOption,
    paymentAvailable: false,
    unavailableReason: 'DEPOSIT_TOO_LOW_USE_FULL_PAYMENT',
  });
  const user = { id: 1, name: 'Customer', role: 'CUSTOMER', phone: '0900000001' } as CurrentUser;

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    await act(async () => root.render(React.createElement(CheckoutPage, {
      currentUser: user,
      directService: service(703, 'Sơn gel'),
      preselectedDate: tomorrow.toISOString().slice(0, 10),
      preselectedTime: '10:00',
      onBack() {},
      onViewBookings() {},
      onNeedLogin() {},
    })));
    const clickButton = async (text: string) => act(async () => {
      const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes(text));
      assert.ok(button, text);
      button.click();
    });
    await clickButton('Tiếp tục: Chọn hình thức');
    await clickButton('Tiếp tục: Tóm tắt');
    const submit = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Tiếp tục tới PayOS')) as HTMLButtonElement;
    assert.ok(submit);
    assert.equal(submit.disabled, false);
    await act(async () => submit.click());
    const alerts = [...document.querySelectorAll('[role="alert"]')].map((item) => item.textContent).join(' ');
    assert.match(alerts, /PayOS/);
  } finally {
    await act(async () => root.unmount());
    beautyApi.servicePaymentQuote = originalQuote;
    beautyApi.serviceCapacity = originalCapacity;
    dom.window.close();
  }
});

test('checkout disables fully booked slots and keeps remaining capacity selectable', async () => {
  const { dom, root } = environment();
  const originalCapacity = beautyApi.serviceCapacity;
  const originalQuote = beautyApi.servicePaymentQuote;
  beautyApi.serviceCapacity = async (_id, date) => ({ date, qualifiedPractitioners: 2,
    slots: [
      { time: '10:00', availablePractitioners: 0, state: 'FULLY_BOOKED' },
      { time: '10:30', availablePractitioners: 1, state: 'AVAILABLE' },
    ], reason: null });
  beautyApi.servicePaymentQuote = async (_id, paymentOption) => ({ originalAmount: 100000, discountAmount: 0,
    payableAmount: 100000, amount: paymentOption === 'DEPOSIT_05' ? 5000 : 100000,
    remainingAmount: paymentOption === 'DEPOSIT_05' ? 95000 : 0, paymentOption, paymentAvailable: true, unavailableReason: null });
  try {
    await act(async () => root.render(React.createElement(CheckoutPage, {
      currentUser: null, directService: service(703, 'Sơn gel'), onBack() {}, onViewBookings() {}, onNeedLogin() {},
    })));
    const full = [...document.querySelectorAll('button')].find(button => button.textContent?.includes('10:00') && button.textContent?.includes('Hết chỗ')) as HTMLButtonElement;
    const open = [...document.querySelectorAll('button')].find(button => button.textContent?.includes('10:30 (1)')) as HTMLButtonElement;
    assert.ok(full); assert.equal(full.disabled, true);
    assert.ok(open); assert.equal(open.disabled, false);
  } finally {
    await act(async () => root.unmount());
    beautyApi.serviceCapacity = originalCapacity;
    beautyApi.servicePaymentQuote = originalQuote;
    dom.window.close();
  }
});
