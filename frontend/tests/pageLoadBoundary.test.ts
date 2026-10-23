import assert from 'node:assert/strict';
import { test } from 'node:test';
import React, { act, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { PageLoadBoundary } from '../src/components/PageLoadBoundary';

test('deferred page shows loading, renders once downloaded and gives recovery UI on failure', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const root = createRoot(document.getElementById('root')!);
  let resolve!: (value: { default: React.FC }) => void;
  const Deferred = lazy(() => new Promise<{ default: React.FC }>(done => { resolve = done; }));
  const render = (child: React.ReactNode, key: string) => act(async () => {
    root.render(React.createElement(PageLoadBoundary, { key }, child));
  });
  try {
    await render(React.createElement(Deferred), 'success');
    assert.match(document.querySelector('[role="status"]')!.textContent!, /Đang tải trang/);
    await act(async () => resolve({ default: () => React.createElement('h1', {}, 'Trang đã tải') }));
    assert.equal(document.querySelector('[role="status"]'), null);
    assert.equal(document.querySelector('h1')?.textContent, 'Trang đã tải');

    const expected = new Error('test-only chunk download failure');
    const Broken = lazy(async () => { throw expected; });
    const previousError = console.error;
    console.error = (value, ...args) => { if (value !== expected) previousError(value, ...args); };
    try { await render(React.createElement(Broken), 'failure'); }
    finally { console.error = previousError; }
    assert.match(document.querySelector('[role="alert"]')!.textContent!, /Không thể tải trang/);
    assert.equal(document.querySelector('button')?.textContent, 'Tải lại trang');
    assert.doesNotMatch(document.body.textContent!, /test-only chunk download failure/);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
