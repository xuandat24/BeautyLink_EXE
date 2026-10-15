import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { HotDealsSection } from '../src/components/HotDealsSection';
import type { HotDeal } from '../src/types';

const deal = (index: number): HotDeal => ({
  id: `deal-${index}`,
  serviceId: index,
  supplierId: 100 + index,
  title: `Dịch vụ ${index}`,
  brandName: `Đối tác ${index}`,
  brandLogo: `ĐT${index}`,
  image: `https://example.test/deal-${index}.jpg`,
  originalPrice: 200_000,
  salePrice: 150_000,
  discountPercent: 25,
  rating: 4.8,
  reviewsCount: 10,
  duration: '60 phút',
  category: 'spa',
  highlightText: '',
});

test('hot deals has two responsive pages and partner names open shops without booking', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    sessionStorage: dom.window.sessionStorage,
    localStorage: dom.window.localStorage,
  });
  Object.defineProperty(dom.window, 'innerWidth', { value: 1280, configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });

  const root = createRoot(document.getElementById('root')!);
  const selectedPartners: number[] = [];
  const bookedServices: number[] = [];
  const deals = Array.from({ length: 25 }, (_, index) => deal(index + 1));

  try {
    await act(async () => {
      root.render(
        React.createElement(HotDealsSection, {
          deals,
          onBookDeal(item: HotDeal) {
            bookedServices.push(item.serviceId!);
          },
          onAddToCart() {},
          onViewAll() {},
          onSelectPartner(item: HotDeal) {
            selectedPartners.push(item.supplierId!);
          },
        })
      );
    });

    assert.equal(document.querySelectorAll('[aria-label^="Xem trang khuyến mãi"]').length, 2);
    const firstPageTitles = [...document.querySelectorAll('h3')].map((item) => item.textContent);
    assert.ok(firstPageTitles.includes('Dịch vụ 1'));
    assert.equal(firstPageTitles.includes('Dịch vụ 11'), false);

    const partnerButton = document.querySelector('[aria-label="Mở cửa hàng Đối tác 1"]') as HTMLButtonElement;
    assert.ok(partnerButton);
    await act(async () => partnerButton.click());
    assert.deepEqual(selectedPartners, [101]);
    assert.deepEqual(bookedServices, []);

    const nextButton = document.querySelector('[aria-label="Xem thêm khuyến mãi tiếp theo"]') as HTMLButtonElement;
    assert.ok(nextButton);
    await act(async () => nextButton.click());
    const secondPageTitles = [...document.querySelectorAll('h3')].map((item) => item.textContent);
    assert.ok(secondPageTitles.includes('Dịch vụ 11'));
    assert.equal(secondPageTitles.includes('Dịch vụ 21'), false);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
