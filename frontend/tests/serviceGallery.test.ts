import assert from 'node:assert/strict';
import { test } from 'node:test';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { ServiceImageUploadField } from '../src/components/ServiceImageUploadField';
import { SupplierServiceModal } from '../src/components/SupplierDashboard';
import type { BackendService } from '../src/types';

test('service gallery supports multi-select, atomic failure, cover and removal without fake defaults', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const root = createRoot(document.getElementById('root')!);
  const originalReader = globalThis.FileReader;
  const originalImage = globalThis.Image;
  let imageNumber = 0;
  class Reader {
    result = 'data:image/png;base64,source'; onload?: () => void;
    readAsDataURL() { this.onload?.(); }
  }
  class ImageStub {
    naturalWidth = 800; naturalHeight = 600; onload?: () => void;
    set src(_value: string) { this.onload?.(); }
  }
  Object.assign(globalThis, { FileReader: Reader, Image: ImageStub });
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype, 'getContext', { value: () => ({ fillRect() {}, drawImage() {}, fillStyle: '' }) });
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype, 'toDataURL', { value: () => `data:image/jpeg;base64,image${++imageNumber}` });
  let images: string[] = [];
  const busy: boolean[] = [];
  function Harness() {
    const [value, setValue] = useState<string[]>([]); images = value;
    return React.createElement(ServiceImageUploadField, { value, onChange: setValue, onBusyChange: value => busy.push(value) });
  }
  const choose = async (types: string[]) => act(async () => {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    assert.equal(input.multiple, true);
    Object.defineProperty(input, 'files', { configurable: true, value: types.map((type, i) => new dom.window.File(['image'], `photo${i}`, { type })) });
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  try {
    await act(async () => root.render(React.createElement(Harness)));
    assert.equal(document.querySelector('img'), null);
    await choose(['image/png', 'image/jpeg']);
    assert.equal(images.length, 2);
    assert.deepEqual(busy, [true, false]);
    assert.equal(document.querySelectorAll('img').length, 2);
    const originalFirst = images[0];
    await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Đặt làm ảnh bìa')!.click());
    assert.notEqual(images[0], originalFirst);
    assert.equal(images[1], originalFirst);
    const before = [...images];
    await choose(['image/png', 'image/svg+xml']);
    assert.deepEqual(images, before, 'failed batch must not partially replace existing gallery');
    assert.ok(document.querySelector('[role="alert"]'));
    await choose(Array(5).fill('image/png'));
    assert.match(document.querySelector('[role="alert"]')!.textContent!, /tối đa 6/);
    assert.deepEqual(images, before);
    await act(async () => (document.querySelector('button[aria-label="Xóa ảnh 1"]') as HTMLButtonElement).click());
    assert.equal(images.length, 1);
    assert.equal(images[0], originalFirst);
  } finally {
    await act(async () => root.unmount());
    Object.assign(globalThis, { FileReader: originalReader, Image: originalImage }); dom.window.close();
  }
});

test('service form starts without Unsplash defaults and reopening edit reads backend gallery', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  const root = createRoot(document.getElementById('root')!);
  const props = { categories: [], onClose() {}, async onSave() {} };
  try {
    await act(async () => root.render(React.createElement(SupplierServiceModal, { ...props, service: null })));
    assert.equal(document.querySelectorAll('img').length, 0);
    assert.match(document.body.textContent!, /Chưa chọn ảnh dịch vụ/);
    const service = { id: 1, imageUrl: 'https://example.com/cover.jpg', imageUrls: ['https://example.com/cover.jpg', 'https://example.com/second.jpg'] } as BackendService;
    await act(async () => root.render(React.createElement(SupplierServiceModal, { ...props, key: 'edit', service })));
    assert.equal(document.querySelectorAll('img').length, 2);
    assert.equal(document.querySelectorAll('img')[1].src, service.imageUrls![1]);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
