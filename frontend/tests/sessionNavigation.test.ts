import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useSessionLifecycle } from '../src/hooks/useSessionLifecycle';
import { beautyApi } from '../src/services/beautyApi';
import { clearSession, installToken, getSessionToken, IDLE_MS } from '../src/lib/authSession';
import { sessionToken } from './sessionFixtures';

test('focus/file-picker and deduplicated background checks preserve verified UI; expiry still locks it', async t => {
  let now = 1792800000000; t.mock.method(Date, 'now', () => now);
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document,
    localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const original = { me: beautyApi.me, logoutSession: beautyApi.logoutSession };
  let calls = 0, finish!: (user: any) => void, fail!: (error: Error) => void;
  beautyApi.me = () => { calls++; return new Promise((resolve, reject) => { finish = resolve; fail = reject; }); };
  beautyApi.logoutSession = async () => {};
  clearSession(false); const token = sessionToken(); installToken(token);
  const phases: string[] = [];
  function Harness() {
    const session = useSessionLifecycle(); phases.push(session.phase);
    return React.createElement('div', null, session.phase);
  }
  const root = createRoot(document.getElementById('root')!);
  const user = { id: 42, fullName: 'Verified Customer', role: 'CUSTOMER' };
  try {
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Harness))));
    assert.equal(document.body.textContent, 'checking'); assert.equal(calls, 1);
    await act(async () => finish(user)); phases.length = 0;
    await act(async () => { window.dispatchEvent(new dom.window.Event('focus')); document.dispatchEvent(new dom.window.Event('visibilitychange')); });
    assert.equal(calls, 1, 'immediate file-picker return does not request /me again');
    now += 60_000;
    await act(async () => { window.dispatchEvent(new dom.window.Event('focus')); document.dispatchEvent(new dom.window.Event('visibilitychange')); });
    assert.equal(calls, 2, 'focus and visibility share one in-flight verification');
    assert.equal(document.body.textContent, 'verified');
    assert.ok(phases.every(phase => phase === 'verified'), 'background check never remounts protected page');
    await act(async () => finish(user));
    now += 60_000;
    await act(async () => window.dispatchEvent(new dom.window.Event('focus')));
    await act(async () => fail(new Error('network unavailable')));
    assert.equal(document.body.textContent, 'locked'); assert.equal(getSessionToken(), token);
    now += IDLE_MS;
    await act(async () => window.dispatchEvent(new dom.window.Event('focus')));
    assert.equal(getSessionToken(), null); assert.equal(document.body.textContent, 'anonymous');
  } finally {
    await act(async () => root.unmount()); Object.assign(beautyApi, original); clearSession(false); dom.window.close();
  }
});
