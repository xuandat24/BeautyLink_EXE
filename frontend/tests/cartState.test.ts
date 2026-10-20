import assert from 'node:assert/strict';
import { test } from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { CurrentUser, HotDeal } from '../src/types';

const deal: HotDeal = { id: 'service-42', serviceId: 42, supplierId: 7, title: 'Dịch vụ kiểm thử',
  brandName: 'Salon kiểm thử', brandLogo: '', image: '/assets/beauty-placeholder.svg', originalPrice: 200000,
  salePrice: 150000, discountPercent: 25, rating: 0, reviewsCount: 0, duration: '60 phút', category: 'spa', highlightText: '' };
const a: CurrentUser = { id: 10, name: 'Khách A', role: 'CUSTOMER' };
const b: CurrentUser = { id: 11, name: 'Khách B', role: 'CUSTOMER' };
const key = (id: number) => `beautylink_cart_items_v4:${id}`;
const stored = (ownerId: string, items: unknown[]) => JSON.stringify({ version: 4, ownerId, source: 'user-action', items });

test('account carts persist independently without legacy restoration UI or auth changes', async t => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document,
    localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  localStorage.setItem('beautylink_cart_items_v2', JSON.stringify([{ deal, quantity: 1 }]));
  localStorage.setItem('beautylink_cart_items_v3', JSON.stringify({ version: 3, source: 'user-action', items: [{ deal, quantity: 1 }] }));
  const { useBeautyStore, loadCartFromStorage } = await import('../src/store/beautyStore.ts');
  const { setAccessToken, getAccessToken } = await import('../src/services/beautyApi.ts');
  const { CartDrawer } = await import('../src/components/CartDrawer.tsx');
  let state!: ReturnType<typeof useBeautyStore>;
  function Harness() {
    state = useBeautyStore();
    return React.createElement(CartDrawer, { isOpen: true, items: state.cartItems, onClose() {},
      onRemoveItem: state.removeFromCart, onClearCart: state.clearCart, onCheckout() { assert.fail('No checkout expected'); } });
  }
  const root = createRoot(document.getElementById('root')!);
  await act(async () => root.render(React.createElement(Harness)));
  const action = async (fn: () => void) => { await act(async () => fn()); };
  const storageEvent = async (storageKey: string | null, newValue: string | null) => action(() => {
    window.dispatchEvent(new dom.window.StorageEvent('storage', { key: storageKey, newValue, storageArea: localStorage }));
  });
  try {
    await t.test('fresh guest is empty and has no restore controls despite old carts', () => {
      assert.deepEqual(state.cartItems, []);
      assert.match(document.body.textContent ?? '', /Dịch vụ đã chọn \(0\)/);
      assert.doesNotMatch(document.body.textContent ?? '', /Khôi phục|Không khôi phục|phiên bản trước/);
      assert.deepEqual(loadCartFromStorage(null), []);
      assert.ok(localStorage.getItem('beautylink_cart_items_v2'));
    });
    await t.test('guest selection is memory-only and moves on intentional login', async () => {
      await action(() => state.addToCart(deal));
      assert.equal(state.cartItems.length, 1);
      assert.equal(localStorage.getItem(key(10)), null);
      assert.deepEqual(loadCartFromStorage(null), []);
      await action(() => state.setCurrentUser(a));
      assert.deepEqual(loadCartFromStorage(a), [{ deal, quantity: 1 }]);
    });
    await t.test('profile refresh keeps cart and remember-me token/session unchanged', async () => {
      setAccessToken('synthetic-test-token', true);
      await action(() => state.setCurrentUser({ ...a, id: '10', name: 'Tên mới' }));
      assert.equal(state.cartItems.length, 1);
      assert.equal(getAccessToken(), 'synthetic-test-token');
      assert.equal(JSON.parse(localStorage.getItem('beautylink_session_user')!).id, '10');
      assert.equal(sessionStorage.getItem('beautylink_session_user'), null);
      assert.deepEqual(loadCartFromStorage(), [{ deal, quantity: 1 }], 'page reload reads the saved account cart');
    });
    await t.test('logout empties visible cart but re-login restores saved selections', async () => {
      await action(() => state.logout());
      assert.equal(getAccessToken(), null);
      assert.deepEqual(state.cartItems, []);
      assert.deepEqual(loadCartFromStorage(), []);
      assert.equal(loadCartFromStorage(a).length, 1);
      await action(() => state.setCurrentUser(a));
      assert.equal(state.cartItems.length, 1);
      assert.ok(sessionStorage.getItem('beautylink_session_user'));
    });
    await t.test('different accounts never inherit each other cart', async () => {
      await action(() => state.setCurrentUser(b));
      assert.equal(state.cartItems.length, 0);
      await action(() => state.addToCart({ ...deal, id: 'service-99' }));
      await action(() => state.setCurrentUser(a));
      assert.equal(state.cartItems[0].deal.id, deal.id);
      await action(() => state.setCurrentUser(b));
      assert.equal(state.cartItems[0].deal.id, 'service-99');
    });
    await t.test('remove and clear affect only the active owner', async () => {
      await action(() => state.removeFromCart('service-99'));
      assert.deepEqual(loadCartFromStorage(b), []);
      assert.equal(loadCartFromStorage(a).length, 1);
      await action(() => state.addToCart(deal));
      await action(() => state.clearCart());
      assert.deepEqual(loadCartFromStorage(b), []);
      assert.equal(loadCartFromStorage(a).length, 1);
    });
    await t.test('wrong-owner and malformed storage fail closed', () => {
      for (const raw of ['not-json', '{}', stored('10', [{ deal, quantity: 1 }]),
        stored('11', [{ deal, quantity: 0 }]), stored('11', [{ deal: { ...deal, salePrice: '123' }, quantity: 1 }])]) {
        localStorage.setItem(key(11), raw);
        assert.deepEqual(loadCartFromStorage(b), []);
      }
      localStorage.removeItem(key(11));
    });
    await t.test('guest selections merge once with existing account cart', async () => {
      await action(() => state.logout());
      await action(() => state.addToCart(deal));
      await action(() => state.setCurrentUser(a));
      assert.equal(state.cartItems[0].quantity, 2);
      await action(() => state.setCurrentUser(a));
      assert.equal(state.cartItems[0].quantity, 2);
    });
    await t.test('cross-tab updates apply only to current account and validate owner', async () => {
      await storageEvent(key(11), stored('11', [{ deal, quantity: 5 }]));
      assert.equal(state.cartItems[0].quantity, 2);
      await storageEvent(key(10), stored('10', [{ deal, quantity: 3 }]));
      assert.equal(state.cartItems[0].quantity, 3);
      await storageEvent(key(10), stored('11', [{ deal, quantity: 5 }]));
      assert.deepEqual(state.cartItems, []);
      await action(() => state.addToCart(deal));
      await storageEvent(key(10), null);
      assert.deepEqual(state.cartItems, []);
    });
    await t.test('missing stable account ID cannot read or write a shared cart', async () => {
      await action(() => state.setCurrentUser({ name: 'No ID', role: 'CUSTOMER' }));
      await action(() => state.addToCart(deal));
      assert.deepEqual(loadCartFromStorage({ name: 'No ID', role: 'CUSTOMER' }), []);
      assert.equal(localStorage.getItem('beautylink_cart_items_v4:undefined'), null);
      await action(() => state.logout());
      assert.deepEqual(state.cartItems, []);
    });
    await t.test('full storage clear empties active cart', async () => {
      await action(() => state.setCurrentUser(a));
      await action(() => state.addToCart(deal));
      await storageEvent(null, null);
      assert.deepEqual(state.cartItems, []);
    });
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
