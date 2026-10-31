import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { AdminOverview } from '../src/components/admin/AdminOverview';
import { adminV2Api } from '../src/services/adminApi';
import { beautyApi } from '../src/services/beautyApi';
import { insightsFixture, metricFixture, paymentFixture } from './adminV2Fixtures';

test('revenue uses verified receipts; stored service value stays separate and unwanted KPI text is absent', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/#admin-dashboard' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const root = createRoot(document.getElementById('root')!);
  const original = { insights: adminV2Api.insights, payments: beautyApi.adminPaymentSummary, bookings: beautyApi.adminBookings };
  const data = insightsFixture();
  data.completedServiceValue = metricFixture(765000, 'VND');
  data.commissionRevenue = metricFixture(999999, 'VND');
  data.trends[0].completedServiceValue = 765000;
  adminV2Api.insights = async () => data;
  beautyApi.adminPaymentSummary = async () => paymentFixture();
  beautyApi.adminBookings = async () => ({ content: [], totalElements: 0, totalPages: 0, page: 0, size: 5 });
  const navigation: unknown[] = [];
  try {
    await act(async () => root.render(React.createElement(AdminOverview, { params: { from: '2026-10-01', to: '2026-10-31', includeDemo: false }, renderBookings: () => null, onSalon() {}, onBookedCustomers() {}, onNavigate: (...args) => navigation.push(args) })));
    const revenue = [...document.querySelectorAll('article')].find(card => card.querySelector('h2')?.textContent === 'Doanh thu')!;
    assert.match(revenue.querySelector('[data-admin-value]')!.textContent!, /30\.000/);
    assert.match(document.body.textContent!, /Tổng giá trị dịch vụ: 765\.000/);
    assert.doesNotMatch(document.body.textContent!, /Khách đã đặt lịch|Chưa có so sánh|999\.999/);
    assert.match(document.body.textContent!, /Tổng thu online xác minh theo paidAt/);
    assert.match(document.querySelector('circle[aria-label^="Thu online"]')!.getAttribute('aria-label')!, /30\.000/);
    await act(async () => revenue.querySelector('button')!.click());
    assert.deepEqual(navigation, [['payments', undefined]]);
  } finally {
    await act(async () => root.unmount()); adminV2Api.insights = original.insights; beautyApi.adminPaymentSummary = original.payments; beautyApi.adminBookings = original.bookings; dom.window.close();
  }
});
