import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { AvatarPickerModal } from '../src/components/AvatarPickerModal';

test('avatar validates file, waits for confirmation, preserves preview on failure and prevents duplicate saves', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const originals = { FileReader: globalThis.FileReader, Image: globalThis.Image };
  class Reader { result = 'data:image/png;base64,source'; onload?: () => void; readAsDataURL() { this.onload?.(); } }
  class ImageStub { naturalWidth = 100; naturalHeight = 100; onload?: () => void; set src(_value: string) { this.onload?.(); } }
  Object.assign(globalThis, { FileReader: Reader, Image: ImageStub });
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype, 'getContext', { value: () => ({ fillRect() {}, drawImage() {} }) });
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype, 'toDataURL', { value: () => 'data:image/jpeg;base64,prepared' });
  let saves = 0, closed = 0, resolve!: () => void, reject!: (reason: Error) => void;
  const root = createRoot(document.getElementById('root')!);
  const click = async (text: string) => act(async () => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === text); assert.ok(button); button.click();
  });
  const select = async (type: string, size = 4) => act(async () => {
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new dom.window.File(['data'], 'avatar.png', { type }); Object.defineProperty(file, 'size', { value: size });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  try {
    await act(async () => root.render(React.createElement(AvatarPickerModal, {
      isOpen: true, currentAvatar: 'https://example.com/old.png', onClose: () => { closed++; },
      onSaveAvatar: async image => { saves++; assert.equal(image, 'data:image/jpeg;base64,prepared'); await new Promise<void>((ok, bad) => { resolve = ok; reject = bad; }); },
    })));
    await click('Tải từ thiết bị');
    await select('image/svg+xml'); assert.match(document.body.textContent ?? '', /Chỉ chấp nhận/);
    await select('image/png', 6 * 1024 * 1024); assert.match(document.body.textContent ?? '', /5 MB/);
    assert.equal(document.querySelector('img')?.getAttribute('src'), 'https://example.com/old.png');
    await select('image/png'); assert.equal(saves, 0);
    assert.equal(document.querySelector('img')?.getAttribute('src'), 'data:image/jpeg;base64,prepared');
    await act(async () => {
      const save = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Lưu ảnh đại diện'))!;
      save.click(); save.click();
    });
    assert.equal(saves, 1); assert.equal(closed, 0); assert.match(document.body.textContent ?? '', /Đang lưu ảnh/);
    await act(async () => reject(new Error('Cloudinary unavailable')));
    assert.equal(closed, 0); assert.match(document.body.textContent ?? '', /Cloudinary unavailable/);
    assert.equal(document.querySelector('img')?.getAttribute('src'), 'data:image/jpeg;base64,prepared');
    await click('Lưu ảnh đại diện'); await act(async () => resolve()); assert.equal(closed, 1); assert.equal(saves, 2);
    assert.ok([...document.querySelectorAll('button')].every(button => button.type === 'button'));
  } finally { await act(async () => root.unmount()); Object.assign(globalThis, originals); dom.window.close(); }
});
