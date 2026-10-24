import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import axios from 'axios';
import { sessionToken } from './sessionFixtures';
import { TOKEN_KEY, SESSION_META_KEY, AUTH_EVENT_KEY, IDLE_MS, clearSession, installToken, initializeSession,
  getSessionToken, recordUserActivity, sessionSnapshot, setSessionPhase, receiveSessionStorage, isAuthStorageEvent } from '../src/lib/authSession';
import { apiClient, beautyApi } from '../src/services/beautyApi';

const sidA = '11111111-1111-4111-8111-111111111111';
const sidB = '22222222-2222-4222-8222-222222222222';
function env() {
  const dom = new JSDOM('', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  clearSession(false); return dom;
}
test('persistent legacy credentials and cached profiles never restore identity', () => {
  const dom = env();
  try {
    localStorage.setItem(TOKEN_KEY, sessionToken());
    localStorage.setItem('beautylink_session_user', '{"id":1,"role":"ADMIN"}');
    localStorage.setItem('beautylink_cart_items_v4:1', 'keep');
    initializeSession();
    assert.equal(getSessionToken(), null); assert.equal(sessionSnapshot().phase, 'anonymous');
    assert.equal(localStorage.getItem(TOKEN_KEY), null);
    assert.equal(localStorage.getItem('beautylink_session_user'), null);
    assert.equal(localStorage.getItem('beautylink_cart_items_v4:1'), 'keep');
  } finally { dom.window.close(); }
});
test('reopen with restored sessionStorage requires verification and expired/suspended tabs cannot renew', t => {
  t.mock.method(Date, 'now', () => 1792800000000);
  const dom = env(); const now = Date.now();
  try {
    const token = sessionToken(); installToken(token); initializeSession();
    assert.equal(sessionSnapshot().phase, 'checking');
    assert.equal(recordUserActivity(now + 1), false, 'unverified profile cannot authorize activity');
    setSessionPhase('verified', token);
    assert.equal(getSessionToken(now + IDLE_MS - 1), token);
    assert.equal(recordUserActivity(now + IDLE_MS), false);
    assert.equal(getSessionToken(now + 8 * 3600000), null);
    assert.equal(sessionSnapshot().phase, 'anonymous');
  } finally { dom.window.close(); }
});
test('real activity extends idle only; token rotation retains deadlines and cross-tab hints never carry credentials', t => {
  t.mock.method(Date, 'now', () => 1792800000000);
  const dom = env(); const now = Date.now();
  try {
    installToken(sessionToken(sidA, now + 3600000));
    assert.equal(recordUserActivity(now + 300000), true);
    const before = JSON.parse(sessionStorage.getItem(SESSION_META_KEY)!);
    installToken(sessionToken(sidA, now + 7200000));
    assert.deepEqual(JSON.parse(sessionStorage.getItem(SESSION_META_KEY)!), before);
    assert.equal(localStorage.getItem(TOKEN_KEY), null);
    assert.equal(getSessionToken(now + 300000 + IDLE_MS - 1) != null, true);
    assert.equal(getSessionToken(now + 300000 + IDLE_MS), null);
    installToken(sessionToken(sidB, now + 3600000));
    receiveSessionStorage(new dom.window.StorageEvent('storage', { key: AUTH_EVENT_KEY, newValue: JSON.stringify({ sid: sidA }) }));
    assert.ok(getSessionToken());
    receiveSessionStorage(new dom.window.StorageEvent('storage', { key: AUTH_EVENT_KEY, newValue: JSON.stringify({ sid: sidB }) }));
    assert.equal(getSessionToken(), null);
    assert.equal(isAuthStorageEvent(new dom.window.StorageEvent('storage', { key: `beautylink_activity:${sidB}` })), false);
  } finally { dom.window.close(); }
});
test('same-sid tab consumes newer activity, absolute deadline still wins, malformed metadata fails closed', t => {
  t.mock.method(Date, 'now', () => 1792800000000);
  const dom = env(); const now = Date.now();
  try {
    const token = sessionToken(sidA, now + 10000); installToken(token);
    const meta = JSON.parse(sessionStorage.getItem(SESSION_META_KEY)!);
    meta.lastActivityAt = now - 599000; sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
    localStorage.setItem(`beautylink_activity:${sidA}`, String(now));
    assert.equal(getSessionToken(now + 2000), token);
    assert.equal(getSessionToken(now + 10000), null);
    installToken(sessionToken()); sessionStorage.setItem(SESSION_META_KEY, '{bad');
    assert.equal(getSessionToken(), null);
  } finally { dom.window.close(); }
});
test('401 invalidates, 403 does not logout, network/500 lock, stale response cannot clear account B', async () => {
  const dom = env(); const previous = apiClient.defaults.adapter;
  try {
    for (const status of [403, 500, 0, 401]) {
      const token = sessionToken(); installToken(token);
      apiClient.defaults.adapter = async config => {
        throw new axios.AxiosError('test failure', status ? 'ERR_BAD_RESPONSE' : 'ERR_NETWORK', config, undefined,
          status ? { data: {}, status, statusText: 'test', headers: {}, config } : undefined);
      };
      await assert.rejects(beautyApi.me());
      assert.equal(getSessionToken(), status === 401 ? null : token);
      assert.equal(sessionSnapshot().phase, status === 401 ? 'anonymous' : status === 403 ? 'verified' : 'locked');
    }
    const first = sessionToken(sidA), second = sessionToken(sidB); installToken(first);
    apiClient.defaults.adapter = async config => {
      installToken(second);
      throw new axios.AxiosError('old account', 'ERR_BAD_RESPONSE', config, undefined,
        { data: {}, status: 401, statusText: 'Unauthorized', headers: {}, config });
    };
    await assert.rejects(beautyApi.me()); assert.equal(getSessionToken(), second);
  } finally { apiClient.defaults.adapter = previous; dom.window.close(); }
});
test('locked/expired session blocks protected payment while public catalog and explicit login remain usable', async () => {
  const dom = env(); const previous = apiClient.defaults.adapter; let calls = 0;
  try {
    const token = sessionToken(); installToken(token); setSessionPhase('locked', token);
    apiClient.defaults.adapter = async config => {
      calls++; assert.equal(config.headers.Authorization, undefined);
      return { data: [], status: 200, statusText: 'OK', headers: {}, config };
    };
    await assert.rejects(apiClient.post('/v1/payments/payos/create', { bookingId: 42 }));
    assert.equal(calls, 0);
    await beautyApi.categories(); await apiClient.post('/v1/auth/google', { credential: 'test-only' });
    assert.equal(calls, 2);
    clearSession(); await assert.rejects(apiClient.post('/v1/bookings', {})); assert.equal(calls, 2);
    assert.equal(window.location.search, '');
  } finally { apiClient.defaults.adapter = previous; dom.window.close(); }
});
test('late profile and sign-in responses cannot resurrect logout or overwrite account switch', async t => {
  t.mock.method(Date, 'now', () => 1792800000000);
  const dom = env(); const previous = apiClient.defaults.adapter;
  let finish!: () => void;
  apiClient.defaults.adapter = config => new Promise(resolve => { finish = () => resolve({
    data: { user: { id: 1, role: 'CUSTOMER' }, accessToken: sessionToken(sidA) }, status: 200, statusText: 'OK', headers: {}, config }); });
  try {
    for (const switchAccount of [false, true]) for (const update of [
      () => beautyApi.updateCustomerProfile({ fullName: 'Update' }),
      () => beautyApi.updateCustomerAvatar('https://example.com/avatar.png'),
    ]) {
      installToken(sessionToken(sidA));
      const response = update();
      await new Promise(resolve => setImmediate(resolve));
      if (switchAccount) installToken(sessionToken(sidB)); else clearSession();
      finish(); await assert.rejects(response, /Phiên đã thay đổi/);
      assert.equal(getSessionToken(), switchAccount ? sessionToken(sidB) : null);
    }
    clearSession();
    const login = beautyApi.login('test@example.com', 'test-only');
    await new Promise(resolve => setImmediate(resolve));
    clearSession(); finish(); await assert.rejects(login, /đăng nhập cũ/);
    assert.equal(getSessionToken(), null);
  } finally { apiClient.defaults.adapter = previous; dom.window.close(); }
});
test('logout fails closed even if storage removal throws while reads still work', t => {
  const dom = env();
  try {
    installToken(sessionToken());
    const original = dom.window.Storage.prototype.removeItem;
    t.mock.method(dom.window.Storage.prototype, 'removeItem', () => { throw new Error('restricted storage'); });
    clearSession(); assert.equal(getSessionToken(), null); assert.equal(sessionSnapshot().phase, 'anonymous');
    t.mock.method(dom.window.Storage.prototype, 'removeItem', original);
  } finally { dom.window.close(); }
});

test('resource upload network/503 errors do not invalidate a verified session; avatar 401 does', async () => {
  const dom = env(); const previous = apiClient.defaults.adapter;
  try {
    for (const status of [0, 503, 403, 401]) {
      const token = sessionToken(); installToken(token);
      apiClient.defaults.adapter = async config => {
        throw new axios.AxiosError('upload failed', status ? 'ERR_BAD_RESPONSE' : 'ERR_NETWORK', config, undefined,
          status ? { data: {}, status, statusText: 'failed', headers: {}, config } : undefined);
      };
      await assert.rejects(beautyApi.updateCustomerAvatar('https://example.com/avatar.png'));
      assert.equal(getSessionToken(), status === 401 ? null : token);
      assert.equal(sessionSnapshot().phase, status === 401 ? 'anonymous' : 'verified');
    }
  } finally { apiClient.defaults.adapter = previous; dom.window.close(); }
});
