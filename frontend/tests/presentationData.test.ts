import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { presentationEmail, presentationReviewAllocation, presentationService } from '../src/lib/presentationData';
import { createPresentationAdminData, isPresentationUser, mergePersistentPresentationData, presentationBookings, presentationCustomers, presentationCustomerCsv, presentationInsights as reportInsights, presentationPage } from '../src/lib/presentationAdminData';
import { AdminModulesPage } from '../src/components/admin/AdminModulesPage';
import { AdminOverview } from '../src/components/admin/AdminOverview';
import { adminV2Api } from '../src/services/adminApi';
import { beautyApi } from '../src/services/beautyApi';
import { insightsFixture as sourceInsightsFixture, paymentFixture } from './adminV2Fixtures';
import type { AdminBooking, AdminCustomer, BackendService } from '../src/types';
import type { AdminSalonRow } from '../src/types/adminV2';

const salons = Array.from({ length: 14 }, (_, index) => ({ id: index + 1, name: `Salon ${index + 1}`, ownerName: 'Owner', ownerEmail: 'owner@example.com', businessType: 'Spa', location: 'Hà Nội', address: 'Hà Nội', active: false, approvalStatus: 'PENDING', serviceCount: 1, practitionerCount: 1, bookingCount: 0 } as AdminSalonRow));
const snapshot = createPresentationAdminData(salons, []);
const insightsFixture = () => { const data = sourceInsightsFixture(); return { ...data, range: { ...data.range, toDate: '2026-10-29' } }; };
const presentationInsights = (data: ReturnType<typeof insightsFixture>, enabled: boolean) => enabled ? reportInsights(data, snapshot) : data;

