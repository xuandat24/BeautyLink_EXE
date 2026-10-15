import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { AuthPage } from '../src/components/AuthPage';
import { beautyApi, getAuthErrorMessage } from '../src/services/beautyApi';

async function environment() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const requestAnimationFrame = (callback: FrameRequestCallback) => dom.window.setTimeout(() => callback(Date.now()), 0);
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    sessionStorage: dom.window.sessionStorage,
    localStorage: dom.window.localStorage,
    requestAnimationFrame,
  });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  Object.defineProperty(dom.window, 'requestAnimationFrame', { value: requestAnimationFrame, configurable: true });
  Object.defineProperty(dom.window, 'cancelAnimationFrame', { value: dom.window.clearTimeout.bind(dom.window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  return { dom, root: createRoot(document.getElementById('root')!) };
}

async function enter(input: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(domInputPrototype(input), 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
}

function domInputPrototype(input: HTMLInputElement) {
  return Object.getPrototypeOf(input) as HTMLInputElement;
}

test('mobile login preserves the exact controlled password through visibility toggles and one submit', async () => {
  const { dom, root } = await environment();
  const originalLogin = beautyApi.login;
  const calls: Array<{ identifier: string; password: string }> = [];
  let finish!: (value: { user: { id: number; fullName: string; role: 'CUSTOMER' }; accessToken: string }) => void;
  beautyApi.login = (identifier, password) => {
    calls.push({ identifier, password });
    return new Promise(resolve => { finish = resolve; });
  };
  try {
    await act(async () => root.render(React.createElement(AuthPage, {
      initialMode: 'login', onBackToHome() {}, onSuccess() {},
    })));
    const identifier = document.querySelector<HTMLInputElement>('#customer-identifier')!;
    const password = document.querySelector<HTMLInputElement>('#customer-password')!;
    assert.equal(identifier.autocomplete, 'username');
    assert.equal(identifier.name, 'username');
    assert.equal(password.autocomplete, 'current-password');
    assert.equal(password.name, 'password');
    assert.equal(password.type, 'password');

    const exactPassword = 'Mobile Password 123! ';
    await enter(identifier, '0901234567');
    await enter(password, exactPassword);
    assert.equal(password.value, exactPassword);

    const show = document.querySelector<HTMLButtonElement>('button[aria-label="Hiện mật khẩu"]')!;
    await act(async () => { show.click(); await new Promise(resolve => dom.window.setTimeout(resolve, 1)); });
    assert.equal(document.querySelector<HTMLInputElement>('#customer-password'), password);
    assert.equal(password.type, 'text');
    assert.equal(password.value, exactPassword);
    await act(async () => { document.querySelector<HTMLButtonElement>('button[aria-label="Ẩn mật khẩu"]')!.click(); await new Promise(resolve => dom.window.setTimeout(resolve, 1)); });
    assert.equal(password.type, 'password');
    assert.equal(password.value, exactPassword);

    const submit = document.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    await act(async () => { submit.click(); submit.click(); });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { identifier: '0901234567', password: exactPassword });
    await act(async () => finish({ user: { id: 1, fullName: 'Mobile Test', role: 'CUSTOMER' }, accessToken: 'test-token' }));
  } finally {
    beautyApi.login = originalLogin;
    await act(async () => root.unmount());
    dom.window.close();
  }
});

test('authentication errors distinguish credentials, throttling, network and server failures', () => {
  const axiosError = (status?: number, code?: string) => ({ isAxiosError: true, code, message: code, response: status ? { status, data: {} } : undefined });
  assert.match(getAuthErrorMessage(axiosError(401)), /không chính xác/);
  assert.match(getAuthErrorMessage(axiosError(429)), /quá nhiều lần/);
  assert.match(getAuthErrorMessage(axiosError(undefined, 'ERR_NETWORK')), /kết nối/);
  assert.match(getAuthErrorMessage(axiosError(503)), /tạm gián đoạn/);
});
