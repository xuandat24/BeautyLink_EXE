import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { AdminNav, adminItems } from '../src/components/admin/AdminNav';
import { AdminOverview } from '../src/components/admin/AdminOverview';
import { BookingTable } from '../src/components/admin/AdminDashboardPage';
import { adminV2Api, adminRangeError } from '../src/services/adminApi';
import { beautyApi } from '../src/services/beautyApi';
import { insightsFixture, paymentFixture } from './adminV2Fixtures';
import type { AdminBooking } from '../src/types';
import App from '../src/App';
import { installToken, clearSession } from '../src/lib/authSession';
import { sessionToken } from './sessionFixtures';
function environment() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/#admin-dashboard' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  return dom;
}
test('admin date range validates missing/corrupt/reversed dates and the inclusive 366-day boundary', () => {
  assert.ok(adminRangeError({ from: '', to: '2026-10-25' }));
  assert.ok(adminRangeError({ from: '2026-02-31', to: '2026-03-02' }));
  assert.ok(adminRangeError({ from: '2026-10-25', to: '2026-10-24' }));
  assert.equal(adminRangeError({ from: '2026-01-01', to: '2027-01-01' }), null);
  assert.ok(adminRangeError({ from: '2026-01-01', to: '2027-01-02' }));
});
test('sidebar exposes nine real module destinations, keyboard menu and booking-scoped search', async () => {
  const dom = environment(); const root = createRoot(document.getElementById('root')!); let result: unknown[] = [];
  try {
    await act(async () => root.render(React.createElement(AdminNav, { active: 'overview', adminName: 'Admin', onNavigate: (...args) => { result = args; }, onHome() {}, onLogout() {} })));
    assert.deepEqual(adminItems.map(i => i.label), ['Tổng quan', 'Người dùng', 'Đối tác/Salon', 'Lịch đặt', 'Thanh toán', 'Đánh giá', 'Khuyến mãi', 'Báo cáo', 'Cài đặt']);
    assert.equal(document.querySelector('nav')?.querySelectorAll('button').length, 9);
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Mở menu quản trị"]')!.click());
    assert.equal(document.querySelector('button[aria-label="Mở menu quản trị"]')?.getAttribute('aria-expanded'), 'true');
    await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(document.querySelector('button[aria-label="Mở menu quản trị"]')?.getAttribute('aria-expanded'), 'false');
    await act(async () => document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    assert.deepEqual(result, ['bookings', '']);
    await act(async () => [...document.querySelectorAll('nav button')].find(b => b.textContent?.includes('Đối tác/Salon'))!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
    assert.deepEqual(result, ['salons', undefined]);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
test('overview shows loading/error/retry and truthful zero/N-A without fake data', async () => {
  const dom = environment(); const root = createRoot(document.getElementById('root')!);
  const original = { insights: adminV2Api.insights, payments: beautyApi.adminPaymentSummary, bookings: beautyApi.adminBookings };
  let reject!: (error: Error) => void; let calls = 0;
  const zero = insightsFixture(); for (const metric of [zero.totalBookings, zero.users, zero.revenue, zero.activePartners, zero.onlinePaymentRate, zero.completedBookings]) metric.value = 0;
  zero.statuses.forEach(row => row.count = 0); zero.paymentAttemptSuccessRate = null; zero.topSalons = []; zero.popularServices = [];
  adminV2Api.insights = async () => { calls++; if (calls === 1) return new Promise((_ok, fail) => { reject = fail; }); return zero; };
  beautyApi.adminPaymentSummary = async () => paymentFixture(); beautyApi.adminBookings = async () => ({ content: [], totalElements: 0, totalPages: 0, page: 0, size: 5 });
  try {
    await act(async () => root.render(React.createElement(AdminOverview, { params: { from: '2026-10-01', to: '2026-10-15', includeDemo: false }, renderBookings: () => null, onSalon() {}, onBookedCustomers() {} })));
    assert.match(document.body.textContent ?? '', /Đang tổng hợp/);
    await act(async () => reject(new Error('Service unavailable'))); assert.match(document.querySelector('[role="alert"]')?.textContent ?? '', /Service unavailable/);
    await act(async () => document.querySelector<HTMLButtonElement>('[role="alert"] button')!.click());
    assert.equal(calls, 2); assert.equal(document.querySelectorAll('[aria-label="Chỉ số kinh doanh"] article').length, 6);
    assert.match(document.body.textContent ?? '', /Chưa có so sánh/); assert.match(document.body.textContent ?? '', /Chưa có booking/);
    assert.doesNotMatch(document.body.textContent ?? '', /NaN|Infinity|Thao tác nhanh|Thông báo & Cảnh báo|Chuyên viên bận nhất/);
  } finally { await act(async () => root.unmount()); adminV2Api.insights = original.insights; beautyApi.adminPaymentSummary = original.payments; beautyApi.adminBookings = original.bookings; dom.window.close(); }
});
test('booking badges distinguish deposits, cancellation and refunds and expose an accessible detail action', async () => {
  const dom = environment(); const root = createRoot(document.getElementById('root')!); let selected = 0;
  const row = { id: 1, bookingCode: 'BL-TEST', customerName: 'Customer', supplierName: 'Salon', serviceName: 'Care', appointmentDate: '2026-10-25', startTime: '09:00', createdAt: '2026-10-25T00:00:00Z', status: 'CANCELLED', paymentStatus: 'PARTIALLY_PAID' } as AdminBooking;
  try {
    await act(async () => root.render(React.createElement(BookingTable, { title: 'Bookings', bookings: [row], onSelect: b => { selected = b.id; } })));
    assert.match(document.querySelector('tbody')?.textContent ?? '', /Đã hủy/); assert.match(document.querySelector('tbody')?.textContent ?? '', /Đã đặt cọc/);
    assert.doesNotMatch(document.querySelector('tbody')?.textContent ?? '', /Đã hoàn tiền|Đã thanh toán/);
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Chi tiết BL-TEST"]')!.click()); assert.equal(selected, 1);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
test('customer cannot mount an admin directory or request its data through a bookmarked route', async () => {
  const dom = environment(); window.location.hash = 'admin-salons'; dom.window.scrollTo = () => {};
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  const original = { me: beautyApi.me, categories: beautyApi.categories, locations: beautyApi.locations, homepageServices: beautyApi.homepageServices, salons: adminV2Api.salons };
  let calls = 0; beautyApi.me = async () => ({ id: 42, fullName: 'Customer', role: 'CUSTOMER' });
  beautyApi.categories = async () => []; beautyApi.locations = async () => []; beautyApi.homepageServices = async () => [];
  adminV2Api.salons = async () => { calls++; return { content: [], totalElements: 0, totalPages: 0, page: 0, size: 20 }; };
  installToken(sessionToken()); const root = createRoot(document.getElementById('root')!);
  try {
    await act(async () => root.render(React.createElement(App)));
    assert.match(document.body.textContent ?? '', /Không có quyền truy cập/); assert.equal(calls, 0);
    assert.equal(document.querySelector('nav[aria-label="Điều hướng quản trị"]'), null);
  } finally { await act(async () => root.unmount()); beautyApi.me = original.me; beautyApi.categories = original.categories; beautyApi.locations = original.locations; beautyApi.homepageServices = original.homepageServices; adminV2Api.salons = original.salons; clearSession(false); dom.window.close(); }
});
test('late range and previous-account insights never overwrite the current admin view', async () => {
  const dom = environment(); const root = createRoot(document.getElementById('root')!);
  const original = { insights: adminV2Api.insights, payments: beautyApi.adminPaymentSummary, bookings: beautyApi.adminBookings };
  const finish: Array<(data: ReturnType<typeof insightsFixture>) => void> = [];
  adminV2Api.insights = async () => new Promise(resolve => finish.push(resolve));
  beautyApi.adminPaymentSummary = async () => paymentFixture(); beautyApi.adminBookings = async () => ({ content: [], totalElements: 0, totalPages: 0, page: 0, size: 5 });
  installToken(sessionToken());
  const render = (from: string) => act(async () => root.render(React.createElement(AdminOverview, { params: { from, to: '2026-10-15', includeDemo: false }, renderBookings: () => null, onSalon() {}, onBookedCustomers() {} })));
  try {
    await render('2026-10-01'); await render('2026-10-02');
    const current = insightsFixture(); current.totalBookings.value = 99;
    await act(async () => finish[1](current)); await act(async () => finish[0](insightsFixture()));
    assert.match(document.querySelector('[aria-label="Chỉ số kinh doanh"] article')?.textContent ?? '', /99/);
    await render('2026-10-03');
    const old = insightsFixture(); old.topSalons = [{ id: 1, name: 'Private previous salon', location: null, bookings: 1, verifiedOnlineAmount: 10 }];
    await act(async () => { installToken(sessionToken('22222222-2222-4222-8222-222222222222')); finish[2](old); });
    assert.doesNotMatch(document.body.textContent ?? '', /Private previous salon/);
  } finally { await act(async () => root.unmount()); adminV2Api.insights = original.insights; beautyApi.adminPaymentSummary = original.payments; beautyApi.adminBookings = original.bookings; clearSession(false); dom.window.close(); }
});
