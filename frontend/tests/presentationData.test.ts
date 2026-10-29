import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { presentationEmail, presentationReviewAllocation, presentationService } from '../src/lib/presentationData';
import { createPresentationAdminData, isPresentationUser, presentationBookings, presentationCustomers, presentationCustomerCsv, presentationInsights as reportInsights, presentationPage } from '../src/lib/presentationAdminData';
import { AdminModulesPage } from '../src/components/admin/AdminModulesPage';
import { AdminOverview } from '../src/components/admin/AdminOverview';
import { adminV2Api } from '../src/services/adminApi';
import { beautyApi } from '../src/services/beautyApi';
import { insightsFixture as sourceInsightsFixture, paymentFixture } from './adminV2Fixtures';
import type { BackendService } from '../src/types';
import type { AdminSalonRow } from '../src/types/adminV2';

const salons = Array.from({ length: 14 }, (_, index) => ({ id: index + 1, name: `Salon ${index + 1}`, ownerName: 'Owner', ownerEmail: 'owner@example.com', businessType: 'Spa', location: 'Hà Nội', address: 'Hà Nội', active: false, approvalStatus: 'PENDING', serviceCount: 1, practitionerCount: 1, bookingCount: 0 } as AdminSalonRow));
const snapshot = createPresentationAdminData(salons, []);
const insightsFixture = () => { const data = sourceInsightsFixture(); return { ...data, range: { ...data.range, toDate: '2026-10-29' } }; };
const presentationInsights = (data: ReturnType<typeof insightsFixture>, enabled: boolean) => enabled ? reportInsights(data, snapshot) : data;

test('286 fictional accounts and 147 bookings reconcile across paging, histories, salons and CSV', async () => {
  assert.equal(snapshot.users.length, 286);
  assert.equal(new Set(snapshot.users.map(user => user.email)).size, 286);
  assert.equal(new Set(snapshot.users.map(user => user.fullName)).size, 286);
  assert.equal(new Set(snapshot.users.map(user => user.phone)).size, 286);
  assert.equal(snapshot.users.filter(user => user.role === 'SUPPLIER').length, 14);
  assert.ok(snapshot.users.every(user => isPresentationUser(user.id) && /^0[35789]\d{8}$/.test(user.phone!)));
  assert.ok(snapshot.users.every(user => !/seed|demo|test|\+/.test(user.email!)));
  assert.equal(snapshot.salons.length, 14);
  assert.ok(snapshot.salons.every(salon => salon.active && salon.approvalStatus === 'VERIFIED'));
  assert.equal(salons[0].active, false);
  assert.equal(snapshot.bookings.length, 147);
  assert.equal(snapshot.salons.reduce((sum, salon) => sum + salon.bookingCount, 0), 147);
  assert.ok(snapshot.bookings.every(booking => booking.status === 'COMPLETED' && snapshot.users.some(user => user.id === booking.customerId)));
  const customers = presentationCustomers(snapshot);
  assert.equal(customers.reduce((sum, customer) => sum + customer.completedBookings, 0), 147);
  assert.equal(presentationCustomers(snapshot, { bookedOnly: true }).length, 78);
  assert.equal(presentationBookings(snapshot, { status: 'CANCELLED' }).length, 0);
  assert.equal(presentationPage(snapshot.users, 14).content.length, 6);
  assert.equal(presentationPage(snapshot.users, 14).totalPages, 15);
  assert.ok(presentationBookings(snapshot, { customerId: customers[0].id }).every(booking => booking.customerName === customers[0].fullName));
  const csv = await presentationCustomerCsv(snapshot).text();
  assert.equal(csv.trim().split('\r\n').length, customers.length + 1);
  assert.ok(csv.includes(customers[0].email));
  await assert.rejects(adminV2Api.updateAccount(snapshot.users[0].id, {} as never), /chỉ hỗ trợ xem/);
});

test('date and status filters agree with overview totals, including empty ranges', () => {
  for (const [fromDate, toDate] of [['2026-10-01', '2026-10-07'], ['2026-10-10', '2026-10-20'], ['2026-11-01', '2026-11-30']]) {
    const source = insightsFixture(); source.range = { ...source.range, fromDate, toDate };
    const result = reportInsights(source, snapshot);
    const count = presentationBookings(snapshot, { from: fromDate, to: toDate, status: 'COMPLETED' }).length;
    assert.equal(result.completedBookings.value, count);
    assert.equal(result.totalBookings.value, count);
    assert.equal(result.trends.reduce((sum, point) => sum + point.bookings, 0), count);
    assert.equal(result.topSalons.reduce((sum, salon) => sum + salon.bookings, 0), count);
    assert.equal(result.trends.reduce((sum, point) => sum + point.commissionAmount!, 0), result.commissionRevenue!.value);
  }
});

