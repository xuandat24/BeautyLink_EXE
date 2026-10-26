import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { AdminOverview } from '../src/components/admin/AdminOverview';
import { AdminDetailPage } from '../src/components/admin/AdminDetailPage';
import { parseAdminDetailHash } from '../src/components/admin/adminRoutes';
import { adminV2Api } from '../src/services/adminApi';
import { beautyApi } from '../src/services/beautyApi';
import { insightsFixture, paymentFixture } from './adminV2Fixtures';
import type { AdminAccountDetail } from '../src/types/adminV2';

function environment() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/#admin' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const root = createRoot(document.getElementById('root')!); return { dom, root, async close() { await act(async () => root.unmount()); dom.window.close(); } };
}
test('detail hash routes preserve IDs/tabs and fail closed on malformed and unsafe IDs', () => {
  assert.deepEqual(parseAdminDetailHash('#admin-salons/42/payments'), { kind: 'salon', id: 42, tab: 'payments', edit: false });
  assert.deepEqual(parseAdminDetailHash('#admin-users/3/edit'), { kind: 'account', id: 3, tab: 'edit', edit: true });
  for (const hash of ['#admin-users/0/edit', '#admin-salons/../payments', '#admin-users/9007199254740992', '#admin-users/2/edit/extra']) assert.equal(parseAdminDetailHash(hash)?.id, null);
  assert.equal(parseAdminDetailHash('#admin-customers'), null);
  assert.deepEqual(parseAdminDetailHash('#admin-users/edit'), { kind: 'account', id: null, tab: '', edit: true, list: true });
  assert.equal(parseAdminDetailHash('#admin-users/{id}/edit')?.id, null);
  assert.equal(parseAdminDetailHash('#admin-users/edit/extra')?.list, undefined);
});
test('grain switching keeps dashboard nodes/data mounted, fetches only insights, and ignores stale response', async () => {
  const env = environment(); const original = { insights: adminV2Api.insights, payments: beautyApi.adminPaymentSummary, bookings: beautyApi.adminBookings };
  let calls = 0, payCalls = 0, bookingCalls = 0; const requests: Array<{ resolve: (data: ReturnType<typeof insightsFixture>) => void; reject: (error: Error) => void }> = [];
  adminV2Api.insights = async () => { calls++; if (calls === 1) return insightsFixture(); return new Promise((resolve, reject) => requests.push({ resolve, reject })); };
  beautyApi.adminPaymentSummary = async () => { payCalls++; return paymentFixture(); }; beautyApi.adminBookings = async () => { bookingCalls++; return { content: [], page: 0, size: 5, totalPages: 0, totalElements: 0 }; };
  try {
    await act(async () => env.root.render(React.createElement(AdminOverview, { params: { from: '2026-10-01', to: '2026-10-15', includeDemo: false }, renderBookings: () => React.createElement('div', { id: 'recent' }, 'Persisted recent'), onSalon() {}, onBookedCustomers() {} })));
    const root = document.querySelector('[data-testid="admin-overview"]'); const cards = document.querySelector('[aria-label="Chỉ số kinh doanh"]'); const recent = document.getElementById('recent');
    const click = async (label: string) => act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === label)!.click());
    await click('Theo tuần'); await click('Theo tháng');
    assert.equal(document.querySelector('[data-testid="admin-overview"]'), root); assert.equal(document.querySelector('[aria-label="Chỉ số kinh doanh"]'), cards); assert.equal(document.getElementById('recent'), recent);
    assert.equal(payCalls, 1); assert.equal(bookingCalls, 1);
    const month = insightsFixture(); month.totalBookings.value = 999; month.trends = [{ date: '2026-10-01', bookings: 88, verifiedOnlineAmount: 300 }];
    await act(async () => requests[1].resolve(month)); await act(async () => requests[0].resolve(insightsFixture()));
    assert.match(document.querySelector('p[role="status"]')?.textContent ?? '', /88 lịch/);
    assert.equal(cards?.querySelector('[data-admin-value]')?.textContent, '5', 'trend response cannot replace unrelated summary');
    await click('Theo ngày'); await act(async () => requests[2].reject(new Error('Chart unavailable')));
    assert.match(document.querySelector('[role="alert"]')?.textContent ?? '', /Chart unavailable/); assert.equal(document.querySelector('[aria-label="Chỉ số kinh doanh"]'), cards);
    await click('Thử lại biểu đồ'); assert.equal(payCalls, 1); assert.equal(bookingCalls, 1);
    await act(async () => requests[3].resolve(insightsFixture())); assert.equal(document.querySelector('[role="alert"]'), null);
  } finally { adminV2Api.insights = original.insights; beautyApi.adminPaymentSummary = original.payments; beautyApi.adminBookings = original.bookings; await env.close(); }
});
const nav = { adminName: 'Admin', onNavigate() {}, onHome() {}, onLogout() {} };
test('salon tabs retain shell/header, load only their own datasets, and reuse cached tab data', async () => {
  const env = environment(); const original = { header: adminV2Api.salonHeader, services: adminV2Api.salonServices, people: adminV2Api.salonPractitioners };
  let headerCalls = 0, serviceCalls = 0, peopleCalls = 0;
  adminV2Api.salonHeader = async () => { headerCalls++; return { salon: { id: 4, name: 'Salon Four', address: 'Address', ownerName: 'Owner', ownerEmail: 'owner@example.com', location: 'Hà Nội', businessType: 'SPA', approvalStatus: 'VERIFIED', active: true, serviceCount: 1, practitionerCount: 0, bookingCount: 0 }, services: [], practitioners: [], schedules: [], recentBookings: [] }; };
  adminV2Api.salonServices = async id => { assert.equal(id, 4); serviceCalls++; return { content: [{ id: 40, name: 'Care', category: 'Skin', price: 50000, durationMinutes: 30, active: true }], totalPages: 1, totalElements: 1, page: 0, size: 20 }; };
  adminV2Api.salonPractitioners = async () => { peopleCalls++; return { content: [], totalPages: 0, totalElements: 0, page: 0, size: 20 }; };
  const render = (tab: string) => act(async () => env.root.render(React.createElement(AdminDetailPage, { ...nav, route: { kind: 'salon', id: 4, tab, edit: false } })));
  try {
    await render(''); const header = document.querySelector('main header'); const navigation = document.querySelector('nav[aria-label="Điều hướng quản trị"]');
    assert.equal(serviceCalls, 0); assert.equal(peopleCalls, 0); assert.equal(document.querySelector('[role="dialog"]'), null);
    await render('services'); assert.equal(serviceCalls, 1); assert.match(document.querySelector('main')?.textContent ?? '', /Care/);
    await render(''); await render('services'); assert.equal(serviceCalls, 1); assert.equal(headerCalls, 1); assert.equal(peopleCalls, 0);
    assert.equal(document.querySelector('main header'), header); assert.equal(document.querySelector('nav[aria-label="Điều hướng quản trị"]'), navigation);
    assert.equal(document.querySelectorAll('th[scope="col"]').length, 5);
  } finally { adminV2Api.salonHeader = original.header; adminV2Api.salonServices = original.services; adminV2Api.salonPractitioners = original.people; await env.close(); }
});
test('account view has no edit discovery; direct edit sends only approved fields and prevents duplicate saves', async () => {
  const env = environment(); const original = { account: adminV2Api.account, update: adminV2Api.updateAccount };
  let account: AdminAccountDetail = { id: 7, fullName: 'Nguyễn Test', email: 'test@example.com', phone: '0391111111', gender: 'FEMALE', dateOfBirth: '1995-01-01', role: 'CUSTOMER', status: 'ACTIVE', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', salons: [] };
  let calls = 0; let finish!: (value: AdminAccountDetail) => void;
  adminV2Api.account = async () => account;
  adminV2Api.updateAccount = async (id, data) => { calls++; assert.equal(id, 7); assert.deepEqual(Object.keys(data).sort(), ['confirmContactChange', 'dateOfBirth', 'email', 'expectedUpdatedAt', 'fullName', 'gender', 'phone']); return new Promise(resolve => { finish = resolve; }); };
  const render = (edit: boolean) => act(async () => env.root.render(React.createElement(AdminDetailPage, { ...nav, route: { kind: 'account', id: 7, tab: edit ? 'edit' : '', edit } })));
  try {
    await render(false); assert.doesNotMatch([...document.querySelectorAll('button,a')].map(n => n.textContent).join(' '), /chỉnh sửa|edit/i); assert.equal(document.querySelector('form:not(header form)'), null);
    await render(true); const form = document.querySelector('main form')!;
    assert.equal(form.querySelectorAll('input').length, 4); assert.equal(form.querySelectorAll('select').length, 1); assert.equal(form.querySelector('select')?.getAttribute('aria-label'), 'Giới tính');
    await act(async () => { form.dispatchEvent(new env.dom.window.Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new env.dom.window.Event('submit', { bubbles: true, cancelable: true })); }); assert.equal(calls, 1);
    account = { ...account, updatedAt: '2026-10-02T00:00:00Z' }; await act(async () => finish(account)); assert.match(document.body.textContent ?? '', /Đã lưu hồ sơ khách hàng/);
  } finally { adminV2Api.account = original.account; adminV2Api.updateAccount = original.update; await env.close(); }
});


test('manual edit directory reuses all-role list, allows CUSTOMER and SUPPLIER edit only and normal list has no edit discovery', async () => {
  const env = environment(); const original = adminV2Api.users;
  const requests: unknown[] = [];
  adminV2Api.users = async params => { requests.push(params); return { content: [
    { id: 7, fullName: 'Khách Demo', email: 'customer@example.com', role: 'CUSTOMER', status: 'ACTIVE', createdAt: '2026-10-01T00:00:00Z' },
    { id: 8, fullName: 'Đối Tác Demo', email: 'supplier@example.com', role: 'SUPPLIER', status: 'ACTIVE', createdAt: '2026-10-01T00:00:00Z' },
    { id: 9, fullName: 'Admin Demo', email: 'admin@example.com', role: 'ADMIN', status: 'ACTIVE', createdAt: '2026-10-01T00:00:00Z' },
  ], totalPages: 1, totalElements: 3, page: 0, size: 20 }; };
  try {
    const route = parseAdminDetailHash('#admin-users/edit')!;
    await act(async () => env.root.render(React.createElement(AdminDetailPage, { ...nav, route })));
    assert.equal(document.querySelectorAll('tbody tr').length, 3);
    assert.equal(document.querySelector('[aria-label="Lọc vai trò"]')?.querySelectorAll('option').length, 5);
    assert.deepEqual(requests[0], { query: undefined, role: undefined, page: 0, size: 20 });
    const edits = [...document.querySelectorAll('button')].filter(b => b.textContent === 'Sửa hồ sơ');
    assert.equal(edits.length, 2); assert.match(edits[0].getAttribute('aria-label')!, /Khách Demo/);
    await act(async () => edits[0].click()); assert.equal(window.location.hash, '#admin-users/7/edit');
    assert.equal(document.querySelectorAll('a[href="#admin-users/edit"]').length, 0);
    const { AdminModulesPage } = await import('../src/components/admin/AdminModulesPage');
    await act(async () => env.root.render(React.createElement(AdminModulesPage, { ...nav, section: 'customers' })));
    assert.equal(document.querySelectorAll('tbody tr').length, 3);
    assert.doesNotMatch([...document.querySelectorAll('button,a')].map(n => n.textContent).join(' '), /Sửa hồ sơ|Chế độ chỉnh sửa/);
  } finally { adminV2Api.users = original; await env.close(); }
});


test('partner editor saves scoped profile, retains form on conflict and blocks duplicate submits', async () => {
  const env=environment(); const original={ profile:adminV2Api.partnerProfile, update:adminV2Api.updatePartnerProfile, locations:beautyApi.locations, categories:beautyApi.categories };
  const initial={ data:{ name:'Salon Example',businessType:'SPA',description:'Profile',addressLine:'Test address',imageUrl:null,locationId:null,latitude:null,longitude:null },revision:'original' };
  adminV2Api.partnerProfile=async id=>{assert.equal(id,4);return initial;};beautyApi.locations=async()=>[];beautyApi.categories=async()=>[];
  let count=0;let finish!: (value: typeof initial)=>void;
  adminV2Api.updatePartnerProfile=async(id,data,revision)=>{assert.equal(id,4);assert.equal(revision,'original');assert.equal(data.name,'Salon Example');count++;if(count===1)throw new Error('Dữ liệu đã thay đổi');return new Promise(resolve=>{finish=resolve;});};
  try {
    const { AdminPartnerEditor }=await import('../src/components/admin/AdminPartnerEditor');
    await act(async()=>env.root.render(React.createElement(AdminPartnerEditor,{salonId:4,name:'Salon Example'})));
    const form=document.querySelector('form')!;assert.ok(form);assert.equal(form.querySelector('input')?.value,'Salon Example');
    await act(async()=>form.dispatchEvent(new env.dom.window.Event('submit',{bubbles:true,cancelable:true})));assert.match(document.body.textContent??'',/Dữ liệu đã thay đổi/);assert.equal(document.querySelector('form'),form);assert.equal(form.querySelector('input')?.value,'Salon Example');
    await act(async()=>{form.dispatchEvent(new env.dom.window.Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new env.dom.window.Event('submit',{bubbles:true,cancelable:true}));});assert.equal(count,2);
    await act(async()=>finish(initial));assert.match(document.body.textContent??'',/Đã lưu thay đổi đối tác/);
    assert.equal(form.querySelector('[name="role"]'),null);assert.equal(form.querySelector('[name="verificationStatus"]'),null);
  } finally {adminV2Api.partnerProfile=original.profile;adminV2Api.updatePartnerProfile=original.update;beautyApi.locations=original.locations;beautyApi.categories=original.categories;await env.close();}
});
