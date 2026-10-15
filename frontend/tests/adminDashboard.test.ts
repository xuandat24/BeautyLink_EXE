import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { AdminDashboardPage } from '../src/components/admin/AdminDashboardPage';
import { beautyApi } from '../src/services/beautyApi';
import type { AdminDashboardSummary } from '../src/types';

test('admin overview renders authoritative booking people separately from bookings and drills down with the same range', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/#admin-dashboard' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const root = createRoot(document.getElementById('root')!);
  const original = beautyApi.adminDashboardSummary;
  const requests: Array<{ from: string; to: string; includeDemo: boolean }> = [];
  let bookedRange: { from: string; to: string } | null = null;
  let navigated = '';
  const summary: AdminDashboardSummary = {
    range: { fromDate: '2026-10-01', toDate: '2026-10-15', timezone: 'Asia/Ho_Chi_Minh', includeDemo: false },
    registeredCustomers: 9, customersWhoBooked: 2, totalBookings: 5, paidBookingCustomers: 1,
    verifiedPaidBookings: 1, upcomingBookings: 3, reconciliationIssues: 0, completedBookings: 1,
    cancelledBookings: 1, repeatCustomers: 2, bookingToPaymentConversion: 20, generatedAt: '2026-10-15T00:00:00Z',
    bookingTrends: [], recentBookings: [],
  };
  beautyApi.adminDashboardSummary = async (params) => { requests.push(params); return summary; };
  try {
    await act(async () => root.render(React.createElement(AdminDashboardPage, {
      mode: 'overview', adminName: 'Admin', onNavigate: (section: string) => { navigated = section; },
      onHome() {}, onLogout() {}, onOpenBookedCustomers: (from: string, to: string) => { bookedRange = { from, to }; },
    })));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].includeDemo, false);
    const customerCard = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Khách đã đặt lịch'));
    assert.ok(customerCard);
    assert.match(customerCard.textContent || '', /2/);
    assert.match(document.body.textContent || '', /Tổng lịch đã đặt5/);
    await act(async () => customerCard.click());
    assert.deepEqual(bookedRange, { from: requests[0].from, to: requests[0].to });
    const paymentNav = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Thanh toán'));
    assert.ok(paymentNav);
    await act(async () => paymentNav.click());
    assert.equal(navigated, 'payments');
  } finally {
    await act(async () => root.unmount());
    beautyApi.adminDashboardSummary = original;
    dom.window.close();
  }
});
