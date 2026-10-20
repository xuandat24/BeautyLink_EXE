import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { PublicImageUploadField } from '../src/components/PublicImageUploadField.tsx';
import { SupplierDashboard } from '../src/components/SupplierDashboard.tsx';
import { beautyApi, apiClient } from '../src/services/beautyApi.ts';

test('public image picker prepares image, keeps old value on error, exposes labels and busy state', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const root = createRoot(document.getElementById('root')!);
  const originalReader = globalThis.FileReader;
  const originalImage = globalThis.Image;
  const changes: string[] = [];
  const busy: boolean[] = [];
  let finishRead: (() => void) | undefined;
  class Reader {
    result = 'data:image/png;base64,source';
    onload?: () => void;
    readAsDataURL() { finishRead = () => this.onload?.(); }
  }
  class ImageStub {
    naturalWidth = 2000;
    naturalHeight = 1000;
    onload?: () => void;
    set src(_value: string) { this.onload?.(); }
  }
  Object.assign(globalThis, { FileReader: Reader, Image: ImageStub });
  const canvas = dom.window.HTMLCanvasElement.prototype;
  Object.defineProperty(canvas, 'getContext', { value: () => ({ fillRect() {}, drawImage() {}, fillStyle: '' }) });
  Object.defineProperty(canvas, 'toDataURL', { value: () => 'data:image/jpeg;base64,prepared' });
  const render = () => act(async () => {
    root.render(React.createElement(PublicImageUploadField, {
      label: 'Ảnh dịch vụ', value: 'https://example.com/old.jpg',
      onChange: value => changes.push(value), onBusyChange: value => busy.push(value),
    }));
  });
  const select = async (type: string) => act(async () => {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new dom.window.File(['image'], 'test', { type })], configurable: true });
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  try {
    await render();
    assert.match(document.querySelector('label')?.textContent ?? '', /Ảnh dịch vụ/);
    await select('image/svg+xml');
    assert.match(document.querySelector('[role="alert"]')?.textContent ?? '', /JPG, PNG hoặc WEBP/);
    assert.equal(document.querySelector('img')?.getAttribute('src'), 'https://example.com/old.jpg');
    assert.equal(changes.length, 0);
    await select('image/png');
    assert.equal((document.querySelector('input[type="file"]') as HTMLInputElement).disabled, true);
    assert.match(document.body.textContent ?? '', /Đang chuẩn bị/);
    await act(async () => finishRead?.());
    assert.deepEqual(changes, ['data:image/jpeg;base64,prepared']);
    assert.deepEqual(busy, [true, false, true, false]);
    assert.match(document.body.textContent ?? '', /tải lên khi bạn lưu/);
    assert.doesNotMatch(document.body.textContent ?? '', /Đã tải lên thành công/);
    await select('image/png');
    await act(async () => root.unmount());
    await act(async () => finishRead?.());
    assert.equal(changes.length, 1, 'unmounted image preparation cannot change a different form');
  } finally {
    await act(async () => root.unmount());
    Object.assign(globalThis, { FileReader: originalReader, Image: originalImage });
    dom.window.close();
  }
});

test('image-bearing save APIs preserve existing paths/payload and allow bounded backend upload time', async () => {
  const dom = new JSDOM('', { url: 'http://localhost' });
  Object.assign(globalThis, { sessionStorage: dom.window.sessionStorage, localStorage: dom.window.localStorage });
  const previous = apiClient.defaults.adapter;
  const calls: string[] = [];
  apiClient.defaults.adapter = async config => {
    calls.push(config.url ?? '');
    assert.equal(config.timeout, config.url?.includes('/supplier/services') ? 120000 : 30000);
    assert.doesNotMatch(JSON.stringify(config.data), /api_secret|signature|api_key/);
    return { data: { id: 1, addressLine: 'Address' }, status: 200, statusText: 'OK', headers: {}, config };
  };
  try {
    await beautyApi.updateSupplierProfile({ name: 'Salon', imageUrl: 'data:image/jpeg;base64,test' });
    await beautyApi.createPractitioner({ name: 'Lan Anh', avatarUrl: 'data:image/jpeg;base64,test' });
    await beautyApi.updatePractitioner(1, { name: 'Lan Anh' });
    await beautyApi.createSupplierService({ name: 'Service' });
    await beautyApi.updateSupplierService(1, { name: 'Service' });
    assert.equal(calls.length, 5);
  } finally { apiClient.defaults.adapter = previous; dom.window.close(); }
});

test('practitioner provider failure stays in the form and never fabricates a saved practitioner', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const root = createRoot(document.getElementById('root')!);
  const originals = {
    supplierProfile: beautyApi.supplierProfile, supplierPractitioners: beautyApi.supplierPractitioners,
    supplierBookings: beautyApi.supplierBookings, supplierServices: beautyApi.supplierServices,
    createPractitioner: beautyApi.createPractitioner,
  };
  beautyApi.supplierProfile = async () => ({ id: 1, userId: 1, name: 'Test Salon', businessType: 'Spa', locationId: 1, address: 'Address', verificationStatus: 'VERIFIED' });
  beautyApi.supplierPractitioners = async () => [];
  beautyApi.supplierBookings = async () => [];
  beautyApi.supplierServices = async () => [];
  let requests = 0;
  let rejectSave: (reason: Error) => void = () => {};
  beautyApi.createPractitioner = async () => {
    requests += 1;
    return new Promise((_resolve, reject) => { rejectSave = reject; });
  };
  const click = async (text: string) => act(async () => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent?.trim() === text);
    assert.ok(button, `Missing button ${text}`);
    button.click();
  });
  try {
    await act(async () => root.render(React.createElement(SupplierDashboard, { onBack() {}, onLogout() {} })));
    await click('Đội ngũ');
    await click('Thêm chuyên viên');
    const form = document.querySelector('[role="dialog"] form')!;
    await act(async () => {
      // Event bypasses native required validation to exercise save/error handling, not input validation.
      form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    });
    assert.equal(requests, 1, 'double submission issues one save request');
    await act(async () => rejectSave(new Error('Cloudinary unavailable')));
    assert.ok(document.querySelector('[role="dialog"]'), 'failed save must leave modal open');
    assert.match(document.querySelector('[role="alert"]')?.textContent ?? '', /Cloudinary unavailable/);
    assert.equal(document.querySelectorAll('article').length, 0, 'failed API must not add a practitioner card');
  } finally {
    await act(async () => root.unmount());
    Object.assign(beautyApi, originals);
    dom.window.close();
  }
});
