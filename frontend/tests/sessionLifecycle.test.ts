import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import axios from 'axios';
import { useSessionLifecycle } from '../src/hooks/useSessionLifecycle';
import { useBeautyStore } from '../src/store/beautyStore';
import { apiClient } from '../src/services/beautyApi';
import { installToken, getSessionToken, sessionSnapshot, AUTH_EVENT_KEY, SESSION_META_KEY } from '../src/lib/authSession';
import { sessionToken } from './sessionFixtures';

test('restored UI waits for /me; network/500/403 lock without logout; explicit retry, 401, sleep and logout', async t => {
  let now = 1792800000000; t.mock.method(Date, 'now', () => now);
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/?bookingPayment=42#bookings', pretendToBeVisual: true });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  localStorage.setItem('beautylink_session_user', '{"id":999,"role":"ADMIN"}');
  localStorage.setItem('beautylink_cart_items_v4:42', '{"version":4,"ownerId":"42","source":"user-action","items":[]}');
  const token = sessionToken(); installToken(token);
  const old = apiClient.defaults.adapter;
  let status = 500, calls = 0;
  apiClient.defaults.adapter = async config => {
    calls++;
    if (status !== 200) throw new axios.AxiosError('failure', 'ERR_TEST', config, undefined,
      status ? { data: {}, status, statusText: 'test', headers: {}, config } : undefined);
    return { data: { id: 42, fullName: 'Verified customer', role: 'CUSTOMER' }, status: 200, statusText: 'OK', headers: {}, config };
  };
  let session!: ReturnType<typeof useSessionLifecycle>, store!: ReturnType<typeof useBeautyStore>;
  const firstChildPhases: string[] = [];
  function Child({ phase }: { phase: string }) {
    React.useEffect(() => { firstChildPhases.push(phase); }, []);
    return null;
  }
  function Harness() {
    session = useSessionLifecycle(); store = useBeautyStore();
    return React.createElement('div', null, React.createElement(Child, { phase: session.phase }), session.phase === 'verified' ? store.currentUser?.name : 'private hidden');
  }
  const root = createRoot(document.getElementById('root')!);
  try {
    await act(async () => root.render(React.createElement(Harness)));
    assert.deepEqual(firstChildPhases, ['checking'], 'payment return child must not see anonymous before restoration starts');
    assert.equal(session.phase, 'locked'); assert.equal(getSessionToken(), token);
    assert.equal(store.currentUser, null); assert.equal(document.body.textContent, 'private hidden');
    assert.equal(calls, 1, 'no failure retry loop');
    for (const failure of [0, 403]) {
      status = failure; await act(async () => session.retry());
      assert.equal(session.phase, 'locked'); assert.equal(getSessionToken(), token);
      assert.equal(document.body.textContent, 'private hidden');
    }
    status = 200; await act(async () => session.retry());
    assert.equal(session.phase, 'verified'); assert.equal(document.body.textContent, 'Verified customer');
    const lastActivity = JSON.parse(sessionStorage.getItem(SESSION_META_KEY)!).lastActivityAt;
    await act(async () => document.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true })));
    assert.equal(JSON.parse(sessionStorage.getItem(SESSION_META_KEY)!).lastActivityAt, lastActivity, 'synthetic/passive events do not keep alive');
    now += 60_000; // Focus revalidation is deduplicated for one minute after a successful check.
    status = 401; await act(async () => window.dispatchEvent(new dom.window.Event('focus')));
    assert.equal(sessionSnapshot().phase, 'anonymous'); assert.equal(getSessionToken(), null);
    assert.equal(store.currentUser, null); assert.match(window.location.search, /bookingPayment=42/, 'server booking hint is preserved');
    status = 200; await act(async () => { installToken(sessionToken()); session.retry(); });
    await act(async () => window.dispatchEvent(new dom.window.Event('focus')));
    now += 600000;
    await act(async () => window.dispatchEvent(new dom.window.Event('focus')));
    assert.equal(getSessionToken(), null); assert.equal(store.currentUser, null);
    await act(async () => { installToken(sessionToken()); store.setCurrentUser({ id: 42, role: 'CUSTOMER', name: 'Customer' }); });
    await act(async () => store.logout());
    assert.equal(store.currentUser, null); assert.equal(getSessionToken(), null);
    assert.ok(localStorage.getItem('beautylink_cart_items_v4:42'));
    assert.ok(localStorage.getItem(AUTH_EVENT_KEY));
  } finally { await act(async () => root.unmount()); apiClient.defaults.adapter = old; dom.window.close(); }
});

test('late /me for account A cannot overwrite newly authenticated account B', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  const old = apiClient.defaults.adapter;
  let finish!: () => void;
  apiClient.defaults.adapter = config => new Promise(resolve => { finish = () => resolve({
    data: { id: 1, fullName: 'Wrong late user', role: 'ADMIN' }, status: 200, statusText: 'OK', headers: {}, config }); });
  installToken(sessionToken());
  let store!: ReturnType<typeof useBeautyStore>;
  function Harness() { useSessionLifecycle(); store = useBeautyStore(); return null; }
  const root = createRoot(document.getElementById('root')!);
  try {
    await act(async () => root.render(React.createElement(Harness)));
    await act(async () => {
      installToken(sessionToken('22222222-2222-4222-8222-222222222222'));
      store.setCurrentUser({ id: 2, name: 'Account B', role: 'CUSTOMER' });
      finish();
    });
    assert.equal(store.currentUser?.id, 2); assert.equal(store.currentUser?.name, 'Account B');
  } finally { await act(async () => root.unmount()); apiClient.defaults.adapter = old; dom.window.close(); }
});
