import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { AdminDashboardPage } from '../src/components/admin/AdminDashboardPage';
import { beautyApi } from '../src/services/beautyApi';
import type { AdminDashboardSummary, AdminPaymentSummary } from '../src/types';
import { adminV2Api } from '../src/services/adminApi';
import { insightsFixture, paymentFixture } from './adminV2Fixtures';

test('admin overview renders authoritative booking people separately from bookings and drills down with the same range', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/#admin-dashboard' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const root = createRoot(document.getElementById('root')!);
  const original = { insights: adminV2Api.insights, payments: beautyApi.adminPaymentSummary, bookings: beautyApi.adminBookings };
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
  adminV2Api.insights = async params => { requests.push(params); return insightsFixture(); };
  beautyApi.adminPaymentSummary = async () => paymentFixture();
  beautyApi.adminBookings = async () => ({ content: [], totalElements: 0, totalPages: 0, page: 0, size: 5 });
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
    assert.match(document.body.textContent || '', /Tổng đơn đặt lịch5/);
    assert.match(document.body.textContent || '', /Lịch hẹn hoàn thành1/);
    assert.equal(document.querySelector('[aria-label="Chỉ số kinh doanh"]')?.querySelectorAll('article').length, 6);
    await act(async () => customerCard.click());
    assert.deepEqual(bookedRange, { from: requests[0].from, to: requests[0].to });
    await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Hôm nay')!.click());
    assert.notEqual(requests.at(-1)?.from, requests[0].from, 'date preset forwards a different range to the backend');
    const paymentNav = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Thanh toán'));
    assert.ok(paymentNav);
    await act(async () => paymentNav.click());
    assert.equal(navigated, 'payments');
  } finally {
    await act(async () => root.unmount());
    adminV2Api.insights = original.insights; beautyApi.adminPaymentSummary = original.payments; beautyApi.adminBookings = original.bookings;
    dom.window.close();
  }
});

test('admin revenue table pages verified payments and exports the selected range', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/#admin-payments' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const root = createRoot(document.getElementById('root')!);
  const originalSummary = beautyApi.adminPaymentSummary;
  const originalRevenue = beautyApi.adminRevenue;
  const originalExport = beautyApi.exportAdminRevenueCsv;
  const originalCreateUrl = URL.createObjectURL;
  const originalRevokeUrl = URL.revokeObjectURL;
  const originalClick = dom.window.HTMLAnchorElement.prototype.click;
  const requests: Array<{ from: string; to: string; includeDemo: boolean; page: number; size: number }> = [];
  const exports: Array<{ from: string; to: string; includeDemo: boolean }> = [];
  const summary: AdminPaymentSummary = {
    range: { fromDate: '2026-10-01', toDate: '2026-10-19', timezone: 'Asia/Ho_Chi_Minh', includeDemo: false },
    verifiedOnlineCollected: 30000, verifiedDeposits: 30000, verifiedFullPayments: 0,
    remainingAtSalon: 570000, verifiedPaymentBookings: 2, depositBookings: 2,
    fullPaymentBookings: 0, reconciliationIssues: 0, generatedAt: '2026-10-19T00:00:00Z',
  };
  beautyApi.adminPaymentSummary = async () => summary;
  beautyApi.adminRevenue = async (params) => {
    requests.push(params);
    return { content: [{ paymentId: params.page + 1, paidAt: '2026-10-19T01:00:00Z',
      bookingCode: `BL-${params.page + 1}`, supplierName: 'Salon', serviceName: 'Nails',
      paymentOption: 'DEPOSIT_05' as const, amount: 15000, remainingAtSalon: 285000 }],
      totalElements: 2, totalPages: 2, page: params.page, size: params.size };
  };
  beautyApi.exportAdminRevenueCsv = async (params) => { exports.push(params); return new Blob(['csv']); };
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = () => {};
  try {
    await act(async () => root.render(React.createElement(AdminDashboardPage, {
      mode: 'payments', adminName: 'Admin', onNavigate() {}, onHome() {}, onLogout() {},
      onOpenBookedCustomers() {},
    })));
    assert.match(document.body.textContent || '', /BL-1/);
    assert.equal(requests[0].includeDemo, false);
    const next = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Trang sau'))!;
    await act(async () => next.click());
    assert.match(document.body.textContent || '', /BL-2/);
    const download = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Tải CSV'))!;
    await act(async () => download.click());
    assert.deepEqual(exports, [{ from: requests[0].from, to: requests[0].to, includeDemo: false }]);
  } finally {
    await act(async () => root.unmount());
    beautyApi.adminPaymentSummary = originalSummary;
    beautyApi.adminRevenue = originalRevenue;
    beautyApi.exportAdminRevenueCsv = originalExport;
    URL.createObjectURL = originalCreateUrl;
    URL.revokeObjectURL = originalRevokeUrl;
    dom.window.HTMLAnchorElement.prototype.click = originalClick;
    dom.window.close();
  }
});

test('admin revenue CSV uses all authorized JSON pages and preserves Vietnamese text safely', async () => {
  const originalRevenue = beautyApi.adminRevenue;
  const requests: Array<{ from: string; to: string; includeDemo: boolean; page: number; size: number }> = [];
  beautyApi.adminRevenue = async (params) => {
    requests.push(params);
    return {
      content: [{ paymentId: params.page + 1, paidAt: '2026-10-19T01:02:03Z',
        bookingCode: `BL-${params.page + 1}`, supplierName: 'Tiệm, Móng "Đẹp"',
        serviceName: params.page === 0 ? '=SUM(1+1)' : 'Sơn gel',
        paymentOption: 'DEPOSIT_05' as const, amount: 15000,
        remainingAtSalon: 285000 }],
      totalElements: 2, totalPages: 2, page: params.page, size: params.size,
    };
  };
  try {
    const blob = await beautyApi.exportAdminRevenueCsv({
      from: '2026-10-01', to: '2026-10-19', includeDemo: false,
    });
    const csv = await blob.text();
    assert.deepEqual(requests.map(({ page, size }) => ({ page, size })), [
      { page: 0, size: 500 }, { page: 1, size: 500 },
    ]);
    assert.deepEqual([...new Uint8Array(await blob.arrayBuffer()).slice(0, 3)], [0xEF, 0xBB, 0xBF]);
    assert.match(csv, /^paid_at_vietnam,booking_code,partner,service,/);
    assert.match(csv, /"2026-10-19 08:02:03","BL-1","Tiệm, Móng ""Đẹp""","'=SUM\(1\+1\)"/);
    assert.match(csv, /"BL-2"/);
    assert.equal(csv.trim().split('\r\n').length, 3);
  } finally {
    beautyApi.adminRevenue = originalRevenue;
  }
});
