import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { ONBOARDING_KEY, ONBOARDING_TTL, readOnboarding, eligibleOnboardingVisit } from '../src/lib/onboarding';
import type { CurrentUser } from '../src/types';

const completedAt = 1792800000000;
const snapshot = { version: 1, completedAt, locationId: 7, city: 'Hà Nội', category: 'spa' };
test('atomic timestamp: first, before, exact, after 24h, refresh and corrupt/legacy records', () => {
  assert.equal(readOnboarding(null, completedAt), null);
  const raw = JSON.stringify(snapshot);
  for (const age of [0, 1000, ONBOARDING_TTL - 1]) assert.deepEqual(readOnboarding(raw, completedAt + age), snapshot);
  for (const age of [ONBOARDING_TTL, ONBOARDING_TTL + 1]) assert.equal(readOnboarding(raw, completedAt + age), null);
  assert.equal(JSON.parse(raw).completedAt, completedAt, 'reads never renew completion time');
  for (const raw of ['{bad', 'true', '{}', JSON.stringify({ ...snapshot, completedAt: undefined }),
    JSON.stringify({ ...snapshot, completedAt: completedAt + 100 }), JSON.stringify({ ...snapshot, locationId: -1 }),
    JSON.stringify({ ...snapshot, category: '<script>' })]) assert.equal(readOnboarding(raw, completedAt), null);
});
test('new eligible home visit only: payment return, checkout, active booking never get automatic modal', () => {
  assert.equal(eligibleOnboardingVisit('home', '', '#home'), true);
  assert.equal(eligibleOnboardingVisit('home', '', ''), true);
  for (const view of ['checkout', 'account', 'bookings', 'supplier-dashboard']) assert.equal(eligibleOnboardingVisit(view, '', '#home'), false);
  for (const query of ['?payment=success', '?payment=cancel', '?orderCode=42', '?bookingPayment=42'])
    assert.equal(eligibleOnboardingVisit('home', query, ''), false);
  assert.equal(eligibleOnboardingVisit('home', '', '#checkout'), false);
  assert.equal(eligibleOnboardingVisit('home', '', '#home', true), false);
});
test('store expiry is atomic across tabs/visibility, validates options, preserves auth and unrelated preferences', async t => {
  let now = completedAt; t.mock.method(Date, 'now', () => now);
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  let deadline!: () => void, delay = 0;
  t.mock.method(window, 'setTimeout', (handler: TimerHandler, timeout?: number) => { deadline = handler as () => void; delay = timeout ?? 0; return 1; });
  t.mock.method(window, 'clearTimeout', () => {});
  localStorage.setItem('beautylink_v2_user_selected_city', JSON.stringify({ data: 'Hà Nội', timestamp: now, ttl: 0, hash: 'legacy' }));
  localStorage.setItem('unrelated-preference', 'preserve');
  const { useBeautyStore } = await import('../src/store/beautyStore');
  let store!: ReturnType<typeof useBeautyStore>;
  function Harness() { store = useBeautyStore(); return null; }
  const root = createRoot(document.getElementById('root')!);
  const refresh = () => window.dispatchEvent(new dom.window.Event('focus'));
  const assertEmpty = () => {
    assert.equal(store.selectedLocationId, null); assert.equal(store.selectedIntentCategory, null);
    assert.equal(store.selectedCity, 'Chọn khu vực'); assert.equal(store.locationConfirmed, false); assert.equal(store.onboardingCompleted, false);
  };
  try {
    await act(async () => root.render(React.createElement(Harness)));
    await act(async () => store.validateOnboardingOptions([{ id: 7, name: 'Hà Nội' }], ['spa']));
    assertEmpty(); assert.equal(store.currentUser, null);
    assert.equal(localStorage.getItem('beautylink_v2_user_selected_city'), null);
    await act(async () => store.setCurrentUser({ id: 42, name: 'Customer', role: 'CUSTOMER' }));
    await act(async () => store.completeOnboarding(7, 'Hà Nội', 'spa'));
    const raw = localStorage.getItem(ONBOARDING_KEY)!;
    assert.equal(delay, ONBOARDING_TTL);
    assert.equal(store.onboardingCompleted, true);
    now += ONBOARDING_TTL - 1; await act(async () => refresh());
    assert.equal(store.onboardingCompleted, true); assert.equal(localStorage.getItem(ONBOARDING_KEY), raw);
    assert.equal(delay, 1);
    now++; await act(async () => deadline());
    await act(async () => document.dispatchEvent(new dom.window.Event('visibilitychange')));
    assertEmpty(); assert.equal((store.currentUser as CurrentUser | null)?.id, 42); assert.equal(localStorage.getItem('unrelated-preference'), 'preserve');
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ ...snapshot, completedAt: now, locationId: 999 }));
    await act(async () => window.dispatchEvent(new dom.window.StorageEvent('storage', { key: ONBOARDING_KEY })));
    assertEmpty();
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ ...snapshot, completedAt: now, category: 'unknown' }));
    await act(async () => refresh()); assertEmpty();
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ ...snapshot, completedAt: now }));
    await act(async () => window.dispatchEvent(new dom.window.StorageEvent('storage', { key: ONBOARDING_KEY })));
    assert.equal(store.onboardingCompleted, true);
    await act(async () => store.resetOnboarding()); assertEmpty();
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