test('presentation stars are stable per supplier, preserve real reviews and leave source objects intact', () => {
  const source = { id: 11, supplierId: 7, rating: 0, serviceReviewCount: 0, supplierRating: 0, supplierReviewCount: 0, bookedOrCompletedCount: 3 } as BackendService;
  const other = { ...source, id: 12, bookedOrCompletedCount: 2 };
  const allocation = presentationReviewAllocation([source, other]);
  assert.equal(presentationService(source, allocation, false), source);
  const first = presentationService(source, allocation, true);
  const second = presentationService(other, allocation, true);
  assert.equal(first.serviceReviewCount, 3);
  assert.equal(second.serviceReviewCount, 2);
  assert.equal(first.supplierReviewCount, 5);
  assert.equal(first.supplierRating, second.supplierRating);
  assert.equal(first.supplierReviewCount, second.supplierReviewCount);
  assert.ok(first.rating >= 4.6 && first.rating <= 4.9);
  assert.deepEqual(presentationService(source, allocation, true), first);
  assert.equal(source.rating, 0);
  const actual = { ...source, rating: 3.5, serviceReviewCount: 2, supplierRating: 4.1, supplierReviewCount: 9 };
  assert.deepEqual(presentationService(actual, allocation, true), actual);
});

test('public service specialists do not show seeded demo markers', () => {
  const source = { id: 11, supplierId: 7, serviceReviewCount: 0, supplierReviewCount: 0,
    practitioners: [{ id: 51, displayName: 'Hồ Ngọc Thanh', specialty: 'DEMO - Hair studio', bio: 'DEMO BeautyLink [bl-practitioner-010]' },
      { id: 52, displayName: 'Mai An', specialty: 'Nail artist', bio: 'Chuyên viên chăm sóc móng' }] } as BackendService;
  const result = presentationService(source, null, false);
  assert.equal(result.practitioners?.[0].specialty, 'Hair studio');
  assert.equal(result.practitioners?.[0].bio, undefined);
  assert.deepEqual(result.practitioners?.[1], source.practitioners?.[1]);
  assert.equal(source.practitioners?.[0].specialty, 'DEMO - Hair studio');
});

test('154 services share at most 147 reviews and unbooked services get one or two only while budget remains', () => {
  const catalog = Array.from({ length: 154 }, (_, index) => ({
    id: index + 1, supplierId: 1 + Math.floor(index / 11), serviceReviewCount: index === 2 ? 2 : 0,
    bookedOrCompletedCount: index === 0 ? 6 : index === 1 ? 3 : 0,
  } as BackendService));
  const allocation = presentationReviewAllocation(catalog);
  assert.equal(allocation.services.get(1), 6);
  assert.equal(allocation.services.get(2), 3);
  assert.equal(allocation.services.get(3), 2);
  assert.equal([...allocation.services.values()].reduce((sum, count) => sum + count, 0), 147);
  assert.equal([...allocation.suppliers.values()].reduce((sum, count) => sum + count, 0), 147);
  assert.ok(catalog.slice(3).every(service => [0, 1, 2].includes(allocation.services.get(service.id)!)));
  assert.ok(catalog.slice(3).some(service => allocation.services.get(service.id) === 0));
  assert.deepEqual(presentationReviewAllocation(catalog), allocation);
});

test('only seeded email display addresses change; aliases are stable and use ordinary human-style local parts', () => {
  const email = 'nguyen.minhanh+492.351@seed.beautylink.test';
  assert.equal(presentationEmail(email, false), email);
  assert.equal(presentationEmail(null, true), null);
  assert.equal(presentationEmail('real.person@gmail.com', true), 'real.person@gmail.com');
  const alias = presentationEmail(email, true)!;
  assert.match(alias, /^nguyen\.minhanh\d{2}@(gmail|outlook|yahoo)\.com$/);
  assert.equal(presentationEmail(email, true), alias);
  assert.doesNotMatch(alias, /seed|test|demo|\+/);
});

test('presentation report reconciles 286 users, 14 active partners and 147 completed bookings without mutating API data', () => {
  const source = insightsFixture();
  assert.equal(presentationInsights(source, false), source);
  const result = presentationInsights(source, true);
  assert.equal(result.completedBookings.value, 147);
  assert.equal(result.completedBookings.previous, null);
  assert.equal(result.completedBookings.changePercent, null);
  assert.equal(result.totalBookings.value, 147);
  assert.equal(result.bookingCustomers, 78);
  assert.equal(result.commissionRevenue?.value, 1_906_000);
  assert.equal(result.statuses.reduce((sum, row) => sum + row.count, 0), 147);
  assert.equal(result.statuses.find(row => row.status === 'COMPLETED')?.count, 147);
  assert.equal(result.trends.reduce((sum, row) => sum + row.bookings, 0), 147);
  assert.equal(result.trends.reduce((sum, row) => sum + row.commissionAmount!, 0), 1_906_000);
  assert.equal(result.revenue, source.revenue);
  assert.equal(result.users.value, 286);
  assert.equal(result.activePartners.value, 14);
  assert.equal(source.users.value, 9);
  assert.equal(source.completedBookings.value, 1);
  assert.equal(source.totalBookings.value, 5);
  assert.equal(source.statuses.reduce((sum, row) => sum + row.count, 0), 5);
});

