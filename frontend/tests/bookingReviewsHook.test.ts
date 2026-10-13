import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useBookingReviews } from '../src/hooks/useBookingReviews.ts';
import { ReviewListStatus } from '../src/components/ReviewListStatus.tsx';
import { beautyApi, apiClient, type PublicReviewPage } from '../src/services/beautyApi.ts';

test('scoped client uses correct endpoints and rejects invalid IDs', async () => {
  const original = apiClient.defaults.adapter;
  const urls: string[] = [];
  apiClient.defaults.adapter = async config => {
    urls.push(config.url ?? '');
    assert.deepEqual(config.params, { page: 1, size: 20 });
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  try {
    await beautyApi.publicBookingReviews('SERVICE', 12, 1);
    await beautyApi.publicBookingReviews('SUPPLIER', 42, 1);
    await assert.rejects(() => beautyApi.publicBookingReviews('SERVICE', NaN));
    assert.deepEqual(urls, ['/v1/services/12/reviews', '/v1/suppliers/42/reviews']);
  } finally { apiClient.defaults.adapter = original; }
});

test('hook covers loading, error, retry, empty, pagination, missing ID and stale scope', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const root = createRoot(document.getElementById('root')!);
  const original = beautyApi.publicBookingReviews;
  const calls: Array<{ target: string; id: number; page: number; resolve: (page: PublicReviewPage) => void; reject: (error: Error) => void }> = [];
  beautyApi.publicBookingReviews = (target, id, page = 0) => new Promise((resolve, reject) => calls.push({ target, id, page, resolve, reject }));
  const empty: PublicReviewPage = { content: [], totalElements: 0, totalPages: 0, page: 0, size: 20, rating: 0 };
  function Harness({ supplierId, serviceId, target }: { supplierId?: number; serviceId?: number; target?: 'SERVICE' | 'SUPPLIER' }) {
    const state = useBookingReviews(supplierId, serviceId, 0, target);
    assert.equal('key' in state, false, 'internal request identity must not become a React key prop');
    return React.createElement('div', {}, React.createElement(ReviewListStatus, state), ...state.reviews.map(r => React.createElement('p', { key: r.id }, r.content)));
  }
  const render = (supplierId?: number, serviceId?: number, target?: 'SERVICE' | 'SUPPLIER') => act(async () => { root.render(React.createElement(Harness, { supplierId, serviceId, target })); });
  const click = async (text: string) => act(async () => { [...document.querySelectorAll('button')].find(b => b.textContent === text)!.click(); });
  try {
    await render(42, 12);
    assert.match(document.body.textContent ?? '', /Đang tải/);
    assert.deepEqual([calls[0].target, calls[0].id], ['SERVICE', 12]);
    await act(async () => calls[0].reject(new Error('Provider unavailable')));
    assert.match(document.querySelector('[role="alert"]')?.textContent ?? '', /Provider unavailable/);
    await click('Thử lại');
    await act(async () => calls[1].resolve(empty));
    assert.match(document.body.textContent ?? '', /Chưa có đánh giá/);
    await render(42);
    assert.deepEqual([calls[2].target, calls[2].id], ['SUPPLIER', 42]);
    await act(async () => calls[2].resolve({ ...empty, totalElements: 21, totalPages: 2, rating: 4 }));
    await click('Trang sau');
    assert.equal(calls[3].page, 1);
    await render(43);
    await act(async () => calls[3].resolve({ ...empty, content: [{ id: 1, targetType: 'SUPPLIER', rating: 5, comment: 'OLD SCOPE', reviewerDisplayName: 'Masked', serviceId: 12, serviceName: '', createdAt: '2026-10-13' }] }));
    assert.doesNotMatch(document.body.textContent ?? '', /OLD SCOPE/);
    await act(async () => calls[4].resolve(empty));
    const count = calls.length;
    await render(undefined, NaN);
    assert.equal(calls.length, count);
    assert.match(document.body.textContent ?? '', /Không xác định/);
    await render(42, undefined, 'SERVICE');
    assert.equal(calls.length, count, 'missing service ID must not fall back to supplier endpoint');
  } finally { await act(async () => root.unmount()); beautyApi.publicBookingReviews = original; dom.window.close(); }
});
