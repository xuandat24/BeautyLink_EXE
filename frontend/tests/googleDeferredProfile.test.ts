import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { BookingContactDialog } from '../src/components/BookingContactDialog';
import { beautyApi } from '../src/services/beautyApi';
import { mapBackendUser } from '../src/lib/authUser';

const environment = () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document,
    sessionStorage: dom.window.sessionStorage, localStorage: dom.window.localStorage });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  return { dom, root: createRoot(document.getElementById('root')!) };
};

test('verified Google profile maps without inventing phone, password or birth date', () => {
  const user = mapBackendUser({ id: 7, fullName: 'Google User', email: 'google@example.com', role: 'CUSTOMER',
    phone: null, dateOfBirth: null, bookingContactConfirmed: false });
  assert.equal(user.phone, undefined);
  assert.equal(user.dateOfBirth, undefined);
  assert.equal(user.bookingContactConfirmed, false);
  assert.equal(user.role, 'CUSTOMER');
});

test('existing phone is shown for confirmation and duplicate clicks make one persistence request', async () => {
  const { dom, root } = environment();
  const original = beautyApi.updateCustomerProfile;
  const calls: unknown[] = [];
  let finish!: (value: { user: any; accessToken: string }) => void;
  beautyApi.updateCustomerProfile = async data => {
    calls.push(data);
    return new Promise(resolve => { finish = resolve; });
  };
  try {
    let completed = 0;
    await act(async () => root.render(React.createElement(BookingContactDialog, {
      currentUser: { id: 7, name: 'Google User', email: 'google@example.com', phone: '0901234567', role: 'CUSTOMER' },
      onCancel() {}, onComplete() { completed++; },
    })));
    assert.match(document.body.textContent || '', /0901234567/);
    assert.match(document.body.textContent || '', /Chúng tôi sẽ sử dụng số điện thoại này/);
    const confirm = [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Xác nhận')!;
    await act(async () => { confirm.click(); confirm.click(); });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { phone: '0901234567', confirmBookingContact: true });
    await act(async () => finish({ accessToken: 'new-token', user: { id: 7, fullName: 'Google User', email: 'google@example.com', phone: '0901234567', role: 'CUSTOMER', bookingContactConfirmed: true } }));
    assert.equal(completed, 1);
  } finally {
    beautyApi.updateCustomerProfile = original;
    await act(async () => root.unmount());
    dom.window.close();
  }
});

test('cancelling profile completion does not save or discard caller-owned booking state', async () => {
  const { dom, root } = environment();
  const original = beautyApi.updateCustomerProfile;
  let calls = 0, cancelled = 0;
  beautyApi.updateCustomerProfile = async () => { calls++; throw new Error('must not save'); };
  try {
    await act(async () => root.render(React.createElement(BookingContactDialog, {
      currentUser: { id: 8, name: 'No Phone', email: 'new@example.com', role: 'CUSTOMER' },
      onCancel() { cancelled++; }, onComplete() {},
    })));
    const cancel = [...document.querySelectorAll('button')].find(button => button.textContent?.includes('Hủy và quay lại'))!;
    await act(async () => cancel.click());
    assert.equal(cancelled, 1);
    assert.equal(calls, 0);
  } finally {
    beautyApi.updateCustomerProfile = original;
    await act(async () => root.unmount());
    dom.window.close();
  }
});
