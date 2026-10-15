import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { CategoryServicePage } from '../src/components/CategoryServicePage';
import { beautyApi, DEFAULT_CATEGORIES } from '../src/services/beautyApi';
import type { BackendService, NewPartner } from '../src/types';

const service = (id: number, supplierId: number, supplierName: string, name: string): BackendService => ({
  id,
  name,
  price: 100_000 + id,
  durationMinutes: 60,
  imageUrl: `https://example.test/service-${id}.jpg`,
  categorySlug: 'nails',
  categoryName: 'Nail',
  rating: 4.8,
  supplierId,
  supplierName,
  supplierAddress: 'Hà Nội',
  supplierImageUrl: `https://example.test/supplier-${supplierId}.jpg`,
  supplierBusinessType: 'Nail salon',
  supplierReviewCount: 12,
  supplierRating: 4.9,
});

test('category browsing shows one card per partner and opens that partner shop', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    sessionStorage: dom.window.sessionStorage,
    localStorage: dom.window.localStorage,
  });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });

  const root = createRoot(document.getElementById('root')!);
  const originalServices = beautyApi.services;
  beautyApi.services = async () => [
    service(101, 7, 'Nail nhà Chuối', 'Sơn gel'),
    service(102, 7, 'Nail nhà Chuối', 'Đính đá'),
    service(103, 8, 'Mây Nail Studio', 'Chăm sóc móng'),
  ];
  const selected: NewPartner[] = [];

  try {
    await act(async () => {
      root.render(
        React.createElement(CategoryServicePage, {
          category: DEFAULT_CATEGORIES.find((item) => item.slug === 'nails')!,
          locationId: null,
          locationLabel: 'Hà Nội',
          onBack() {},
          onSelectPartner(partner: NewPartner) {
            selected.push(partner);
          },
        })
      );
    });

    const partnerHeadings = [...document.querySelectorAll('h3')].map((item) => item.textContent);
    assert.equal(partnerHeadings.filter((name) => name === 'Nail nhà Chuối').length, 1);
    assert.equal(partnerHeadings.filter((name) => name === 'Mây Nail Studio').length, 1);
    assert.equal(document.body.textContent?.includes('2 dịch vụ'), true);

    const partnerButton = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Nail nhà Chuối')
    );
    assert.ok(partnerButton);
    await act(async () => partnerButton.click());
    assert.equal(selected[0]?.supplierId, 7);
    assert.equal(selected[0]?.serviceId, 101);
  } finally {
    await act(async () => root.unmount());
    beautyApi.services = originalServices;
    dom.window.close();
  }
});
