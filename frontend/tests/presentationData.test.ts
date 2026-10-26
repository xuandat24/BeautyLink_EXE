import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { presentationEmail, presentationInsights, presentationService } from '../src/lib/presentationData';
import { AdminModulesPage } from '../src/components/admin/AdminModulesPage';
import { adminV2Api } from '../src/services/adminApi';
import { insightsFixture } from './adminV2Fixtures';
import type { BackendService } from '../src/types';

test('presentation stars are stable per supplier, preserve real reviews and leave source objects intact', () => {
  const source = { id: 11, supplierId: 7, rating: 0, serviceReviewCount: 0, supplierRating: 0, supplierReviewCount: 0 } as BackendService;
  assert.equal(presentationService(source, false), source);
  const first = presentationService(source, true);
  const second = presentationService({ ...source, id: 12 }, true);
  assert.equal(first.supplierRating, second.supplierRating);
  assert.equal(first.supplierReviewCount, second.supplierReviewCount);
  assert.ok(first.rating >= 4.6 && first.rating <= 4.9);
  assert.ok(first.serviceReviewCount! > 0);
  assert.deepEqual(presentationService(source, true), first);
  assert.equal(source.rating, 0);
  const actual = { ...source, rating: 3.5, serviceReviewCount: 2, supplierRating: 4.1, supplierReviewCount: 9 };
  assert.deepEqual(presentationService(actual, true), actual);
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

test('presentation overview displays 59 without changing underlying bookings, revenue or source metrics', () => {
  const source = insightsFixture();
  assert.equal(presentationInsights(source, false), source);
  const result = presentationInsights(source, true);
  assert.equal(result.completedBookings.value, 59);
  assert.equal(result.completedBookings.previous, null);
  assert.equal(result.completedBookings.changePercent, null);
  assert.equal(result.revenue, source.revenue);
  assert.equal(result.totalBookings, source.totalBookings);
  assert.equal(result.statuses, source.statuses);
  assert.equal(source.completedBookings.value, 1);
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
