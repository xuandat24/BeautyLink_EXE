import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { AdminDashboardPage, BookingTable } from '../src/components/admin/AdminDashboardPage';
import { AdminOverview } from '../src/components/admin/AdminOverview';
import { adminV2Api } from '../src/services/adminApi';
import { beautyApi } from '../src/services/beautyApi';
import { insightsFixture, paymentFixture } from './adminV2Fixtures';
import type { AdminBooking } from '../src/types';

async function setup() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/#admin-dashboard' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const root = createRoot(document.getElementById('root')!);
  const original = { insights: adminV2Api.insights, payments: beautyApi.adminPaymentSummary, bookings: beautyApi.adminBookings };
  const data = insightsFixture(); const requests: Parameters<typeof beautyApi.adminBookings>[0][] = []; const grains: string[] = [];
  adminV2Api.insights = async p => { grains.push(p.granularity); return data; };
  beautyApi.adminPaymentSummary = async () => paymentFixture();
  beautyApi.adminBookings = async p => { requests.push(p); return { content: [], totalElements: 0, totalPages: 0, page: 0, size: 20 }; };
  return { root, dom, data, requests, grains, async close() { await act(async () => root.unmount()); adminV2Api.insights = original.insights; beautyApi.adminPaymentSummary = original.payments; beautyApi.adminBookings = original.bookings; dom.window.close(); } };
}
const click = (label: string) => act(async () => {
  const button = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === label || b.textContent === label);
  assert.ok(button, label); button.click();
});
const overviewProps = { params: { from: '2026-10-01', to: '2026-10-15', includeDemo: false }, renderBookings: () => null, onSalon(_id: number) {}, onBookedCustomers() {} };

test('KPI actions use real destinations once; definitions never navigate; salon retains database ID', async () => {
  const env = await setup(); const destinations: unknown[][] = []; let salonId = 0;
  env.data.topSalons = [{ id: 73, name: 'Salon thật', location: 'Hà Nội', bookings: 5, verifiedOnlineAmount: 30000 }];
  try {
    await act(async () => env.root.render(React.createElement(AdminOverview, { ...overviewProps, onNavigate: (...args) => destinations.push(args), onSalon: id => { salonId = id; } })));
    for (const label of ['Tổng đơn đặt lịch', 'Người dùng', 'Doanh thu', 'Đối tác hoạt động', 'Tỷ lệ thanh toán online', 'Lịch hẹn hoàn thành']) await click(`Xem chi tiết ${label}`);
    assert.deepEqual(destinations, [['bookings', undefined], ['customers', undefined], ['payments', undefined], ['salons', undefined], ['payments', undefined], ['bookings', 'COMPLETED']]);
    await act(async () => document.querySelector<HTMLElement>('summary')!.click()); assert.equal(destinations.length, 6);
    await click('Xem salon Salon thật'); assert.equal(salonId, 73);
    assert.equal(document.querySelectorAll('button button').length, 0);
  } finally { await env.close(); }
});

test('completed KPI and view-all preserve date/demo cohort and send supported booking filters', async () => {
  const env = await setup();
  function Harness() {
    const [mode, setMode] = React.useState<'overview' | 'bookings' | 'payments'>('overview');
    return React.createElement(AdminDashboardPage, { mode, adminName: 'Admin', onNavigate: section => { if (section === 'overview' || section === 'bookings' || section === 'payments') setMode(section); }, onHome() {}, onLogout() {}, onOpenBookedCustomers() {} });
  }
  try {
    await act(async () => env.root.render(React.createElement(Harness)));
    await click('7 ngày'); assert.equal([...document.querySelectorAll('button')].find(b => b.textContent === '7 ngày')?.getAttribute('aria-pressed'), 'true');
    await act(async () => document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()); const range = env.requests.at(-1)!;
    await click('Xem chi tiết Lịch hẹn hoàn thành');
    assert.equal(env.requests.at(-1)?.status, 'COMPLETED'); assert.equal(env.requests.at(-1)?.includeDemo, true);
    assert.equal(env.requests.at(-1)?.from, range.from); assert.equal(env.requests.at(-1)?.to, range.to);
    assert.equal(document.querySelector<HTMLSelectElement>('[aria-label="Trạng thái lịch"]')?.value, 'COMPLETED');
    await click('Tổng quan'); await click('Xem tất cả lịch đặt →');
    assert.equal(env.requests.at(-1)?.status, undefined); assert.equal(env.requests.at(-1)?.paymentStatus, undefined); assert.equal(env.requests.at(-1)?.page, 0);
  } finally { await env.close(); }
});

test('chart grain requests DAY/WEEK/MONTH once per change and exposes exact revenue on focus', async () => {
  const env = await setup();
  try {
    await act(async () => env.root.render(React.createElement(AdminOverview, overviewProps)));
    for (const label of ['Theo tuần', 'Theo tháng', 'Theo ngày', 'Theo ngày']) {
      await click(label); assert.equal([...document.querySelectorAll('button')].find(b => b.textContent === label)?.getAttribute('aria-pressed'), 'true');
    }
    assert.deepEqual(env.grains, ['DAY', 'WEEK', 'MONTH', 'DAY']);
    assert.equal(document.querySelectorAll('circle[tabindex="0"]').length, 2);
    await act(async () => document.querySelector<SVGElement>('circle[aria-label^="Thu online"]')!.focus());
    assert.match(document.querySelector('p[role="status"]')?.textContent ?? '', /2026-10-01: 5 lịch.*30.000/);
    assert.ok(document.querySelector('polyline[stroke-dasharray]'));
  } finally { await env.close(); }
});

test('zero chart has an explicit empty state and donut never divides by zero', async () => {
  const env = await setup(); env.data.trends = []; env.data.statuses.forEach(row => { row.count = 0; });
  try {
    await act(async () => env.root.render(React.createElement(AdminOverview, overviewProps)));
    assert.match(document.body.textContent ?? '', /Chưa có lịch đặt hoặc tiền online đã xác minh/);
    assert.doesNotMatch(document.body.textContent ?? '', /NaN|Infinity/);
    assert.equal(document.querySelectorAll('circle[tabindex="0"]').length, 0);
  } finally { await env.close(); }
});

test('booking/payment pills distinguish pending, confirmed, completed, cancelled, deposit and refund', async () => {
  const env = await setup(); const states = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;
  const payments = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'] as const;
  const rows = states.map((status, id) => ({ id, status, paymentStatus: payments[id], bookingCode: `BL-${id}`, appointmentDate: '2026-10-26', startTime: '09:00', createdAt: '2026-10-26T00:00:00Z' } as AdminBooking));
  try {
    await act(async () => env.root.render(React.createElement(BookingTable, { title: 'Bookings', bookings: rows, onSelect() {} })));
    const cells = [...document.querySelectorAll('tbody tr')].map(tr => tr.querySelectorAll('td'));
    for (const [i, color] of ['amber', 'blue', 'emerald', 'rose'].entries()) assert.match(cells[i][4].querySelector('span')!.className, new RegExp(`bg-${color}-100`));
    for (const [i, color] of ['slate', 'amber', 'emerald', 'violet'].entries()) assert.match(cells[i][5].querySelector('span')!.className, new RegExp(`bg-${color}-100`));
    assert.equal(document.querySelectorAll('button[aria-label^="Chi tiết "]').length, 4);
  } finally { await env.close(); }
});