test('chart granularities, empty API trends and partner/service rankings retain exact report totals', () => {
  for (const granularity of ['DAY', 'WEEK', 'MONTH'] as const) {
    for (const size of [0, 1, 4, 30]) {
      const source = insightsFixture(); source.granularity = granularity;
      source.trends = Array.from({ length: size }, (_, index) => ({ date: `2026-10-${String(index + 1).padStart(2, '0')}`, bookings: index % 3, verifiedOnlineAmount: 12345 }));
      source.topSalons = [1, 2, 3].map(id => ({ id, name: `Salon ${id}`, location: null, bookings: id, verifiedOnlineAmount: 12345 }));
      source.popularServices = [1, 2, 3].map(id => ({ id, name: `Service ${id}`, supplierName: 'Salon', bookings: id, percentage: 0 }));
      const result = presentationInsights(source, true);
      assert.equal(result.trends.reduce((sum, row) => sum + row.bookings, 0), 147);
      assert.equal(result.trends.reduce((sum, row) => sum + row.commissionAmount!, 0), 1_906_000);
      assert.equal(result.topSalons.reduce((sum, row) => sum + row.bookings, 0), 147);
      assert.equal(result.topSalons.reduce((sum, row) => sum + row.commissionAmount!, 0), 1_906_000);
      assert.equal(result.popularServices.reduce((sum, row) => sum + row.bookings, 0), 147);
      for (const service of result.popularServices) assert.equal(service.percentage, Math.round(service.bookings / 147 * 1000) / 10);
      assert.ok(result.trends.every(row => Number.isInteger(row.bookings) && Number.isInteger(row.commissionAmount) && row.bookings >= 0 && row.commissionAmount! >= 0));
    }
  }
});

test('commission dashboard labels distinguish platform earnings from online receipts and show the matching donut', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/#admin-dashboard' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const root = createRoot(document.getElementById('root')!);
  const original = { insights: adminV2Api.insights, payments: beautyApi.adminPaymentSummary, bookings: beautyApi.adminBookings };
  adminV2Api.insights = async () => presentationInsights(insightsFixture(), true);
  beautyApi.adminPaymentSummary = async () => paymentFixture();
  beautyApi.adminBookings = async () => ({ content: [], totalElements: 0, totalPages: 0, page: 0, size: 5 });
  try {
    await act(async () => root.render(React.createElement(AdminOverview, { params: { from: '2026-10-01', to: '2026-10-15', includeDemo: false }, renderBookings: () => null, onSalon() {}, onBookedCustomers() {} })));
    const cards = [...document.querySelectorAll('[aria-label="Chỉ số kinh doanh"] article')];
    assert.deepEqual(cards.slice(0, 3).map(card => card.querySelector('h2')?.textContent), ['Tổng đơn đặt lịch', 'Người dùng', 'Doanh thu hoa hồng']);
    assert.deepEqual(cards.slice(0, 2).map(card => card.querySelector('[data-admin-value]')?.textContent), ['147', '286']);
    assert.match(cards[2].querySelector('[data-admin-value]')?.textContent ?? '', /1\.906\.000/);
    assert.ok(document.querySelector('svg[aria-label="147 lịch trong kỳ"]'));
    assert.match(document.body.textContent ?? '', /Kết quả kinh doanh & tài chính/);
    assert.doesNotMatch(document.body.textContent ?? '', /Tổng thu online xác minh theo paidAt/);
  } finally { await act(async () => root.unmount()); Object.assign(adminV2Api, { insights: original.insights }); beautyApi.adminPaymentSummary = original.payments; beautyApi.adminBookings = original.bookings; dom.window.close(); }
});

test('users table has five aligned columns and retains account detail navigation', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/#admin-customers' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const root = createRoot(document.getElementById('root')!);
  const original = adminV2Api.users; let selected = 0;
  adminV2Api.users = async () => ({ content: [{ id: 7, fullName: 'Nguyễn Minh Anh', email: 'minhanh97@gmail.com', role: 'CUSTOMER', status: 'DISABLED', createdAt: '2026-10-01T00:00:00Z' }], page: 0, size: 20, totalElements: 1, totalPages: 1 });
  try {
    await act(async () => root.render(React.createElement(AdminModulesPage, { section: 'customers', adminName: 'Admin', onNavigate() {}, onHome() {}, onLogout() {}, onOpenAccount(id) { selected = id; } })));
    assert.deepEqual([...document.querySelectorAll('thead th')].map(th => th.textContent), ['Người dùng', 'Email', 'Vai trò', 'Ngày tạo', 'Thao tác']);
    assert.equal(document.querySelectorAll('tbody tr:first-child td').length, 5);
    assert.doesNotMatch(document.querySelector('tbody')?.textContent ?? '', /DISABLED|Vô hiệu hóa/);
    await act(async () => document.querySelector<HTMLButtonElement>('tbody button')!.click());
    assert.equal(selected, 7);
  } finally {
    await act(async () => root.unmount()); adminV2Api.users = original; dom.window.close();
  }
});
