import assert from 'node:assert/strict';
import { test } from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { HotDeal } from '../src/types';

const deal: HotDeal = { id: 'service-42', serviceId: 42, supplierId: 7, title: 'Dịch vụ kiểm thử',
  brandName: 'Salon kiểm thử', brandLogo: '', image: 'https://example.com/image.jpg', originalPrice: 200000,
  salePrice: 150000, discountPercent: 25, rating: 0, reviewsCount: 0, duration: '60 phút', category: 'spa', highlightText: '' };
const cartKey = 'beautylink_cart_items_v2';

test('cart starts empty without explicit additions and stays isolated on logout/storage removal', async t => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document,
    localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  localStorage.setItem('beautylink_v2_user_cart_items', JSON.stringify({ data: [{ deal, quantity: 1 }], timestamp: Date.now(), ttl: 0, hash: 'old-cache' }));
  const { useBeautyStore, loadCartFromStorage } = await import('../src/store/beautyStore.ts');
  const { Header } = await import('../src/components/Header.tsx');
  let state!: ReturnType<typeof useBeautyStore>;
  function Harness() {
    state = useBeautyStore();
    return React.createElement(React.Fragment, {},
      React.createElement(Header, { cartCount: state.cartItems.length, onOpenCart() {}, onOpenPartnerModal() {}, onOpenAuthModal() {}, onSearch() {} }),
      React.createElement('output', {}, String(state.cartItems.length)));
  }
  const root = createRoot(document.getElementById('root')!);
  await act(async () => root.render(React.createElement(Harness)));
  try {
    await t.test('legacy cache alone must not populate a new visitor cart', () => {
      assert.equal(state.cartItems.length, 0);
      assert.equal(document.querySelector('output')?.textContent, '0');
      assert.equal(document.querySelector('button[title="Giỏ dịch vụ & Lịch hẹn"] span'), null);
    });
    await act(async () => state.clearCart());
    await t.test('explicit additions persist but logout clears only cart and session data', async () => {
      localStorage.setItem('unrelated-preference', 'preserve-me');
      await act(async () => state.addToCart(deal));
      assert.equal(state.cartItems.length, 1);
      assert.equal(document.querySelector('button[title="Giỏ dịch vụ & Lịch hẹn"] span')?.textContent, '1');
      assert.equal(JSON.parse(localStorage.getItem(cartKey) ?? '[]').length, 1);
      assert.deepEqual(loadCartFromStorage(), [{ deal, quantity: 1 }], 'refresh may restore the explicitly added cart');
      await act(async () => state.logout());
      assert.equal(state.cartItems.length, 0);
      assert.deepEqual(JSON.parse(localStorage.getItem(cartKey) ?? '[]'), []);
      assert.equal(localStorage.getItem('unrelated-preference'), 'preserve-me');
      assert.equal(document.querySelector('button[title="Giỏ dịch vụ & Lịch hẹn"] span'), null);
      assert.equal(localStorage.getItem('beautylink_v2_user_cart_items'), null, 'old cache must not resurrect after a clear');
    });
    await t.test('missing, malformed and invalid rows cannot create phantom items', async () => {
      for (const raw of ['not-json', '{}', '[null,{},1]', JSON.stringify([{ deal, quantity: 0 }]),
        JSON.stringify([{ deal: { ...deal, salePrice: '150000' }, quantity: 1 }])]) {
        localStorage.setItem(cartKey, raw);
        assert.deepEqual(loadCartFromStorage(), []);
      }
      localStorage.removeItem(cartKey);
      assert.deepEqual(loadCartFromStorage(), []);
      localStorage.setItem(cartKey, JSON.stringify([null, { deal, quantity: 1 }]));
      assert.deepEqual(loadCartFromStorage(), [{ deal, quantity: 1 }]);
      await act(async () => state.clearCart());
    });
    await t.test('same-account profile refresh keeps cart, switching account clears it', async () => {
      await act(async () => state.setCurrentUser({ id: 10, name: 'Khách A', role: 'CUSTOMER' }));
      await act(async () => state.addToCart(deal));
      await act(async () => state.setCurrentUser({ id: '10', name: 'Khách A cập nhật', role: 'CUSTOMER' }));
      assert.equal(state.cartItems.length, 1);
      await act(async () => state.setCurrentUser({ id: 11, name: 'Khách B', role: 'CUSTOMER' }));
      assert.equal(state.cartItems.length, 0);
      assert.deepEqual(loadCartFromStorage(), []);
      await act(async () => state.logout());
    });
    await t.test('guest cart survives intentional login, but session removal clears it', async () => {
      await act(async () => state.addToCart(deal));
      await act(async () => state.setCurrentUser({ id: 10, name: 'Khách A', role: 'CUSTOMER' }));
      assert.equal(state.cartItems.length, 1);
      await act(async () => state.setCurrentUser(null));
      assert.equal(state.cartItems.length, 0);
    });
    await act(async () => state.clearCart());
    await t.test('clearing cart storage in another tab clears the badge', async () => {
      await act(async () => state.addToCart(deal));
      await act(async () => window.dispatchEvent(new dom.window.StorageEvent('storage', { key: cartKey, newValue: null, storageArea: localStorage })));
      assert.equal(state.cartItems.length, 0);
    });
    await t.test('invalid cross-tab rows and a full storage clear remove the badge', async () => {
      await act(async () => window.dispatchEvent(new dom.window.StorageEvent('storage', { key: cartKey, newValue: '[{}]', storageArea: localStorage })));
      assert.equal(state.cartItems.length, 0);
      await act(async () => state.addToCart(deal));
      await act(async () => window.dispatchEvent(new dom.window.StorageEvent('storage', { key: null, newValue: null, storageArea: localStorage })));
      assert.equal(state.cartItems.length, 0);
    });
  } finally {
    await act(async () => { state.clearCart(); root.unmount(); });
    dom.window.close();
  }
});