test('database-recovered records preserve every original and reconcile service value, statuses and all chart grains', async () => {
  const values=[11000,11000,11000,200000];
  const originals=values.map((totalAmount,i)=>({...snapshot.bookings[i],id:i+1,bookingCode:`BL-REAL-${i}`,totalAmount,customerId:501,customerName:'Original customer',createdAt:'2026-10-15T02:30:00Z',verifiedOnlineAmount:null,paymentStatus:'UNPAID'} as AdminBooking));
  const source={users:[{id:501,fullName:'Original customer',email:'original@example.com',role:'CUSTOMER' as const,status:'ACTIVE',createdAt:'2026-09-01T00:00:00Z'}],bookings:originals};
  const plan=createPresentationAdminData(salons,[],source);
  const stored={...plan,users:plan.users.filter(u=>isPresentationUser(u.id)),originalCustomers:[],bookings:plan.bookings.filter(b=>b.id>=9000000000).map((b,i)=>({...b,totalAmount:i<95?20000:19000,verifiedOnlineAmount:null,verifiedPaidAt:null,verifiedPaymentOption:null,remainingAtSalon:null}))};
  const recovered=mergePersistentPresentationData(stored,source);
  assert.equal(recovered.bookings.length,147);
  assert.equal(recovered.users.length,286);
  for(const original of originals) for(const [key,value] of Object.entries(original)) if(!['serviceId','commissionAmount'].includes(key)) assert.deepEqual((recovered.bookings.find(b=>b.id===original.id) as any)[key],value);
  for(const granularity of ['DAY','WEEK','MONTH'] as const) {
    const api=insightsFixture(); api.granularity=granularity; api.range={...api.range,fromDate:'2026-10-01',toDate:'2026-10-31'};
    const result=reportInsights(api,recovered);
    assert.equal(result.completedServiceValue!.value,3045000);
    assert.equal(result.completedBookings.value,147);
    assert.equal(result.trends.reduce((sum,t)=>sum+(t.completedServiceValue??0),0),3045000);
    assert.equal(result.topSalons.reduce((sum,t)=>sum+(t.completedServiceValue??0),0),3045000);
    assert.deepEqual(result.revenue,api.revenue,'verified receipts never become simulated service value');
  }
  const malicious={...stored,users:[{...stored.users[0],role:'CUSTOMER' as const,fullName:'=IMPORTXML("unsafe")'}]};
  assert.match(await presentationCustomerCsv(malicious).text(),/'=IMPORTXML/);
});

test('live bookings and customers survive supplementation, with deposits summed per customer', () => {
  const customer = { id: 501, fullName: 'Trần Hải Anh', phone: '0912345678', email: 'hai.anh@gmail.com', gender: 'FEMALE', dateOfBirth: '1996-04-12',
    bookingsPlaced: 4, paidBookings: 2, completedBookings: 1, totalVerifiedOnlineAmount: 45000, lastBookingAt: '2026-10-15T02:30:00Z' } as AdminCustomer;
  const originals = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map((status, index) => ({
    ...snapshot.bookings[index], id: 101 + index, bookingCode: `BL-OLD-${101 + index}`, customerId: customer.id, customerName: customer.fullName, customerPhone: customer.phone,
    status, paymentStatus: index === 1 ? 'PARTIALLY_PAID' : index === 2 ? 'PAID' : 'UNPAID', createdAt: '2026-10-15T02:30:00Z',
    verifiedOnlineAmount: index === 1 ? 15000 : index === 2 ? 30000 : null,
  } as AdminBooking));
  const input = structuredClone({ customers: [customer], bookings: originals });
  const report = createPresentationAdminData(salons, [], input);
  const insights = reportInsights(insightsFixture(), report);
  assert.equal(report.users.length, 286);
  assert.ok(report.users.some(user => user.id === customer.id && user.email === customer.email));
  assert.equal(insights.completedBookings.value, 147);
  assert.equal(insights.totalBookings.value, 150);
  assert.deepEqual(insights.statuses.map(row => row.count), [1, 1, 147, 1]);
  assert.equal(insights.trends.reduce((sum, point) => sum + point.bookings, 0), 150);
  assert.ok(insights.returningCustomers!.value > 0);
  const nonCancelled = new Map<number, number>();
  report.bookings.filter(booking => booking.status !== 'CANCELLED').forEach(booking => nonCancelled.set(booking.customerId, (nonCancelled.get(booking.customerId) ?? 0) + 1));
  assert.equal(insights.returningCustomers!.value, [...nonCancelled.values()].filter(count => count >= 2).length);
  for (const original of originals) {
    const restored = report.bookings.find(booking => booking.id === original.id)!;
    for (const [key, value] of Object.entries(original)) if (!['commissionAmount', 'serviceId'].includes(key)) assert.deepEqual(restored[key as keyof AdminBooking], value);
  }
  const synthetic = report.bookings.filter(booking => booking.id >= 9_000_000_000);
  assert.equal(synthetic.length, 146);
  assert.ok(synthetic.every(booking => booking.verifiedOnlineAmount! >= 5000 && booking.verifiedOnlineAmount! <= 15000));
  assert.ok(new Set(synthetic.map(booking => booking.verifiedOnlineAmount)).size > 1);
  const row = presentationCustomers(report).find(row => row.id === customer.id)!;
  const history = presentationBookings(report, { customerId: customer.id });
  assert.equal(row.bookingsPlaced, history.length);
  assert.equal(row.paidBookings, history.filter(booking => ['PAID', 'PARTIALLY_PAID'].includes(booking.paymentStatus)).length);
  assert.equal(row.completedBookings, history.filter(booking => booking.status === 'COMPLETED').length);
  assert.equal(row.totalVerifiedOnlineAmount, history.reduce((sum, booking) => sum + (booking.verifiedOnlineAmount ?? 0), 0));
  assert.deepEqual(input, { customers: [customer], bookings: originals });
  assert.deepEqual(createPresentationAdminData(salons, [], input).bookings, report.bookings, 'sample deposits remain stable between reloads');
});

test('all original accounts survive even above 286 and Vietnam midnight filtering stays consistent', () => {
  const users = Array.from({ length: 287 }, (_, index) => ({ id: index + 1, fullName: `Khách ${index + 1}`, email: `person${index + 1}@gmail.com`, role: 'CUSTOMER' as const, status: 'ACTIVE', createdAt: '2026-09-01T00:00:00Z' }));
  const original = { ...snapshot.bookings[0], id: 55, bookingCode: 'BL-MIDNIGHT', customerId: 1, createdAt: '2026-10-29T20:30:00Z', status: 'CONFIRMED' as const };
  const report = createPresentationAdminData(salons, [], { users, bookings: [original] });
  assert.equal(report.users.length, 287);
  assert.ok(users.every(user => report.users.some(row => row.id === user.id)));
  assert.equal(presentationBookings(report, { from: '2026-10-30', to: '2026-10-30' }).length, 1);
  const source = insightsFixture(); source.range = { ...source.range, fromDate: '2026-10-30', toDate: '2026-10-30' };
  const insights = reportInsights(source, report);
  assert.equal(insights.totalBookings.value, 1);
  assert.equal(insights.completedBookings.value, 0);
  assert.equal(insights.trends[0].bookings, 1);
});

test('286 fictional accounts and 147 bookings reconcile across paging, histories, salons and CSV', async () => {
  assert.equal(snapshot.users.length, 286);
  assert.equal(new Set(snapshot.users.map(user => user.email)).size, 286);
  assert.equal(new Set(snapshot.users.map(user => user.fullName)).size, 286);
  assert.equal(new Set(snapshot.users.map(user => user.phone)).size, 286);
  assert.equal(snapshot.users.filter(user => user.role === 'SUPPLIER').length, 14);
  assert.ok(snapshot.users.every(user => isPresentationUser(user.id) && /^(03[2-9]|07[06789]|08[1-9]|09\d)\d{7}$/.test(user.phone!)));
  assert.ok(snapshot.users.every(user => !/seed|demo|test|\+/.test(user.email!)));
  assert.equal(snapshot.salons.length, 14);
  assert.ok(snapshot.salons.every(salon => salon.active && salon.approvalStatus === 'VERIFIED'));
  assert.equal(salons[0].active, false);
  assert.equal(snapshot.bookings.length, 147);
  assert.equal(snapshot.salons.reduce((sum, salon) => sum + salon.bookingCount, 0), 147);
  assert.ok(snapshot.bookings.every(booking => booking.status === 'COMPLETED' && snapshot.users.some(user => user.id === booking.customerId)));
  const customers = presentationCustomers(snapshot);
  assert.equal(customers.reduce((sum, customer) => sum + customer.completedBookings, 0), 147);
  assert.equal(customers.reduce((sum, customer) => sum + customer.totalVerifiedOnlineAmount, 0), snapshot.bookings.reduce((sum, booking) => sum + booking.verifiedOnlineAmount!, 0));
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
    assert.equal(result.trends.reduce((sum, point) => sum + point.completedServiceValue!, 0), result.completedServiceValue!.value);
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
  assert.equal(result.completedServiceValue?.value, snapshot.bookings.reduce((sum, row) => sum + row.totalAmount, 0));
  assert.equal(result.statuses.reduce((sum, row) => sum + row.count, 0), 147);
  assert.equal(result.statuses.find(row => row.status === 'COMPLETED')?.count, 147);
  assert.equal(result.trends.reduce((sum, row) => sum + row.bookings, 0), 147);
  assert.equal(result.trends.reduce((sum, row) => sum + row.completedServiceValue!, 0), result.completedServiceValue!.value);
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
      assert.equal(result.trends.reduce((sum, row) => sum + row.completedServiceValue!, 0), result.completedServiceValue!.value);
      assert.equal(result.topSalons.reduce((sum, row) => sum + row.bookings, 0), 147);
      assert.equal(result.topSalons.reduce((sum, row) => sum + row.completedServiceValue!, 0), result.completedServiceValue!.value);
      assert.equal(result.popularServices.reduce((sum, row) => sum + row.bookings, 0), 147);
      for (const service of result.popularServices) assert.equal(service.percentage, Math.round(service.bookings / 147 * 1000) / 10);
      assert.ok(result.trends.every(row => Number.isInteger(row.bookings) && Number.isInteger(row.completedServiceValue) && row.bookings >= 0 && row.completedServiceValue! >= 0));
    }
  }
});

test('service-value dashboard keeps verified receipts separate and shows the matching donut', async () => {
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
    assert.deepEqual(cards.slice(0, 3).map(card => card.querySelector('h2')?.textContent), ['Tổng đơn đặt lịch', 'Người dùng', 'Doanh thu']);
    assert.deepEqual(cards.slice(0, 2).map(card => card.querySelector('[data-admin-value]')?.textContent), ['147', '286']);
    assert.equal(cards[2].querySelector('[data-admin-value]')?.textContent, new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(snapshot.bookings.reduce((sum,row)=>sum+row.totalAmount,0)));
    assert.ok(document.querySelector('svg[aria-label="147 lịch trong kỳ"]'));
    assert.doesNotMatch(document.body.textContent ?? '', /Kết quả kinh doanh & tài chính/);
    assert.match(document.body.textContent ?? '', /Tổng thu online xác minh theo paidAt/);
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
