import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import App from '../src/App';
import { beautyApi } from '../src/services/beautyApi';
import { installToken, getSessionToken } from '../src/lib/authSession';
import { sessionToken } from './sessionFixtures';

test('public home renders during silent session verification; protected route stays locked', async () => {
  const original = {
    me: beautyApi.me,
    categories: beautyApi.categories,
    locations: beautyApi.locations,
    homepageServices: beautyApi.homepageServices,
  };
  let finishVerification!: (value: { id: number; fullName: string; role: 'CUSTOMER' }) => void;
  let failVerification!: (reason: Error) => void;
  beautyApi.me = () => new Promise((resolve, reject) => { finishVerification = resolve; failVerification = reject; });
  beautyApi.categories = async () => [];
  beautyApi.locations = async () => [];
  beautyApi.homepageServices = async () => [];
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/#home', pretendToBeVisual: true });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document,
    localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  dom.window.scrollTo = () => {};
  let googleDisableCalls = 0;
  Object.assign(dom.window, { google: { accounts: { id: { disableAutoSelect: () => { googleDisableCalls++; } } } } });
  const token = sessionToken();
  installToken(token);
  const root = createRoot(document.getElementById('root')!);
  try {
    await act(async () => root.render(React.createElement(App)));
    assert.match(document.body.textContent ?? '', /BeautyLink/, 'public home appears before /me resolves');
    assert.doesNotMatch(document.body.textContent ?? '', /Đang xác minh phiên đăng nhập/);
    assert.equal(getSessionToken(), token);

    await act(async () => { window.location.hash = 'account'; window.dispatchEvent(new dom.window.Event('hashchange')); });
    assert.match(document.body.textContent ?? '', /Đang kiểm tra quyền truy cập/);
    assert.doesNotMatch(document.body.textContent ?? '', /Thông tin tài khoản/);

    await act(async () => failVerification(new Error('network unavailable')));
    assert.match(document.body.textContent ?? '', /Chưa thể xác minh phiên đăng nhập/);
    assert.equal(getSessionToken(), token, 'temporary failure retains recoverable credential');
    await act(async () => { window.location.hash = 'home'; window.dispatchEvent(new dom.window.Event('hashchange')); });
    assert.match(document.body.textContent ?? '', /BeautyLink/, 'public page stays usable after network failure');
    assert.ok(document.querySelector('aside button')?.textContent?.includes('Thử lại'));
    await act(async () => document.querySelector<HTMLButtonElement>('aside button')!.click());
    await act(async () => finishVerification({ id: 42, fullName: 'Verified Customer', role: 'CUSTOMER' }));
    assert.doesNotMatch(document.body.textContent ?? '', /Đang kiểm tra quyền truy cập/);
    await act(async () => document.querySelector<HTMLButtonElement>('button[title="Đăng xuất"]')!.click());
    assert.equal(googleDisableCalls, 1, 'BeautyLink logout records sign-out with official GIS API');
    assert.equal(getSessionToken(), null);
  } finally {
    await act(async () => root.unmount());
    Object.assign(beautyApi, original);
    dom.window.close();
  }
});
